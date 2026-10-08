/*
 * Request a task (new and edit) and Request a meeting. Both open in the side panel.
 * Only the title is required: managers can send an incomplete brief and add details later.
 */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const D = WH.dates;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress'];

  // ---------- task request ----------

  WH.panels.requestForm = function (app, params) {
    const editing = params && params[0];
    const isMaha = app.user === 'maha';
    let t = {};
    if (editing) {
      t = app.state.tasks.find((x) => x.id === editing);
      if (!t) return { title: 'Task not found', html: '<p>This task does not exist.</p>' };
      if (!P.can(app.user, 'task.editBrief', t)) {
        return { title: 'Edit request', html: '<div class="callout warn"><p>Only ' + esc(people.name(t.requesterId)) + ' can edit this brief' +
          (['complete', 'cancelled', 'archived'].includes(t.status) ? ', and closed requests cannot be edited' : '') + '.</p></div>' +
          '<p><a href="#/tasks/' + encodeURIComponent(t.id) + '">Back to the task</a></p>' };
      }
    }
    const projects = Array.from(new Set(app.state.tasks.map((x) => x.project).filter(Boolean))).sort();
    const types = [{ value: '', label: 'Choose one (optional)' }].concat(W.DELIVERABLE_TYPES.map((d) => ({ value: d, label: d })));
    const urgencies = Object.keys(W.URGENCY).map((k) => ({ value: k, label: W.URGENCY[k] }));
    const hasOptional = editing && ['project', 'deliverableType', 'audience', 'purpose', 'deadlineReason', 'urgencyReason', 'materials', 'missingInfo', 'notes'].some((k) => t[k]);

    const links = editing ? '' : [1, 2].map((i) => '<div class="form-grid">' +
      ui.field({ name: 'link' + i + 'url', label: 'Link ' + i, type: 'url', placeholder: 'https://' }) +
      ui.field({ name: 'link' + i + 'label', label: 'Link ' + i + ' description' }) + '</div>').join('');

    const html = '<form data-form="' + (editing ? 'request-edit' : 'request-create') + '" data-id="' + esc(editing || '') + '" novalidate>' +
      '<p class="small muted">' + (editing ? 'Update the brief any time. Changes are recorded in the activity history.'
        : isMaha ? 'A task for your own work. It goes straight onto your list.' : 'Your request goes directly to Maha. Share what you have now; you can add more later.') + '</p>' +
      '<fieldset><legend>Essentials</legend>' +
      ui.field({ name: 'title', label: 'Task title', required: true, value: t.title, hint: 'A short name, e.g. “Holiday donor card”' }) +
      ui.field({ name: 'description', label: 'Short brief', type: 'textarea', rows: 3, value: t.description, hint: 'A sentence or two is enough. You can add more later.' }) +
      '<div class="form-grid">' +
      ui.field({ name: 'requestedDeadline', label: 'Requested deadline', type: 'date', value: t.requestedDeadline, min: editing ? undefined : W.today() }) +
      '<div class="field check-field">' + ui.checkbox({ name: 'dateUnknown', label: 'Not known yet', checked: editing ? t.dateUnknown : false }).replace(/^<div class="field" data-field="dateUnknown">/, '<div data-field="dateUnknown">') + '</div>' +
      '</div></fieldset>' +
      '<details class="psec form-sec" id="form-optional"' + (hasOptional ? ' open' : '') + '><summary><span>Optional details</span></summary><div class="psec-body">' +
      '<div class="form-grid">' +
      ui.field({ name: 'audience', label: 'Audience', value: t.audience, hint: 'Who will see it?' }) +
      ui.field({ name: 'deliverableType', label: 'Deliverable', type: 'select', options: types, value: t.deliverableType }) +
      ui.field({ name: 'requestedUrgency', label: 'Requested urgency', type: 'select', options: urgencies, value: t.requestedUrgency || 'normal', hint: 'Carla sets confirmed priorities.' }) +
      ui.field({ name: 'urgencyReason', label: 'Reason for urgency', value: t.urgencyReason }) +
      ui.field({ name: 'project', label: 'Project or campaign', value: t.project }).replace('<input', '<input list="project-list"') +
      ui.field({ name: 'purpose', label: 'Purpose', value: t.purpose }) +
      ui.field({ name: 'deadlineReason', label: 'Why this date?', value: t.deadlineReason }) +
      '<div class="field check-field">' + ui.checkbox({ name: 'deadlineFixed', label: 'Date is externally fixed', checked: t.deadlineFixed }).replace(/^<div class="field" data-field="deadlineFixed">/, '<div data-field="deadlineFixed">') + '</div>' +
      '</div>' +
      '<datalist id="project-list">' + projects.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist>' +
      ui.field({ name: 'materials', label: 'Available copy, images or information', type: 'textarea', rows: 2, value: t.materials }) +
      ui.field({ name: 'missingInfo', label: 'Information still missing', type: 'textarea', rows: 2, value: t.missingInfo }) +
      ui.field({ name: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: t.notes }) +
      links + '</div></details>' +
      (editing ? '' : '<fieldset><legend>Attachments</legend><div class="field" data-field="files"><label for="f-files">Documents <span class="hint">Optional. Up to 10 MB each. Saved in this browser only.</span></label>' +
        '<input id="f-files" name="files" type="file" multiple></div></fieldset>') +
      '<div class="btn-row form-actions"><button type="submit" class="btn primary">' + (editing ? 'Save changes' : isMaha ? 'Create task' : 'Send request') + '</button>' +
      '<button type="button" class="btn" data-action="close-panel">Cancel</button></div></form>';
    return { title: editing ? 'Edit request' : isMaha ? 'Create task' : 'Request a task', eyebrow: editing ? t.title : 'New', html };
  };

  /** Saves files one by one. Only files that are confirmed stored get recorded as documents. */
  function uploadFiles(app, taskId, files) {
    let chain = Promise.resolve({ saved: 0, failed: 0 });
    files.forEach((file) => {
      chain = chain.then((acc) => WH.store.saveFile(file)
        .then((meta) => {
          W.addDocument(app.state, app.user, taskId, meta);
          WH.store.save(app.state);
          acc.saved += 1;
          return acc;
        })
        .catch((e) => {
          app.toast(file.name + ' was NOT saved: ' + e.message, 'error');
          acc.failed += 1;
          return acc;
        }));
    });
    return chain;
  }
  WH.uploadFiles = uploadFiles;

  WH.forms['request-create'] = (app, form, data) => {
    const links = [1, 2].map((i) => ({ url: data['link' + i + 'url'], label: data['link' + i + 'label'] }));
    let task;
    try {
      task = W.createTask(app.state, app.user, Object.assign({}, data, { links }));
    } catch (e) {
      app.handleError(e, form);
      return;
    }
    WH.store.save(app.state);
    const files = Array.from(data.files || []);
    const button = form.querySelector('button[type="submit"]');
    if (files.length) { button.disabled = true; button.textContent = 'Saving files…'; }
    uploadFiles(app, task.id, files).then((r) => {
      app.go('#/tasks/' + encodeURIComponent(task.id));
      app.toast((app.user === 'maha' ? 'Task created.' : 'Request sent to Maha.') + (r.saved ? ' ' + r.saved + ' document' + (r.saved > 1 ? 's' : '') + ' saved in this browser.' : ''));
    });
  };

  WH.forms['request-edit'] = (app, form, data) => {
    const id = form.getAttribute('data-id');
    app.mutate(() => W.updateBrief(app.state, app.user, id, data), 'Changes saved.', { form, go: '#/tasks/' + encodeURIComponent(id) });
  };

  // ---------- meeting request ----------

  WH.panels.meetingForm = function (app) {
    if (!P.can(app.user, 'meeting.request')) {
      return { title: 'Meetings', html: '<p>Managers request meetings with Maha. Maha answers them under Calendar → Meetings.</p>' };
    }
    const open = app.state.tasks.filter((t) => OPEN.includes(t.status));
    open.sort((a, b) => (a.requesterId === app.user ? -1 : 0) - (b.requesterId === app.user ? -1 : 0));
    const taskOptions = [{ value: '', label: 'Not related to a task' }].concat(open.map((t) => ({ value: t.id, label: t.title + ' (' + people.first(t.requesterId) + ')' })));
    const html = '<form data-form="meeting-create" novalidate>' +
      '<p class="small muted">Maha will confirm, decline or suggest another time. Times are Toronto time.</p>' +
      ui.field({ name: 'purpose', label: 'Purpose', required: true, hint: 'What do you want to cover?' }) +
      '<div class="form-grid">' +
      ui.field({ name: 'date', label: 'Preferred date', type: 'date', required: true, min: W.today() }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'start', label: 'Start time', type: 'time', required: true, value: '10:00' }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, value: 30, min: 15, max: 480, step: 5, hint: '15 minutes to 8 hours' }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'location', label: 'Location or meeting link' }) +
      '</div>' +
      ui.field({ name: 'taskId', label: 'Related task', type: 'select', options: taskOptions, value: '' }) +
      '<div id="meeting-preview" aria-live="polite"></div>' +
      '<div class="btn-row form-actions"><button type="submit" class="btn primary">Send meeting request</button><button type="button" class="btn" data-action="close-panel">Cancel</button></div>' +
      '</form>';
    return { title: 'Request a meeting', eyebrow: 'Calendar', html };
  };

  function conflictCallout(list) {
    if (!list.length) return '<p class="small muted">No conflicts with Maha’s meetings, events or capacity.</p>';
    return '<div class="callout warn small"><p><strong>Possible conflicts</strong> (you can still send it):</p><ul>' + list.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
  }
  WH.conflictCallout = conflictCallout;

  WH.actions['meeting-preview'] = (app, el) => {
    const form = el.closest('form');
    const d = app.formData(form);
    const box = form.querySelector('#meeting-preview');
    const dur = Number(d.durationMin);
    if (!D.isISODate(d.date) || !D.isTime(d.start) || !(dur >= 15)) { box.innerHTML = ''; return; }
    box.innerHTML = conflictCallout(W.meetingConflicts(app.state, d.date, d.start, dur));
  };

  WH.forms['meeting-create'] = (app, form, data) => {
    app.mutate(() => W.requestMeeting(app.state, app.user, Object.assign({}, data, { durationMin: Number(data.durationMin) })),
      'Meeting request sent to Maha. It stays pending until Maha responds.', { form, go: '#/calendar/meetings' });
  };
})(globalThis.WH = globalThis.WH || {});
