/*
 * Accounts and sign-in.
 *  - Passwords are stored only as scrypt hashes (never the password itself).
 *  - Invitations and password-reset links are single-use and expire. Only a hash of each
 *    link is stored, so someone who copies the database cannot use pending links.
 *  - Sessions are random tokens in an HttpOnly cookie; the database stores only their hash.
 */
'use strict';

const crypto = require('crypto');
const { transaction } = require('./db');

const INVITE_HOURS = 72;
const RESET_HOURS = 24;
const SESSION_DAYS = 30;       // longest a sign-in lasts
const IDLE_DAYS = 14;          // signed out after this long without use
const MIN_PASSWORD = 12;
const ROLES = { owner: 'Communications workspace owner', executive: 'Executive Director', manager: 'Manager' };

class AuthError extends Error {
  constructor(message, status, fields) { super(message); this.status = status || 400; this.fields = fields; }
}

const nowIso = () => new Date().toISOString();
const addHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

// ---------- passwords ----------

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function checkPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(actual, expected);
}
// Used when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function validatePassword(pw, confirm) {
  const fields = {};
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) fields.password = 'Use at least ' + MIN_PASSWORD + ' characters. A short sentence is easy to remember.';
  else if (pw.length > 200) fields.password = 'Use at most 200 characters.';
  if (confirm !== undefined && pw !== confirm) fields.confirm = 'The two passwords do not match.';
  if (Object.keys(fields).length) throw new AuthError('Please check the password.', 400, fields);
}

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const cleanText = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- users ----------

function publicUser(u) {
  return { id: u.id, name: u.name, first: u.name.split(' ')[0], title: u.title || ROLES[u.role], role: u.role, email: u.email, inactive: !u.active };
}

function listUsers(db) {
  return db.prepare('SELECT * FROM users ORDER BY active DESC, name').all().map(publicUser);
}

function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function setActive(db, id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
}

// ---------- invitations and reset links ----------

/**
 * Creates an invitation. Returns the one-time token; it is shown once and never stored.
 * Nothing is sent: the person creating it shares the link themselves (when the pilot starts).
 */
function createInvite(db, { name, title, role, email, createdBy, hours }) {
  const fields = {};
  const n = cleanText(name, 120);
  if (!n) fields.name = 'Enter the person’s name.';
  if (!ROLES[role]) fields.role = 'Choose a role.';
  const e = cleanEmail(email);
  if (e && !validEmail(e)) fields.email = 'Enter a valid email address, or leave it blank.';
  if (e && db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) fields.email = 'There is already an account with this email.';
  if (Object.keys(fields).length) throw new AuthError('Please check the invitation.', 400, fields);
  const token = newToken();
  const expires = addHours(hours || INVITE_HOURS);
  db.prepare('INSERT INTO tokens (hash, kind, name, title, role, email, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sha256(token), 'invite', n, cleanText(title, 160), role, e || null, createdBy, nowIso(), expires);
  return { token, expiresAt: expires };
}

function createResetLink(db, { userId, createdBy }) {
  const u = getUser(db, userId);
  if (!u || !u.active) throw new AuthError('Account not found or inactive.', 404);
  // Only the newest reset link works.
  db.prepare("UPDATE tokens SET revoked_at = ? WHERE kind = 'reset' AND user_id = ? AND used_at IS NULL AND revoked_at IS NULL").run(nowIso(), userId);
  const token = newToken();
  const expires = addHours(RESET_HOURS);
  db.prepare('INSERT INTO tokens (hash, kind, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sha256(token), 'reset', userId, createdBy, nowIso(), expires);
  return { token, expiresAt: expires };
}

function tokenStatus(row) {
  if (!row) return 'invalid';
  if (row.used_at) return 'used';
  if (row.revoked_at) return 'revoked';
  if (row.expires_at < nowIso()) return 'expired';
  return 'valid';
}

const TOKEN_MESSAGES = {
  invalid: 'This link is not valid. Check that the whole link was copied, or ask Maha for a new one.',
  used: 'This link has already been used. Each link works once. Sign in, or ask Maha for a new link.',
  revoked: 'This link was cancelled. Ask Maha for a new one.',
  expired: 'This link has expired. Ask Maha for a new one.'
};

function findToken(db, token, kind) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const row = db.prepare('SELECT * FROM tokens WHERE hash = ? AND kind = ?').get(sha256(token), kind);
  return row || null;
}

/** What the invitation page shows before the person chooses a password. */
function describeToken(db, token, kind) {
  const row = findToken(db, token, kind);
  const status = tokenStatus(row);
  if (status !== 'valid') throw new AuthError(TOKEN_MESSAGES[status], 410);
  if (kind === 'invite') return { kind, name: row.name, title: row.title || ROLES[row.role], role: row.role, email: row.email || '', expiresAt: row.expires_at };
  const u = getUser(db, row.user_id);
  return { kind, name: u.name, email: u.email, expiresAt: row.expires_at };
}

function acceptInvite(db, token, { email, password, confirm }) {
  return transaction(db, () => {
    const row = findToken(db, token, 'invite');
    const status = tokenStatus(row);
    if (status !== 'valid') throw new AuthError(TOKEN_MESSAGES[status], 410);
    const e = row.email || cleanEmail(email);
    if (!validEmail(e)) throw new AuthError('Please check your email address.', 400, { email: 'Enter a valid email address.' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw new AuthError('There is already an account with this email.', 400, { email: 'There is already an account with this email. Sign in instead.' });
    validatePassword(password, confirm);
    const id = 'u-' + crypto.randomBytes(6).toString('hex');
    db.prepare('INSERT INTO users (id, email, name, title, role, pw_hash, active, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run(id, e, row.name, row.title || '', row.role, hashPassword(password), nowIso(), row.created_by);
    // Single use: marked used in the same transaction that creates the account.
    const used = db.prepare('UPDATE tokens SET used_at = ?, used_by = ? WHERE hash = ? AND used_at IS NULL').run(nowIso(), id, row.hash);
    if (used.changes !== 1) throw new AuthError(TOKEN_MESSAGES.used, 410);
    return getUser(db, id);
  });
}

function useResetLink(db, token, { password, confirm }) {
  return transaction(db, () => {
    const row = findToken(db, token, 'reset');
    const status = tokenStatus(row);
    if (status !== 'valid') throw new AuthError(TOKEN_MESSAGES[status], 410);
    validatePassword(password, confirm);
    db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
    db.prepare('UPDATE tokens SET used_at = ?, used_by = ? WHERE hash = ?').run(nowIso(), row.user_id, row.hash);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id); // signs out everywhere
    return getUser(db, row.user_id);
  });
}

function listInvites(db) {
  return db.prepare("SELECT rowid AS ref, kind, user_id, name, title, role, email, created_by, created_at, expires_at, used_at, used_by, revoked_at FROM tokens ORDER BY created_at DESC LIMIT 100").all()
    .map((r) => ({ ref: String(r.ref), kind: r.kind, userId: r.user_id, name: r.name, title: r.title, role: r.role, email: r.email, createdBy: r.created_by,
      createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at, usedBy: r.used_by, status: tokenStatus(r) }));
}

function revokeInvite(db, ref) {
  return db.prepare('UPDATE tokens SET revoked_at = ? WHERE rowid = ? AND used_at IS NULL AND revoked_at IS NULL').run(nowIso(), Number(ref)).changes === 1;
}

// ---------- sign-in and sessions ----------

// Slows down password guessing: after 8 failed attempts for an email or from one address,
// further attempts are refused for 15 minutes.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
function tooMany(key) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) { failures.delete(key); return false; }
  return f.count >= MAX_FAILURES;
}
function fail(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { first: Date.now(), count: 1 });
  else f.count += 1;
}

function signIn(db, { email, password }, ip) {
  const e = cleanEmail(email);
  const keys = ['email:' + e, 'ip:' + (ip || '')];
  if (keys.some(tooMany)) throw new AuthError('Too many attempts. Wait 15 minutes, then try again.', 429);
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(e);
  const ok = checkPassword(String(password || ''), u ? u.pw_hash : DUMMY_HASH);
  if (!u || !ok || !u.active) {
    keys.forEach(fail);
    throw new AuthError(u && ok && !u.active ? 'This account has been turned off. Ask Maha if you need access.' : 'The email or password is not correct.', 401);
  }
  keys.forEach((k) => failures.delete(k));
  return u;
}

function createSession(db, userId) {
  const token = newToken();
  const t = nowIso();
  db.prepare('INSERT INTO sessions (hash, user_id, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), userId, t, t, addHours(SESSION_DAYS * 24));
  return token;
}

/** Returns the signed-in, active user for a session token, or null. */
function sessionUser(db, token) {
  if (!token) return null;
  const hash = sha256(token);
  const s = db.prepare('SELECT * FROM sessions WHERE hash = ?').get(hash);
  if (!s) return null;
  const idleLimit = new Date(Date.now() - IDLE_DAYS * 24 * 3600 * 1000).toISOString();
  if (s.expires_at < nowIso() || s.last_seen < idleLimit) { db.prepare('DELETE FROM sessions WHERE hash = ?').run(hash); return null; }
  const u = getUser(db, s.user_id);
  if (!u || !u.active) return null;
  // Record use at most once a minute.
  if (Date.now() - Date.parse(s.last_seen) > 60000) db.prepare('UPDATE sessions SET last_seen = ? WHERE hash = ?').run(nowIso(), hash);
  return u;
}

function endSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha256(token));
}

module.exports = {
  AuthError, ROLES, MIN_PASSWORD, INVITE_HOURS, RESET_HOURS,
  hashPassword, checkPassword, publicUser, listUsers, getUser, setActive,
  createInvite, createResetLink, describeToken, acceptInvite, useResetLink, listInvites, revokeInvite,
  signIn, createSession, sessionUser, endSession
};
