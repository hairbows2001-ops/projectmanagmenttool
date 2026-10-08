/*
 * The shared database: one SQLite file (DATA_DIR/workspace.sqlite), using the SQLite built into Node.js.
 *
 * Tables
 *  - users, tokens (invitations and password-reset links), sessions: accounts and sign-in.
 *  - records: tasks, meetings, events, schedule-change proposals (decisions) and weekly capacity.
 *    Each row is one item, stored as JSON with the revision, person and time of the last change to each field, so the server can
 *    tell whether a change would overwrite something another person saved in the meantime.
 *    A task row holds its comments, estimate, schedule, documents list and history.
 *  - activity: the workspace activity log (append only).
 *  - files: uploaded documents (the file itself is in DATA_DIR/files, never in the web folder).
 *  - meta: workspace revision counter and data version.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('owner','executive','manager')), pw_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, created_by TEXT
);
CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('invite','reset')), user_id TEXT,
  name TEXT, title TEXT, role TEXT, email TEXT,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  used_at TEXT, used_by TEXT, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, last_seen TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL, field_revs TEXT NOT NULL,
  updated_by TEXT, updated_at TEXT, PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS activity (seq INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL,
  sha256 TEXT NOT NULL, uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL
);
`;

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'files'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'workspace.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  if (!getMeta(db, 'rev')) setMeta(db, 'rev', '0');
  return db;
}

function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

/** Runs fn inside a transaction: either every change is saved or none is. */
function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open, getMeta, setMeta, transaction };
