/* Task detail: brief, documents, links, comments, dates, effort, schedule, approval, history and actions. */
(function (WH) {
  'use strict';

  const { esc, fmtHours, round1 } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval'];

  function fact(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + (value === '' || value === null || value === undefined ? '<span class="muted">Not provided</span>' : value) + '</dd></div>';
  }

  function progress(task) {
    const flow = ['submitted', 'scheduled', 'in_progress', 'awaiting_approval', 'complete'];
    if (!flow.includes(task.status) && task.status !== 'clarification') {
      return '<p class="small muted">This request is ' + esc(W.STATUSES[task.status].toLowerCase()) + '. Its history is kept below.</p>';
    }
    const idx = task.status === 'clarification' ? 0 : flow.indexOf(task.status);
    return '<ol class="chips" aria-label="Progress" style="list-style:none;padding:0;margin:0 0 6px">' + flow.map((s, i) => {
      const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
      const label = (i === 0 && task.status === 'clarification') ? W.STATUSES.clarification : W.STATUSES[s];
      return '<li class="chip ' + (state === 'current' ? 's-' + (i === 0 && task.status === 'clarification' ? 'clarification' : s) : state === 'done' ? '' : 'sample') + '"' +
        (state === 'current' ? ' aria-current="step"' : '') + '>' + (state === 'done' ? ui.icon('check') : '') + esc(label) +
        '<span class="visually-hidden"> (' + (state === 'done' ? 'done' : state === 'current' ? 'current step' : 'not yet') + ')</span></li>';
    }).join('<li aria-hidden="true" class="muted">→</li>') + '</ol>';
  }

  function briefCard(task) {
    return '<section class="card" aria-labelledby="brief-h"><div class="card-head"><h2 id="brief-h">Brief</h2></div><dl class="facts">' +
      fact('What is needed', esc(task.description)) +
      fact('Project or campaign', esc(task.project)) +
      fact('Deliverable type', esc(task.deliverableType)) +
      fact('Audience', esc(task.audience)) +
      fact('Purpose', esc(task.purpose)) +
      fact('Requested deadline', task.requestedDeadline ? esc(D.fmtLong(task.requestedDeadline)) + (task.deadlineFixed ? ' · <strong>Externally fixed</strong>' : '') : 'Date not known yet') +
      fact('Reason for deadline', esc(task.deadlineReason)) +
      fact('Requested urgency', esc(W.URGENCY[task.requestedUrgency]) + ' <span class="muted small">(a request; Carla sets priority)</span>') +
      fact('Reason for urgency', esc(task.urgencyReason)) +
      fact('Available materials', esc(task.materials)) +
      fact('Missing information', esc(task.missingInfo)) +
      fact('Additional notes', esc(task.notes)) +
      fact('Submitted', esc(D.fmtStamp(task.createdAt)) + ' by ' + esc(people.name(task.requesterId))) +
      '</dl></section>';
  }

  function docsCard(app, task) {
    const canAdd = P.can(app.user, 'task.addDocument', task);
    const docs = task.documents.length ? '<ul class="rows">' + task.documents.map((d) => '<li><div class="row-line"><span class="row-title">' + ui.icon('doc').replace('<svg', '<svg width="16" height="16"') + ' ' + esc(d.name) + '</span>' +
      (d.stored ? '<button type="button" class="btn small" data-action="download-doc" data-id="' + esc(d.id) + '" data-name="' + esc(d.name) + '">Open<span class="visually-hidden"> ' + esc(d.name) + '</span></button>'
        : '<span class="chip sample">' + (d.sample ? 'Sample listing, no file' : 'File not stored') + '</span>') + '</div>' +
      '<div class="row-meta"><span>' + esc(people.name(d.addedBy)) + '</span><span>' + esc(D.fmtStamp(d.addedAt)) + '</span>' + (d.size ? '<span>' + Math.max(1, Math.round(d.size / 1024)) + ' KB</span>' : '') +
      (d.stored ? '<span>Saved in this browser only</span>' : '') + '</div></li>').join('') + '</ul>' : '<p class="empty">No documents yet.</p>';
    const links = task.links.length ? '<ul class="rows" style="margin-top:12px">' + task.links.map((l) => '<li><div class="row-line"><a class="row-title" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
      ui.icon('link').replace('<svg', '<svg width="16" height="16"') + ' ' + esc(l.label) + '<span class="visually-hidden"> (opens in a new tab)</span></a></div><div class="row-meta"><span>' + esc(people.name(l.addedBy)) + '</span><span>' + esc(D.fmtStamp(l.addedAt)) + '</span></div></li>').join('') + '</ul>' : '';
    const forms = canAdd
      ? '<details class="action"><summary>Add documents</summary><div class="action-body"><form data-form="add-docs" data-id="' + esc(task.id) + '" novalidate>' +
        '<div class="field" data-field="file"><label for="add-files">Choose files <span class="hint">Up to 10 MB each. Saved in this browser only; other people cannot open them in this prototype.</span></label><input id="add-files" name="files" type="file" multiple></div>' +
        '<button type="submit" class="btn small primary">Upload</button></form></div></details>' +
        '<details class="action"><summary>Add a link</summary><div class="action-body"><form data-form="add-link" data-id="' + esc(task.id) + '" novalidate>' +
        ui.field({ name: 'url', label: 'Link', type: 'url', required: true, placeholder: 'https://', id: 'add-link-url' }) +
        ui.field({ name: 'label', label: 'Description', id: 'add-link-label' }) +
        '<button type="submit" class="btn small primary">Add link</button></form></div></details>'
      : '';
    return '<section class="card" aria-labelledby="docs-h"><div class="card-head"><h2 id="docs-h">Documents and links</h2></div>' + docs + links + forms + '</section>';
  }

  function commentsCard(app, task) {
    const kindLabel = { clarification: 'Question', answer: 'Information provided', revision: 'Revisions requested' };
    const list = task.comments.length ? task.comments.map((c) => '<div class="comment kind-' + esc(c.kind) + '"><span class="who">' + esc(people.name(c.by)) + '</span>' +
      (kindLabel[c.kind] ? '<span class="kind-label">' + esc(kindLabel[c.kind]) + '</span>' : '') + '<span class="when">' + esc(D.fmtStamp(c.at)) + '</span><p>' + esc(c.text) + '</p></div>').join('')
      : '<p class="empty">No comments yet.</p>';
    const form = P.can(app.user, 'task.comment', task)
      ? '<form data-form="add-comment" data-id="' + esc(task.id) + '" novalidate style="margin-top:14px">' +
        ui.field({ name: 'comment', label: 'Add a comment or more information', type: 'textarea', rows: 3, id: 'comment-text' }) +
        '<button type="submit" class="btn small primary">Post comment</button></form>'
      : '<p class="small muted" style="margin-top:12px">Only the requester, Maha and Carla can comment on this request.</p>';
    return '<section class="card" aria-labelledby="cmt-h"><div class="card-head"><h2 id="cmt-h">Comments</h2></div>' + list + form + '</section>';
  }

  function datesCard(task) {
    return '<section class="card" aria-labelledby="dates-h"><div class="card-head"><h2 id="dates-h">Dates and effort</h2></div><dl class="facts">' +
      fact('Requested deadline', task.requestedDeadline ? esc(D.fmtShort(task.requestedDeadline)) + (task.deadlineFixed ? ' (fixed)' : '') : 'Not known yet') +
      fact('Agreed deadline', task.agreedDeadline ? '<strong>' + esc(D.fmtShort(task.agreedDeadline)) + '</strong>' : '<span class="muted">Not agreed yet</span>') +
      fact('Estimated effort', ui.effortText(task)) +
      fact('Remaining effort', task.estimateHours > 0 ? fmtHours(C.remainingOf(task)) : '—') +
      fact('Priority', ui.priorityChip(task) + (task.priorityReason ? '<div class="small muted">' + esc(task.priorityReason) + '</div>' : '')) +
      (task.coveredBySocial ? fact('Capacity', 'Covered by the weekly social media allocation (not counted twice)') : '') +
      '</dl></section>';
  }

  function scheduleCard(app, task) {
    const cw = W.currentWeek();
    const eff = C.effectiveAllocations(task, cw);
    const planned = task.allocations;
    const rows = planned.length ? '<table class="week-table"><caption class="visually-hidden">Hours allocated by week</caption><thead><tr><th scope="col">Week</th><th scope="col">Planned</th><th scope="col">Counted now</th></tr></thead><tbody>' +
      planned.map((a) => {
        const e = eff.weeks.find((x) => x.weekStart === a.weekStart);
        return '<tr' + (a.weekStart === cw ? ' class="current"' : '') + '><td>' + esc(D.fmtWeek(a.weekStart)) + (a.weekStart < cw ? ' <span class="muted small">past</span>' : '') + '</td><td>' + fmtHours(a.hours) + '</td><td>' + fmtHours(e ? e.hours : 0) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="small muted" style="margin-top:8px">“Counted now” spreads the remaining effort over current and future weeks.</p>'
      : '<p class="empty">Not scheduled yet.</p>';
    const unplaced = eff.unplaced > 0 ? '<div class="callout warn small"><p>' + fmtHours(eff.unplaced) + ' of remaining effort has no current or future week. Reschedule it.</p></div>' : '';
    const proposals = app.state.proposals.filter((p) => p.moves.some((m) => m.taskId === task.id));
    const propHtml = proposals.length ? '<h3 class="eyebrow" style="margin-top:14px">Schedule change proposals</h3><ul class="rows">' + proposals.map((p) => {
      const mv = p.moves.find((m) => m.taskId === task.id);
      return '<li><div class="row-line"><span class="row-title">Move ' + fmtHours(mv.hours) + ' to week of ' + esc(D.fmtWeek(mv.toWeek)) + '</span>' +
        (p.status === 'pending' ? '<span class="chip pending s-awaiting_approval">' + ui.icon('hourglass') + 'Pending Maha’s confirmation</span>'
          : p.status === 'confirmed' ? '<span class="chip s-complete">' + ui.icon('check') + 'Confirmed</span>' : '<span class="chip s-cancelled">' + ui.icon('x') + 'Not confirmed</span>') + '</div>' +
        '<div class="row-meta"><span>Proposed by ' + esc(people.name(p.createdBy)) + '</span><span>' + esc(p.reason) + '</span></div></li>';
    }).join('') + '</ul>' : '';
    return '<section class="card" aria-labelledby="sched-h"><div class="card-head"><h2 id="sched-h">Scheduled allocations</h2></div>' + unplaced + rows + propHtml + '</section>';
  }

  const EMAIL_STATUS = { awaiting_reply: 'Awaiting reply', decided: 'Decision received', decided_in_app: 'Decided in the app', superseded: 'Outdated (request changed)', expired: 'Expired' };

  function requestApprovalCard(app, task) {
    const ra = task.requestApproval;
    if (!ra) return '';
    const emails = (app.state.emails || []).filter((e) => e.taskId === task.id);
    const decided = ra.decidedAt ? fact('Decision', esc(WH.approval.REQUEST_APPROVAL[ra.status]) + ' by ' + esc(people.name(ra.decidedBy)) + ', ' + esc(D.fmtStamp(ra.decidedAt)) +
      '<div class="small muted">' + esc(W.CHANNEL_LABELS[ra.channel] || '') + ' · version ' + ra.version + '</div>') : '';
    const emailList = emails.length ? '<h3 class="eyebrow" style="margin-top:14px">Approval emails (simulated, not sent)</h3><ul class="rows">' + emails.map((e) => {
      const st = W.emailStatus(e);
      return '<li><div class="row-line"><span class="row-title small">Version ' + e.approvalVersion + ' · ' + esc(D.fmtStamp(e.sentAt)) + '</span><span class="chip ' + (st === 'awaiting_reply' ? 'pending' : st === 'decided' ? 's-complete' : 's-cancelled') + '">' + esc(EMAIL_STATUS[st]) + '</span></div>' +
        '<div class="row-meta"><span>Ref ' + esc(e.token) + '</span><span><a href="#/email" data-action="open-email" data-id="' + esc(e.id) + '">View email</a></span></div></li>';
    }).join('') + '</ul>' : '';
    return '<section class="card ' + (ra.status === 'pending' ? 'attention' : ra.status === 'declined' ? 'alert' : '') + '" aria-labelledby="ra-h"><div class="card-head"><h2 id="ra-h">Request approval</h2>' + ui.requestApprovalChip(task, true) + '</div>' +
      '<p class="small">' + esc(WH.approval.ruleText(task.requesterId)) + '</p>' +
      '<dl class="facts">' + fact('Request version', String(task.briefVersion || 1) + ' <span class="small muted">(changes to the brief or requested deadline start a new version)</span>') + decided +
      (ra.note ? fact('Carla\u2019s note', esc(ra.note)) : '') + '</dl>' + emailList +
      '<p class="small muted" style="margin-top:10px">Separate from completed-work approval, which Carla gives when the finished work is submitted.</p></section>';
  }

  function approvalCard(task) {
    const a = task.approval;
    if (!a) return '';
    const decision = a.decision === 'approved' ? '<span class="chip s-complete">' + ui.icon('check') + 'Approved</span>'
      : a.decision === 'revisions' ? '<span class="chip blocked">' + ui.icon('alert') + 'Revisions requested</span>'
        : '<span class="chip s-awaiting_approval">' + ui.icon('hourglass') + 'Awaiting Carla</span>';
    return '<section class="card" aria-labelledby="appr-h"><div class="card-head"><h2 id="appr-h">Completed-work approval</h2>' + decision + '</div><dl class="facts">' +
      fact('Submitted for approval', esc(D.fmtStamp(a.submittedAt)) + ' by ' + esc(people.name(a.submittedBy))) +
      (a.note ? fact('Note from Maha', esc(a.note)) : '') +
      (a.decidedAt ? fact('Decision', esc(D.fmtStamp(a.decidedAt)) + ' by ' + esc(people.name(a.decidedBy))) : '') +
      (a.decisionNote ? fact('Carla’s note', esc(a.decisionNote)) : '') + '</dl></section>';
  }

  // ---------- action panel ----------

  function detailsForm(summary, formName, task, body, submitLabel, opts) {
    const o = opts || {};
    return '<details class="action"' + (o.open ? ' open' : '') + '><summary>' + esc(summary) + '</summary><div class="action-body"><form data-form="' + formName + '" data-id="' + esc(task.id) + '" novalidate>' +
      body + '<button type="submit" class="btn small ' + (o.danger ? 'danger' : 'primary') + '">' + esc(submitLabel) + '</button></form></div></details>';
  }

  function scheduleForm(app, task) {
    const cw = W.currentWeek();
    const remaining = C.remainingOf(task);
    const eff = C.effectiveAllocations(task, cw);
    const deadline = task.agreedDeadline || (task.requestedDeadline && task.requestedDeadline >= W.today() ? task.requestedDeadline : '');
    const lastAlloc = task.allocations.reduce((m, a) => (a.weekStart > m ? a.weekStart : m), cw);
    const deadlineWeek = deadline ? D.weekStart(deadline) : cw;
    const lastWeek = lastAlloc > deadlineWeek ? lastAlloc : deadlineWeek;
    const count = Math.max(6, D.diffDays(cw, lastWeek) / 7 + 2);
    let rows = '';
    for (let i = 0; i < count; i++) {
      const w = D.addDays(cw, i * 7);
      const own = eff.weeks.find((x) => x.weekStart === w);
      const s = C.weekSummary(app.state, w, cw);
      const freeExcl = round1(s.remaining + (own && !task.coveredBySocial ? own.hours : 0));
      rows += '<div class="alloc-row"><label for="alloc-' + w + '">Week of ' + esc(D.fmtWeek(w)) +
        '<span class="wk-load">' + (freeExcl < 0 ? '<span class="over-text">' + fmtHours(-freeExcl) + ' over</span> before this task' : fmtHours(freeExcl) + ' free before this task') + '</span></label>' +
        '<input id="alloc-' + w + '" name="alloc:' + w + '" type="number" min="0" step="0.5" inputmode="decimal" value="' + (own ? round1(own.hours) : '') + '" data-input="alloc-total"></div>';
    }
    return '<p class="small">Remaining effort to place: <strong>' + fmtHours(remaining) + '</strong>. Allocated: <strong id="alloc-sum">' +
      fmtHours(eff.weeks.filter((x) => x.weekStart >= cw).reduce((s, x) => s + x.hours, 0)) + '</strong></p>' +
      ui.field({ name: 'agreedDeadline', label: 'Agreed deadline', type: 'date', required: true, value: deadline, id: 'sched-deadline', min: W.today() }) +
      '<div data-field="allocations"><p class="label">Hours per week</p>' + rows + '</div>' +
      '<p><button type="button" class="btn small" data-action="alloc-spread" data-remaining="' + remaining + '">Spread evenly up to the deadline</button></p>';
  }

  function actionsCard(app, task) {
    const u = app.user;
    const parts = [];
    const can = (a) => P.can(u, a, task);

    // Requester
    if (can('task.editBrief')) parts.push('<p><a class="btn small" href="#/tasks/' + encodeURIComponent(task.id) + '/edit">Edit brief</a></p>');
    if (can('task.provideInfo')) {
      parts.push(detailsForm(u === 'maha' ? 'Mark information as received' : 'Provide the requested information', 'provide-info', task,
        ui.field({ name: 'note', label: 'Information or answer', type: 'textarea', rows: 3, id: 'info-note' }), 'Send to Maha', { open: u !== 'maha' }));
    }

    // Maha
    if (u === 'maha') {
      if (task.status === 'submitted' && can('task.requestClarification')) {
        parts.push(detailsForm('Ask for clarification', 'clarify', task, ui.field({ name: 'question', label: 'What do you need to know?', type: 'textarea', rows: 3, id: 'clarify-q' }), 'Send question'));
      }
      if (OPEN.includes(task.status) && task.status !== 'awaiting_approval') {
        parts.push(detailsForm(task.estimateHours > 0 ? 'Change estimate (' + fmtHours(task.estimateHours) + ')' : 'Estimate effort', 'estimate', task,
          ui.field({ name: 'estimate', label: 'Estimated hours', type: 'number', min: 0.5, step: 0.5, value: task.estimateHours || '', id: 'est-hours' }), 'Save estimate', { open: !(task.estimateHours > 0) }));
      }
      const approvalOk = WH.approval.canSchedule(task);
      if (!approvalOk && OPEN.includes(task.status)) {
        parts.push('<div class="callout warn small"><p>' + (task.requestApproval.status === 'declined'
          ? 'Carla declined this request. It cannot be scheduled unless the requester revises it and Carla approves.'
          : 'Waiting for Carla\u2019s request approval. You can clarify and estimate, but not schedule yet.') + '</p></div>');
        if (task.requestApproval.status === 'pending') {
          parts.push('<p><button type="button" class="btn small" data-action="resend-approval" data-id="' + esc(task.id) + '">Resend approval email (simulated)</button>' +
            '<span class="hint">Use after estimating, so Carla sees the effort.</span></p>');
        }
      }
      if (approvalOk && ['submitted', 'clarification', 'scheduled', 'in_progress'].includes(task.status)) {
        if (task.estimateHours > 0) {
          parts.push(detailsForm(task.agreedDeadline ? 'Reschedule' : 'Schedule and agree deadline', 'schedule', task, scheduleForm(app, task),
            task.agreedDeadline ? 'Save schedule' : 'Schedule', { open: task.status === 'submitted' && task.estimateHours > 0 }));
        } else {
          parts.push('<p class="small muted">Add an estimate before scheduling.</p>');
        }
      }
      if (['scheduled', 'in_progress', 'awaiting_approval'].includes(task.status)) {
        parts.push(detailsForm('Update remaining effort (' + fmtHours(C.remainingOf(task)) + ')', 'remaining', task,
          ui.field({ name: 'remaining', label: 'Hours still needed', type: 'number', min: 0, step: 0.5, value: C.remainingOf(task), id: 'rem-hours' }), 'Save'));
      }
      if (task.status === 'scheduled' && approvalOk) parts.push('<p><button type="button" class="btn small accent" data-action="start-work" data-id="' + esc(task.id) + '">' + ui.icon('play') + 'Start work</button></p>');
      if (task.status === 'in_progress') {
        parts.push(detailsForm('Submit for Carla’s approval', 'submit-approval', task,
          ui.field({ name: 'note', label: 'Note for Carla (optional)', type: 'textarea', rows: 2, id: 'appr-note' }), 'Submit for approval', { open: true }));
      }
      if (['scheduled', 'in_progress'].includes(task.status)) {
        parts.push(task.blocked
          ? '<p><button type="button" class="btn small" data-action="unblock" data-id="' + esc(task.id) + '">Clear block</button></p>'
          : detailsForm('Flag as blocked', 'block', task, ui.field({ name: 'reason', label: 'What is blocking the work?', type: 'textarea', rows: 2, id: 'block-reason' }), 'Flag as blocked'));
        parts.push('<p><label class="check"><input type="checkbox" data-change="toggle-social" data-id="' + esc(task.id) + '"' + (task.coveredBySocial ? ' checked' : '') +
          '><span>Covered by weekly social media time<span class="hint">Use for routine posts, so hours are not counted twice.</span></span></label></p>');
      }
      if (task.status === 'awaiting_approval') parts.push('<p class="small">Waiting for Carla to approve or request revisions.</p>');
    }

    // Carla
    if (can('request.decide') && task.requestApproval && task.requestApproval.status === 'pending' && OPEN.includes(task.status)) {
      parts.push('<div class="callout warn"><p><strong>Request approval needed.</strong> Approving lets Maha schedule it. It does not confirm the requested deadline.</p>' +
        '<form data-form="request-decision" data-id="' + esc(task.id) + '" novalidate>' + ui.field({ name: 'note', label: 'Note (optional)', id: 'ra-note' }) +
        '<div class="btn-row"><button type="submit" name="decision" value="approve" class="btn small accent">' + ui.icon('check') + 'Approve request</button>' +
        '<button type="submit" name="decision" value="decline" class="btn small danger">' + ui.icon('x') + 'Decline request</button></div></form></div>');
    }
    if (can('task.approve')) {
      parts.push('<div class="callout info"><p><strong>Completed work is ready for your approval.</strong></p>' +
        '<form data-form="approve" data-id="' + esc(task.id) + '" novalidate>' + ui.field({ name: 'note', label: 'Note (optional)', id: 'approve-note' }) +
        '<button type="submit" class="btn small accent">' + ui.icon('check') + 'Approve as complete</button></form></div>');
      parts.push(detailsForm('Request revisions', 'revisions', task, ui.field({ name: 'note', label: 'What needs to change?', type: 'textarea', rows: 3, id: 'rev-note' }), 'Return for revisions'));
    }
    if (can('task.setPriority') && OPEN.includes(task.status)) {
      const opts = [{ value: '', label: 'Not set' }].concat(Object.keys(W.PRIORITIES).map((k) => ({ value: k, label: k + ' ' + W.PRIORITIES[k] })));
      parts.push(detailsForm('Set priority', 'priority', task,
        ui.field({ name: 'priority', label: 'Priority', type: 'select', options: opts, value: task.priority || '', id: 'prio-sel' }) +
        ui.field({ name: 'reason', label: 'Reason (optional)', value: task.priorityReason, id: 'prio-reason' }), 'Save priority', { open: !task.priority }));
    }

    // Everyone with rights
    if (can('task.cancel')) {
      parts.push(detailsForm('Cancel request', 'cancel', task, ui.field({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, id: 'cancel-reason' }) +
        '<p class="small muted">Cancelled requests keep their history.</p>', 'Cancel request', { danger: true }));
    }
    if (can('task.archive')) parts.push('<p><button type="button" class="btn small" data-action="archive" data-id="' + esc(task.id) + '">' + ui.icon('archive') + 'Archive</button> <span class="small muted">History is kept.</span></p>');
    if (u === 'maha' && task.status === 'awaiting_approval') { /* message already shown */ }

    if (!parts.length) {
      parts.push('<p class="small muted">' + ui.icon('lock').replace('<svg', '<svg width="14" height="14"') + ' View only. You can see this summary. ' +
        (task.requesterId === u ? 'This request is closed.' : 'Only ' + esc(people.name(task.requesterId)) + ', Maha and Carla can change it.') + '</p>');
    }
    return '<section class="card accent" aria-labelledby="act-h"><div class="card-head"><h2 id="act-h">Actions</h2><span class="muted small">As ' + esc(people.first(u)) + '</span></div>' + parts.join('') + '</section>';
  }

  function raCallout(task) {
    const ra = task.requestApproval;
    if (!ra || !OPEN.includes(task.status)) return '';
    if (ra.status === 'pending') {
      return '<div class="callout warn"><p><strong>Request approval: Pending.</strong> Carla approves this request before Maha commits it to the schedule' +
        (C.COMMITTED_STATUSES.includes(task.status) ? '. It was already scheduled, but the brief changed, so Carla must approve the new version before it continues' : '') + '.</p></div>';
    }
    if (ra.status === 'declined') return '<div class="callout danger"><p><strong>Request approval: Declined</strong> by Carla' + (ra.note ? ': ' + esc(ra.note) : '') + '. It will not be scheduled. The requester can revise the brief to ask again, or cancel it.</p></div>';
    return '';
  }

  WH.views.task = function (app, params) {
    const task = app.state.tasks.find((t) => t.id === params[0]);
    if (!task) return '<h1>Task not found</h1><p><a href="#/workload">Back to shared workload</a></p>';
    const blocked = task.blocked ? '<div class="callout danger"><p><strong>Blocked:</strong> ' + esc(task.blocked.reason) + ' <span class="small">(' + esc(people.name(task.blocked.by)) + ', ' + esc(D.fmtStamp(task.blocked.at)) + ')</span></p></div>' : '';
    const clar = task.status === 'clarification' ? '<div class="callout warn"><p><strong>Needs clarification.</strong> ' + esc((task.comments.filter((c) => c.kind === 'clarification').pop() || {}).text || '') + '</p></div>' : '';
    return '<p class="small"><a href="#/workload">← Shared workload</a></p>' +
      '<div class="page-head"><div><p class="eyebrow">Request from ' + esc(people.name(task.requesterId)) + (task.project ? ' · ' + esc(task.project) : '') + '</p>' +
      '<h1>' + esc(task.title) + '</h1><div class="chips">' + ui.statusChip(task.status) + ui.blockedChip(task) + ui.requestApprovalChip(task, true) + ui.priorityChip(task) + ui.urgencyChip(task) + ui.sampleChip(task) + '</div></div></div>' +
      progress(task) + raCallout(task) + blocked + clar +
      '<div class="grid grid-main" style="margin-top:18px"><div class="stack">' + briefCard(task) + docsCard(app, task) + commentsCard(app, task) + '</div>' +
      '<div class="stack">' + actionsCard(app, task) + requestApprovalCard(app, task) + datesCard(task) + scheduleCard(app, task) + approvalCard(task) +
      '<section class="card" aria-labelledby="hist-h"><div class="card-head"><h2 id="hist-h">Activity history</h2></div>' + ui.historyList(task.history) + '</section>' +
      '</div></div>';
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
  WH.forms['submit-approval'] = (app, form, d) => app.mutate(() => W.submitForApproval(app.state, app.user, id(form), d.note), 'Submitted to Carla for approval.', { form });
  WH.forms.block = (app, form, d) => app.mutate(() => W.setBlocked(app.state, app.user, id(form), d.reason), 'Flagged as blocked.', { form });
  WH.forms.approve = (app, form, d) => app.mutate(() => W.approve(app.state, app.user, id(form), d.note), 'Approved and marked Complete.', { form });
  WH.forms.revisions = (app, form, d) => app.mutate(() => W.requestRevisions(app.state, app.user, id(form), d.note), 'Returned to Maha for revisions.', { form });
  WH.forms.priority = (app, form, d) => app.mutate(() => W.setPriority(app.state, app.user, id(form), d.priority, d.reason), 'Priority saved.', { form });
  WH.forms.cancel = (app, form, d) => app.mutate(() => W.cancelTask(app.state, app.user, id(form), d.reason), 'Request cancelled. History is kept.', { form });

  WH.forms['request-decision'] = (app, form, d, ev) => {
    const decision = form.getAttribute('data-decision') || 'approve';
    app.mutate(() => W.decideRequest(app.state, app.user, id(form), decision, d.note),
      decision === 'approve' ? 'Request approved. Maha and the requester are notified (simulated). Maha still confirms dates.' : 'Request declined. Maha and the requester are notified (simulated).', { form });
  };
  WH.actions['resend-approval'] = (app, el) => app.mutate(() => W.resendApprovalEmail(app.state, app.user, el.getAttribute('data-id')), 'New approval email created (simulated, not sent).');
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
