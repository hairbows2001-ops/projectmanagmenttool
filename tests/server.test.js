// Team workspace server: accounts, server-enforced permissions, private files, conflict protection,
// import and backup/restore. Starts a real server on a free port with a temporary data folder.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/index');
const auth = require('../server/auth');
const backup = require('../server/backup');

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wh-test-')); }

async function start(dataDir) {
  const app = createApp({ dataDir, port: 0, host: '127.0.0.1', publicUrl: 'http://localhost', secure: false, trustProxy: false, autoBackup: false });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  app.base = 'http://127.0.0.1:' + app.server.address().port;
  return app;
}

/** A browser-like client with its own sign-in cookie. */
function client(app) {
  let cookie = '';
  const c = {
    async call(method, url, body, headers) {
      const h = Object.assign({ 'X-Requested-With': 'WH' }, headers || {}, cookie ? { Cookie: cookie } : {});
      let payload = body;
      if (body !== undefined && !Buffer.isBuffer(body)) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
      const res = await fetch(app.base + url, { method, headers: h, body: payload });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const type = res.headers.get('content-type') || '';
      const data = method === 'HEAD' ? null : type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
      if (data && data.rev !== undefined) c.rev = data.rev;
      if (data && data.state) c.state = data.state;
      return { status: res.status, data };
    },
    async join(token, email) {
      return c.call('POST', '/api/join', { token, email, password: 'a long enough password', confirm: 'a long enough password' });
    },
    cookie() { return cookie; },
    run(op, ...args) { return c.call('POST', '/api/commands', { base: c.rev, commands: [{ op, args, ids: [] }] }); },
    task(title) { return c.state.tasks.find((t) => t.title === title); }
  };
  return c;
}

async function team() {
  const dir = tempDir();
  const app = await start(dir);
  const inv = (role, name) => auth.createInvite(app.db, { role, name, createdBy: 'test' }).token;
  const people = { maha: client(app), carla: client(app), lina: client(app), christine: client(app) };
  assert.equal((await people.maha.join(inv('owner', 'Maha'), 'maha@example.org')).status, 200);
  assert.equal((await people.carla.join(inv('executive', 'Carla Neto'), 'carla@example.org')).status, 200);
  assert.equal((await people.lina.join(inv('manager', 'Lina Almanzan'), 'lina@example.org')).status, 200);
  assert.equal((await people.christine.join(inv('manager', 'Christine Boeck'), 'christine@example.org')).status, 200);
  return { app, dir, inv, ...people };
}

const nextWeekday = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

test('invitations are single-use and expire; sign-in checks the password', async () => {
  const { app, inv } = await team();
  try {
    const token = inv('manager', 'Leslie Burrow');
    const a = client(app);
    assert.equal((await a.join(token, 'leslie@example.org')).status, 200);
    const again = await client(app).join(token, 'someone@example.org');
    assert.equal(again.status, 410);
    assert.match(again.data.message, /already been used/);
    const expired = auth.createInvite(app.db, { role: 'manager', name: 'Late', createdBy: 'test', hours: -1 }).token;
    assert.equal((await client(app).join(expired, 'late@example.org')).status, 410);
    const short = await client(app).call('POST', '/api/join', { token: inv('manager', 'Short'), email: 's@example.org', password: 'short', confirm: 'short' });
    assert.equal(short.status, 400);
    assert.ok(short.data.fields.password);
    const bad = await client(app).call('POST', '/api/signin', { email: 'leslie@example.org', password: 'wrong password here' });
    assert.equal(bad.status, 401);
    const good = await client(app).call('POST', '/api/signin', { email: 'LESLIE@example.org', password: 'a long enough password' });
    assert.equal(good.status, 200);
    assert.equal(good.data.user.name, 'Leslie Burrow');
    // Passwords and links are stored only as hashes.
    const row = app.db.prepare("SELECT pw_hash FROM users WHERE email = 'leslie@example.org'").get();
    assert.match(row.pw_hash, /^scrypt\$/);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM tokens WHERE hash = ?').get(token).n, 0);
  } finally { await app.close(); }
});

test('signed-out visitors and private server paths are refused', async () => {
  const { app } = await team();
  try {
    const anon = client(app);
    assert.equal((await anon.call('GET', '/api/session')).status, 401);
    assert.equal((await anon.call('GET', '/api/state')).status, 401);
    for (const p of ['/server/index.js', '/data/workspace.sqlite', '/workspace.sqlite', '/tests/server.test.js', '/package.json', '/js/../server/auth.js']) {
      const res = await fetch(app.base + p);
      assert.equal(res.status, 404, p);
    }
    const page = await fetch(app.base + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const cfg = await (await fetch(app.base + '/js/config.js')).text();
    assert.match(cfg, /mode: 'team'/);
    // Changes need the app's own header (blocks other websites).
    const res = await fetch(app.base + '/api/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
  } finally { await app.close(); }
});

test('full workflow across accounts; the server enforces Maha’s and Carla’s permissions', async () => {
  const { app, maha, carla, lina, christine } = await team();
  try {
    assert.equal((await lina.run('createTask', { title: 'Spring newsletter' })).status, 200);
    await maha.call('GET', '/api/state');
    const t = maha.task('Spring newsletter');
    assert.equal(t.status, 'submitted');
    assert.equal(t.approvalRequired, true, 'manager requests need approval by default');

    // A manager cannot do Maha's work, and cannot pretend to be someone else.
    assert.equal((await lina.run('setEstimate', t.id, 4)).status, 403);
    assert.equal((await christine.run('scheduleTask', t.id, { agreedDeadline: nextWeekday(10), allocations: [] })).status, 403);

    assert.equal((await maha.run('setEstimate', t.id, 4)).status, 200);
    const week = require('./load').workflow.currentWeek();
    const s = await maha.run('scheduleTask', t.id, { agreedDeadline: nextWeekday(10), allocations: [{ weekStart: week, hours: 4 }] });
    assert.equal(s.status, 200, JSON.stringify(s.data));
    await lina.call('GET', '/api/state');
    assert.equal(lina.task('Spring newsletter').status, 'scheduled', 'the manager sees the new status');

    assert.equal((await maha.run('startWork', t.id)).status, 200);
    assert.equal((await maha.run('completeTask', t.id, 'Done')).status, 200);
    assert.equal(maha.task('Spring newsletter').status, 'awaiting_approval');
    assert.equal((await maha.run('requestApproval', t.id)).status, 200);

    // Only Carla approves.
    for (const who of [lina, christine, maha]) {
      await who.call('GET', '/api/state');
      const r = await who.run('approveWork', t.id, '');
      assert.equal(r.status, 403, 'approve refused');
      assert.match(r.data.message, /permission/);
    }
    assert.equal((await christine.run('setPriority', t.id, 'P1', 'mine')).status, 403);
    await carla.call('GET', '/api/state');
    assert.equal((await carla.run('approveWork', t.id, '')).status, 200);
    assert.equal(carla.task('Spring newsletter').status, 'complete');

    // Maha's own task: no approval by default; Carla can change it per task.
    await maha.call('GET', '/api/state');
    await maha.run('createTask', { title: 'Footer update' });
    const own = maha.task('Footer update');
    assert.equal(own.approvalRequired, false);
    await carla.call('GET', '/api/state');
    assert.equal((await carla.run('setApprovalRequired', own.id, true)).status, 200);
    assert.equal(carla.task('Footer update').approvalRequired, true);
    assert.equal((await lina.run('setApprovalRequired', own.id, false)).status, 403);

    // Requests changes path.
    await maha.call('GET', '/api/state');
    await maha.run('setEstimate', own.id, 1);
    await maha.run('scheduleTask', own.id, { agreedDeadline: nextWeekday(5), allocations: [{ weekStart: week, hours: 1 }] });
    await maha.run('startWork', own.id);
    await maha.run('completeTask', own.id, '');
    await maha.run('requestApproval', own.id);
    await carla.call('GET', '/api/state');
    assert.equal((await carla.run('requestChanges', own.id, 'Use the new logo')).status, 200);
    assert.equal(carla.task('Footer update').status, 'in_progress');

    // Carla proposes, Maha confirms.
    const proposal = await carla.run('createProposal', { weekStart: week, reason: 'Gala first', moves: [] });
    assert.ok([200, 400].includes(proposal.status));
    assert.equal((await lina.run('createProposal', { weekStart: week, reason: 'Mine first', moves: [] })).status, 403);

    // Commands outside the allowed list are refused.
    assert.equal((await maha.run('addDocument', own.id, { id: 'x', name: 'fake.pdf', stored: true })).status, 400);
    assert.equal((await maha.call('POST', '/api/commands', { base: maha.rev, commands: [{ op: 'constructor', args: [] }] })).status, 400);
  } finally { await app.close(); }
});

test('private documents: only the requester, Maha and Carla can open them; others see a summary', async () => {
  const { app, maha, carla, lina, christine } = await team();
  try {
    await lina.run('createTask', { title: 'Donor letter', description: 'Private details' });
    const t = lina.task('Donor letter');
    const up = await lina.call('POST', '/api/files?task=' + t.id + '&base=' + lina.rev, Buffer.from('secret notes'), { 'X-File-Name': encodeURIComponent('notes.txt'), 'Content-Type': 'text/plain' });
    assert.equal(up.status, 200);
    const docId = up.data.doc.id;
    assert.ok(fs.existsSync(path.join(app.config.dataDir, 'files', docId)));

    const upOther = await christine.call('POST', '/api/files?task=' + t.id + '&base=0', Buffer.from('x'), { 'X-File-Name': 'x.txt' });
    assert.equal(upOther.status, 403, 'other managers cannot add documents');

    for (const who of [lina, maha, carla]) {
      const r = await who.call('GET', '/api/files/' + docId);
      assert.equal(r.status, 200);
      assert.equal(r.data.toString(), 'secret notes');
    }
    assert.equal((await christine.call('GET', '/api/files/' + docId)).status, 403);
    // The quick access check the browser makes before downloading.
    assert.equal((await lina.call('HEAD', '/api/files/' + docId)).status, 200);
    assert.equal((await christine.call('HEAD', '/api/files/' + docId)).status, 403);
    const named = await fetch(app.base + '/api/files/' + docId, { headers: { Cookie: lina.cookie() } });
    assert.match(named.headers.get('content-disposition'), /^attachment; filename="notes.txt"; filename\*=UTF-8''notes.txt$/);
    assert.equal((await client(app).call('GET', '/api/files/' + docId)).status, 401);
    assert.equal((await christine.call('GET', '/api/files/doc-000000000000000000')).status, 404);

    await christine.call('GET', '/api/state');
    const seen = christine.task('Donor letter');
    assert.equal(seen.restricted, true);
    assert.equal(seen.documents.length, 0);
    assert.equal(seen.description, undefined);
    assert.equal(seen.status, 'submitted');

    const accented = await lina.call('POST', '/api/files?task=' + t.id + '&base=' + lina.rev, Buffer.from('é'), { 'X-File-Name': encodeURIComponent('Résumé – v2.pdf'), 'Content-Type': 'application/pdf' });
    const res2 = await fetch(app.base + '/api/files/' + accented.data.doc.id, { headers: { Cookie: lina.cookie() } });
    assert.match(res2.headers.get('content-disposition'), /filename\*=UTF-8''R%C3%A9sum%C3%A9%20%E2%80%93%20v2\.pdf/, 'accented names survive for Windows and Mac');

    const big = await lina.call('POST', '/api/files?task=' + t.id + '&base=' + lina.rev, Buffer.alloc(10 * 1024 * 1024 + 10), { 'X-File-Name': 'big.bin' });
    assert.equal(big.status, 413);
  } finally { await app.close(); }
});

test('nobody silently overwrites someone else’s change; additions merge', async () => {
  const { app, maha, lina } = await team();
  try {
    await lina.run('createTask', { title: 'Poster' });
    await maha.call('GET', '/api/state');
    const t = maha.task('Poster');
    const linaSaw = lina.rev;
    const mahaSaw = maha.rev;

    assert.equal((await maha.run('setEstimate', t.id, 3)).status, 200);

    // Lina adds a comment from her older page: merged, not a conflict.
    const c = await lina.call('POST', '/api/commands', { base: linaSaw, commands: [{ op: 'addComment', args: [t.id, 'Photos in the drive'], ids: [] }] });
    assert.equal(c.status, 200);
    assert.equal(lina.task('Poster').estimateHours, 3, 'Maha’s estimate kept');

    // A real clash: Maha changes the estimate again from a page opened before her first change.

    const clash = await maha.call('POST', '/api/commands', { base: mahaSaw, commands: [{ op: 'setEstimate', args: [t.id, 8], ids: [] }] });
    assert.equal(clash.status, 409);
    assert.match(clash.data.message, /Maha changed “Poster” \(estimate/);
    assert.ok(clash.data.state, 'the latest version comes back with the refusal');
    await maha.call('GET', '/api/state');
    assert.equal(maha.task('Poster').estimateHours, 3, 'nothing overwritten');
    assert.ok(maha.task('Poster').comments.some((x) => x.text === 'Photos in the drive'));

    // Status clash: Lina cancels from a page opened before Maha changed the status.
    const before = lina.rev;
    await maha.run('requestClarification', t.id, 'Which size?');
    const cancel = await lina.call('POST', '/api/commands', { base: before, commands: [{ op: 'cancelTask', args: [t.id, 'not needed'], ids: [] }] });
    assert.equal(cancel.status, 409);
    assert.match(cancel.data.message, /status/);

    // A stale or missing revision is rejected rather than guessed.
    assert.equal((await maha.call('POST', '/api/commands', { commands: [{ op: 'setEstimate', args: [t.id, 2], ids: [] }] })).status, 400);
  } finally { await app.close(); }
});

test('ids from the browser are reused only when valid and unused', async () => {
  const { app, lina } = await team();
  try {
    const id = 'task-abcd1234-1xyz';
    const r = await lina.call('POST', '/api/commands', { base: lina.rev, commands: [{ op: 'createTask', args: [{ title: 'A' }], ids: [id] }] });
    assert.equal(r.status, 200);
    assert.ok(lina.state.tasks.some((t) => t.id === id));
    const dup = await lina.call('POST', '/api/commands', { base: lina.rev, commands: [{ op: 'createTask', args: [{ title: 'B' }], ids: [id] }] });
    assert.equal(dup.status, 200);
    const b = lina.task('B');
    assert.notEqual(b.id, id, 'a used id is never reused');
  } finally { await app.close(); }
});

test('only Maha manages invitations; she can invite managers but not executives', async () => {
  const { app, maha, carla, lina } = await team();
  try {
    assert.equal((await carla.call('GET', '/api/admin/team')).status, 403);
    assert.equal((await lina.call('POST', '/api/admin/invites', { name: 'X' })).status, 403);
    const r = await maha.call('POST', '/api/admin/invites', { name: 'Sheila Barro', role: 'executive' });
    assert.equal(r.status, 200);
    const token = r.data.link.split('/join/')[1];
    const s = client(app);
    await s.join(token, 'sheila@example.org');
    assert.equal((await s.call('GET', '/api/session')).data.user.role, 'manager', 'role is always manager when Maha invites');
    const team = (await maha.call('GET', '/api/admin/team')).data;
    const carlaAcct = team.users.find((u) => u.role === 'executive');
    assert.equal((await maha.call('POST', '/api/admin/users/' + carlaAcct.id + '/reset-link', {})).status, 403, 'Maha cannot take over Carla’s account');
    const linaAcct = team.users.find((u) => u.name === 'Lina Almanzan');
    assert.equal((await maha.call('POST', '/api/admin/users/' + linaAcct.id + '/active', { active: false })).status, 200);
    assert.equal((await lina.call('GET', '/api/state')).status, 401, 'turned-off account is signed out');
  } finally { await app.close(); }
});

test('import is explicit: sample tasks skipped, no duplicates, owner only', async () => {
  const { app, maha, lina } = await team();
  try {
    const file = {
      format: 'wh-comms-tasks', version: 1, exportedAt: '2026-10-01T12:00:00.000Z',
      people: [{ id: 'lina', name: 'Lina Almanzan' }, { id: 'maha', name: 'Maha' }],
      tasks: [
        { id: 'task-1', title: 'Real task', status: 'scheduled', requesterId: 'lina', estimateHours: 3, allocations: [], comments: [{ by: 'lina', at: '2026-10-01T12:00:00.000Z', text: 'hello' }], history: [], documents: [{ id: 'doc-a', name: 'a.txt', stored: true }], links: [] },
        { id: 'sample-1', title: 'Fictional', status: 'submitted', requesterId: 'lina', sample: true }
      ],
      files: { 'doc-a': { name: 'a.txt', type: 'text/plain', data: Buffer.from('file a').toString('base64') } }
    };
    assert.equal((await lina.call('POST', '/api/admin/import?base=' + lina.rev, file)).status, 403);
    const r = await maha.call('POST', '/api/admin/import?base=' + maha.rev, file);
    assert.equal(r.status, 200);
    assert.equal(r.data.report.imported, 1);
    assert.equal(r.data.report.skippedSample, 1);
    const t = maha.task('Real task');
    const linaId = (await lina.call('GET', '/api/session')).data.user.id;
    assert.equal(t.requesterId, linaId, 'matched to Lina’s account by name');
    assert.equal(t.comments[0].by, linaId);
    assert.ok(t.documents[0].stored);
    assert.equal((await lina.call('GET', '/api/files/' + t.documents[0].id)).data.toString(), 'file a');
    const again = await maha.call('POST', '/api/admin/import?base=' + maha.rev, file);
    assert.equal(again.data.report.imported, 0);
    assert.equal(again.data.report.skippedDuplicate, 1);
    assert.ok(!maha.state.tasks.some((x) => x.title === 'Fictional'));
  } finally { await app.close(); }
});

test('backup and restore bring back tasks, accounts and documents', async () => {
  const { app, dir, maha, lina } = await team();
  let restored;
  try {
    await lina.run('createTask', { title: 'Keep me' });
    const t = lina.task('Keep me');
    const up = await lina.call('POST', '/api/files?task=' + t.id + '&base=' + lina.rev, Buffer.from('backup me'), { 'X-File-Name': 'b.txt', 'Content-Type': 'text/plain' });
    const docId = up.data.doc.id;
    const dl = await maha.call('GET', '/api/admin/backup');
    assert.equal(dl.status, 200);
    const tarPath = path.join(dir, 'downloaded.tar');
    fs.writeFileSync(tarPath, dl.data);
    const names = backup.readTar(tarPath).map((e) => e.name);
    assert.ok(names.includes('workspace.sqlite') && names.includes('files/' + docId));
    assert.equal((await lina.call('GET', '/api/admin/backup')).status, 403, 'only Maha downloads backups');
    await app.close();

    // Restore into an empty folder, start a new server, sign in, check.
    const fresh = tempDir();
    const r = backup.restoreBackup(tarPath, fresh);
    assert.equal(r.restoredFiles, 1);
    restored = await start(fresh);
    const l2 = client(restored);
    assert.equal((await l2.call('POST', '/api/signin', { email: 'lina@example.org', password: 'a long enough password' })).status, 200);
    assert.ok(l2.task('Keep me'));
    assert.equal((await l2.call('GET', '/api/files/' + docId)).data.toString(), 'backup me');

    // Restoring over existing data moves the old data aside instead of deleting it.
    await restored.close(); restored = null;
    const again = backup.restoreBackup(tarPath, fresh);
    assert.ok(fs.existsSync(path.join(again.previousDataMovedTo, 'workspace.sqlite')));

    // A file that is not a backup is refused without touching anything.
    const junk = path.join(fresh, 'junk.tar');
    backup.writeTar(junk, [{ name: 'other.txt', data: Buffer.from('x') }]);
    assert.throws(() => backup.restoreBackup(junk, fresh), /not a workspace backup/);
  } finally {
    if (restored) await restored.close();
  }
});

test('daily automatic backups keep the newest 14', () => {
  const dir = tempDir();
  const bdir = path.join(dir, 'backups');
  fs.mkdirSync(bdir, { recursive: true });
  for (let i = 0; i < 16; i++) fs.writeFileSync(path.join(bdir, 'auto-2026-01-' + String(i + 1).padStart(2, '0') + 'T00-00-00.tar'), 'x');
  backup.prune(dir);
  const left = fs.readdirSync(bdir).sort();
  assert.equal(left.length, 14);
  assert.equal(left[0], 'auto-2026-01-03T00-00-00.tar');
});

test('a backup placed at restore-this.tar is restored when the server starts', async () => {
  const { app, dir, lina } = await team();
  await lina.run('createTask', { title: 'Before the backup' });
  const tarPath = backup.createBackup(app.db, dir);
  await lina.run('createTask', { title: 'After the backup' });
  await app.close();
  fs.copyFileSync(tarPath, path.join(dir, 'restore-this.tar'));
  const again = await start(dir);
  try {
    const l = client(again);
    await l.call('POST', '/api/signin', { email: 'lina@example.org', password: 'a long enough password' });
    assert.ok(l.task('Before the backup'));
    assert.equal(l.task('After the backup'), undefined, 'back to the state in the backup');
    assert.ok(!fs.existsSync(path.join(dir, 'restore-this.tar')), 'renamed so it is not restored twice');
    assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('replaced-')), 'replaced data kept aside');
  } finally { await again.close(); }
});
