/*
 * Workspace settings (team workspace, Maha only): people, invitation links, importing tasks
 * from an export file, and backups. Also the demo's "Export tasks to keep".
 */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const D = WH.dates;
  const ui = WH.ui;
  const P = WH.permissions;

  const ROLE_LABEL = { owner: 'Workspace owner', executive: 'Executive Director', manager: 'Manager' };
  const STATUS_LABEL = { valid: 'Not used yet', used: 'Used', expired: 'Expired', revoked: 'Cancelled', invalid: 'Not valid' };

  function load(app) {
    const t = app.ui.team;
    if (t && (t.loading || t.fetchedRev === app.rev)) return;
    const rev = app.rev;
    app.ui.team = Object.assign({}, t, { loading: true });
    WH.remote.admin.team().then((d) => { app.ui.team = Object.assign({}, app.ui.team, d, { loading: false, fetchedRev: rev }); app.render({ keepInputs: true }); })
      .catch((e) => { app.ui.team = { error: e.message }; app.render(); });
  }

  function linkBox(label, link, expiresAt) {
    return '<div class="callout link-callout" role="status"><p><strong>' + esc(label) + '</strong></p>' +
      '<div class="link-box"><input type="text" readonly id="new-link" value="' + esc(link) + '" aria-label="Link">' +
      '<button type="button" class="btn small" data-action="copy-link">Copy</button></div>' +
      '<p class="small">Not sent. Copy it and share it privately with that person when the pilot starts. It works once. It expires ' + esc(D.fmtStamp(expiresAt)) + '</p></div>';
  }

  function people(app, t) {
    const users = t.users || [];
    if (!users.length) return '<p class="empty">No accounts yet.</p>';
    return '<ul class="rows">' + users.map((u) => '<li><div class="row-line"><span class="row-title">' + esc(u.name) + '</span>' +
      (u.inactive ? '<span class="chip s-cancelled">Turned off</span>' : '<span class="chip">' + esc(ROLE_LABEL[u.role]) + '</span>') + '</div>' +
      '<div class="row-meta"><span>' + esc(u.title) + '</span><span>' + esc(u.email) + '</span></div>' +
      (u.role === 'manager'
        ? '<div class="btn-row row-actions"><button type="button" class="linklike" data-action="user-active" data-id="' + esc(u.id) + '" data-active="' + (u.inactive ? '1' : '0') + '">' + (u.inactive ? 'Turn back on' : 'Turn off account') + '</button>' +
          (u.inactive ? '' : '<button type="button" class="linklike" data-action="user-reset" data-id="' + esc(u.id) + '">Create password reset link</button>') + '</div>'
        : '') + '</li>').join('') + '</ul>' +
      (t.resetLink ? linkBox('Password reset link for ' + t.resetLink.name, t.resetLink.link, t.resetLink.expiresAt) : '');
  }

  function invites(t) {
    const list = (t.invites || []).filter((i) => i.kind === 'invite');
    if (!list.length) return '<p class="empty">No invitation links yet.</p>';
    return '<ul class="rows">' + list.map((i) => '<li><div class="row-line"><span class="row-title">' + esc(i.name) + '</span>' +
      '<span class="chip' + (i.status === 'valid' ? ' s-scheduled' : i.status === 'used' ? ' s-complete' : '') + '">' + esc(STATUS_LABEL[i.status] || i.status) + '</span></div>' +
      '<div class="row-meta"><span>' + esc(ROLE_LABEL[i.role] || '') + '</span><span>Created ' + esc(D.fmtStamp(i.createdAt)) + '</span>' +
      (i.status === 'valid' ? '<span>Expires ' + esc(D.fmtStamp(i.expiresAt)) + '</span>' : '') + '</div>' +
      (i.status === 'valid' ? '<div class="row-actions"><button type="button" class="linklike" data-action="invite-revoke" data-id="' + esc(i.ref) + '">Cancel this link</button></div>' : '') + '</li>').join('') + '</ul>';
  }

  // ---------- import ----------

  function importPreview(app, t) {
    const imp = app.ui.importData;
    if (!imp) {
      return '<div class="field" data-field="importFile"><label for="import-file">Export file (.json) <span class="hint">Made with “Export tasks to keep” in the demo, or “Download tasks” here.</span></label>' +
        '<input type="file" id="import-file" accept=".json,application/json" data-change="import-file"></div>';
    }
    const accounts = (t.users || []).filter((u) => !u.inactive);
    const owner = accounts.find((u) => u.role === 'owner');
    const requesters = Array.from(new Set(imp.tasks.map((x) => x.requesterId)));
    const nameOf = (id) => (imp.people.find((p) => p.id === id) || {}).name || id;
    const mapFields = requesters.map((rid) => {
      const match = accounts.find((u) => u.name.toLowerCase() === String(nameOf(rid)).toLowerCase()) || owner;
      return ui.field({ name: 'map:' + rid, id: 'map-' + rid.replace(/[^\w-]/g, ''), label: 'Requests from ' + nameOf(rid) + ' belong to', type: 'select',
        options: accounts.map((u) => ({ value: u.id, label: u.name + ' (' + ROLE_LABEL[u.role] + ')' })), value: match ? match.id : '' });
    }).join('');
    return '<form data-form="import-tasks" novalidate><p><strong>' + esc(imp.fileName) + '</strong>: ' + imp.tasks.length + ' task' + (imp.tasks.length === 1 ? '' : 's') + ' you can import' +
      (imp.sampleCount ? '; ' + imp.sampleCount + ' fictional sample task' + (imp.sampleCount === 1 ? ' is' : 's are') + ' left out' : '') + '.</p>' +
      (imp.tasks.length ? '<fieldset><legend>Tasks to import</legend>' + imp.tasks.map((x) => ui.checkbox({ name: 'task:' + x.id, id: 'imp-' + x.id.replace(/[^\w-]/g, ''), label: x.title + ' · ' + (WH.workflow.STATUSES[x.status] || x.status), checked: true })).join('') + '</fieldset>' +
        '<div class="form-grid">' + mapFields + '</div>' +
        '<p class="small muted">Comments and history keep the original names. Documents are included if the export contains the files.</p>' : '') +
      '<div class="btn-row form-actions">' + (imp.tasks.length ? '<button type="submit" class="btn">Import selected tasks</button>' : '') +
      '<button type="button" class="btn" data-action="import-clear">Choose another file</button></div></form>';
  }

  WH.actions['import-file'] = (app, el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    file.text().then((text) => {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('This file is not a task export.'); }
      if (!data || data.format !== 'wh-comms-tasks' || !Array.isArray(data.tasks)) throw new Error('This file is not a task export from the Communications Workspace.');
      const real = data.tasks.filter((x) => x && !x.sample);
      app.ui.importData = { fileName: file.name, data, tasks: real, sampleCount: data.tasks.length - real.length, people: data.people || [] };
      app.render();
    }).catch((e) => app.toast(e.message, 'error'));
  };

  WH.actions['import-clear'] = (app) => { app.ui.importData = null; app.render(); };

  WH.forms['import-tasks'] = (app, form, d) => {
    const imp = app.ui.importData;
    const selected = imp.tasks.filter((x) => d['task:' + x.id]).map((x) => x.id);
    if (!selected.length) { app.showErrors(form, { _: 'Tick at least one task to import.' }); return; }
    const requesterMap = {};
    Object.keys(d).filter((k) => k.startsWith('map:')).forEach((k) => { requesterMap[k.slice(4)] = d[k]; });
    form.querySelector('button[type="submit"]').disabled = true;
    WH.remote.admin.importTasks(app, Object.assign({}, imp.data, { selected, requesterMap })).then((r) => {
      app.ui.importData = null;
      app.render();
      app.toast('Imported ' + r.imported + ' task' + (r.imported === 1 ? '' : 's') + (r.skippedDuplicate ? '; ' + r.skippedDuplicate + ' already imported earlier' : '') +
        (r.filesStored ? '; ' + r.filesStored + ' document' + (r.filesStored === 1 ? '' : 's') + ' stored' : '') + (r.filesMissing ? '; ' + r.filesMissing + ' document file(s) were not in the export' : '') + '.');
    }).catch((e) => { form.querySelector('button[type="submit"]').disabled = false; app.handleError(e, form); });
  };

  // ---------- page ----------

  WH.views.settings = function (app) {
    if (!P.isOwner(app.user)) return '<h1>Workspace settings</h1><p>Only Maha (workspace owner) can open this page.</p>';
    load(app);
    const t = app.ui.team || {};
    if (t.error) return '<h1>Workspace settings</h1><div class="callout danger"><p>' + esc(t.error) + '</p></div>';
    const inviteForm = '<form data-form="invite" novalidate><div class="form-grid">' +
      ui.field({ name: 'name', label: 'Name', required: true }) + ui.field({ name: 'title', label: 'Job title' }) +
      ui.field({ name: 'email', label: 'Work email', type: 'email', hint: 'Optional. If entered, only this email can be used.', wide: true }) + '</div>' +
      '<div class="btn-row form-actions"><button type="submit" class="btn primary">Create invitation link</button></div></form>' +
      (t.newInvite ? linkBox('Invitation link for ' + t.newInvite.name, t.newInvite.link, t.newInvite.expiresAt) : '') +
      '<p class="small muted">Managers only. Accounts for Carla and for you are created by whoever runs the server, so nobody can give themselves Carla’s permissions here (see docs/pilot-setup.md).</p>';
    return '<div class="page-head"><div><p class="eyebrow">Private pilot</p><h1>Workspace settings</h1>' +
      '<p class="muted">Accounts, invitation links, bringing in tasks you want to keep, and backups. Nothing here sends email.</p></div></div>' +
      (t.loading && !t.users ? '<p class="muted">Loading…</p>' : '') +
      '<div class="settings-grid">' +
      '<section class="card"><h2>Invite a manager</h2>' + inviteForm + '</section>' +
      '<section class="card"><h2>People</h2>' + people(app, t) + '</section>' +
      '<section class="card"><h2>Invitation links</h2>' + invites(t) + '</section>' +
      '<section class="card"><h2>Bring in tasks you want to keep</h2><p class="small">Nothing is imported automatically. Choose an export file, check the list, then import. Fictional sample tasks are always left out, and tasks already imported from the same file are skipped.</p>' +
      importPreview(app, t) + '</section>' +
      '<section class="card"><h2>Backups</h2><p class="small">The server keeps a backup every day (the newest 14). Also download one each week and keep it in a private, approved place (see docs/backup-and-recovery.md). A backup includes all tasks, history, documents and accounts.</p>' +
      '<div class="btn-row"><a class="btn" href="/api/admin/backup" download>Download full backup</a><a class="btn" href="/api/admin/export" download>Download tasks (.json)</a></div></section>' +
      '</div>';
  };

  WH.forms.invite = (app, form, d) => {
    form.querySelector('button[type="submit"]').disabled = true;
    WH.remote.admin.invite({ name: d.name, title: d.title, email: d.email }).then((r) => {
      app.ui.team = Object.assign({}, app.ui.team, { invites: r.invites, newInvite: { name: d.name, link: r.link, expiresAt: r.expiresAt } });
      app.render();
      const box = document.getElementById('new-link');
      if (box) { box.focus(); box.select(); }
    }).catch((e) => { form.querySelector('button[type="submit"]').disabled = false; app.handleError(e, form); });
  };

  WH.actions['copy-link'] = (app) => {
    const box = document.getElementById('new-link');
    if (!box) return;
    box.select();
    const done = () => app.toast('Link copied. It has not been sent to anyone.');
    if (navigator.clipboard) navigator.clipboard.writeText(box.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  };

  WH.actions['invite-revoke'] = (app, el) => {
    if (!window.confirm('Cancel this invitation link? It will stop working.')) return;
    WH.remote.admin.revoke(el.getAttribute('data-id')).then((r) => { app.ui.team = Object.assign({}, app.ui.team, { invites: r.invites, newInvite: null }); app.render(); app.toast('Invitation link cancelled.'); })
      .catch((e) => app.handleError(e));
  };

  WH.actions['user-active'] = (app, el) => {
    const on = el.getAttribute('data-active') === '1';
    if (!on && !window.confirm('Turn off this account? The person is signed out and cannot sign in. Their requests and history stay.')) return;
    WH.remote.admin.setActive(el.getAttribute('data-id'), on).then((r) => { app.ui.team = Object.assign({}, app.ui.team, { users: r.users }); app.render(); app.toast(on ? 'Account turned back on.' : 'Account turned off.'); })
      .catch((e) => app.handleError(e));
  };

  WH.actions['user-reset'] = (app, el) => {
    const id = el.getAttribute('data-id');
    const u = (app.ui.team.users || []).find((x) => x.id === id);
    WH.remote.admin.resetLink(id).then((r) => { app.ui.team = Object.assign({}, app.ui.team, { resetLink: { name: u ? u.name : '', link: r.link, expiresAt: r.expiresAt } }); app.render(); })
      .catch((e) => app.handleError(e));
  };

  // ---------- demo: export tasks to keep ----------

  function toBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  WH.actions['export-demo-tasks'] = (app) => {
    const tasks = app.state.tasks.filter((t) => !t.sample);
    if (!tasks.length) { app.toast('There are no tasks of your own to export. Fictional sample tasks are never exported.', 'warn'); return; }
    const files = {};
    const docs = [];
    tasks.forEach((t) => (t.documents || []).forEach((d) => { if (d.stored) docs.push(d); }));
    Promise.all(docs.map((d) => WH.store.getFile(d.id).then((rec) => (rec ? toBase64(rec.blob).then((data) => { files[d.id] = { name: d.name, type: d.type, data }; }) : null)).catch(() => null)))
      .then(() => {
        const payload = { format: 'wh-comms-tasks', version: 1, source: 'demo-browser', exportedAt: new Date().toISOString(), schemaVersion: app.state.schemaVersion,
          people: WH.people.PEOPLE.map((p) => ({ id: p.id, name: p.name })), tasks, files };
        WH.remote.saveBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'my-tasks-export-' + WH.workflow.today() + '.json');
        app.toast('Exported ' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + ' (sample tasks left out). In the team workspace, Maha can import the file under Workspace settings.');
      });
  };
})(globalThis.WH = globalThis.WH || {});
