/*
 * The shared workspace: runs every change through the same rules as the app (js/core),
 * as the signed-in person, then saves it to the database.
 *
 * How a change works
 *  1. The browser sends the change as a list of commands (for example scheduleTask with its
 *     form values) plus the workspace revision it was looking at ("base").
 *  2. The server runs the commands on a copy of the latest data, with the signed-in account as
 *     the actor. The rules check permission and validate; any error means nothing is saved.
 *  3. Protection against overwriting: for every field the change touches, the server checks
 *     whether someone else changed that field after "base". If so, nothing is saved and the
 *     person sees who changed what. Adding to lists (comments, history, documents, links) never
 *     conflicts, because it is applied to the latest version.
 *  4. Otherwise the changed items are saved in one transaction and the revision goes up.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getMeta, setMeta, transaction } = require('./db');
const auth = require('./auth');

// Load the shared rules (the same files the browser uses).
['util', 'dates', 'people', 'permissions', 'capacity', 'workflow', 'migrate'].forEach((f) => require(path.join(__dirname, '..', 'js', 'core', f + '.js')));
const WH = globalThis.WH;
const W = WH.workflow;
const P = WH.permissions;
const clone = WH.util.clone;

const COLLECTIONS = { task: 'tasks', meeting: 'meetings', event: 'events', proposal: 'proposals' };
const KINDS = Object.keys(COLLECTIONS).concat('capacity');

/** Changes the browser may send. Documents are added only through the upload route. */
const COMMANDS = [
  'createTask', 'updateBrief', 'addComment', 'addLink',
  'requestClarification', 'provideInfo', 'setEstimate', 'setRemaining', 'scheduleTask', 'setCoveredBySocial', 'startWork',
  'setBlocked', 'clearBlocked', 'planToday', 'completeTask', 'requestApproval', 'approveWork', 'requestChanges', 'setApprovalRequired',
  'setPriority', 'cancelTask', 'archiveTask',
  'createProposal', 'confirmProposal', 'declineProposal',
  'requestMeeting', 'respondMeeting', 'acceptCounter', 'withdrawMeeting',
  'setCapacity', 'clearCapacity', 'addEvent', 'removeEvent'
];

// Lists that only grow: changes to them are merged, never treated as a conflict.
const MERGEABLE = ['history', 'comments', 'links', 'documents', 'updatedAt'];

const FIELD_LABELS = {
  status: 'status', allocations: 'schedule', agreedDeadline: 'agreed deadline', estimateHours: 'estimate', remainingHours: 'remaining effort',
  priority: 'priority', priorityReason: 'priority', blocked: 'blocked flag', approval: 'approval', approvalRequired: 'approval setting',
  title: 'title', description: 'brief', requestedDeadline: 'requested deadline', plannedDates: 'Today list', coveredBySocial: 'social media setting',
  moves: 'proposed moves', counter: 'proposed time', capacity: 'capacity'
};

const ID_RE = /^[a-z]{2,8}-[a-z0-9]{4,16}-[a-z0-9]{2,16}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; Object.assign(this, extra || {}); }
}

function createWorkspace(db, dataDir) {
  const filesDir = path.join(dataDir, 'files');
  let cache = null; // { rev, state, meta: { 'kind:id': { fieldRevs, updatedBy, updatedAt } } }

  function refreshPeople() {
    WH.people.setPeople(auth.listUsers(db).map((u) => ({ id: u.id, name: u.name, first: u.first, title: u.title, role: u.role, inactive: u.inactive })));
  }

  function load() {
    const state = { schemaVersion: Number(getMeta(db, 'schemaVersion') || WH.migrate.CURRENT), tasks: [], meetings: [], events: [], proposals: [], capacity: {}, log: [] };
    const meta = {};
    db.prepare('SELECT * FROM records ORDER BY rowid').all().forEach((r) => {
      const data = JSON.parse(r.data);
      if (r.kind === 'capacity') state.capacity[r.id] = data;
      else state[COLLECTIONS[r.kind]].push(data);
      meta[r.kind + ':' + r.id] = { fieldRevs: JSON.parse(r.field_revs), updatedBy: r.updated_by, updatedAt: r.updated_at };
    });
    state.log = db.prepare('SELECT data FROM activity ORDER BY seq').all().map((r) => JSON.parse(r.data));
    cache = { rev: Number(getMeta(db, 'rev')), state, meta };
    return cache;
  }

  function current() { return cache || load(); }

  /** Upgrades saved data when the data version changes (same steps as the demo, js/core/migrate.js). */
  function migrate() {
    const c = current();
    if (!getMeta(db, 'schemaVersion')) { setMeta(db, 'schemaVersion', WH.migrate.CURRENT); c.state.schemaVersion = WH.migrate.CURRENT; return false; }
    if (c.state.schemaVersion === WH.migrate.CURRENT) return false;
    refreshPeople();
    const draft = clone(c.state);
    const result = WH.migrate.run(draft, new Date());
    if (!result) throw new Error('Saved data version ' + c.state.schemaVersion + ' cannot be upgraded automatically. Restore a backup or contact support.');
    commit(c, draft, 'system', null, () => setMeta(db, 'schemaVersion', draft.schemaVersion));
    return true;
  }

  // ---------- comparing and saving ----------

  function recordsOf(state) {
    const out = new Map();
    Object.entries(COLLECTIONS).forEach(([kind, key]) => (state[key] || []).forEach((r) => out.set(kind + ':' + r.id, r)));
    Object.entries(state.capacity || {}).forEach(([week, r]) => out.set('capacity:' + week, r));
    return out;
  }

  function changedFields(a, b) {
    if (!a || !b) return Object.keys(a || b);
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    return Array.from(keys).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }

  function diff(before, after) {
    const A = recordsOf(before);
    const B = recordsOf(after);
    const changes = [];
    B.forEach((rec, key) => {
      const fields = changedFields(A.get(key), rec);
      if (fields.length) changes.push({ key, rec, fields, created: !A.has(key) });
    });
    A.forEach((rec, key) => { if (!B.has(key)) changes.push({ key, rec: null, fields: Object.keys(rec), deleted: true }); });
    const newLog = (after.log || []).slice((before.log || []).length);
    return { changes, newLog };
  }

  /** Throws a conflict if a field this change touches was changed by someone else after `base`. */
  function checkConflicts(c, changes, base) {
    if (base === null || base === undefined) return;
    const found = [];
    changes.forEach((ch) => {
      if (ch.created) return;
      const m = c.meta[ch.key];
      if (!m) return;
      const clash = ch.fields.filter((f) => !MERGEABLE.includes(f) && m.fieldRevs[f] && m.fieldRevs[f].rev > base);
      if (clash.length) found.push({ ch, m, clash });
    });
    if (!found.length) return;
    const parts = found.map(({ ch, m, clash }) => {
      const [kind, id] = ch.key.split(':');
      const old = recordsOf(c.state).get(ch.key) || {};
      const what = kind === 'task' ? '“' + old.title + '”' : kind === 'meeting' ? 'the meeting “' + (old.purpose || '') + '”' : kind === 'proposal' ? 'the schedule change for the week of ' + WH.dates.fmtWeek(old.weekStart) : kind === 'capacity' ? 'capacity for the week of ' + WH.dates.fmtWeek(id) : 'the event “' + (old.title || '') + '”';
      // Name each person who changed one of these fields, with the time of their latest change.
      const byPerson = {};
      clash.forEach((f) => {
        const fr = m.fieldRevs[f];
        const p = byPerson[fr.by] = byPerson[fr.by] || { labels: [], at: fr.at };
        const label = FIELD_LABELS[f] || 'details';
        if (!p.labels.includes(label)) p.labels.push(label);
        if (fr.at > p.at) p.at = fr.at;
      });
      return Object.entries(byPerson).map(([by, p]) => WH.people.name(by) + ' changed ' + what + ' (' + p.labels.join(', ') + ') at ' + WH.dates.fmtStamp(p.at)).join('; ');
    });
    throw new ApiError(409, 'Not saved, so nothing was overwritten. ' + parts.join('; ') + ', after you opened it. The latest version is now shown: check it, then try again.', { error: 'conflict' });
  }

  /** Saves the difference between the cached state and `after` in one transaction. */
  function commit(c, after, actor, base, inTransaction) {
    const { changes, newLog } = diff(c.state, after);
    checkConflicts(c, changes, base);
    if (!changes.length && !newLog.length && !inTransaction) return c.rev;
    const rev = c.rev + 1;
    const at = new Date().toISOString();
    transaction(db, () => {
      const upsert = db.prepare('INSERT INTO records (kind, id, data, rev, field_revs, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, field_revs = excluded.field_revs, updated_by = excluded.updated_by, updated_at = excluded.updated_at');
      const del = db.prepare('DELETE FROM records WHERE kind = ? AND id = ?');
      changes.forEach((ch) => {
        const [kind, id] = [ch.key.slice(0, ch.key.indexOf(':')), ch.key.slice(ch.key.indexOf(':') + 1)];
        if (ch.deleted) { del.run(kind, id); delete c.meta[ch.key]; return; }
        const fieldRevs = Object.assign({}, (c.meta[ch.key] || {}).fieldRevs);
        ch.fields.forEach((f) => { fieldRevs[f] = { rev, by: actor, at }; });
        upsert.run(kind, id, JSON.stringify(ch.rec), rev, JSON.stringify(fieldRevs), actor, at);
        c.meta[ch.key] = { fieldRevs, updatedBy: actor, updatedAt: at };
      });
      const addLog = db.prepare('INSERT INTO activity (data) VALUES (?)');
      newLog.forEach((entry) => addLog.run(JSON.stringify(entry)));
      if (inTransaction) inTransaction();
      setMeta(db, 'rev', rev);
    });
    c.state = after;
    c.rev = rev;
    return rev;
  }

  /** Revision bump for changes outside records (accounts), so open pages refresh the people list. */
  function bump() {
    const c = current();
    c.rev += 1;
    setMeta(db, 'rev', c.rev);
  }

  function collectIds(state) {
    const ids = new Set();
    recordsOf(state).forEach((r) => {
      if (r.id) ids.add(r.id);
      ['comments', 'links', 'documents'].forEach((k) => (r[k] || []).forEach((x) => x && x.id && ids.add(x.id)));
    });
    return ids;
  }

  // ---------- commands from the browser ----------

  function runCommands(user, base, commands) {
    if (!Number.isInteger(base) || base < 0) throw new ApiError(400, 'Missing workspace revision. Reload the page.');
    if (!Array.isArray(commands) || !commands.length || commands.length > 10) throw new ApiError(400, 'No change was sent.');
    const c = current();
    if (base > c.rev) throw new ApiError(400, 'Unknown workspace revision. Reload the page.');
    refreshPeople();
    const draft = clone(c.state);
    const used = collectIds(draft);
    const results = [];
    try {
      commands.forEach((cmd) => {
        if (!cmd || !COMMANDS.includes(cmd.op) || !Array.isArray(cmd.args) || cmd.args.length > 5) throw new ApiError(400, 'This change is not allowed.');
        const offered = Array.isArray(cmd.ids) ? cmd.ids.slice(0, 50) : [];
        // Reuse the ids the browser created, after checking them, so links in the page stay valid.
        WH.util.setUidHook((prefix, generate) => {
          const next = offered.shift();
          const id = typeof next === 'string' && ID_RE.test(next) && next.startsWith(prefix + '-') && !used.has(next) ? next : generate();
          used.add(id);
          return id;
        });
        const r = W[cmd.op].apply(null, [draft, user.id].concat(clone(cmd.args)));
        results.push(r && r.id ? { id: r.id } : null);
      });
    } catch (e) {
      throw toApiError(e);
    } finally {
      WH.util.setUidHook(null);
    }
    commit(c, draft, user.id, base);
    return { results };
  }

  function toApiError(e) {
    if (e instanceof ApiError) return e;
    if (e instanceof WH.util.PermissionError) return new ApiError(403, e.message, { error: 'permission' });
    if (e instanceof WH.util.ValidationError) return new ApiError(400, e.message, { error: 'validation', fields: e.fields });
    return e;
  }

  // ---------- what each person may see ----------

  const TASK_SUMMARY = ['id', 'title', 'requesterId', 'status', 'priority', 'estimateHours', 'remainingHours', 'agreedDeadline', 'requestedDeadline',
    'dateUnknown', 'deadlineFixed', 'allocations', 'coveredBySocial', 'approvalRequired', 'plannedDates', 'createdAt', 'project', 'deliverableType',
    'requestedUrgency', 'completedAt', 'completedBy', 'sample'];

  function viewTask(t, userId) {
    if (P.can(userId, 'task.viewDetails', t)) return t;
    const out = { restricted: true, documents: [], links: [], comments: [], history: [], blocked: t.blocked ? { reason: 'Blocked (details are private)', at: t.blocked.at, by: t.blocked.by } : null };
    TASK_SUMMARY.forEach((k) => { if (k in t) out[k] = t[k]; });
    if (t.approval) out.approval = { requestedAt: t.approval.requestedAt, decision: t.approval.decision, decidedAt: t.approval.decidedAt, decidedBy: t.approval.decidedBy, completedAt: t.approval.completedAt };
    return out;
  }

  function viewMeeting(m, userId) {
    if (m.requesterId === userId || P.isOwner(userId) || P.isExec(userId)) return m;
    return { id: m.id, requesterId: m.requesterId, purpose: 'Meeting with Maha', location: '', taskId: null, date: m.date, start: m.start, durationMin: m.durationMin,
      status: m.status, counter: m.counter ? { date: m.counter.date, start: m.counter.start, durationMin: m.counter.durationMin } : null, responseNote: '', history: [], createdAt: m.createdAt, restricted: true };
  }

  function viewFor(user) {
    const c = current();
    refreshPeople();
    const s = c.state;
    return {
      rev: c.rev,
      people: WH.people.PEOPLE,
      state: {
        schemaVersion: s.schemaVersion, tasks: s.tasks.map((t) => viewTask(t, user.id)), meetings: s.meetings.map((m) => viewMeeting(m, user.id)),
        events: s.events, proposals: s.proposals, capacity: s.capacity, log: (P.isOwner(user.id) || P.isExec(user.id)) ? s.log.slice(-200) : []
      }
    };
  }

  function rev() { return current().rev; }

  // ---------- documents ----------

  function safeName(name) {
    return String(name || 'file').replace(/[\\/\0-\x1f\x7f]/g, '_').replace(/^\.+/, '_').slice(0, 200) || 'file';
  }

  /** Stores an uploaded file and attaches it to the task, as one change. */
  function addFile(user, taskId, name, type, buffer, base) {
    if (!buffer.length) throw new ApiError(400, 'The file is empty.', { error: 'validation', fields: { file: 'The file is empty.' } });
    if (buffer.length > MAX_FILE_BYTES) throw new ApiError(413, name + ' is larger than 10 MB. Attach a link to it instead.', { error: 'validation', fields: { file: 'Files can be up to 10 MB.' } });
    const c = current();
    refreshPeople();
    const task = c.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError(404, 'Task not found.');
    if (!P.can(user.id, 'task.addDocument', task)) throw new ApiError(403, WH.people.name(user.id) + ' cannot add documents to this task.', { error: 'permission' });
    const id = 'doc-' + crypto.randomBytes(9).toString('hex');
    const cleanType = /^[\w.+-]+\/[\w.+-]+$/.test(type || '') ? type : 'application/octet-stream';
    const draft = clone(c.state);
    let doc;
    try { doc = W.addDocument(draft, user.id, taskId, { id, name: safeName(name), size: buffer.length, type: cleanType, stored: true }); } catch (e) { throw toApiError(e); }
    const tmp = path.join(filesDir, id + '.part');
    fs.writeFileSync(tmp, buffer, { mode: 0o600 });
    try {
      commit(c, draft, user.id, base, () => {
        db.prepare('INSERT INTO files (id, task_id, name, type, size, sha256, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, taskId, doc.name, cleanType, buffer.length, crypto.createHash('sha256').update(buffer).digest('hex'), user.id, new Date().toISOString());
      });
      fs.renameSync(tmp, path.join(filesDir, id));
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      throw e;
    }
    return doc;
  }

  /** A file can be downloaded by the requester of its task, Maha and Carla. */
  function fileFor(user, fileId) {
    const row = typeof fileId === 'string' && /^doc-[a-f0-9]{18}$/.test(fileId) ? db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) : null;
    if (!row) throw new ApiError(404, 'File not found.');
    refreshPeople();
    const task = current().state.tasks.find((t) => t.id === row.task_id);
    if (!task || !P.can(user.id, 'task.viewDetails', task)) throw new ApiError(403, 'You do not have access to this file.');
    return { path: path.join(filesDir, row.id), name: row.name, type: row.type, size: row.size };
  }

  // ---------- export and import (explicit only) ----------

  function exportTasks(user) {
    if (!P.isOwner(user.id)) throw new ApiError(403, 'Only Maha can export the workspace tasks.');
    const c = current();
    const files = {};
    db.prepare('SELECT * FROM files').all().forEach((f) => {
      const p = path.join(filesDir, f.id);
      if (fs.existsSync(p)) files[f.id] = { name: f.name, type: f.type, data: fs.readFileSync(p).toString('base64') };
    });
    return { format: 'wh-comms-tasks', version: 1, source: 'team-workspace', exportedAt: new Date().toISOString(), schemaVersion: c.state.schemaVersion,
      people: auth.listUsers(db).map((u) => ({ id: u.id, name: u.name })), tasks: c.state.tasks, files };
  }

  const TASK_FIELDS = ['title', 'description', 'project', 'deliverableType', 'audience', 'purpose', 'requestedDeadline', 'dateUnknown', 'deadlineReason', 'deadlineFixed',
    'requestedUrgency', 'urgencyReason', 'materials', 'missingInfo', 'notes', 'status', 'blocked', 'priority', 'priorityReason', 'estimateHours', 'remainingHours',
    'agreedDeadline', 'allocations', 'coveredBySocial', 'approvalRequired', 'approval', 'plannedDates', 'createdAt', 'completedAt', 'completedBy', 'completionNote'];

  /**
   * Imports tasks from an export file chosen by Maha. Sample (fictional) tasks are always skipped,
   * and tasks already imported from the same export are not imported twice.
   * requesterMap: { idInFile: accountId } for the person each request should belong to.
   */
  function importTasks(user, payload, base) {
    if (!P.isOwner(user.id)) throw new ApiError(403, 'Only Maha can import tasks.');
    if (!payload || payload.format !== 'wh-comms-tasks' || !Array.isArray(payload.tasks)) throw new ApiError(400, 'This is not a task export from the Communications Workspace.');
    const c = current();
    refreshPeople();
    const accounts = auth.listUsers(db);
    const peopleInFile = Object.fromEntries((payload.people || []).filter((p) => p && typeof p.id === 'string').map((p) => [p.id, String(p.name || '').slice(0, 120)]));
    const map = payload.requesterMap || {};
    const wanted = Array.isArray(payload.selected) ? new Set(payload.selected) : null;
    const personFor = (id) => {
      if (map[id] && accounts.some((a) => a.id === map[id])) return map[id];
      const nm = peopleInFile[id];
      const match = nm && accounts.find((a) => a.name.toLowerCase() === nm.toLowerCase());
      if (match) return match.id;
      if (id === 'system') return 'system';
      return 'former:' + (nm || 'Unknown person');
    };
    const draft = clone(c.state);
    const already = new Set(draft.tasks.map((t) => t.importedFrom).filter(Boolean));
    const files = payload.files || {};
    const newFiles = [];
    const report = { imported: 0, skippedSample: 0, skippedDuplicate: 0, skippedInvalid: 0, filesStored: 0, filesMissing: 0 };
    const at = new Date().toISOString();
    payload.tasks.forEach((src) => {
      if (!src || typeof src !== 'object') { report.skippedInvalid += 1; return; }
      if (wanted && !wanted.has(src.id)) return;
      if (src.sample) { report.skippedSample += 1; return; }
      const origin = String(payload.exportedAt || '') + '/' + String(src.id || '');
      if (already.has(origin)) { report.skippedDuplicate += 1; return; }
      if (typeof src.title !== 'string' || !src.title.trim() || !W.STATUSES[src.status]) { report.skippedInvalid += 1; return; }
      const t = {};
      TASK_FIELDS.forEach((k) => { if (k in src) t[k] = clone(src[k]); });
      t.title = src.title.slice(0, 120);
      t.id = WH.util.uid('task');
      t.importedFrom = origin;
      t.sample = false;
      t.requesterId = personFor(src.requesterId);
      if (t.requesterId.startsWith('former:') || t.requesterId === 'system') t.requesterId = user.id;
      t.allocations = Array.isArray(t.allocations) ? t.allocations.filter((a) => a && WH.dates.isISODate(a.weekStart) && Number(a.hours) >= 0) : [];
      t.plannedDates = Array.isArray(t.plannedDates) ? t.plannedDates.filter((d) => WH.dates.isISODate(d)) : [];
      if (t.approvalRequired === undefined) t.approvalRequired = !P.isOwner(t.requesterId);
      if (t.approval && t.approval.completedBy) t.approval.completedBy = personFor(t.approval.completedBy);
      if (t.approval && t.approval.decidedBy) t.approval.decidedBy = personFor(t.approval.decidedBy);
      if (t.completedBy) t.completedBy = personFor(t.completedBy);
      t.comments = (Array.isArray(src.comments) ? src.comments : []).filter((x) => x && typeof x.text === 'string')
        .map((x) => ({ id: WH.util.uid('cmt'), by: personFor(x.by), at: String(x.at || at), text: x.text.slice(0, 5000), kind: x.kind || 'comment' }));
      t.links = (Array.isArray(src.links) ? src.links : []).filter((x) => x && /^https?:\/\//i.test(String(x.url || '')))
        .map((x) => ({ id: WH.util.uid('lnk'), url: String(x.url).slice(0, 1000), label: String(x.label || x.url).slice(0, 120), addedBy: personFor(x.addedBy), addedAt: String(x.addedAt || at) }));
      t.documents = [];
      (Array.isArray(src.documents) ? src.documents : []).forEach((d) => {
        if (!d || !d.name) return;
        const f = d.stored && files[d.id];
        const buf = f && typeof f.data === 'string' ? Buffer.from(f.data, 'base64') : null;
        const ok = buf && buf.length > 0 && buf.length <= MAX_FILE_BYTES;
        const id = ok ? 'doc-' + crypto.randomBytes(9).toString('hex') : WH.util.uid('doc');
        const type = ok && /^[\w.+-]+\/[\w.+-]+$/.test(f.type || '') ? f.type : 'application/octet-stream';
        if (ok) { newFiles.push({ id, taskId: t.id, name: safeName(d.name), type, buf }); report.filesStored += 1; } else if (d.stored) report.filesMissing += 1;
        t.documents.push({ id, name: safeName(d.name), size: ok ? buf.length : (d.size || 0), type, stored: !!ok, addedBy: personFor(d.addedBy), addedAt: String(d.addedAt || at) });
      });
      t.history = (Array.isArray(src.history) ? src.history : []).filter((h) => h && h.action)
        .map((h) => ({ at: String(h.at || at), by: personFor(h.by), action: String(h.action).slice(0, 200), detail: String(h.detail || '').slice(0, 2000) }));
      t.history.push({ at, by: user.id, action: 'Imported', detail: 'Imported into the team workspace from an export made ' + (payload.exportedAt ? WH.dates.fmtStamp(payload.exportedAt) : 'earlier') +
        (src.requesterId && t.requesterId === user.id && !P.isOwner(src.requesterId) && peopleInFile[src.requesterId] ? '. Originally requested by ' + peopleInFile[src.requesterId] : '') + '.' });
      draft.tasks.push(t);
      report.imported += 1;
    });
    if (!report.imported) return report;
    draft.log.push({ at, by: user.id, action: 'Tasks imported', detail: report.imported + ' task(s) imported from an export file.', ref: null });
    const written = [];
    try {
      newFiles.forEach((f) => { fs.writeFileSync(path.join(filesDir, f.id), f.buf, { mode: 0o600 }); written.push(f.id); });
      commit(c, draft, user.id, base, () => {
        const ins = db.prepare('INSERT INTO files (id, task_id, name, type, size, sha256, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        newFiles.forEach((f) => ins.run(f.id, f.taskId, f.name, f.type, f.buf.length, crypto.createHash('sha256').update(f.buf).digest('hex'), user.id, at));
      });
    } catch (e) {
      written.forEach((id) => fs.rmSync(path.join(filesDir, id), { force: true }));
      throw toApiError(e);
    }
    return report;
  }

  return { load, migrate, rev, bump, runCommands, viewFor, addFile, fileFor, exportTasks, importTasks, refreshPeople, ApiError };
}

module.exports = { createWorkspace, ApiError, COMMANDS, MAX_FILE_BYTES };
