/* Request a task (new and edit) and Request a meeting forms. */
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

  function requestForm(app, params) {
    const editing = params && params[0];
    let t = {};
    if (editing) {
      t = app.state.tasks.find((x) => x.id === editing);
      if (!t) return '<h1>Task not found</h1><p><a href="#/workload">Back to shared workload</a></p>';
      if (!P.can(app.user, 'task.editBrief', t)) {
        return '<h1>Edit request</h1><div class="callout warn"><p>Only ' + esc(people.name(t.requesterId)) + ' can edit this brief' +
          (['complete', 'cancelled', 'archived'].includes(t.status) ? ', and closed requests cannot be edited' : '') + '.</p></div><p><a href="#/tasks/' + encodeURIComponent(t.id) + '">Back to the task</a></p>';
      }
    }
    const me = people.get(app.user);
    const projects = Array.from(new Set(app.state.tasks.map((x) => x.project).filter(Boolean))).sort();
    const types = [{ value: '', label: 'Choose one (optional)' }].concat(W.DELIVERABLE_TYPES.map((d) => ({ value: d, label: d })));
    const urgencies = Object.keys(W.URGENCY).map((k) => ({ value: k, label: W.URGENCY[k] }));

    const linkRows = editing ? '' : [1, 2].map((i) => '<div class="form-grid">' +
      ui.field({ name: 'link' + i + 'url', label: 'Link ' + i, type: 'url', placeholder: 'https://', hint: i === 1 ? 'Shared drive, website or reference links' : '' }) +
      ui.field({ name: 'link' + i + 'label', label: 'Link ' + i + ' description' }) + '</div>').join('');

    const fileField = editing
      ? '<p class="small muted">To add documents or links, use the task page.</p>'
      : '<div class="field" data-field="files"><label for="f-files">Documents <span class="hint">Optional. Up to 10 MB each. Files are saved in this browser only (prototype).</span></label>' +
        '<input id="f-files" name="files" type="file" multiple></div>';

    return '<div class="page-head"><div><p class="eyebrow">' + (editing ? 'Edit your brief' : 'New request to communications') + '</p>' +
      '<h1>' + (editing ? 'Edit request' : 'Request a task') + '</h1>' +
      '<p>Share what you have now. You can add more details and documents later.</p></div></div>' +
      '<form class="card" data-form="' + (editing ? 'request-edit' : 'request-create') + '" data-id="' + esc(editing || '') + '" novalidate style="max-width:860px">' +
      '<fieldset><legend>The basics</legend><p class="fieldset-note">Fields marked <span class="req">*</span> are required.</p>' +
      '<p class="small">Requested by <strong>' + esc(editing ? people.name(t.requesterId) : me.name) + '</strong>, from your profile.</p>' +
      '<div class="callout info small"><p>' + (editing ? 'You can update this brief at any time. Maha sees your changes in the activity history.' : 'Your request goes directly to Maha for review, questions, an effort estimate and scheduling.') + '</p></div>' +
      ui.field({ name: 'title', label: 'Task title', required: true, value: t.title, hint: 'A short name, e.g. “Holiday donor card”' }) +
      ui.field({ name: 'description', label: 'What is needed?', type: 'textarea', required: true, value: t.description, hint: 'A few sentences is enough.' }) +
      '</fieldset>' +
      '<fieldset><legend>Details</legend><div class="form-grid">' +
      ui.field({ name: 'project', label: 'Project or campaign', value: t.project }).replace('<input', '<input list="project-list"') +
      '<datalist id="project-list">' + projects.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist>' +
      ui.field({ name: 'deliverableType', label: 'Deliverable type', type: 'select', options: types, value: t.deliverableType }) +
      ui.field({ name: 'audience', label: 'Audience', value: t.audience, hint: 'Who will see it?' }) +
      ui.field({ name: 'purpose', label: 'Purpose', value: t.purpose, hint: 'What should it achieve?' }) +
      '</div></fieldset>' +
      '<fieldset><legend>Timing</legend><div class="form-grid">' +
      ui.field({ name: 'requestedDeadline', label: 'Requested deadline', type: 'date', value: t.requestedDeadline, min: editing ? undefined : W.today() }) +
      '<div class="field" style="align-self:end">' + ui.checkbox({ name: 'dateUnknown', label: 'Date not known yet', checked: editing ? t.dateUnknown : false }).replace(/^<div class="field" data-field="dateUnknown">/, '<div data-field="dateUnknown">') + '</div>' +
      ui.field({ name: 'deadlineReason', label: 'Why this date?', value: t.deadlineReason, wide: true }) +
      ui.checkbox({ name: 'deadlineFixed', label: 'This deadline is externally fixed', hint: 'For example, a funder, printer or event date that cannot move.', checked: t.deadlineFixed, wide: true }) +
      ui.field({ name: 'requestedUrgency', label: 'Requested urgency', type: 'select', options: urgencies, value: t.requestedUrgency || 'normal', hint: 'This is a request. Carla sets confirmed priorities.' }) +
      ui.field({ name: 'urgencyReason', label: 'Why this urgency?', value: t.urgencyReason, hint: 'Required if urgent.' }) +
      '</div></fieldset>' +
      '<fieldset><legend>Materials</legend>' +
      ui.field({ name: 'materials', label: 'Available copy, images or information', type: 'textarea', value: t.materials, hint: 'Paste text or describe what you have and where it is.' }) +
      linkRows + fileField + '</fieldset>' +
      '<fieldset><legend>Anything else</legend>' +
      ui.field({ name: 'missingInfo', label: 'Information still missing', type: 'textarea', value: t.missingInfo, rows: 3 }) +
      ui.field({ name: 'notes', label: 'Additional notes', type: 'textarea', value: t.notes, rows: 3 }) +
      '</fieldset>' +
      '<div class="btn-row" style="margin-top:12px"><button type="submit" class="btn primary">' + (editing ? 'Save changes' : 'Submit request') + '</button>' +
      '<a class="btn" href="' + (editing ? '#/tasks/' + encodeURIComponent(editing) : '#/dashboard') + '">Cancel</a></div>' +
      '</form>';
  }

  WH.views.requestForm = requestForm;

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
      app.toast('Request submitted to Maha.' + (r.saved ? ' ' + r.saved + ' document' + (r.saved > 1 ? 's' : '') + ' saved in this browser.' : ''));
    });
  };

  WH.forms['request-edit'] = (app, form, data) => {
    const id = form.getAttribute('data-id');
    app.mutate(() => W.updateBrief(app.state, app.user, id, data), 'Changes saved.', { form, go: '#/tasks/' + encodeURIComponent(id) });
  };

  // ---------- meeting request ----------

  function meetingForm(app) {
    if (!P.can(app.user, 'meeting.request')) {
      return '<h1>Request a meeting</h1><div class="callout info"><p>Managers request meetings with Maha. Maha answers requests on the <a href="#/meetings">Meetings</a> page.</p></div>';
    }
    const mine = app.state.tasks.filter((t) => OPEN.includes(t.status));
    mine.sort((a, b) => (a.requesterId === app.user ? -1 : 0) - (b.requesterId === app.user ? -1 : 0));
    const taskOptions = [{ value: '', label: 'Not related to a task' }].concat(mine.map((t) => ({ value: t.id, label: t.title + ' (' + people.first(t.requesterId) + ')' })));
    const preset = app.ui.meetingTask || '';
    app.ui.meetingTask = null;
    return '<div class="page-head"><div><p class="eyebrow">Meeting proposal</p><h1>Request a meeting</h1>' +
      '<p>Maha will confirm, decline or suggest another time. Times are Toronto time.</p></div></div>' +
      '<form class="card" data-form="meeting-create" novalidate style="max-width:760px">' +
      ui.field({ name: 'purpose', label: 'Purpose', required: true, hint: 'What do you want to cover?' }) +
      '<div class="form-grid">' +
      ui.field({ name: 'date', label: 'Preferred date', type: 'date', required: true, min: W.today() }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'start', label: 'Preferred start time', type: 'time', required: true, value: '10:00' }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, value: 30, min: 15, max: 480, step: 5, hint: '15 minutes to 8 hours' }).replace('<input', '<input data-input="meeting-preview" data-change="meeting-preview"') +
      ui.field({ name: 'location', label: 'Location or meeting link' }) +
      '</div>' +
      ui.field({ name: 'taskId', label: 'Related task', type: 'select', options: taskOptions, value: preset }) +
      '<div id="meeting-preview" aria-live="polite"></div>' +
      '<div class="btn-row" style="margin-top:8px"><button type="submit" class="btn primary">Send meeting request</button><a class="btn" href="#/meetings">Cancel</a></div>' +
      '</form>';
  }

  WH.views.meetingForm = meetingForm;

  function conflictCallout(list) {
    if (!list.length) return '<div class="callout info small"><p>No conflicts found with Maha’s confirmed meetings, events or capacity.</p></div>';
    return '<div class="callout warn small"><p><strong>Possible conflicts</strong> (you can still send the request):</p><ul>' + list.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
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
      'Meeting request sent to Maha. It stays pending until Maha responds.', { form, go: '#/meetings' });
  };
})(globalThis.WH = globalThis.WH || {});
