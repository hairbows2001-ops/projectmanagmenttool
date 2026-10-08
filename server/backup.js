/*
 * Backups: one .tar file holding a consistent copy of the database (workspace.sqlite) and every
 * uploaded document (files/...). Any archive tool can open it (on a Mac, double-click it).
 *
 *  - createBackup(): makes a copy while the app is running (SQLite "VACUUM INTO").
 *  - The server makes one automatically every day and keeps the newest 14 (DATA_DIR/backups).
 *  - restoreBackup(): used by `node server/admin.js restore <file>` with the app stopped.
 *    The data being replaced is moved aside first, never deleted.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const KEEP = 14;

// ---------- minimal tar (POSIX ustar) ----------

function header(name, size, mtime) {
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 100, 'utf8');
  h.write('0000600\0', 100, 'ascii');
  h.write('0000000\0', 108, 'ascii');
  h.write('0000000\0', 116, 'ascii');
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  h.write(Math.floor(mtime / 1000).toString(8).padStart(11, '0') + '\0', 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write('0', 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i];
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return h;
}

function writeTar(outPath, entries) {
  const fd = fs.openSync(outPath, 'w', 0o600);
  try {
    entries.forEach((e) => {
      const data = e.data || fs.readFileSync(e.path);
      fs.writeSync(fd, header(e.name, data.length, e.mtime || Date.now()));
      fs.writeSync(fd, data);
      const pad = (512 - (data.length % 512)) % 512;
      if (pad) fs.writeSync(fd, Buffer.alloc(pad, 0));
    });
    fs.writeSync(fd, Buffer.alloc(1024, 0));
  } finally {
    fs.closeSync(fd);
  }
}

function readTar(file) {
  const buf = fs.readFileSync(file);
  const out = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const name = h.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(h.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    off += 512;
    if (type === '0') out.push({ name, data: buf.subarray(off, off + size) });
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

// ---------- backup and restore ----------

function stamp() {
  return new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
}

/** Writes a backup .tar and returns its path. `db` is the open database (or null if the app is stopped). */
function createBackup(db, dataDir, opts) {
  const o = opts || {};
  const dir = o.dir || path.join(dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const tmpDb = path.join(dir, '.backup-' + process.pid + '-' + Date.now() + '.sqlite');
  const source = db || new DatabaseSync(path.join(dataDir, 'workspace.sqlite'));
  try {
    source.prepare('VACUUM INTO ?').run(tmpDb);
  } finally {
    if (!db) source.close();
  }
  const entries = [{ name: 'workspace.sqlite', path: tmpDb }];
  const filesDir = path.join(dataDir, 'files');
  if (fs.existsSync(filesDir)) {
    fs.readdirSync(filesDir).filter((f) => !f.endsWith('.part')).forEach((f) => entries.push({ name: 'files/' + f, path: path.join(filesDir, f), mtime: fs.statSync(path.join(filesDir, f)).mtimeMs }));
  }
  entries.push({ name: 'README.txt', data: Buffer.from('Communications Workspace backup made ' + new Date().toISOString() + '.\n' +
    'Contains the database (workspace.sqlite: tasks, comments, schedules, meetings, decisions, history, accounts with hashed passwords)\n' +
    'and uploaded documents (files/). Keep it somewhere private. To restore, see docs/backup-and-recovery.md.\n') });
  const out = path.join(dir, (o.prefix || 'workspace-backup') + '-' + stamp() + '.tar');
  try {
    writeTar(out, entries);
  } finally {
    fs.rmSync(tmpDb, { force: true });
  }
  return out;
}

/** Deletes the oldest automatic backups, keeping the newest KEEP. */
function prune(dataDir) {
  const dir = path.join(dataDir, 'backups');
  if (!fs.existsSync(dir)) return;
  const auto = fs.readdirSync(dir).filter((f) => f.startsWith('auto-') && f.endsWith('.tar')).sort();
  auto.slice(0, Math.max(0, auto.length - KEEP)).forEach((f) => fs.rmSync(path.join(dir, f)));
}

function lastAutoBackup(dataDir) {
  const dir = path.join(dataDir, 'backups');
  if (!fs.existsSync(dir)) return null;
  const auto = fs.readdirSync(dir).filter((f) => f.startsWith('auto-') && f.endsWith('.tar')).sort();
  return auto.length ? fs.statSync(path.join(dir, auto[auto.length - 1])).mtimeMs : null;
}

/** Makes a daily backup if the newest automatic one is more than a day old. */
function dailyBackup(db, dataDir) {
  const last = lastAutoBackup(dataDir);
  if (last && Date.now() - last < 23.5 * 3600 * 1000) return null;
  const file = createBackup(db, dataDir, { prefix: 'auto' });
  prune(dataDir);
  return file;
}

/**
 * Restores a backup into dataDir. The app must be stopped.
 * The current data is moved to dataDir/replaced-<time> first.
 */
function restoreBackup(tarFile, dataDir) {
  const entries = readTar(tarFile);
  const dbEntry = entries.find((e) => e.name === 'workspace.sqlite');
  if (!dbEntry) throw new Error('This file is not a workspace backup (no workspace.sqlite inside).');
  for (const e of entries) {
    if (e.name.includes('..') || path.isAbsolute(e.name) || !(e.name === 'workspace.sqlite' || e.name === 'README.txt' || /^files\/[\w.-]+$/.test(e.name))) {
      throw new Error('Unexpected item in backup: ' + e.name);
    }
  }
  // Check the database opens and has the expected tables before replacing anything.
  const staging = path.join(dataDir, '.restore-' + Date.now());
  fs.mkdirSync(path.join(staging, 'files'), { recursive: true });
  fs.writeFileSync(path.join(staging, 'workspace.sqlite'), dbEntry.data, { mode: 0o600 });
  const check = new DatabaseSync(path.join(staging, 'workspace.sqlite'));
  try {
    const ok = check.prepare('PRAGMA integrity_check').get();
    if (!ok || Object.values(ok)[0] !== 'ok') throw new Error('The database in this backup is damaged.');
    check.prepare('SELECT count(*) AS n FROM records').get();
    check.prepare('SELECT count(*) AS n FROM users').get();
  } finally {
    check.close();
  }
  entries.filter((e) => e.name.startsWith('files/')).forEach((e) => fs.writeFileSync(path.join(staging, e.name), e.data, { mode: 0o600 }));

  const aside = path.join(dataDir, 'replaced-' + stamp());
  fs.mkdirSync(aside, { recursive: true });
  ['workspace.sqlite', 'workspace.sqlite-wal', 'workspace.sqlite-shm', 'files'].forEach((n) => {
    const p = path.join(dataDir, n);
    if (fs.existsSync(p)) fs.renameSync(p, path.join(aside, n));
  });
  fs.renameSync(path.join(staging, 'workspace.sqlite'), path.join(dataDir, 'workspace.sqlite'));
  fs.renameSync(path.join(staging, 'files'), path.join(dataDir, 'files'));
  fs.rmSync(staging, { recursive: true, force: true });
  return { restoredFiles: entries.filter((e) => e.name.startsWith('files/')).length, previousDataMovedTo: aside };
}

module.exports = { createBackup, dailyBackup, restoreBackup, readTar, writeTar, prune };
