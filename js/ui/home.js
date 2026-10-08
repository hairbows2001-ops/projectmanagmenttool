/*
 * Home. Answers three questions:
 *  1. What am I doing today?  2. How much capacity is there this week?  3. What needs attention?
 * Maha sees her Today list, capacity and attention items. Managers see their requests,
 * a small shared-capacity summary and, for Carla, a short line about priorities.
 */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress'];
  const PRIO = { P1: 0, P2: 1, P3: 2, P4: 3 };

  function byPriorityThenDate(a, b) {
    const pa = a.priority ? PRIO[a.priority] : 9;
    const pb = b.priority ? PRIO[b.priority] : 9;
    if (pa !== pb) return pa - pb;
    return (a.agreedDeadline || a.requestedDeadline || '9999') < (b.agreedDeadline || b.requestedDeadline || '9999') ? -1 : 1;
  }

  function greeting(app, actions) {
    const p = people.get(app.user);
    const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: D.TZ, hour: '2-digit', hourCycle: 'h23' }).format(W.now()));
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return '<div class="page-head compact"><div><p class="date-line">' + esc(D.fmtLong(W.today())) + '</p>' +
      '<h1>' + part + ', <span class="highlight">' + esc(p.first) + '</span></h1></div>' +
      '<div class="btn-row">' + actions + '</div></div>';
  }

  /** Attention item: one line with a count and a link. */
  function attentionItem(count, text, href, action, attrs) {
    if (!count) return '';
    return '<li><a href="' + href + '"' + (action ? ' data-action="' + action + '"' : '') + (attrs || '') + '><span class="att-count">' + count + '</span>' +
      '<span>' + esc(text) + '</span><span class="att-go" aria-hidden="true">→</span></a></li>';
  }

  function attentionSection(items, emptyText) {
    const list = items.filter(Boolean);
    return '<section class="attention" aria-labelledby="att-h"><div class="sec-head"><h2 id="att-h">Needs attention</h2></div>' +
      (list.length ? '<ul class="att-list">' + list.join('') + '</ul>' : '<p class="empty">' + esc(emptyText) + '</p>') + '</section>';
  }

  // ---------- Maha ----------

  function todayRowMenu(task, inToday) {
    const items = [{ label: 'Open details', action: 'open-task', attrs: 'data-id="' + esc(task.id) + '"' }];
    items.push(inToday
      ? { label: 'Remove from today', action: 'plan-today', attrs: 'data-id="' + esc(task.id) + '" data-on="0"' }
      : { label: 'Add to today', action: 'plan-today', attrs: 'data-id="' + esc(task.id) + '" data-on="1"' });
    return ui.actionMenu('Actions for ' + task.title, items);
  }
  WH.todayRowMenu = todayRowMenu;

  function completeBox(task) {
    const disabled = task.blocked ? ' disabled title="Clear the block first"' : '';
    return '<label class="trow-check"><input type="checkbox" data-change="today-complete" data-id="' + esc(task.id) + '"' + disabled + '>' +
      '<span class="visually-hidden">Mark “' + esc(task.title) + '” complete</span></label>';
  }

  function mahaHome(app) {
    const s = app.state;
    const today = W.today();
    const cw = W.currentWeek();
    const summary = C.weekSummary(s, cw, cw);

    const weekTasks = summary.tasks.concat(summary.socialTasks)
      .filter((x) => ['scheduled', 'in_progress'].includes(x.task.status)).map((x) => x.task);
    const planned = weekTasks.filter((t) => (t.plannedDates || []).includes(today));
    const dueToday = s.tasks.filter((t) => ['scheduled', 'in_progress'].includes(t.status) && t.agreedDeadline === today && !planned.includes(t));
    const todayTasks = planned.concat(dueToday).sort(byPriorityThenDate);
    const meetings = s.meetings.filter((m) => m.status === 'accepted' && m.date === today).sort((a, b) => (a.start < b.start ? -1 : 1));
    const events = s.events.filter((e) => e.date === today);

    const timed = meetings.map((m) => '<li class="trow timed"><span class="time">' + esc(D.fmtTime(m.start)) + '</span><div class="trow-main"><span class="trow-title plain">' + esc(m.purpose) + '</span>' +
      '<span class="trow-meta">Meeting with ' + esc(people.name(m.requesterId)) + ' · ' + m.durationMin + ' min</span></div></li>')
      .concat(events.map((e) => '<li class="trow timed"><span class="time">' + esc(D.fmtTime(e.start)) + '</span><div class="trow-main"><span class="trow-title plain">' + esc(e.title) + '</span>' +
        '<span class="trow-meta">Event until ' + esc(D.fmtTime(e.end)) + '</span></div></li>'));

    const rows = todayTasks.map((t) => ui.taskRow(t, {
      lead: completeBox(t),
      menu: todayRowMenu(t, (t.plannedDates || []).includes(today))
    }));

    const others = weekTasks.length - planned.length;
    const todayBody = (timed.length || rows.length)
      ? '<ul class="tlist">' + timed.join('') + rows.join('') + '</ul>'
      : '<p class="empty">Nothing planned for today yet.</p>';
    const todaySec = '<section class="today" aria-labelledby="today-h"><div class="sec-head"><h2 id="today-h">Today</h2>' +
      '<a href="#/tasks/week">View this week' + (others > 0 ? ' (' + others + ' more)' : '') + '</a></div>' + todayBody + '</section>';

    const conflicts = C.conflicts(s, cw, 8).filter((c) => c.kind === 'committed');
    const pendingProposals = s.proposals.filter((p) => p.status === 'pending');
    const newReq = s.tasks.filter((t) => t.status === 'submitted').length;
    const clar = s.tasks.filter((t) => t.status === 'clarification').length;
    const needEst = C.tasksNeedingEstimate(s).length;
    const meetingReq = s.meetings.filter((m) => m.status === 'pending').length;
    const blocked = s.tasks.filter((t) => t.blocked && OPEN.includes(t.status)).length;

    const attention = attentionSection([
      attentionItem(newReq, newReq === 1 ? 'new request to review' : 'new requests to review', '#/tasks', 'filter-tasks', ' data-status="submitted"'),
      attentionItem(clar, clar === 1 ? 'request waiting for clarification' : 'requests waiting for clarification', '#/tasks', 'filter-tasks', ' data-status="clarification"'),
      attentionItem(needEst, needEst === 1 ? 'task needs an estimate' : 'tasks need an estimate', '#/tasks', 'filter-tasks', ' data-status="estimate"'),
      attentionItem(meetingReq, meetingReq === 1 ? 'meeting request to answer' : 'meeting requests to answer', '#/calendar/meetings'),
      attentionItem(pendingProposals.length, pendingProposals.length === 1 ? 'schedule change from Carla to confirm' : 'schedule changes from Carla to confirm', '#/tasks/priorities'),
      attentionItem(conflicts.length, conflicts.length === 1 ? 'week over capacity' : 'weeks over capacity', '#/tasks/priorities'),
      attentionItem(blocked, blocked === 1 ? 'blocked task' : 'blocked tasks', '#/tasks', 'filter-tasks', ' data-status="blocked"')
    ], 'Nothing needs attention right now.');

    return greeting(app, '<a class="btn primary" href="#/tasks/new">' + ui.icon('plus') + 'Create task</a>') +
      '<div class="home-grid">' + todaySec +
      '<div class="home-side">' + ui.capacitySummary(summary, { footer: '<p class="small"><a href="#/calendar/leave">Events, leave and other weeks</a></p>' }) + '</div>' +
      attention + '</div>';
  }

  // ---------- managers & Carla ----------

  function sharedCapacity(app) {
    const s = app.state;
    const cw = W.currentWeek();
    const next = [1, 2].map((i) => {
      const w = D.addDays(cw, i * 7);
      const x = C.weekSummary(s, w, cw);
      return '<li><span>Week of ' + esc(D.fmtWeek(w)) + '</span><span class="' + (x.over > 0 ? 'over-text' : 'muted') + '">' + (x.over > 0 ? fmtHours(x.over) + ' over' : fmtHours(x.remaining) + ' free') + '</span></li>';
    }).join('');
    return ui.capacitySummary(C.weekSummary(s, cw, cw), {
      title: 'Maha’s capacity',
      footer: '<ul class="mini-weeks" aria-label="Next weeks">' + next + '</ul>'
    });
  }

  function managerHome(app) {
    const s = app.state;
    const me = app.user;
    const isCarla = me === 'carla';
    const cw = W.currentWeek();

    const mine = s.tasks.filter((t) => t.requesterId === me);
    const active = mine.filter((t) => OPEN.includes(t.status)).sort(byPriorityThenDate);
    const closed = mine.length - active.length;
    const needInfo = mine.filter((t) => t.status === 'clarification');
    const counter = s.meetings.filter((m) => m.requesterId === me && m.status === 'counter');

    const reqSec = '<section class="today" aria-labelledby="mine-h"><div class="sec-head"><h2 id="mine-h">Your requests</h2>' +
      (closed ? '<a href="#/tasks" data-action="filter-mine">All of yours</a>' : '') + '</div>' +
      ui.taskList(active, { empty: 'No active requests. Use “Request a task” to send one to Maha.' }) + '</section>';

    const items = [
      attentionItem(needInfo.length, needInfo.length === 1 ? 'request needs more information from you' : 'requests need more information from you', '#/tasks', 'filter-mine-status', ' data-status="clarification"'),
      attentionItem(counter.length, counter.length === 1 ? 'meeting has a new time proposed' : 'meetings have a new time proposed', '#/calendar/meetings')
    ];
    if (isCarla) {
      const conflicts = C.conflicts(s, cw, 8).filter((c) => c.kind === 'committed').length;
      const pending = s.proposals.filter((p) => p.status === 'pending').length;
      const noPrio = s.tasks.filter((t) => OPEN.includes(t.status) && !t.priority).length;
      items.push(
        attentionItem(conflicts, conflicts === 1 ? 'week over capacity: decide what moves' : 'weeks over capacity: decide what moves', '#/tasks/priorities'),
        attentionItem(noPrio, noPrio === 1 ? 'open request without a priority' : 'open requests without a priority', '#/tasks', 'filter-tasks', ' data-priority="none"'),
        attentionItem(pending, pending === 1 ? 'change waiting for Maha to confirm' : 'changes waiting for Maha to confirm', '#/tasks/priorities')
      );
    }

    return greeting(app, '<a class="btn" href="#/calendar/meetings/new">' + ui.icon('users') + 'Request a meeting</a>' +
      '<a class="btn primary" href="#/tasks/new">' + ui.icon('plus') + 'Request a task</a>') +
      '<div class="home-grid">' + reqSec + '<div class="home-side">' + sharedCapacity(app) + '</div>' +
      attentionSection(items, 'Nothing needs your attention.') + '</div>';
  }

  WH.views.home = function (app) {
    return app.user === 'maha' ? mahaHome(app) : managerHome(app);
  };

  // ---------- actions ----------

  WH.actions['plan-today'] = (app, el) => {
    const on = el.getAttribute('data-on') === '1';
    app.mutate(() => W.planToday(app.state, app.user, el.getAttribute('data-id'), on), on ? 'Added to today.' : 'Removed from today.');
  };

  WH.actions['open-task'] = (app, el) => app.go('#/tasks/' + encodeURIComponent(el.getAttribute('data-id')));

  /** Today checkbox: completes the task (starting it first if it was only scheduled). */
  WH.actions['today-complete'] = (app, el) => {
    if (!el.checked) return;
    const id = el.getAttribute('data-id');
    app.mutate(() => {
      const t = app.state.tasks.find((x) => x.id === id);
      if (t && t.status === 'scheduled') W.startWork(app.state, app.user, id);
      return W.completeTask(app.state, app.user, id, '');
    }, 'Marked Complete.');
  };

  WH.actions['filter-tasks'] = (app, el) => {
    app.ui.filters = { requester: '', status: el.getAttribute('data-status') || 'open', priority: el.getAttribute('data-priority') || '', project: '', from: '', to: '' };
    app.ui.tasksView = 'list';
    app.go('#/tasks');
  };

  WH.actions['filter-mine'] = (app) => {
    app.ui.filters = { requester: app.user, status: 'all', priority: '', project: '', from: '', to: '' };
    app.go('#/tasks');
  };

  WH.actions['filter-mine-status'] = (app, el) => {
    app.ui.filters = { requester: app.user, status: el.getAttribute('data-status'), priority: '', project: '', from: '', to: '' };
    app.go('#/tasks');
  };
})(globalThis.WH = globalThis.WH || {});
