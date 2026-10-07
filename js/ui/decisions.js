/*
 * Priorities & decisions.
 * Carla sees competing commitments in an over-capacity week, chooses what moves and records why.
 * Maha confirms (or declines) the resulting dates. Nothing moves until Maha confirms.
 */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  const PRIO = { P1: 0, P2: 1, P3: 2, P4: 3 };

  function weekPicker(app, cw, selected, conflicts) {
    const conflictWeeks = conflicts.map((c) => c.summary.weekStart);
    const btns = conflicts.map((c) => '<button type="button" class="btn small' + (c.summary.weekStart === selected ? ' primary' : '') + '" data-action="decision-week" data-week="' + c.summary.weekStart + '"' +
      (c.summary.weekStart === selected ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + (c.kind === 'committed' ? ui.icon('alert') : '') + 'Week of ' + esc(D.fmtWeek(c.summary.weekStart)) +
      ' · ' + (c.kind === 'committed' ? '+' + fmtHours(c.summary.over) : fmtHours(-c.summary.potentialRemaining) + ' potential') + '</button>').join('');
    const options = [];
    for (let i = 0; i < 10; i++) {
      const w = D.addDays(cw, i * 7);
      options.push('<option value="' + w + '"' + (w === selected ? ' selected' : '') + '>Week of ' + esc(D.fmtWeek(w)) + (conflictWeeks.includes(w) ? ' (conflict)' : '') + '</option>');
    }
    return '<div class="card" style="margin-bottom:20px"><div class="card-head"><h2>Weeks needing a decision</h2></div>' +
      (btns ? '<div class="btn-row">' + btns + '</div>' : '<p class="empty">No weeks are over capacity in the next eight weeks.</p>') +
      '<div class="field" style="max-width:320px;margin-top:14px;margin-bottom:0"><label for="dec-week">Or look at any week</label><select id="dec-week" data-change="decision-week-select">' + options.join('') + '</select></div></div>';
  }

  function competingTable(app, s, cw) {
    const isCarla = P.can(app.user, 'proposal.create');
    const pendingTaskIds = new Set();
    app.state.proposals.filter((p) => p.status === 'pending').forEach((p) => p.moves.forEach((m) => pendingTaskIds.add(m.taskId)));
    const tasks = s.tasks.slice().sort((a, b) => {
      const pa = a.task.priority ? PRIO[a.task.priority] : 9;
      const pb = b.task.priority ? PRIO[b.task.priority] : 9;
      return pa - pb || ((a.task.agreedDeadline || '') < (b.task.agreedDeadline || '') ? -1 : 1);
    });
    if (!tasks.length) return '<p class="empty">No scheduled task hours in this week.</p>';
    const weekOpts = (taskObj) => {
      const out = [];
      for (let i = 0; i < 10; i++) {
        const w = D.addDays(cw, i * 7);
        if (w === s.weekStart) continue;
        out.push(w);
      }
      const after = out.find((w) => w > s.weekStart) || out[0];
      return out.map((w) => '<option value="' + w + '"' + (w === after ? ' selected' : '') + '>Week of ' + esc(D.fmtWeek(w)) + '</option>').join('');
    };
    const rows = tasks.map((x) => {
      const t = x.task;
      const pending = pendingTaskIds.has(t.id);
      const sel = isCarla && !pending
        ? '<td data-label="Move"><input type="checkbox" name="move:' + esc(t.id) + '" id="mv-' + esc(t.id) + '" data-hours="' + x.hours + '" data-change="decision-preview" aria-label="Move ' + esc(t.title) + '"></td>'
        : isCarla ? '<td data-label="Move"><span class="chip pending small">Pending</span></td>' : '';
      const moveTo = isCarla && !pending
        ? '<td data-label="Move to"><label class="visually-hidden" for="to-' + esc(t.id) + '">Move ' + esc(t.title) + ' to</label><select id="to-' + esc(t.id) + '" name="to:' + esc(t.id) + '">' + weekOpts(t) + '</select>' +
          '<label class="visually-hidden" for="pd-' + esc(t.id) + '">Proposed new deadline for ' + esc(t.title) + '</label><input type="date" id="pd-' + esc(t.id) + '" name="deadline:' + esc(t.id) + '" style="margin-top:6px" title="Proposed new deadline (optional)">' +
          '<span class="sub">Proposed deadline (optional)</span></td>'
        : isCarla ? '<td></td>' : '';
      return '<tr>' + sel +
        '<td class="title-cell"><a href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="sub">' + esc(people.name(t.requesterId)) + '</span></td>' +
        '<td data-label="Priority"><span class="chips">' + ui.priorityChip(t) + ui.urgencyChip(t) + '</span></td>' +
        '<td data-label="This week" class="num">' + fmtHours(x.hours) + '</td>' +
        '<td data-label="Agreed">' + ui.dateOr(t.agreedDeadline, 'Not agreed') + '</td>' +
        '<td data-label="Requested">' + ui.requestedDeadline(t) + '</td>' +
        '<td data-label="Status">' + ui.statusChip(t.status) + '</td>' + moveTo + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="tasks"><caption class="visually-hidden">Competing commitments in the week of ' + esc(D.fmtWeek(s.weekStart)) + '</caption><thead><tr>' +
      (isCarla ? '<th scope="col">Move</th>' : '') + '<th scope="col">Task</th><th scope="col">Priority</th><th scope="col">This week</th><th scope="col">Agreed deadline</th><th scope="col">Requested deadline</th><th scope="col">Status</th>' +
      (isCarla ? '<th scope="col">Move to</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function otherCommitments(s) {
    const items = s.meetings.map((m) => '<li>' + esc(D.fmtShort(m.date)) + ', ' + esc(D.fmtTime(m.start)) + ' · ' + esc(m.purpose) + ' (' + fmtHours(C.meetingHours(m)) + ', meeting)</li>')
      .concat(s.events.map((e) => '<li>' + esc(D.fmtShort(e.date)) + ' · ' + esc(e.title) + ' (' + fmtHours(C.eventHours(e)) + ', event)</li>'))
      .concat(s.socialTasks.map((x) => '<li>' + esc(x.task.title) + ' (within social media time)</li>'));
    const pending = s.pendingTasks.map((x) => '<li><a href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a> · ' + esc(people.name(x.task.requesterId)) + ' · ' + fmtHours(x.hours) + ' potential' +
      (x.task.requestedUrgency === 'urgent' ? ' · <strong>requested as urgent</strong>' : '') + '</li>')
      .concat(s.needsEstimate.map((t) => '<li><a href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a> · estimate needed</li>'));
    return '<div class="grid grid-2" style="margin-top:16px"><div><h3 class="eyebrow">Also in this week</h3>' + (items.length ? '<ul class="small">' + items.join('') + '</ul>' : '<p class="empty small">Nothing else.</p>') +
      '<p class="small muted">Social media reserve: ' + fmtHours(s.social) + '. Meetings are managed on the Meetings page.</p></div>' +
      '<div><h3 class="eyebrow">Waiting to be scheduled (not counted)</h3>' + (pending.length ? '<ul class="small">' + pending.join('') + '</ul>' : '<p class="empty small">No pending requests for this week.</p>') + '</div></div>';
  }

  function proposalCard(app, p) {
    const isMaha = P.can(app.user, 'proposal.confirm');
    const moves = p.moves.map((mv) => {
      const t = app.state.tasks.find((x) => x.id === mv.taskId) || { title: '(removed task)', id: mv.taskId };
      const fixed = t.deadlineFixed && t.requestedDeadline && (mv.proposedDeadline || '') > t.requestedDeadline;
      return '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="num">' + fmtHours(mv.hours) + '</span></div>' +
        '<div class="row-meta"><span>From week of ' + esc(D.fmtWeek(mv.fromWeek)) + ' → week of ' + esc(D.fmtWeek(mv.toWeek)) + '</span>' +
        '<span>Deadline ' + (mv.previousDeadline ? esc(D.fmtShort(mv.previousDeadline)) : 'none') + ' → ' + (mv.confirmedDeadline ? '<strong>' + esc(D.fmtShort(mv.confirmedDeadline)) + '</strong> (confirmed)' : mv.proposedDeadline ? esc(D.fmtShort(mv.proposedDeadline)) + ' (proposed)' : 'Maha to set') + '</span></div>' +
        (fixed ? '<div class="callout warn small"><p>The requested deadline (' + esc(D.fmtShort(t.requestedDeadline)) + ') is externally fixed.</p></div>' : '') +
        (isMaha && p.status === 'pending' ? '<div class="field" data-field="deadline-' + esc(t.id) + '" style="margin:8px 0 0"><label for="cf-' + esc(p.id) + '-' + esc(t.id) + '">Confirmed deadline for ' + esc(t.title) + '</label>' +
          '<input type="date" id="cf-' + esc(p.id) + '-' + esc(t.id) + '" name="deadline:' + esc(t.id) + '" value="' + esc(mv.proposedDeadline || (t.agreedDeadline && D.weekStart(t.agreedDeadline) >= mv.toWeek ? t.agreedDeadline : D.addDays(mv.toWeek, 4))) + '"></div>' : '') + '</li>';
    }).join('');
    const status = p.status === 'pending' ? '<span class="chip pending s-awaiting_approval">' + ui.icon('hourglass') + 'Pending Maha’s confirmation</span>'
      : p.status === 'confirmed' ? '<span class="chip s-complete">' + ui.icon('check') + 'Confirmed by ' + esc(people.first(p.decidedBy)) + '</span>'
        : '<span class="chip s-cancelled">' + ui.icon('x') + 'Not confirmed</span>';
    let actions = '';
    if (p.status === 'pending' && isMaha) {
      actions = '<div class="btn-row" style="margin-top:12px"><button type="submit" class="btn small accent">' + ui.icon('check') + 'Confirm these dates</button></div>' +
        ui.field({ name: 'note', label: 'Note (optional for confirming, required if you cannot confirm)', id: 'pn-' + p.id }) +
        '<button type="button" class="btn small danger" data-action="proposal-decline" data-id="' + esc(p.id) + '">Cannot confirm</button>';
    } else if (p.status === 'pending') {
      actions = '<p class="small muted" style="margin-top:10px">Nothing has moved yet. Maha confirms the resulting dates.</p>';
    }
    const body = '<ul class="rows">' + moves + '</ul>' + actions;
    return '<article class="card ' + (p.status === 'pending' ? 'attention' : '') + '"><div class="card-head"><h3>Week of ' + esc(D.fmtWeek(p.weekStart)) + '</h3>' + status + '</div>' +
      '<p class="small"><strong>Carla’s reason:</strong> ' + esc(p.reason) + '</p>' +
      '<p class="small muted">Proposed by ' + esc(people.name(p.createdBy)) + ', ' + esc(D.fmtStamp(p.createdAt)) +
      (p.decidedAt ? ' · Decided by ' + esc(people.name(p.decidedBy)) + ', ' + esc(D.fmtStamp(p.decidedAt)) : '') + (p.sample ? ' · Fictional sample' : '') + '</p>' +
      (p.decisionNote ? '<p class="small"><strong>Maha’s note:</strong> ' + esc(p.decisionNote) + '</p>' : '') +
      (p.status === 'pending' && isMaha ? '<form data-form="proposal-confirm" data-id="' + esc(p.id) + '" novalidate>' + body + '</form>' : body) + '</article>';
  }

  WH.views.decisions = function (app) {
    const s0 = app.state;
    const cw = W.currentWeek();
    const conflicts = C.conflicts(s0, cw, 8);
    const selected = app.ui.decisionWeek && app.ui.decisionWeek >= cw ? app.ui.decisionWeek : (conflicts[0] ? conflicts[0].summary.weekStart : cw);
    app.ui.decisionWeek = selected;
    const s = C.weekSummary(s0, selected, cw);
    const isCarla = P.can(app.user, 'proposal.create');
    const pending = s0.proposals.filter((p) => p.status === 'pending');
    const decided = s0.proposals.filter((p) => p.status !== 'pending').sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));

    const summaryLine = s.over > 0
      ? '<div class="callout danger"><p><strong>Week of ' + esc(D.fmtWeek(selected)) + ' is ' + fmtHours(s.over) + ' over capacity.</strong> ' + fmtHours(s.committed) + ' committed of ' + fmtHours(s.capacity) + '.' +
        (s.pendingHours ? ' Another ' + fmtHours(s.pendingHours) + ' is requested but not scheduled.' : '') + '</p></div>'
      : s.potentialRemaining < 0
        ? '<div class="callout warn"><p><strong>Week of ' + esc(D.fmtWeek(selected)) + ' has ' + fmtHours(s.remaining) + ' free</strong>, but scheduling the pending requests would put it ' + fmtHours(-s.potentialRemaining) + ' over.</p></div>'
        : '<div class="callout info"><p>Week of ' + esc(D.fmtWeek(selected)) + ' has ' + fmtHours(s.remaining) + ' free.</p></div>';

    const carlaForm = isCarla
      ? '<form data-form="proposal-create" data-week="' + selected + '" novalidate>' + competingTable(app, s, cw) +
        '<div id="decision-preview" class="small" aria-live="polite" style="margin:10px 0"></div>' +
        '<div data-field="moves"></div>' +
        ui.field({ name: 'reason', label: 'Reason for this decision', type: 'textarea', rows: 2, required: true, id: 'dec-reason', hint: 'Recorded in each task’s history and shown to Maha and the requesters.' }) +
        '<button type="submit" class="btn primary">Propose these changes to Maha</button>' +
        '<p class="small muted" style="margin-top:8px">Proposed changes stay pending until Maha confirms the dates. Nothing is rescheduled automatically.</p></form>'
      : competingTable(app, s, cw) + '<p class="small muted" style="margin-top:10px">' + (app.user === 'maha' ? 'Carla decides what moves. You confirm the resulting dates below.' : 'Carla decides what moves when work competes; Maha confirms the dates.') + '</p>';

    return '<div class="page-head"><div><p class="eyebrow">Carla decides · Maha confirms</p><h1>Priorities &amp; decisions</h1>' +
      '<p>When requests compete, Carla sets priorities and proposes what moves. Maha confirms the resulting dates.</p></div></div>' +
      weekPicker(app, cw, selected, conflicts) +
      '<section class="card" aria-labelledby="comp-h" style="margin-bottom:20px"><div class="card-head"><h2 id="comp-h">Competing commitments</h2><span class="muted small">Week of ' + esc(D.fmtWeek(selected)) + '</span></div>' +
      summaryLine + carlaForm + otherCommitments(s) + '</section>' +
      '<h2>Pending changes</h2>' + (pending.length ? '<div class="grid grid-2" style="margin-bottom:24px">' + pending.map((p) => proposalCard(app, p)).join('') + '</div>' : '<p class="empty" style="margin-bottom:24px">No changes are waiting for confirmation.</p>') +
      '<h2>Decision history</h2>' + (decided.length ? '<div class="grid grid-2">' + decided.map((p) => proposalCard(app, p)).join('') + '</div>' : '<p class="empty">No decisions yet.</p>');
  };

  WH.actions['decision-week'] = (app, el) => { app.ui.decisionWeek = el.getAttribute('data-week'); app.render(); };
  WH.actions['decision-week-select'] = (app, el) => { app.ui.decisionWeek = el.value; app.render(); };

  WH.actions['decision-preview'] = (app, el) => {
    const form = el.closest('form');
    const s = C.weekSummary(app.state, form.getAttribute('data-week'), W.currentWeek());
    let moved = 0;
    form.querySelectorAll('input[type="checkbox"][name^="move:"]').forEach((c) => { if (c.checked) moved += Number(c.getAttribute('data-hours')); });
    const after = s.remaining + moved;
    form.querySelector('#decision-preview').innerHTML = moved > 0
      ? 'Moving <strong>' + fmtHours(moved) + '</strong> out would leave this week ' + (after < 0 ? '<span class="over-text">' + fmtHours(-after) + ' over</span>' : '<span class="ok-text">' + fmtHours(after) + ' free</span>') +
        (s.pendingHours ? ' (before ' + fmtHours(s.pendingHours) + ' of pending requests).' : '.')
      : '';
  };

  WH.forms['proposal-create'] = (app, form, d) => {
    const moves = Object.keys(d).filter((k) => k.startsWith('move:') && d[k]).map((k) => {
      const tid = k.slice(5);
      return { taskId: tid, toWeek: d['to:' + tid], proposedDeadline: d['deadline:' + tid] };
    });
    app.mutate(() => W.createProposal(app.state, app.user, { weekStart: form.getAttribute('data-week'), reason: d.reason, moves }),
      'Proposal sent to Maha. It stays pending until confirmed.', { form });
  };

  WH.forms['proposal-confirm'] = (app, form, d) => {
    const deadlines = {};
    Object.keys(d).filter((k) => k.startsWith('deadline:')).forEach((k) => { deadlines[k.slice(9)] = d[k]; });
    app.mutate(() => W.confirmProposal(app.state, app.user, form.getAttribute('data-id'), deadlines, d.note), 'Confirmed. The schedule and agreed deadlines are updated.', { form });
  };

  WH.actions['proposal-decline'] = (app, el) => {
    const form = el.closest('form');
    const note = form.querySelector('[name="note"]').value;
    app.mutate(() => W.declineProposal(app.state, app.user, el.getAttribute('data-id'), note), 'Marked as not confirmed. Carla can decide again.', { form });
  };
})(globalThis.WH = globalThis.WH || {});
