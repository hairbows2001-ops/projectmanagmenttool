/*
 * Team workspace connection (used only when the page is served by the team server,
 * which sets WH.config.mode = 'team'; the demo never uses this file's network code).
 *
 * How a change is sent
 *  - The screen calls the usual rule (for example WH.workflow.scheduleTask) through app.apply().
 *  - Here the rule first runs on a copy of the data, so mistakes show on the form at once.
 *    While it runs, the call and any new ids are recorded.
 *  - The recorded calls are sent to the server, which runs the same rules again as the
 *    signed-in person and saves them, or refuses (permission, validation, or a conflict with
 *    someone else's change). The page then shows the server's version.
 */
(function (WH) {
  'use strict';

  const isTeam = () => !!(WH.config && WH.config.mode === 'team');

  const COMMANDS = [
    'createTask', 'updateBrief', 'addComment', 'addLink',
    'requestClarification', 'provideInfo', 'setEstimate', 'setRemaining', 'scheduleTask', 'setCoveredBySocial', 'startWork',
    'setBlocked', 'clearBlocked', 'planToday', 'completeTask', 'requestApproval', 'approveWork', 'requestChanges', 'setApprovalRequired',
    'setPriority', 'cancelTask', 'archiveTask',
    'createProposal', 'confirmProposal', 'declineProposal',
    'requestMeeting', 'respondMeeting', 'acceptCounter', 'withdrawMeeting',
    'setCapacity', 'clearCapacity', 'addEvent', 'removeEvent'
  ];

  class ConflictError extends Error {
    constructor(message) { super(message); this.name = 'ConflictError'; }
  }
  class SignInError extends Error {
    constructor(message) { super(message); this.name = 'SignInError'; }
  }

  // ---------- talking to the server ----------

  function errorFrom(status, data) {
    const message = (data && data.message) || 'The server could not complete this (error ' + status + ').';
    if (status === 401) return new SignInError(message);
    if (status === 409) { const e = new ConflictError(message); e.payload = data; return e; }
    if (status === 403) return new WH.util.PermissionError(message);
    if (data && data.fields && Object.keys(data.fields).length) return new WH.util.ValidationError(data.fields, message);
    return new Error(message);
  }

  function request(method, url, body, headers) {
    const h = Object.assign({ 'X-Requested-With': 'WH' }, headers || {});
    let payload = body;
    if (body !== undefined && !(body instanceof Blob)) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    return fetch(url, { method, headers: h, body: payload, credentials: 'same-origin', cache: 'no-store' })
      .catch(() => { throw new Error('Could not reach the workspace server. Check your internet connection; nothing was saved.'); })
      .then((res) => {
        if (res.status === 204) return null;
        const json = (res.headers.get('content-type') || '').includes('application/json');
        return (json ? res.json() : Promise.resolve(null)).then((data) => {
          if (!res.ok) throw errorFrom(res.status, data);
          return data;
        });
      });
  }

  // One change at a time, in order.
  let chain = Promise.resolve();
  function queued(fn) {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  }

  /** Takes the server's version of the data for this person. */
  function adopt(app, data) {
    if (!data || !data.state) return;
    WH.people.setPeople(data.people);
    app.state = data.state;
    app.rev = data.rev;
    app.me = data.user;
    app.user = data.user.id;
  }

  // ---------- recording changes ----------

  let recording = null;
  let depth = 0;

  function wrapRules() {
    const W = WH.workflow;
    if (W.__recorded) return;
    COMMANDS.forEach((name) => {
      const original = W[name];
      W[name] = function () {
        const args = Array.prototype.slice.call(arguments);
        if (!recording || depth > 0) return original.apply(this, args);
        const entry = { op: name, args: JSON.parse(JSON.stringify(args.slice(2))), ids: [] };
        depth += 1;
        recording.current = entry;
        try {
          const r = original.apply(this, args);
          recording.list.push(entry);
          return r;
        } finally {
          depth -= 1;
          recording.current = null;
        }
      };
    });
    W.__recorded = true;
    WH.util.setUidHook((prefix, generate) => {
      const id = generate();
      if (recording && recording.current) recording.current.ids.push(id);
      return id;
    });
  }

  /** Runs fn on a copy, then sends the recorded change. Resolves with fn's result. */
  function apply(app, fn, base) {
    const real = app.state;
    const draft = WH.util.clone(real);
    let result;
    let list = [];
    recording = { list: [], current: null };
    app.state = draft;
    try {
      result = fn();
    } catch (e) {
      return Promise.reject(e);
    } finally {
      app.state = real;
      list = recording.list;
      recording = null;
    }
    if (!list.length) return Promise.resolve(result);
    app.busy = true;
    return queued(() => request('POST', '/api/commands', { base: base === undefined ? app.rev : base, commands: list }))
      .then((data) => { adopt(app, data); return result; })
      .catch((e) => { if (e instanceof ConflictError) adopt(app, e.payload); throw e; })
      .finally(() => { app.busy = false; });
  }

  // ---------- keeping the page current ----------

  let timer = null;
  function poll(app) {
    if (!app.user || app.busy || document.visibilityState !== 'visible') return;
    request('GET', '/api/state?since=' + encodeURIComponent(app.rev)).then((data) => {
      if (!data || app.busy) return;
      adopt(app, data);
      app.render({ keepInputs: true, keepBase: true });
    }).catch((e) => { if (e instanceof SignInError) app.signedOut('You were signed out. Please sign in again.'); });
  }

  function startPolling(app) {
    stopPolling();
    timer = setInterval(() => poll(app), 15000);
  }
  function stopPolling() { if (timer) clearInterval(timer); timer = null; }

  function init(app) {
    wrapRules();
    document.addEventListener('visibilitychange', () => poll(app));
    window.addEventListener('focus', () => poll(app));
    return request('GET', '/api/session').then((data) => {
      adopt(app, data);
      startPolling(app);
      return true;
    }).catch((e) => {
      if (e instanceof SignInError) return false;
      throw e;
    });
  }

  function signIn(app, email, password) {
    return request('POST', '/api/signin', { email, password }).then((data) => { adopt(app, data); startPolling(app); return data; });
  }

  function signOut(app) {
    stopPolling();
    return request('POST', '/api/signout', {}).catch(() => {}).then(() => {
      app.user = null; app.state = null; app.me = null; app.rev = 0;
    });
  }

  function describeLink(kind, token) { return request('POST', '/api/token', { kind, token }); }

  function useLink(app, kind, token, fields) {
    return request('POST', kind === 'invite' ? '/api/join' : '/api/reset', Object.assign({ token }, fields))
      .then((data) => { adopt(app, data); startPolling(app); return data; });
  }

  // ---------- documents ----------

  function uploadFiles(app, taskId, files) {
    let acc = Promise.resolve({ saved: 0, failed: 0 });
    files.forEach((file) => {
      acc = acc.then((r) => queued(() => request('POST', '/api/files?task=' + encodeURIComponent(taskId) + '&base=' + app.rev, file,
        { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream' }))
        .then((data) => { adopt(app, data); r.saved += 1; return r; })
        .catch((e) => { app.toast(file.name + ' was NOT uploaded: ' + e.message, 'error'); r.failed += 1; return r; }));
    });
    return acc;
  }

  /**
   * Downloads a document. The server sends it as an attachment with its original name, which is the
   * most reliable way across Edge, Chrome and Safari. A quick check first turns "no access" into a
   * message instead of a downloaded error page.
   */
  function download(app, id, name) {
    const url = '/api/files/' + encodeURIComponent(id);
    return fetch(url, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' }).then((res) => {
      if (res.status === 401) throw new SignInError('Please sign in again.');
      if (!res.ok) throw new Error(res.status === 403 ? 'You do not have access to this file.' : res.status === 404 ? 'This file could not be found.' : 'Could not open the file.');
      const a = document.createElement('a');
      a.href = url;
      a.download = name || '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }).catch((e) => {
      if (e instanceof SignInError) app.signedOut(e.message);
      else app.toast(e.message === 'Failed to fetch' ? 'Could not reach the workspace server.' : e.message, 'error');
    });
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- workspace settings (Maha) ----------

  const admin = {
    team: () => request('GET', '/api/admin/team'),
    invite: (fields) => request('POST', '/api/admin/invites', fields),
    revoke: (ref) => request('POST', '/api/admin/invites/' + encodeURIComponent(ref) + '/revoke', {}),
    setActive: (id, active) => request('POST', '/api/admin/users/' + encodeURIComponent(id) + '/active', { active }),
    resetLink: (id) => request('POST', '/api/admin/users/' + encodeURIComponent(id) + '/reset-link', {}),
    importTasks: (app, body) => queued(() => request('POST', '/api/admin/import?base=' + app.rev, body)).then((data) => { adopt(app, data); return data.report; })
  };

  WH.remote = { isTeam, apply, init, signIn, signOut, describeLink, useLink, uploadFiles, download, saveBlob, admin, startPolling, stopPolling, ConflictError, SignInError };
})(globalThis.WH = globalThis.WH || {});
