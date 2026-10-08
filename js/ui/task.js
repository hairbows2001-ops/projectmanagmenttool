/* Task detail panel: next step, brief, schedule, documents, comments, more actions and history (collapsible sections). */
(function (WH) {
  'use strict';

  const { esc, fmtHours, round1 } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress'];

  function fact(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + (value === '' || value === null || value === undefined ? '<span class="muted">Not provided</span>' : value) + '</dd></div>';
  }

  /** A collapsible section inside the panel. */
  function section(id, title, body, opts) {
    const o = opts || {};
    return '<details class="psec" id="sec-' + id + '"' + (o.open ? ' open' : '') + '><summary><span>' + esc(title) + '</span>' +
      (o.count !== undefined ? '<span class="psec-count">' + o.count + '</span>' : '') + '</summary><div class="psec-body">' + body + '</div></details>';
  }

  function inlineForm(formName, task, body, submitLabel, opts) {
    const o = opts || {};
    return '<form class="inline-form" data-form="' + formName + '" data-id="' + esc(task.id) + '" novalidate>' + body +
      '<button type="submit" class="btn small ' + (o.style || 'primary') + '">' + esc(submitLabel) + '</button></form>';
  }

  function detailsForm(summary, formName, task, body, submitLabel, opts) {
    const o = opts || {};
    return '<details class="action" id="act-' + formName + '"' + (o.open ? ' open' : '') + '><summary>' + esc(summary) + '</summary><div class="action-body">' +
      inlineForm(formName, task, body, submitLabel, { style: o.danger ? 'danger' : 'primary' }) + '</div></details>';
  }

  function brief(task) {
    return '<dl class="facts">' +
      fact('What is needed', esc(task.description)) +
      fact('Project or campaign', esc(task.project)) +
      fact('Deliverable', esc(task.deliverableType)) +
      fact('Audience', esc(task.audience)) +
      fact('Purpose', esc(task.purpose)) +
      fact('Requested deadline', task.requestedDeadline ? esc(D.fmtLong(task.requestedDeadline)) + (task.deadlineFixed ? ' · <strong>Externally fixed</strong>' : '') + (task.deadlineReason ? '<div class="small muted">' + esc(task.deadlineReason) + '</div>' : '') : 'Not known yet') +
      fact('Requested urgency', esc(W.URGENCY[task.requestedUrgency]) + (task.urgencyReason ? ' · ' + esc(task.urgencyReason) : '') + '<div class="small muted">A request; Carla sets priority.</div>') +
      (task.materials ? fact('Available materials', esc(task.materials)) : '') +
      (task.missingInfo ? fact('Missing information', esc(task.missingInfo)) : '') +
      (task.notes ? fact('Notes', esc(task.notes)) : '') +
      fact('Submitted', esc(D.fmtStamp(task.createdAt)) + ' by ' + esc(people.name(task.requesterId))) +
      '</dl>';
  }

  function docs(app, task) {
    const canAdd = P.can(app.user, 'task.addDocument', task);
    const list = task.documents.length ? '<ul class="rows">' + task.documents.map((d) => '<li><div class="row-line"><span class="row-title">' + ui.icon('doc').replace('<svg', '<svg width="16" height="16"') + ' ' + esc(d.name) + '</span>' +
      (d.stored ? '<button type="button" class="btn small" data-action="download-doc" data-id="' + esc(d.id) + '" data-name="' + esc(d.name) + '">Open<span class="visually-hidden"> ' + esc(d.name) + '</span></button>'
        : '<span class="chip sample">' + (d.sample ? 'Sample name only' : 'File not stored') + '</span>') + '</div>' +
      '<div class="row-meta"><span>' + esc(people.name(d.addedBy)) + '</span><span>' + esc(D.fmtStamp(d.addedAt)) + '</span>' + (d.size ? '<span>' + Math.max(1, Math.round(d.size / 1024)) + ' KB</span>' : '') + '</div></li>').join('') + '</ul>' : '<p class="empty">No documents yet.</p>';
    const links = task.links.length ? '<ul class="rows">' + task.links.map((l) => '<li><div class="row-line"><a class="row-title" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
      ui.icon('link').replace('<svg', '<svg width="16" height="16"') + ' ' + esc(l.label) + '<span class="visually-hidden"> (opens in a new tab)</span></a></div><div class="row-meta"><span>' + esc(people.name(l.addedBy)) + '</span></div></li>').join('') + '</ul>' : '';
    const forms = canAdd
      ? '<form class="inline-form" data-form="add-docs" data-id="' + esc(task.id) + '" novalidate>' +
        '<div class="field" data-field="file"><label for="add-files">Add documents <span class="hint">Up to 10 MB each. Saved in this browser only.</span></label><input id="add-files" name="files" type="file" multiple></div>' +
        '<button type="submit" class="btn small">Upload</button></form>' +
        '<form class="inline-form" data-form="add-link" data-id="' + esc(task.id) + '" novalidate><div class="form-grid">' +
        ui.field({ name: 'url', label: 'Add a link', type: 'url', placeholder: 'https://', id: 'add-link-url' }) +
        ui.field({ name: 'label', label: 'Link description', id: 'add-link-label' }) + '</div>' +
        '<button type="submit" class="btn small">Add link</button></form>'
      : '';
    return list + links + forms;
  }

  function comments(app, task) {
    const kindLabel = { clarification: 'Question', answer: 'Information provided', revision: 'Revisions requested' };
    const list = task.comments.length ? task.comments.map((c) => '<div class="comment kind-' + esc(c.kind) + '"><span class="who">' + esc(people.name(c.by)) + '</span>' +
      (kindLabel[c.kind] ? '<span class="kind-label">' + esc(kindLabel[c.kind]) + '</span>' : '') + '<span class="when">' + esc(D.fmtStamp(c.at)) + '</span><p>' + esc(c.text) + '</p></div>').join('')
      : '<p class="empty">No comments yet.</p>';
    const form = P.can(app.user, 'task.comment', task)
      ? inlineForm('add-comment', task, ui.field({ name: 'comment', label: 'Add a comment or more information', type: 'textarea', rows: 3, id: 'comment-text' }), 'Post comment', { style: '' })
      : '<p class="small muted">Only the requester, Maha and Carla can comment on this request.</p>';
    return list + form;
  }

  function scheduleInfo(app, task) {
    const cw = W.currentWeek();
    const eff = C.effectiveAllocations(task, cw);
    const facts = '<dl class="facts">' +
      fact('Agreed deadline', task.agreedDeadline ? '<strong>' + esc(D.fmtShort(task.agreedDeadline)) + '</strong>' : '<span class="muted">Not agreed yet</span>') +
      fact('Estimated effort', ui.effortText(task)) +
      (task.estimateHours > 0 ? fact('Remaining effort', fmtHours(C.remainingOf(task))) : '') +
      fact('Priority', ui.priorityChip(task) + (task.priorityReason ? '<div class="small muted">' + esc(task.priorityReason) + '</div>' : '')) +
      (task.coveredBySocial ? fact('Capacity', 'Covered by the weekly social media reserve') : '') + '</dl>';
    const rows = task.allocations.length ? '<table class="week-table"><caption class="visually-hidden">Hours by week</caption><thead><tr><th scope="col">Week</th><th scope="col">Planned</th><th scope="col">Counted now</th></tr></thead><tbody>' +
      task.allocations.map((a) => {
        const e = eff.weeks.find((x) => x.weekStart === a.weekStart);
        return '<tr' + (a.weekStart === cw ? ' class="current"' : '') + '><td>' + esc(D.fmtWeek(a.weekStart)) + (a.weekStart < cw ? ' <span class="muted small">past</span>' : '') + '</td><td>' + fmtHours(a.hours) + '</td><td>' + fmtHours(e ? e.hours : 0) + '</td></tr>';
      }).join('') + '</tbody></table>' : '';
    const unplaced = eff.unplaced > 0 ? '<div class="callout warn small"><p>' + fmtHours(eff.unplaced) + ' of remaining effort has no current or future week. Reschedule it.</p></div>' : '';
    const proposals = app.state.proposals.filter((p) => p.moves.some((m) => m.taskId === task.id));
    const propHtml = proposals.length ? '<ul class="rows">' + proposals.map((p) => {
      const mv = p.moves.find((m) => m.taskId === task.id);
      return '<li><div class="row-line"><span class="row-title">Move ' + fmtHours(mv.hours) + ' to week of ' + esc(D.fmtWeek(mv.toWeek)) + '</span>' +
        (p.status === 'pending' ? '<span class="chip pending waiting">' + ui.icon('hourglass') + 'Waiting for Maha</span>'
          : p.status === 'confirmed' ? '<span class="chip s-complete">' + ui.icon('check') + 'Confirmed</span>' : '<span class="chip s-cancelled">' + ui.icon('x') + 'Not confirmed</span>') + '</div>' +
        '<div class="row-meta"><span>Proposed by ' + esc(people.name(p.createdBy)) + '</span><span>' + esc(p.reason) + '</span></div></li>';
    }).join('') + '</ul>' : '';
    return facts + unplaced + rows + propHtml;
  }

  function completion(task) {
    if (task.status !== 'complete' && !task.completedAt && !task.approval) return '';
    const rows = [];
    if (task.completedAt) {
      rows.push(fact('Marked complete', esc(D.fmtStamp(task.completedAt)) + ' by ' + esc(people.name(task.completedBy))));
      if (task.completionNote) rows.push(fact('Note', esc(task.completionNote)));
    }
    if (task.approval) {
      rows.push(fact('Earlier approval record', 'Submitted ' + esc(D.fmtStamp(task.approval.submittedAt)) +
        (task.approval.decidedAt ? '; ' + esc(task.approval.decision) + ' by ' + esc(people.name(task.approval.decidedBy)) : '') +
        '<div class="small muted">Kept from before approvals were removed.</div>'));
    }
    return rows.length ? '<dl class="facts">' + rows.join('') + '</dl>' : '';
  }

  function scheduleForm(app, task) {
    const cw = W.currentWeek();
    const remaining = C.remainingOf(task);
    const eff = C.effectiveAllocations(task, cw);
    const deadline = task.agreedDeadline || (task.requestedDeadline && task.requestedDeadline >= W.today() ? task.requestedDeadline : '');
    const lastAlloc = task.allocations.reduce((m, a) => (a.weekStart > m ? a.weekStart : m), cw);
    const deadlineWeek = deadline ? D.weekStart(deadline) : cw;
    const lastWeek = lastAlloc > deadlineWeek ? lastAlloc : deadlineWeek;
    const count = Math.max(4, D.diffDays(cw, lastWeek) / 7 + 2);
    let rows = '';
    for (let i = 0; i < count; i++) {
      const w = D.addDays(cw, i * 7);
      const own = eff.weeks.find((x) => x.weekStart === w);
      const sm = C.weekSummary(app.state, w, cw);
      const freeExcl = round1(sm.remaining + (own && !task.coveredBySocial ? own.hours : 0));
      rows += '<div class="alloc-row"><label for="alloc-' + w + '">Week of ' + esc(D.fmtWeek(w)) +
        '<span class="wk-load">' + (freeExcl < 0 ? '<span class="over-text">' + fmtHours(-freeExcl) + ' over</span> before this task' : fmtHours(freeExcl) + ' free before this task') + '</span></label>' +
        '<input id="alloc-' + w + '" name="alloc:' + w + '" type="number" min="0" step="0.5" inputmode="decimal" value="' + (own ? round1(own.hours) : '') + '" data-input="alloc-total"></div>';
    }
    return ui.field({ name: 'agreedDeadline', label: 'Agreed deadline', type: 'date', required: true, value: deadline, id: 'sched-deadline', min: W.today() }) +
      '<p class="small">Hours to place: <strong>' + fmtHours(remaining) + '</strong> · Allocated: <strong id="alloc-sum">' +
      fmtHours(eff.weeks.filter((x) => x.weekStart >= cw).reduce((a, x) => a + x.hours, 0)) + '</strong> ' +
      '<button type="button" class="linklike" data-action="alloc-spread" data-remaining="' + remaining + '">Spread evenly to the deadline</button></p>' +
      '<div data-field="allocations"><p class="label">Hours per week</p>' + rows + '</div>';
  }

  /** The single most useful next step for this person, shown at the top of the panel. */
  function nextStep(app, task) {
    const u = app.user;
    const can = (a) => P.can(u, a, task);
    if (can('task.provideInfo') && u !== 'maha') {
      return inlineForm('provide-info', task, ui.field({ name: 'note', label: 'Maha asked for more information', type: 'textarea', rows: 3, id: 'info-note' }), 'Send to Maha');
    }
    if (u === 'maha') {
      if (OPEN.includes(task.status) && task.status !== 'in_progress' && !(task.estimateHours > 0)) {
        return inlineForm('estimate', task, ui.field({ name: 'estimate', label: 'Estimate effort (hours)', type: 'number', min: 0.5, step: 0.5, id: 'est-hours' }), 'Save estimate');
      }
      if (['submitted', 'clarification'].includes(task.status)) {
        return '<p class="label">Schedule and agree a deadline</p>' + inlineForm('schedule', task, scheduleForm(app, task), 'Schedule');
      }
      if (task.status === 'scheduled') return '<button type="button" class="btn primary" data-action="start-work" data-id="' + esc(task.id) + '">' + ui.icon('play') + 'Start work</button>';
      if (task.status === 'in_progress') {
        return task.blocked
          ? '<p>Blocked: clear the block under “More actions” before completing.</p>'
          : inlineForm('complete', task, ui.field({ name: 'note', label: 'Mark as complete', type: 'textarea', rows: 2, id: 'done-note', hint: 'Optional note, for example where the final files are.' }), 'Mark complete');
      }
    }
    if (can('task.setPriority') && OPEN.includes(task.status) && !task.priority) {
      return priorityForm(task);
    }
    if (can('task.editBrief')) {
      return '<p class="small">Add details or documents any time.</p><a class="btn" href="#/tasks/' + encodeURIComponent(task.id) + '/edit">Edit brief</a>';
    }
    return '';
  }

  function priorityFields(task) {
    const opts = [{ value: '', label: 'Not set' }].concat(Object.keys(W.PRIORITIES).map((k) => ({ value: k, label: k + ' ' + W.PRIORITIES[k] })));
    return '<div class="form-grid">' + ui.field({ name: 'priority', label: 'Priority', type: 'select', options: opts, value: task.priority || '', id: 'prio-sel' }) +
      ui.field({ name: 'reason', label: 'Reason (optional)', value: task.priorityReason, id: 'prio-reason' }) + '</div>';
  }

  function priorityForm(task) {
    return inlineForm('priority', task, priorityFields(task), 'Save priority');
  }

  /** Less frequent actions, collapsed. */
  function moreActions(app, task) {
    const u = app.user;
    const can = (a) => P.can(u, a, task);
    const parts = [];
    if (can('task.editBrief') && !(nextStep(app, task) || '').includes('/edit"')) parts.push('<p><a class="btn small" href="#/tasks/' + encodeURIComponent(task.id) + '/edit">Edit brief</a></p>');
    if (u === 'maha') {
      if (can('task.provideInfo')) parts.push(detailsForm('Mark information as received', 'provide-info', task, ui.field({ name: 'note', label: 'Information or answer', type: 'textarea', rows: 3, id: 'info-note-m' }), 'Save'));
      if (task.status === 'submitted') parts.push(detailsForm('Ask for clarification', 'clarify', task, ui.field({ name: 'question', label: 'What do you need to know?', type: 'textarea', rows: 3, id: 'clarify-q' }), 'Send question'));
      if (OPEN.includes(task.status) && (task.estimateHours > 0 || task.status === 'in_progress')) {
        parts.push(detailsForm(task.estimateHours > 0 ? 'Change estimate (' + fmtHours(task.estimateHours) + ')' : 'Estimate effort', 'estimate', task,
          ui.field({ name: 'estimate', label: 'Estimated hours', type: 'number', min: 0.5, step: 0.5, value: task.estimateHours || '', id: 'est-hours-m' }), 'Save estimate'));
      }
      if (['scheduled', 'in_progress'].includes(task.status) && task.estimateHours > 0) {
        parts.push(detailsForm('Reschedule', 'schedule', task, scheduleForm(app, task), 'Save schedule'));
        parts.push(detailsForm('Update remaining effort (' + fmtHours(C.remainingOf(task)) + ')', 'remaining', task,
          ui.field({ name: 'remaining', label: 'Hours still needed', type: 'number', min: 0, step: 0.5, value: C.remainingOf(task), id: 'rem-hours' }), 'Save'));
      }
      if (['scheduled', 'in_progress'].includes(task.status)) {
        parts.push(task.blocked
          ? '<p><button type="button" class="btn small" data-action="unblock" data-id="' + esc(task.id) + '">Clear block</button></p>'
          : detailsForm('Flag as blocked', 'block', task, ui.field({ name: 'reason', label: 'What is blocking the work?', type: 'textarea', rows: 2, id: 'block-reason' }), 'Flag as blocked'));
        parts.push('<p><label class="check"><input type="checkbox" data-change="toggle-social" data-id="' + esc(task.id) + '"' + (task.coveredBySocial ? ' checked' : '') +
          '><span>Covered by weekly social media time<span class="hint">For routine posts, so hours are not counted twice.</span></span></label></p>');
      }
    }
    if (can('task.setPriority') && OPEN.includes(task.status) && task.priority) parts.push(detailsForm('Change priority', 'priority', task, priorityFields(task), 'Save priority'));
    if (can('task.cancel')) {
      parts.push(detailsForm('Cancel request', 'cancel', task, ui.field({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, id: 'cancel-reason' }) +
        '<p class="small muted">Cancelled requests keep their history.</p>', 'Cancel request', { danger: true }));
    }
    if (can('task.archive')) parts.push('<p><button type="button" class="btn small" data-action="archive" data-id="' + esc(task.id) + '">' + ui.icon('archive') + 'Archive</button> <span class="small muted">History is kept.</span></p>');
    return parts.join('');
  }

  WH.panels.task = function (app, params) {
    const task = app.state.tasks.find((t) => t.id === params[0]);
    if (!task) return { title: 'Task not found', html: '<p>This task does not exist. <button type="button" class="linklike" data-action="close-panel">Close</button></p>' };
    const callouts = (task.blocked ? '<div class="callout danger small"><p><strong>Blocked:</strong> ' + esc(task.blocked.reason) + '</p></div>' : '') +
      (task.status === 'clarification' ? '<div class="callout warn small"><p><strong>Question from Maha:</strong> ' + esc((task.comments.filter((c) => c.kind === 'clarification').pop() || {}).text || '') + '</p></div>' : '');
    const step = nextStep(app, task);
    const more = moreActions(app, task);
    const done = completion(task);
    const viewOnly = !step && !more && P.can(app.user, 'view')
      ? '<p class="small muted">' + ui.icon('lock').replace('<svg', '<svg width="14" height="14"') + ' View only. Only ' + esc(people.name(task.requesterId)) + ', Maha and Carla can change this request.</p>' : '';
    const html =
      '<div class="panel-summary"><span class="chips">' + ui.statusLabel(task) + ui.usefulPriority(task) + ui.urgencyChip(task) + '</span>' +
      '<p class="trow-meta">' + esc(people.name(task.requesterId)) + ' · ' + esc(ui.dueText(task)) + (task.estimateHours > 0 ? ' · ' + fmtHours(task.estimateHours) + ' estimated' : ' · Estimate needed') + '</p></div>' +
      callouts + (step ? '<div class="next-step">' + step + '</div>' : '') + viewOnly +
      section('brief', 'Brief', brief(task), { open: true }) +
      (done ? section('done', 'Completion', done, { open: task.status === 'complete' }) : '') +
      section('schedule', 'Schedule and effort', scheduleInfo(app, task)) +
      section('docs', 'Documents and links', docs(app, task), { count: task.documents.length + task.links.length }) +
      section('comments', 'Comments', comments(app, task), { count: task.comments.length, open: task.status === 'clarification' }) +
      (more ? section('more', 'More actions', more) : '') +
      section('history', 'Activity history', ui.historyList(task.history), { count: task.history.length });
    return { title: task.title, eyebrow: task.project || 'Task', html };
  };

  // ---------- forms & actions ----------

  const id = (form) => form.getAttribute('data-id');

  WH.forms['add-comment'] = (app, form, d) => app.mutate(() => W.addComment(app.state, app.user, id(form), d.comment), 'Comment posted.', { form });
  WH.forms['add-link'] = (app, form, d) => app.mutate(() => W.addLink(app.state, app.user, id(form), d.url, d.label), 'Link added.', { form });
  WH.forms['add-docs'] = (app, form, d) => {
    const files = Array.from(d.files || []);
    if (!files.length) { app.showErrors(form, { file: 'Choose at least one file.' }); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    WH.uploadFiles(app, id(form), files).then((r) => {
      app.render();
      if (r.saved) app.toast(r.saved + ' document' + (r.saved > 1 ? 's' : '') + ' saved in this browser.');
    });
  };
  WH.forms['provide-info'] = (app, form, d) => app.mutate(() => W.provideInfo(app.state, app.user, id(form), d.note), 'Sent. The request is back with Maha for review.', { form });
  WH.forms.clarify = (app, form, d) => app.mutate(() => W.requestClarification(app.state, app.user, id(form), d.question), 'Question sent. Status: Needs clarification.', { form });
  WH.forms.estimate = (app, form, d) => app.mutate(() => W.setEstimate(app.state, app.user, id(form), d.estimate), 'Estimate saved.', { form });
  WH.forms.remaining = (app, form, d) => app.mutate(() => W.setRemaining(app.state, app.user, id(form), d.remaining), 'Remaining effort updated.', { form });
  WH.forms.schedule = (app, form, d) => {
    const allocations = Object.keys(d).filter((k) => k.startsWith('alloc:')).map((k) => ({ weekStart: k.slice(6), hours: d[k] }));
    app.mutate(() => W.scheduleTask(app.state, app.user, id(form), { agreedDeadline: d.agreedDeadline, allocations }), 'Schedule saved.', { form });
  };
  WH.forms.complete = (app, form, d) => app.mutate(() => W.completeTask(app.state, app.user, id(form), d.note), 'Marked Complete.', { form });
  WH.forms.block = (app, form, d) => app.mutate(() => W.setBlocked(app.state, app.user, id(form), d.reason), 'Flagged as blocked.', { form });
  WH.forms.priority = (app, form, d) => app.mutate(() => W.setPriority(app.state, app.user, id(form), d.priority, d.reason), 'Priority saved.', { form });
  WH.forms.cancel = (app, form, d) => app.mutate(() => W.cancelTask(app.state, app.user, id(form), d.reason), 'Request cancelled. History is kept.', { form });

  WH.actions['start-work'] = (app, el) => app.mutate(() => W.startWork(app.state, app.user, el.getAttribute('data-id')), 'Status: In progress.');
  WH.actions.unblock = (app, el) => app.mutate(() => W.clearBlocked(app.state, app.user, el.getAttribute('data-id')), 'Block cleared.');
  WH.actions.archive = (app, el) => app.mutate(() => W.archiveTask(app.state, app.user, el.getAttribute('data-id')), 'Archived. History is kept.');
  WH.actions['toggle-social'] = (app, el) => app.mutate(() => W.setCoveredBySocial(app.state, app.user, el.getAttribute('data-id'), el.checked),
    el.checked ? 'Now counted inside the social media allocation.' : 'Now counted as scheduled task time.');

  WH.actions['alloc-total'] = (app, el) => {
    const form = el.closest('form');
    let sum = 0;
    form.querySelectorAll('input[name^="alloc:"]').forEach((i) => { const n = Number(i.value); if (n > 0) sum += n; });
    const out = form.querySelector('#alloc-sum');
    if (out) out.textContent = fmtHours(sum);
  };

  WH.actions['alloc-spread'] = (app, el) => {
    const form = el.closest('form');
    const remaining = Number(el.getAttribute('data-remaining'));
    const deadline = form.querySelector('[name="agreedDeadline"]').value;
    if (!D.isISODate(deadline)) { app.showErrors(form, { agreedDeadline: 'Choose the agreed deadline first.' }); return; }
    const last = D.weekStart(deadline);
    const inputs = Array.from(form.querySelectorAll('input[name^="alloc:"]'));
    const target = inputs.filter((i) => i.name.slice(6) <= last);
    if (!target.length) { app.showErrors(form, { agreedDeadline: 'The deadline is before the current week.' }); return; }
    const each = Math.floor((remaining / target.length) * 10) / 10;
    inputs.forEach((i) => { i.value = ''; });
    target.forEach((i, idx) => { i.value = idx === target.length - 1 ? round1(remaining - each * (target.length - 1)) : each; });
    WH.actions['alloc-total'](app, target[0]);
  };

  WH.actions['download-doc'] = (app, el) => {
    WH.store.getFile(el.getAttribute('data-id')).then((rec) => {
      if (!rec) { app.toast('This file is not stored in this browser.', 'error'); return; }
      const url = URL.createObjectURL(rec.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rec.name || el.getAttribute('data-name');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch((e) => app.toast('Could not open the file: ' + e.message, 'error'));
  };
})(globalThis.WH = globalThis.WH || {});
