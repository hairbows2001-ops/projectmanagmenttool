/*
 * Team workspace server: serves the app and the private API. No packages needed (Node.js 22.13+).
 *
 *   npm start                     start (settings: see server/config.js)
 *   node server/admin.js help     create the first invitations, reset links, backups
 *
 * Only the app's own files (index.html, css/, js/) are served. The database, documents,
 * backups and server code are never reachable from the web.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const dbm = require('./db');
const auth = require('./auth');
const backup = require('./backup');
const { createWorkspace, ApiError, MAX_FILE_BYTES } = require('./workspace');
const configLoader = require('./config');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const COOKIE = 'whs';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

/**
 * Recovery on hosts where you cannot run commands while the app is stopped: put a backup file at
 * DATA_DIR/restore-this.tar and restart. It is restored before the database opens, and renamed so it
 * is not restored twice. The data it replaces is moved aside, not deleted.
 */
function restorePending(dataDir) {
  const pending = path.join(dataDir, 'restore-this.tar');
  if (!fs.existsSync(pending)) return;
  const when = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    const r = backup.restoreBackup(pending, dataDir);
    fs.renameSync(pending, path.join(dataDir, 'restored-' + when + '.tar'));
    console.log('Restored restore-this.tar (' + r.restoredFiles + ' documents). Previous data moved to ' + r.previousDataMovedTo);
  } catch (e) {
    fs.renameSync(pending, path.join(dataDir, 'restore-failed-' + when + '.tar'));
    console.error('Could not restore restore-this.tar, so the existing data was kept: ' + e.message);
  }
}

function createApp(cfg) {
  const config = cfg || configLoader.load();
  restorePending(config.dataDir);
  const db = dbm.open(config.dataDir);
  const ws = createWorkspace(db, config.dataDir);
  ws.load();
  ws.migrate();

  // ---------- helpers ----------

  function send(res, status, body, headers) {
    const h = Object.assign({}, SECURITY_HEADERS, config.secure ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}, headers || {});
    if (body === undefined || body === null) { res.writeHead(status, h); res.end(); return; }
    if (Buffer.isBuffer(body) || typeof body === 'string') { res.writeHead(status, h); res.end(body); return; }
    h['Content-Type'] = 'application/json; charset=utf-8';
    h['Cache-Control'] = 'no-store';
    res.writeHead(status, h);
    res.end(JSON.stringify(body));
  }

  function cookies(req) {
    const out = {};
    String(req.headers.cookie || '').split(';').forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
  }

  function sessionCookie(token, maxAgeSeconds) {
    return COOKIE + '=' + (token || '') + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAgeSeconds + (config.secure ? '; Secure' : '');
  }

  function clientIp(req) {
    if (config.trustProxy) {
      const f = req.headers['fly-client-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (f) return f;
    }
    return req.socket.remoteAddress || '';
  }

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const tooLarge = () => new ApiError(413, 'This is too large to upload (the limit is ' + Math.round(limit / 1024 / 1024) + ' MB).', { error: 'validation', fields: { file: 'Files can be up to 10 MB.' } });
      req.on('data', (c) => {
        size += c.length;
        // Over the limit: stop keeping the data, but read the rest so the browser gets a clear answer.
        if (size > limit * 2) { reject(tooLarge()); req.destroy(); return; }
        if (size <= limit) chunks.push(c);
      });
      req.on('end', () => (size > limit ? reject(tooLarge()) : resolve(Buffer.concat(chunks))));
      req.on('error', reject);
    });
  }

  async function readJson(req, limit) {
    const buf = await readBody(req, limit || 1024 * 1024);
    try { return buf.length ? JSON.parse(buf.toString('utf8')) : {}; } catch (e) { throw new ApiError(400, 'The request could not be read.'); }
  }

  function currentUser(req) {
    return auth.sessionUser(db, cookies(req)[COOKIE]);
  }

  function requireUser(req) {
    const u = currentUser(req);
    if (!u) throw new ApiError(401, 'Please sign in.', { error: 'signin' });
    return u;
  }

  function requireOwner(req) {
    const u = requireUser(req);
    if (u.role !== 'owner') throw new ApiError(403, 'Only Maha (workspace owner) can do this.', { error: 'permission' });
    return u;
  }

  /** Blocks other websites from making changes on someone's behalf (cross-site request forgery). */
  function checkSameOrigin(req) {
    if (req.headers['x-requested-with'] !== 'WH') throw new ApiError(403, 'Request blocked.');
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch (e) { /* invalid */ }
      if (host !== req.headers.host) throw new ApiError(403, 'Request blocked.');
    }
  }

  function payload(user) {
    return Object.assign({ user: auth.publicUser(user) }, ws.viewFor(user));
  }

  const link = (kind, token) => config.publicUrl + '/#/' + (kind === 'invite' ? 'join' : 'reset') + '/' + token;

  // ---------- API ----------

  async function api(req, res, url) {
    const p = url.pathname;
    const m = req.method;
    if (m !== 'GET' && m !== 'HEAD') checkSameOrigin(req);

    if (p === '/api/health') return send(res, 200, { ok: true });

    if (p === '/api/session' && m === 'GET') return send(res, 200, payload(requireUser(req)));

    if (p === '/api/signin' && m === 'POST') {
      const body = await readJson(req);
      const u = auth.signIn(db, body, clientIp(req));
      const token = auth.createSession(db, u.id);
      return send(res, 200, payload(u), { 'Set-Cookie': sessionCookie(token, 30 * 24 * 3600) });
    }

    if (p === '/api/signout' && m === 'POST') {
      auth.endSession(db, cookies(req)[COOKIE]);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (p === '/api/token' && m === 'POST') {
      const body = await readJson(req);
      if (!['invite', 'reset'].includes(body.kind)) throw new ApiError(400, 'Unknown link.');
      return send(res, 200, auth.describeToken(db, body.token, body.kind));
    }

    if (p === '/api/join' && m === 'POST') {
      const body = await readJson(req);
      const u = auth.acceptInvite(db, body.token, body);
      ws.bump();
      const token = auth.createSession(db, u.id);
      return send(res, 200, payload(u), { 'Set-Cookie': sessionCookie(token, 30 * 24 * 3600) });
    }

    if (p === '/api/reset' && m === 'POST') {
      const body = await readJson(req);
      const u = auth.useResetLink(db, body.token, body);
      const token = auth.createSession(db, u.id);
      return send(res, 200, payload(u), { 'Set-Cookie': sessionCookie(token, 30 * 24 * 3600) });
    }

    if (p === '/api/state' && m === 'GET') {
      const u = requireUser(req);
      const since = Number(url.searchParams.get('since'));
      if (url.searchParams.has('since') && since === ws.rev()) return send(res, 204);
      return send(res, 200, payload(u));
    }

    if (p === '/api/commands' && m === 'POST') {
      const u = requireUser(req);
      const body = await readJson(req);
      try {
        const out = ws.runCommands(u, body.base, body.commands);
        return send(res, 200, Object.assign(payload(u), out));
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) return send(res, 409, Object.assign(payload(u), { error: 'conflict', message: e.message }));
        throw e;
      }
    }

    if (p === '/api/files' && m === 'POST') {
      const u = requireUser(req);
      const name = decodeURIComponent(String(req.headers['x-file-name'] || 'file'));
      const buf = await readBody(req, MAX_FILE_BYTES + 1);
      const doc = ws.addFile(u, url.searchParams.get('task'), name, String(req.headers['content-type'] || ''), buf, Number(url.searchParams.get('base')));
      return send(res, 200, Object.assign(payload(u), { doc }));
    }

    const fileMatch = p.match(/^\/api\/files\/([\w-]+)$/);
    if (fileMatch && (m === 'GET' || m === 'HEAD')) {
      const u = requireUser(req);
      const f = ws.fileFor(u, fileMatch[1]);
      // HEAD: the browser checks access before downloading (no file data sent).
      const data = m === 'HEAD' ? null : fs.readFileSync(f.path);
      const ascii = f.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      return send(res, 200, data, {
        'Content-Type': f.type || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(f.name),
        'Content-Length': f.size, 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "sandbox; default-src 'none'"
      });
    }

    // ---------- workspace settings (Maha) ----------

    if (p === '/api/admin/team' && m === 'GET') {
      requireOwner(req);
      return send(res, 200, { users: auth.listUsers(db), invites: auth.listInvites(db) });
    }

    if (p === '/api/admin/invites' && m === 'POST') {
      const u = requireOwner(req);
      const body = await readJson(req);
      // Maha can invite managers. Executive and owner accounts are created by whoever runs the
      // server (node server/admin.js), so no one can give themselves Carla's permissions in the app.
      const inv = auth.createInvite(db, { name: body.name, title: body.title, email: body.email, role: 'manager', createdBy: u.id });
      return send(res, 200, { link: link('invite', inv.token), expiresAt: inv.expiresAt, invites: auth.listInvites(db) });
    }

    const revokeMatch = p.match(/^\/api\/admin\/invites\/(\d+)\/revoke$/);
    if (revokeMatch && m === 'POST') {
      requireOwner(req);
      auth.revokeInvite(db, revokeMatch[1]);
      return send(res, 200, { invites: auth.listInvites(db) });
    }

    const userMatch = p.match(/^\/api\/admin\/users\/([\w-]+)\/(active|reset-link)$/);
    if (userMatch && m === 'POST') {
      const owner = requireOwner(req);
      const target = auth.getUser(db, userMatch[1]);
      if (!target) throw new ApiError(404, 'Account not found.');
      if (target.role !== 'manager' || target.id === owner.id) throw new ApiError(403, 'Owner and executive accounts are managed by whoever runs the server (see docs/pilot-setup.md).');
      if (userMatch[2] === 'active') {
        const body = await readJson(req);
        auth.setActive(db, target.id, !!body.active);
        ws.bump();
        return send(res, 200, { users: auth.listUsers(db) });
      }
      const r = auth.createResetLink(db, { userId: target.id, createdBy: owner.id });
      return send(res, 200, { link: link('reset', r.token), expiresAt: r.expiresAt });
    }

    if (p === '/api/admin/export' && m === 'GET') {
      const u = requireOwner(req);
      const data = Buffer.from(JSON.stringify(ws.exportTasks(u), null, 1));
      return send(res, 200, data, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="workspace-tasks-' + new Date().toISOString().slice(0, 10) + '.json"', 'Cache-Control': 'no-store' });
    }

    if (p === '/api/admin/import' && m === 'POST') {
      const u = requireOwner(req);
      const body = await readJson(req, 80 * 1024 * 1024);
      const report = ws.importTasks(u, body, Number(url.searchParams.get('base')));
      return send(res, 200, Object.assign(payload(u), { report }));
    }

    if (p === '/api/admin/backup' && m === 'GET') {
      requireOwner(req);
      const file = backup.createBackup(db, config.dataDir, { prefix: 'workspace-backup' });
      const data = fs.readFileSync(file);
      fs.rmSync(file, { force: true });
      return send(res, 200, data, { 'Content-Type': 'application/x-tar', 'Content-Disposition': 'attachment; filename="' + path.basename(file) + '"', 'Cache-Control': 'no-store' });
    }

    throw new ApiError(404, 'Not found.');
  }

  // ---------- app files ----------

  function staticFile(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    if (p === '/js/config.js') {
      return send(res, 200, "/* Set by the team server. */\n(function (WH) { WH.config = { mode: 'team' }; })(globalThis.WH = globalThis.WH || {});\n", { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-cache' });
    }
    const allowed = p === '/index.html' || /^\/(css|js)\/[\w./-]+\.(css|js)$/.test(p);
    const file = path.normalize(path.join(ROOT, p));
    if (!allowed || p.includes('..') || !file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      let body = data;
      if (p === '/index.html') body = Buffer.from(data.toString('utf8').replace(/<title>[^<]*<\/title>/, '<title>Communications Workspace</title>'));
      send(res, 200, body, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    });
  }

  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, 'Bad request'); }
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return staticFile(req, res, url);
    }
    api(req, res, url).catch((e) => {
      if (e instanceof ApiError || e instanceof auth.AuthError) {
        return send(res, e.status, { error: e.error || (e.status === 401 ? 'signin' : 'error'), message: e.message, fields: e.fields });
      }
      console.error(new Date().toISOString(), req.method, url.pathname, e);
      send(res, 500, { error: 'server', message: 'Something went wrong on the server. Nothing was saved. Try again; if it keeps happening, contact whoever runs the server.' });
    });
  });

  let timer = null;
  function startBackups() {
    const run = () => {
      try {
        const f = backup.dailyBackup(db, config.dataDir);
        if (f) console.log(new Date().toISOString(), 'Daily backup written:', path.basename(f));
      } catch (e) { console.error('Daily backup failed:', e); }
    };
    run();
    timer = setInterval(run, 60 * 60 * 1000);
    timer.unref();
  }

  function close() {
    if (timer) clearInterval(timer);
    return new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  }

  return { server, db, ws, config, close, startBackups };
}

if (require.main === module) {
  const app = createApp();
  if (app.config.autoBackup) app.startBackups();
  app.server.listen(app.config.port, app.config.host, () => {
    console.log('Communications Workspace (team) running at ' + app.config.publicUrl);
    console.log('Data folder: ' + app.config.dataDir);
    if (!auth.listUsers(app.db).length) console.log('No accounts yet. Create the first invitation with: node server/admin.js invite --role owner --name "Maha"');
  });
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createApp };
