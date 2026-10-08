/* Dashboards: Maha's workspace, manager dashboards, and Carla's dashboard. */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress'];
  const PRIO_ORDER = { P1: 0, P2: 1, P3: 2, P4: 3 };

  function byPriorityThenDate(a, b) {
    const pa = a.priority ? PRIO_ORDER[a.priority] : 9;
    const pb = b.priority ? PRIO_ORDER[b.priority] : 9;
    if (pa !== pb) return pa - pb;
    return (a.agreedDeadline || a.requestedDeadline || '9999') < (b.agreedDeadline || b.requestedDeadline || '9999') ? -1 : 1;
  }

  function greeting(app) {
    const p = people.get(app.user);
    const today = W.today();
    return '<div class="greeting"><p class="eyebrow">' + esc(D.fmtLong(today)) + ' · Toronto</p>' +
      '<h1>Welcome, <span class="highlight">' + esc(p.first) + '</span>.</h1>' +
      '<p class="muted">' + esc(p.title) + '</p></div>';
  }

  function card(title, body, opts) {
    const o = opts || {};
    const id = 'c-' + title.toLowerCase().replace(/[^a-z]+/g, '-');
    return '<section class="card ' + (o.tone || '') + '" aria-labelledby="' + id + '"><div class="card-head"><h2 id="' + id + '">' + esc(title) +
      (o.count !== undefined ? ' <span class="muted small">(' + o.count + ')</span>' : '') + '</h2>' + (o.link || '') + '</div>' + body + '</section>';
  }

  function meetingLine(m) {
    return '<li><div class="row-line"><span class="row-title">' + esc(D.fmtTime(m.start)) + ' · ' + esc(m.purpose) + '</span>' +
      '<span class="chip s-scheduled">' + ui.icon('users') + 'Meeting</span></div><div class="row-meta"><span>' + esc(people.name(m.requesterId)) +
      '</span><span>' + m.durationMin + ' min</span>' + (m.location ? '<span>' + esc(m.location) + '</span>' : '') + (m.sample ? '<span>Fictional sample</span>' : '') + '</div></li>';
  }

  function eventLine(e) {
    const outside = C.isOutsideRegularHours(e.date, e.start, e.end);
    return '<li><div class="row-line"><span class="row-title">' + esc(D.fmtTime(e.start)) + '–' + esc(D.fmtTime(e.end)) + ' · ' + esc(e.title) + '</span>' +
      '<span class="chip s-complete">' + ui.icon('calendar') + 'Event</span></div><div class="row-meta"><span>' + fmtHours(C.eventHours(e)) + '</span>' +
      (outside ? '<span>Partly outside regular hours</span>' : '') + (e.sample ? '<span>Fictional sample</span>' : '') + '</div></li>';
  }

  /** Work in progress, with remaining effort and a quick way for Maha to mark it complete. */
  function inProgressList(tasks, canComplete) {
    if (!tasks.length) return '<p class="empty">Nothing is in progress.</p>';
    return '<ul class="rows">' + tasks.map((t) => {
      const left = C.remainingOf(t);
      return '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="chips">' + ui.blockedChip(t) + ui.priorityChip(t) + '</span></div>' +
        '<div class="row-meta"><span>' + esc(people.name(t.requesterId)) + '</span><span>' + (left === 0 ? '<strong>0 h left: ready to complete</strong>' : fmtHours(left) + ' left') + '</span>' +
        (t.agreedDeadline ? '<span>Due ' + esc(D.fmtShort(t.agreedDeadline)) + '</span>' : '') + (t.sample ? '<span>Fictional sample</span>' : '') + '</div>' +
        (canComplete && !t.blocked ? '<div class="btn-row" style="margin-top:8px"><button type="button" class="btn small accent" data-action="quick-complete" data-id="' + esc(t.id) + '">' + ui.icon('check') + 'Mark complete</button></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  // ---------- Maha ----------

  function mahaDashboard(app) {
    const s = app.state;
    const today = W.today();
    const cw = W.currentWeek();
    const summary = C.weekSummary(s, cw, cw);

    const weekTasks = summary.tasks.concat(summary.socialTasks)
      .filter((x) => ['scheduled', 'in_progress'].includes(x.task.status))
      .sort((a, b) => byPriorityThenDate(a.task, b.task));
    const planned = weekTasks.filter((x) => (x.task.plannedDates || []).includes(today));
    const others = weekTasks.filter((x) => !(x.task.plannedDates || []).includes(today));
    const dueToday = s.tasks.filter((t) => OPEN.includes(t.status) && t.agreedDeadline === today);
    const todaysMeetings = s.meetings.filter((m) => m.status === 'accepted' && m.date === today).sort((a, b) => (a.start < b.start ? -1 : 1));
    const todaysEvents = s.events.filter((e) => e.date === today);

    const taskLine = (x, inToday) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a>' +
      '<span class="chips">' + ui.priorityChip(x.task) + ui.blockedChip(x.task) + '</span></div>' +
      '<div class="row-meta"><span>' + esc(people.name(x.task.requesterId)) + '</span><span>' + fmtHours(x.hours) + ' this week</span>' +
      '<span>Due ' + esc(D.fmtShort(x.task.agreedDeadline)) + '</span>' + (x.task.coveredBySocial ? '<span>Within social media time</span>' : '') + (x.task.sample ? '<span>Fictional sample</span>' : '') +
      '<span><button type="button" class="linklike" data-action="plan-today" data-id="' + esc(x.task.id) + '" data-on="' + (inToday ? '0' : '1') + '">' +
      (inToday ? 'Remove from today' : 'Add to today') + '</button></span></div></li>';

    const todayBody =
      (todaysMeetings.length || todaysEvents.length ? '<h3 class="eyebrow">Meetings and events</h3><ul class="rows">' + todaysMeetings.map(meetingLine).join('') + todaysEvents.map(eventLine).join('') + '</ul>' : '') +
      (dueToday.length ? '<div class="callout warn small" style="margin-top:12px"><p><strong>Due today:</strong> ' + dueToday.map((t) => ui.taskLink(t)).join(', ') + '</p></div>' : '') +
      '<h3 class="eyebrow" style="margin-top:16px">Today’s plan</h3>' +
      (planned.length ? '<ul class="rows">' + planned.map((x) => taskLine(x, true)).join('') + '</ul>' : '<p class="empty">Nothing planned for today yet. Add tasks from this week below.</p>') +
      '<h3 class="eyebrow" style="margin-top:16px">Also scheduled this week</h3>' +
      (others.length ? '<ul class="rows">' + others.map((x) => taskLine(x, false)).join('') + '</ul>' : '<p class="empty">No other scheduled tasks this week.</p>');

    const newRequests = s.tasks.filter((t) => t.status === 'submitted').sort(byPriorityThenDate);
    const clarification = s.tasks.filter((t) => t.status === 'clarification');
    const inProgress = s.tasks.filter((t) => t.status === 'in_progress').sort((a, b) => (C.remainingOf(a) - C.remainingOf(b)));

    const conflicts = C.conflicts(s, cw, 8);
    const pendingProposals = s.proposals.filter((p) => p.status === 'pending');
    const pendingMeetings = s.meetings.filter((m) => m.status === 'pending');
    const needEstimate = C.tasksNeedingEstimate(s);
    const blocked = s.tasks.filter((t) => t.blocked && OPEN.includes(t.status));

    const decisions = [];
    conflicts.forEach((c) => decisions.push('<li><div class="row-line"><span class="row-title">' + (c.kind === 'committed' ? ui.icon('alert').replace('<svg', '<svg width="16" height="16"') + ' Over capacity' : 'Would be over if requests are scheduled') +
      ': week of ' + esc(D.fmtWeek(c.summary.weekStart)) + '</span><span class="' + (c.kind === 'committed' ? 'over-text' : 'muted') + '">' +
      (c.kind === 'committed' ? '+' + fmtHours(c.summary.over) : '+' + fmtHours(-c.summary.potentialRemaining) + ' potential') + '</span></div>' +
      '<div class="row-meta"><span>' + (c.kind === 'committed' ? 'Waiting for Carla to decide what moves' : 'Review before scheduling') + '</span>' +
      '<span><a href="#/decisions" data-action="open-decision" data-week="' + c.summary.weekStart + '">Review</a></span></div></li>'));
    pendingProposals.forEach((p) => decisions.push('<li><div class="row-line"><span class="row-title">Carla proposed a schedule change</span><span class="chip pending waiting">' + ui.icon('hourglass') + 'Needs your confirmation</span></div>' +
      '<div class="row-meta"><span>Week of ' + esc(D.fmtWeek(p.weekStart)) + '</span><span>' + p.moves.length + ' task' + (p.moves.length > 1 ? 's' : '') + '</span>' +
      '<span><a href="#/decisions" data-action="open-decision" data-week="' + p.weekStart + '">Review and confirm</a></span></div></li>'));
    if (pendingMeetings.length) decisions.push('<li><div class="row-line"><span class="row-title">' + pendingMeetings.length + ' meeting request' + (pendingMeetings.length > 1 ? 's' : '') + ' to answer</span></div><div class="row-meta"><span><a href="#/meetings">Open meetings</a></span></div></li>');
    needEstimate.forEach((t) => decisions.push('<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="chip estimate-needed">' + ui.icon('alert') + 'Estimate needed</span></div><div class="row-meta"><span>' + esc(people.name(t.requesterId)) + '</span></div></li>'));
    blocked.forEach((t) => decisions.push('<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' + ui.blockedChip(t) + '</div><div class="row-meta"><span>' + esc(t.blocked.reason) + '</span></div></li>'));

    const counts = [
      newRequests.length + ' new request' + (newRequests.length === 1 ? '' : 's'),
      clarification.length + ' awaiting clarification',
      inProgress.length + ' in progress',
      conflicts.filter((c) => c.kind === 'committed').length + ' week' + (conflicts.filter((c) => c.kind === 'committed').length === 1 ? '' : 's') + ' over capacity'
    ];

    return greeting(app) +
      '<p class="muted" style="margin-top:-16px;margin-bottom:24px">' + esc(counts.join(' · ')) + '</p>' +
      '<div class="grid grid-main"><div class="stack">' +
      card('Today', todayBody, { tone: 'accent', link: '<a href="#/calendar" data-action="cal-goto-week">Week view</a>' }) +
      card('New requests to review', ui.taskRows(newRequests, { empty: 'No new requests.', showPriority: true, extra: (t) => (t.estimateHours > 0 ? fmtHours(t.estimateHours) + ' estimated' : 'Estimate needed') + ' · Requested ' + (t.requestedDeadline ? D.fmtShort(t.requestedDeadline) : 'date not known') }), { count: newRequests.length, tone: newRequests.length ? 'attention' : '' }) +
      card('Needs clarification', ui.taskRows(clarification, { empty: 'Nothing waiting on clarification.', extra: (t) => 'Waiting on ' + esc(people.first(t.requesterId)) }), { count: clarification.length }) +
      card('In progress', inProgressList(inProgress, true), { count: inProgress.length }) +
      '</div><div class="stack">' +
      ui.capacityCard(summary, { title: 'This week’s capacity' }) +
      card('Conflicts and decisions', decisions.length ? '<ul class="rows">' + decisions.join('') + '</ul>' : '<p class="empty">No conflicts or pending decisions.</p>', { tone: decisions.length ? 'alert' : 'good', link: '<a href="#/decisions">Priorities &amp; decisions</a>' }) +
      '</div></div>';
  }

  // ---------- managers & Carla ----------

  function workloadSummary(app) {
    const s = app.state;
    const cw = W.currentWeek();
    const rows = [0, 1, 2, 3].map((i) => {
      const w = D.addDays(cw, i * 7);
      const x = C.weekSummary(s, w, cw);
      return '<tr' + (i === 0 ? ' class="current"' : '') + '><td>' + (i === 0 ? 'This week' : 'Week of ' + esc(D.fmtWeek(w))) + (x.adjusted ? ' <span class="sub muted">' + esc(x.adjustReason) + '</span>' : '') + '</td>' +
        '<td class="hide-sm">' + fmtHours(x.committed) + ' of ' + fmtHours(x.capacity) + '</td>' +
        '<td>' + (x.over > 0 ? '<span class="over-text">' + ui.icon('alert').replace('<svg', '<svg width="14" height="14"') + ' ' + fmtHours(x.over) + ' over</span>' : '<span class="ok-text">' + fmtHours(x.remaining) + ' free</span>') + '</td>' +
        '<td class="hide-sm">' + (x.pendingHours > 0 || x.needsEstimate.length ? fmtHours(x.pendingHours) + (x.needsEstimate.length ? ' + ' + x.needsEstimate.length + ' unestimated' : '') : '—') + '</td></tr>';
    }).join('');
    const openCount = s.tasks.filter((t) => OPEN.includes(t.status)).length;
    return card('Maha’s workload', '<p class="small muted">' + openCount + ' open requests across all managers. Weekly capacity is 37.7 h, with 6 h reserved for social media.</p>' +
      '<table class="week-table"><caption class="visually-hidden">Maha’s capacity for the next four weeks</caption><thead><tr><th scope="col">Week</th><th scope="col" class="hide-sm">Committed</th><th scope="col">Available</th><th scope="col" class="hide-sm">Requested, not scheduled</th></tr></thead><tbody>' + rows + '</tbody></table>',
    { tone: 'accent', link: '<a href="#/workload">Shared workload</a>' });
  }

  function managerDashboard(app) {
    const s = app.state;
    const me = app.user;
    const isCarla = me === 'carla';
    const cw = W.currentWeek();
    const today = W.today();

    const mine = s.tasks.filter((t) => t.requesterId === me);
    const mineOpen = mine.filter((t) => OPEN.includes(t.status)).sort(byPriorityThenDate);
    const mineClosed = mine.filter((t) => !OPEN.includes(t.status));
    const needInfo = mine.filter((t) => t.status === 'clarification');
    const counterMeetings = s.meetings.filter((m) => m.requesterId === me && m.status === 'counter');
    const horizon = D.addDays(today, 30);
    const upcoming = mineOpen
      .map((t) => ({ t, date: t.agreedDeadline || t.requestedDeadline, agreed: !!t.agreedDeadline }))
      .filter((x) => x.date && x.date <= horizon)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const inputBody = (needInfo.length || counterMeetings.length)
      ? '<ul class="rows">' + needInfo.map((t) => {
        const q = t.comments.filter((c) => c.kind === 'clarification').pop();
        return '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' + ui.statusChip(t.status) + '</div>' +
          (q ? '<div class="row-meta"><span>Maha asks: “' + esc(q.text) + '”</span></div>' : '') + '</li>';
      }).join('') + counterMeetings.map((m) => '<li><div class="row-line"><span class="row-title">' + esc(m.purpose) + '</span><span class="chip pending">' + ui.icon('clock') + 'New time proposed</span></div>' +
        '<div class="row-meta"><span>Maha suggests ' + esc(D.fmtShort(m.counter.date)) + ', ' + esc(D.fmtTime(m.counter.start)) + '</span><span><a href="#/meetings">Respond</a></span></div></li>').join('') + '</ul>'
      : '<p class="empty">Nothing needs your input right now.</p>';

    const upcomingBody = upcoming.length
      ? '<ul class="rows">' + upcoming.map((x) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.t.id) + '">' + esc(x.t.title) + '</a><span>' + esc(D.fmtShort(x.date)) + '</span></div>' +
        '<div class="row-meta"><span>' + (x.agreed ? 'Agreed deadline' : 'Requested, not yet agreed') + '</span><span>' + esc(W.STATUSES[x.t.status]) + '</span></div></li>').join('') + '</ul>'
      : '<p class="empty">No deadlines in the next 30 days.</p>';

    const actions = '<div class="btn-row" style="margin-bottom:28px"><a class="btn primary big" href="#/requests/new">' + ui.icon('plus') + 'Request a task</a>' +
      '<a class="btn big" href="#/meetings/new">' + ui.icon('users') + 'Request a meeting</a></div>';

    let carla = '';
    if (isCarla) {
      const conflicts = C.conflicts(s, cw, 8);
      const recentDone = s.tasks.filter((t) => t.status === 'complete' && (t.completedAt || '') >= new Date(W.now().getTime() - 14 * 86400000).toISOString())
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
      const inProgress = s.tasks.filter((t) => t.status === 'in_progress');
      const pendingProposals = s.proposals.filter((p) => p.status === 'pending');
      const noPriority = s.tasks.filter((t) => OPEN.includes(t.status) && !t.priority);

      const conflictBody = conflicts.length
        ? '<ul class="rows">' + conflicts.map((c) => {
          const x = c.summary;
          const competing = x.tasks.map((y) => y.task).sort(byPriorityThenDate).slice(0, 4);
          return '<li><div class="row-line"><span class="row-title">Week of ' + esc(D.fmtWeek(x.weekStart)) + '</span><span class="' + (c.kind === 'committed' ? 'over-text' : 'muted') + '">' +
            (c.kind === 'committed' ? ui.icon('alert').replace('<svg', '<svg width="14" height="14"') + ' ' + fmtHours(x.over) + ' over capacity' : fmtHours(-x.potentialRemaining) + ' over if requests are scheduled') + '</span></div>' +
            '<div class="row-meta"><span>Competing: ' + competing.map((t) => esc(t.title) + ' (' + esc(people.first(t.requesterId)) + ')').join(', ') + '</span></div>' +
            '<div style="margin-top:8px"><a class="btn small primary" href="#/decisions" data-action="open-decision" data-week="' + x.weekStart + '">Decide what moves</a></div></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No weeks are over capacity.</p>';

      const doneBody = recentDone.length
        ? '<ul class="rows">' + recentDone.map((t) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' + ui.statusChip(t.status) + '</div>' +
          '<div class="row-meta"><span>' + esc(people.name(t.requesterId)) + '</span><span>Completed ' + esc(D.fmtStamp(t.completedAt)) + '</span>' + (t.sample ? '<span>Fictional sample</span>' : '') + '</div></li>').join('') + '</ul>'
        : '<p class="empty">Nothing completed in the last two weeks.</p>';

      const proposalBody = pendingProposals.length
        ? '<ul class="rows">' + pendingProposals.map((p) => '<li><div class="row-line"><span class="row-title">Week of ' + esc(D.fmtWeek(p.weekStart)) + '</span><span class="chip pending waiting">' + ui.icon('hourglass') + 'Waiting for Maha</span></div>' +
          '<div class="row-meta"><span>' + p.moves.map((mv) => esc((s.tasks.find((t) => t.id === mv.taskId) || {}).title || '') + ' → week of ' + esc(D.fmtWeek(mv.toWeek))).join('; ') + '</span></div>' +
          '<div class="row-meta"><span>Reason: ' + esc(p.reason) + '</span></div></li>').join('') + '</ul>'
        : '<p class="empty">No proposed changes are waiting.</p>';

      carla = '<div class="grid grid-2" style="margin-bottom:20px">' +
        card('Priority conflicts', conflictBody, { tone: conflicts.length ? 'alert' : 'good', count: conflicts.length }) +
        card('In progress', '<p class="small muted">Maha marks work Complete when it is finished.</p>' + inProgressList(inProgress, false), { count: inProgress.length }) +
        card('Proposed changes awaiting Maha’s confirmation', proposalBody, { count: pendingProposals.length, link: '<a href="#/decisions">All decisions</a>' }) +
        card('Recently completed', doneBody, { count: recentDone.length }) +
        card('Open requests without a priority', ui.taskRows(noPriority, { empty: 'Every open request has a priority.', extra: (t) => (t.requestedUrgency === 'urgent' ? 'Requested as urgent' : 'Requested: ' + W.URGENCY[t.requestedUrgency]) }), { count: noPriority.length }) +
        '</div>';
    }

    return greeting(app) + actions + carla +
      '<div class="grid grid-main" style="margin-bottom:20px"><div class="stack">' +
      card(isCarla ? 'Your own requests' : 'Your requests', ui.taskTable(mineOpen, { hideRequester: true, empty: 'You have no open requests. Use “Request a task” to send one.', caption: 'Your open requests' }) +
        (mineClosed.length ? '<p class="small" style="margin-top:10px">' + mineClosed.length + ' completed, cancelled or archived. <a href="#/workload" data-action="filter-mine">See all of yours</a></p>' : ''), { count: mineOpen.length }) +
      '</div><div class="stack">' +
      card('Needs your input', inputBody, { tone: needInfo.length || counterMeetings.length ? 'attention' : '' }) +
      '</div></div>' +
      '<div class="grid grid-2">' + card('Upcoming deadlines', upcomingBody) + workloadSummary(app) + '</div>';
  }

  WH.views.dashboard = function (app) {
    return app.user === 'maha' ? mahaDashboard(app) : managerDashboard(app);
  };

  // ---------- actions ----------

  WH.actions['plan-today'] = (app, el) => {
    const on = el.getAttribute('data-on') === '1';
    app.mutate(() => W.planToday(app.state, app.user, el.getAttribute('data-id'), on), on ? 'Added to today’s plan.' : 'Removed from today’s plan.');
  };

  WH.actions['quick-complete'] = (app, el) => {
    app.mutate(() => W.completeTask(app.state, app.user, el.getAttribute('data-id'), ''), 'Marked Complete.');
  };

  WH.actions['open-decision'] = (app, el) => {
    app.ui.decisionWeek = el.getAttribute('data-week');
    app.go('#/decisions');
  };

  WH.actions['filter-mine'] = (app) => {
    app.ui.filters = { requester: app.user, status: 'all', priority: '', project: '', from: '', to: '' };
    app.go('#/workload');
  };

  WH.actions['cal-goto-week'] = (app) => {
    app.ui.calView = 'week';
    app.ui.calCursor = W.today();
    app.go('#/calendar');
  };
})(globalThis.WH = globalThis.WH || {});
