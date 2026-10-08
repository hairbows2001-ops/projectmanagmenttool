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
    const options = [];
    for (let i = 0; i < 10; i++) {
      const w = D.addDays(cw, i * 7);
      const c = conflicts.find((x) => x.summary.weekStart === w);
      options.push('<option value="' + w + '"' + (w === selected ? ' selected' : '') + '>Week of ' + esc(D.fmtWeek(w)) +
        (c ? (c.kind === 'committed' ? ' · ' + fmtHours(c.summary.over) + ' over' : ' · over if requests are scheduled') : '') + '</option>');
    }
    return '<div class="field"><label for="dec-week">Week' + (conflictWeeks.length ? ' <span class="hint">' + conflictWeeks.length + ' with conflicts</span>' : '') + '</label>' +
      '<select id="dec-week" data-change="decision-week-select">' + options.join('') + '</select></div>';
  }

  /** Competing work in the week, as compact rows. Carla can tick work to move. */
  function competing(app, s, cw) {
    const isCarla = P.can(app.user, 'proposal.create');
    const pendingIds = new Set();
    app.state.proposals.filter((p) => p.status === 'pending').forEach((p) => p.moves.forEach((m) => pendingIds.add(m.taskId)));
    const items = s.tasks.slice().sort((a, b) => {
      const pa = a.task.priority ? PRIO[a.task.priority] : 9;
      const pb = b.task.priority ? PRIO[b.task.priority] : 9;
      return pa - pb || ((a.task.agreedDeadline || '') < (b.task.agreedDeadline || '') ? -1 : 1);
    });
    if (!items.length) return '<p class="empty">No scheduled task hours in this week.</p>';
    const weekOpts = () => {
      const out = [];
      for (let i = 0; i < 10; i++) { const w = D.addDays(cw, i * 7); if (w !== s.weekStart) out.push(w); }
      const after = out.find((w) => w > s.weekStart) || out[0];
      return out.map((w) => '<option value="' + w + '"' + (w === after ? ' selected' : '') + '>Week of ' + esc(D.fmtWeek(w)) + '</option>').join('');
    };
    return '<ul class="tlist compete">' + items.map((x) => {
      const t = x.task;
      const pending = pendingIds.has(t.id);
      const meta = fmtHours(x.hours) + ' this week · ' + (t.priority ? esc(t.priority + ' ' + W.PRIORITIES[t.priority]) : 'No priority') +
        (t.deadlineFixed ? ' · Fixed date' : '') + (t.requestedUrgency === 'urgent' ? ' · Requested as urgent' : '');
      const lead = isCarla
        ? (pending ? '<span class="chip pending small">Pending</span>' : '<label class="trow-check"><input type="checkbox" name="move:' + esc(t.id) + '" id="mv-' + esc(t.id) + '" data-hours="' + x.hours + '" data-change="decision-preview"><span class="visually-hidden">Move ' + esc(t.title) + '</span></label>')
        : '';
      const moveFields = isCarla && !pending
        ? '<div class="move-fields form-grid"><div class="field"><label for="to-' + esc(t.id) + '">Move to</label><select id="to-' + esc(t.id) + '" name="to:' + esc(t.id) + '">' + weekOpts() + '</select></div>' +
          '<div class="field"><label for="pd-' + esc(t.id) + '">Proposed deadline <span class="hint">Optional</span></label><input type="date" id="pd-' + esc(t.id) + '" name="deadline:' + esc(t.id) + '"></div></div>'
        : '';
      return '<li class="trow' + (lead ? ' has-lead' : '') + '">' + lead + '<div class="trow-main"><a class="trow-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' +
        '<span class="trow-meta">' + esc(people.name(t.requesterId)) + ' · ' + esc(ui.dueText(t)) + ' · ' + meta + '</span>' + moveFields + '</div>' +
        '<div class="trow-side">' + ui.statusLabel(t) + '</div></li>';
    }).join('') + '</ul>';
  }

  function otherCommitments(s) {
    const items = s.meetings.map((m) => '<li>' + esc(D.fmtShort(m.date)) + ', ' + esc(D.fmtTime(m.start)) + ' · ' + esc(m.purpose) + ' (' + fmtHours(C.meetingHours(m)) + ')</li>')
      .concat(s.events.map((e) => '<li>' + esc(D.fmtShort(e.date)) + ' · ' + esc(e.title) + ' (' + fmtHours(C.eventHours(e)) + ', event)</li>'))
      .concat(s.socialTasks.map((x) => '<li>' + esc(x.task.title) + ' (within social media time)</li>'));
    const pending = s.pendingTasks.map((x) => '<li>' + esc(x.task.title) + ' · ' + esc(people.first(x.task.requesterId)) + ' · ' + fmtHours(x.hours) + ' potential</li>')
      .concat(s.needsEstimate.map((t) => '<li>' + esc(t.title) + ' · estimate needed</li>'));
    return '<details class="psec" id="prio-also"><summary><span>Also in this week</span></summary><div class="psec-body small">' +
      '<p class="label">Meetings, events and social media (' + fmtHours(s.social) + ' reserved)</p>' + (items.length ? '<ul>' + items.join('') + '</ul>' : '<p class="empty">None.</p>') +
      '<p class="label">Requested, not yet scheduled (not counted)</p>' + (pending.length ? '<ul>' + pending.join('') + '</ul>' : '<p class="empty">None.</p>') + '</div></details>';
  }

  function proposalCard(app, p) {
    const isMaha = P.can(app.user, 'proposal.confirm');
    const moves = p.moves.map((mv) => {
      const t = app.state.tasks.find((x) => x.id === mv.taskId) || { title: '(removed task)', id: mv.taskId };
      const fixed = t.deadlineFixed && t.requestedDeadline && (mv.proposedDeadline || '') > t.requestedDeadline;
      return '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="num">' + fmtHours(mv.hours) + '</span></div>' +
        '<div class="row-meta"><span>To week of ' + esc(D.fmtWeek(mv.toWeek)) + '</span>' +
        '<span>Deadline ' + (mv.previousDeadline ? esc(D.fmtShort(mv.previousDeadline)) : 'none') + ' → ' + (mv.confirmedDeadline ? '<strong>' + esc(D.fmtShort(mv.confirmedDeadline)) + '</strong>' : mv.proposedDeadline ? esc(D.fmtShort(mv.proposedDeadline)) + ' (proposed)' : 'Maha to set') + '</span></div>' +
        (fixed ? '<p class="small over-text">The requested date (' + esc(D.fmtShort(t.requestedDeadline)) + ') is externally fixed.</p>' : '') +
        (isMaha && p.status === 'pending' ? '<div class="field" data-field="deadline-' + esc(t.id) + '"><label for="cf-' + esc(p.id) + '-' + esc(t.id) + '">Confirmed deadline</label>' +
          '<input type="date" id="cf-' + esc(p.id) + '-' + esc(t.id) + '" name="deadline:' + esc(t.id) + '" value="' + esc(mv.proposedDeadline || (t.agreedDeadline && D.weekStart(t.agreedDeadline) >= mv.toWeek ? t.agreedDeadline : D.addDays(mv.toWeek, 4))) + '"></div>' : '') + '</li>';
    }).join('');
    const status = p.status === 'pending' ? '<span class="chip pending waiting">' + ui.icon('hourglass') + 'Waiting for Maha</span>'
      : p.status === 'confirmed' ? '<span class="chip s-complete">' + ui.icon('check') + 'Confirmed</span>' : '<span class="chip s-cancelled">' + ui.icon('x') + 'Not confirmed</span>';
    const body = '<ul class="rows">' + moves + '</ul>' +
      (p.status === 'pending' && isMaha
        ? ui.field({ name: 'note', label: 'Note (required if you cannot confirm)', id: 'pn-' + p.id }) +
          '<div class="btn-row"><button type="submit" class="btn primary small">' + ui.icon('check') + 'Confirm these dates</button>' +
          '<button type="button" class="btn small danger" data-action="proposal-decline" data-id="' + esc(p.id) + '">Cannot confirm</button></div>'
        : p.status === 'pending' ? '<p class="small muted">Nothing has moved yet. Maha confirms the dates.</p>' : '');
    return '<article class="proposal"><div class="row-line"><strong>Week of ' + esc(D.fmtWeek(p.weekStart)) + '</strong>' + status + '</div>' +
      '<p class="small">Carla’s reason: ' + esc(p.reason) + '</p>' +
      '<p class="small muted">Proposed ' + esc(D.fmtStamp(p.createdAt)) + (p.decidedAt ? ' · Decided by ' + esc(people.name(p.decidedBy)) + ', ' + esc(D.fmtStamp(p.decidedAt)) : '') + '</p>' +
      (p.decisionNote ? '<p class="small">Maha’s note: ' + esc(p.decisionNote) + '</p>' : '') +
      (p.status === 'pending' && isMaha ? '<form data-form="proposal-confirm" data-id="' + esc(p.id) + '" novalidate>' + body + '</form>' : body) + '</article>';
  }

  WH.panels.priorities = function (app) {
    const s0 = app.state;
    const cw = W.currentWeek();
    const conflicts = C.conflicts(s0, cw, 8);
    const selected = app.ui.decisionWeek && app.ui.decisionWeek >= cw ? app.ui.decisionWeek : (conflicts[0] ? conflicts[0].summary.weekStart : cw);
    app.ui.decisionWeek = selected;
    const s = C.weekSummary(s0, selected, cw);
    const isCarla = P.can(app.user, 'proposal.create');
    const pending = s0.proposals.filter((p) => p.status === 'pending');
    const decided = s0.proposals.filter((p) => p.status !== 'pending').sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));

    const weekStatus = s.over > 0
      ? '<p class="week-summary"><span class="over-text">' + fmtHours(s.over) + ' over capacity</span> · ' + fmtHours(s.committed) + ' planned / ' + fmtHours(s.capacity) + ' available</p>'
      : '<p class="week-summary">' + fmtHours(s.remaining) + ' free · ' + fmtHours(s.committed) + ' planned / ' + fmtHours(s.capacity) + ' available' +
        (s.potentialRemaining < 0 ? ' · <span class="over-text">over if pending requests are scheduled</span>' : '') + '</p>';

    const decide = isCarla
      ? '<form data-form="proposal-create" data-week="' + selected + '" novalidate>' +
        '<p class="small">Tick the work to move, choose a week, and give a reason. Maha confirms the dates; nothing moves before that.</p>' +
        competing(app, s, cw) + '<div id="decision-preview" class="small" aria-live="polite"></div><div data-field="moves"></div>' +
        ui.field({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, required: true, id: 'dec-reason', hint: 'Recorded in each task’s history.' }) +
        '<button type="submit" class="btn primary">Propose changes to Maha</button></form>'
      : competing(app, s, cw) + '<p class="small muted">' + (WH.permissions.isOwner(app.user) ? 'Carla decides what moves. You confirm the dates above.' : 'Carla decides what moves; Maha confirms the dates.') + '</p>';

    const html = '<p class="small muted">Carla resolves competing priorities and proposes what moves. Maha confirms the revised dates.</p>' +
      (pending.length ? '<h3 class="sub-head">Waiting for Maha to confirm</h3>' + pending.map((p) => proposalCard(app, p)).join('') : '') +
      '<h3 class="sub-head">Competing work</h3>' + weekPicker(app, cw, selected, conflicts) + weekStatus + decide + otherCommitments(s) +
      (decided.length ? '<details class="psec" id="prio-earlier"><summary><span>Earlier decisions</span><span class="psec-count">' + decided.length + '</span></summary><div class="psec-body">' + decided.map((p) => proposalCard(app, p)).join('') + '</div></details>' : '');
    return { title: 'Priorities', eyebrow: 'Tasks', html, wide: true };
  };

  WH.actions['decision-week'] = (app, el) => { app.ui.decisionWeek = el.getAttribute('data-week'); app.render(); };
  WH.actions['decision-week-select'] = (app, el) => { app.ui.decisionWeek = el.value; app.render(); };

  WH.actions['decision-preview'] = (app, el) => {
    const form = el.closest('form');
    // Show the move fields only for ticked work.
    const row = el.closest('.trow');
    if (row) row.classList.toggle('moving', el.checked);
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
