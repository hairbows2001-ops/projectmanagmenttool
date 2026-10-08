/*
 * Calendar: month and week views. Internal calendar only (no Outlook connection).
 * Requested deadlines (dashed outline) look different from agreed deadlines (solid navy).
 * Pending meeting requests (striped, dashed) look different from confirmed meetings (solid teal).
 */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval'];

  /** Builds a map of date -> list of calendar items. */
  function itemsByDate(state) {
    const map = {};
    const add = (date, item) => { (map[date] = map[date] || []).push(item); };
    const taskHref = (t) => '#/tasks/' + encodeURIComponent(t.id);

    state.tasks.forEach((t) => {
      if (!OPEN.includes(t.status) && t.status !== 'complete') return;
      if (t.agreedDeadline) {
        add(t.agreedDeadline, { order: 1, cls: 'agreed', kind: 'Due', text: t.title, href: taskHref(t), title: 'Agreed deadline · ' + people.name(t.requesterId) });
      }
      if (t.requestedDeadline && t.requestedDeadline !== t.agreedDeadline && OPEN.includes(t.status)) {
        add(t.requestedDeadline, { order: 2, cls: 'requested', kind: 'Requested', text: t.title, href: taskHref(t),
          title: 'Requested deadline (not an agreed commitment) · ' + people.name(t.requesterId) + (t.deadlineFixed ? ' · externally fixed' : '') });
      }
    });

    state.proposals.filter((p) => p.status === 'pending').forEach((p) => p.moves.forEach((mv) => {
      const t = state.tasks.find((x) => x.id === mv.taskId);
      if (t && mv.proposedDeadline) {
        add(mv.proposedDeadline, { order: 3, cls: 'proposed', kind: 'Proposed', text: t.title, href: '#/tasks/priorities', title: 'Proposed new deadline, waiting for Maha to confirm' });
      }
    }));

    state.meetings.forEach((m) => {
      if (m.status === 'accepted') {
        add(m.date, { order: 0, time: m.start, cls: 'meeting', kind: D.fmtTime(m.start), text: m.purpose, href: '#/calendar/meetings', title: 'Confirmed meeting with ' + people.name(m.requesterId) + ' · ' + m.durationMin + ' min' });
      } else if (m.status === 'pending') {
        add(m.date, { order: 0, time: m.start, cls: 'meeting-pending', kind: 'Pending ' + D.fmtTime(m.start), text: m.purpose, href: '#/calendar/meetings', title: 'Meeting request, not confirmed · ' + people.name(m.requesterId) });
      } else if (m.status === 'counter' && m.counter) {
        add(m.counter.date, { order: 0, time: m.counter.start, cls: 'meeting-pending', kind: 'Proposed ' + D.fmtTime(m.counter.start), text: m.purpose, href: '#/calendar/meetings', title: 'New time proposed by Maha, waiting for ' + people.name(m.requesterId) });
      }
    });

    state.events.forEach((e) => {
      add(e.date, { order: 0, time: e.start, cls: 'event', kind: 'Event ' + D.fmtTime(e.start), text: e.title, href: '#/calendar/leave',
        title: 'Event ' + D.fmtTime(e.start) + '–' + D.fmtTime(e.end) + (C.isOutsideRegularHours(e.date, e.start, e.end) ? ' · outside regular hours' : '') });
    });

    Object.values(map).forEach((list) => list.sort((a, b) => (a.order - b.order) || ((a.time || '') < (b.time || '') ? -1 : 1)));
    return map;
  }

  function chip(item) {
    return '<a class="ev ' + item.cls + '" href="' + item.href + '" title="' + esc(item.title) + '"><span class="ev-kind">' + esc(item.kind) + ':</span> ' + esc(item.text) +
      '<span class="visually-hidden"> (' + esc(item.title) + ')</span></a>';
  }

  function weekLoadLine(state, week, cw) {
    const s = C.weekSummary(state, week, cw);
    return '<div class="week-load"><strong>Week of ' + esc(D.fmtWeek(week)) + '</strong>' +
      '<span>Scheduled tasks: ' + fmtHours(s.taskHours) + '</span>' +
      '<span>' + (s.over > 0 ? '<span class="over-text">' + fmtHours(s.over) + ' over capacity</span>' : fmtHours(s.remaining) + ' free') + '</span>' +
      (s.proposedOut || s.proposedIn ? '<span>Change pending</span>' : '') + '</div>';
  }

  function legend() {
    return '<ul class="cal-legend" aria-label="Legend">' +
      '<li><span class="ev agreed"><span class="ev-kind">Due</span></span> Agreed deadline</li>' +
      '<li><span class="ev requested"><span class="ev-kind">Requested</span></span> Requested deadline (not agreed)</li>' +
      '<li><span class="ev proposed"><span class="ev-kind">Proposed</span></span> Proposed change, not confirmed</li>' +
      '<li><span class="ev meeting"><span class="ev-kind">10 a.m.</span></span> Confirmed meeting</li>' +
      '<li><span class="ev meeting-pending"><span class="ev-kind">Pending</span></span> Meeting request</li>' +
      '<li><span class="ev event"><span class="ev-kind">Event</span></span> Event</li></ul>';
  }

  function monthView(app, cursor) {
    const state = app.state;
    const today = W.today();
    const cw = W.currentWeek();
    const items = itemsByDate(state);
    const month = cursor.slice(0, 7);
    const weeks = D.monthGrid(cursor);
    let html = '<div class="month"><div class="dow-row" style="display:contents" aria-hidden="true">' +
      D.DAYS.map((d) => '<div class="dow">' + d.slice(0, 3) + '</div>').join('') + '</div>';
    weeks.forEach((days) => {
      html += weekLoadLine(state, days[0], cw);
      html += days.map((d) => {
        const list = items[d] || [];
        const cls = ['day', d.slice(0, 7) !== month ? 'other' : '', D.isWeekend(d) ? 'weekend' : '', d === today ? 'today' : '', list.length ? '' : 'empty-day'].join(' ');
        return '<div class="' + cls + '"' + (d === today ? ' aria-current="date"' : '') + '><div class="day-num"><span>' +
          '<span class="visually-hidden">' + esc(D.fmtLong(d)) + '</span><span aria-hidden="true">' + Number(d.slice(8)) + '</span></span>' +
          (d === today ? '<span class="today-tag">Today</span>' : '') + '</div>' + list.map(chip).join('') + '</div>';
      }).join('');
    });
    return html + '</div>';
  }

  function weekView(app, cursor) {
    const state = app.state;
    const today = W.today();
    const cw = W.currentWeek();
    const week = D.weekStart(cursor);
    const items = itemsByDate(state);
    const s = C.weekSummary(state, week, cw);
    const work = s.tasks.concat(s.socialTasks);

    const workList = work.length
      ? '<ul class="rows">' + work.map((x) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a>' +
        '<span class="num">' + fmtHours(x.hours) + '</span></div><div class="row-meta"><span>' + esc(people.name(x.task.requesterId)) + '</span><span>' + esc(W.STATUSES[x.task.status]) + '</span>' +
        (x.task.coveredBySocial ? '<span>Within social media time</span>' : '') + '<span>Due ' + esc(D.fmtShort(x.task.agreedDeadline)) + '</span></div></li>').join('') + '</ul>'
      : '<p class="empty">No task hours scheduled this week.</p>';

    const days = [];
    for (let i = 0; i < 7; i++) days.push(D.addDays(week, i));
    return '<div class="grid grid-main" style="margin-bottom:20px"><section class="block" aria-labelledby="wk-work"><div class="sec-head"><h3 id="wk-work">Scheduled work this week</h3>' +
      '<span class="muted small">Effort is planned by week, not by hour</span></div>' + workList + '</section>' +
      ui.capacitySummary(s, { title: 'Capacity' }) + '</div>' +
      '<div class="weekview">' + days.map((d) => {
        const list = items[d] || [];
        return '<section class="wday' + (d === today ? ' today' : '') + (D.isWeekend(d) ? ' weekend' : '') + '" aria-label="' + esc(D.fmtLong(d)) + '"' + (d === today ? ' aria-current="date"' : '') + '>' +
          '<h3>' + esc(D.fmtShort(d)) + (d === today ? ' · Today' : '') + '</h3>' +
          (list.length ? list.map(chip).join('') : '<p class="empty small">Nothing scheduled</p>') + '</section>';
      }).join('') + '</div>';
  }

  function calendarBody(app) {
    const cursor = app.ui.calCursor || W.today();
    const view = app.ui.calView;
    const label = view === 'month' ? D.fmtMonth(cursor) : 'Week of ' + D.fmtWeek(D.weekStart(cursor));
    return '<div class="cal-toolbar"><h2 aria-live="polite">' + esc(label) + '</h2><div class="btn-row">' +
      '<div class="segmented" role="group" aria-label="Calendar view"><button type="button" data-action="cal-view" data-view="month" aria-pressed="' + (view === 'month') + '">Month</button>' +
      '<button type="button" data-action="cal-view" data-view="week" aria-pressed="' + (view === 'week') + '">Week</button></div>' +
      '<button type="button" class="btn small" data-action="cal-move" data-dir="-1">← Previous<span class="visually-hidden"> ' + (view === 'month' ? 'month' : 'week') + '</span></button>' +
      '<button type="button" class="btn small" data-action="cal-today">Today</button>' +
      '<button type="button" class="btn small" data-action="cal-move" data-dir="1">Next<span class="visually-hidden"> ' + (view === 'month' ? 'month' : 'week') + '</span> →</button>' +
      '<label class="visually-hidden" for="cal-jump">Go to date</label><input id="cal-jump" type="date" value="' + esc(cursor) + '" data-change="cal-jump" style="width:auto">' +
      '</div></div>' + legend() +
      (view === 'month' ? monthView(app, cursor) : weekView(app, cursor)) +
      '<p class="small muted">Internal calendar in Toronto time. Not connected to Outlook.</p>';
  }

  WH.calendarTabs = WH.calendarTabs || {};

  WH.views.calendar = function (app, route) {
    const tab = route.tab || 'calendar';
    const pendingMeetings = app.state.meetings.filter((m) => m.status === 'pending' || m.status === 'counter').length;
    const t = (key, href, label, count) => '<a href="' + href + '"' + (tab === key ? ' aria-current="page"' : '') + '>' + label +
      (count ? ' <span class="tab-count">' + count + '<span class="visually-hidden"> waiting</span></span>' : '') + '</a>';
    const primary = app.user === 'maha'
      ? (tab === 'leave' ? '' : '<a class="btn primary" href="#/calendar/leave">' + ui.icon('plus') + 'Add event or leave</a>')
      : '<a class="btn primary" href="#/calendar/meetings/new">' + ui.icon('users') + 'Request a meeting</a>';
    const body = tab === 'meetings' ? WH.calendarTabs.meetings(app) : tab === 'leave' ? WH.calendarTabs.leave(app) : calendarBody(app);
    return '<div class="page-head compact"><h1>Calendar</h1>' + primary + '</div>' +
      '<nav class="tabs" aria-label="Calendar sections">' + t('calendar', '#/calendar', 'Calendar') + t('meetings', '#/calendar/meetings', 'Meetings', pendingMeetings) +
      t('leave', '#/calendar/leave', 'Events &amp; leave') + '</nav>' + body;
  };

  WH.actions['cal-view'] = (app, el) => { app.ui.calView = el.getAttribute('data-view'); app.render(); };
  WH.actions['cal-today'] = (app) => { app.ui.calCursor = W.today(); app.render(); };
  WH.actions['cal-move'] = (app, el) => {
    const dir = Number(el.getAttribute('data-dir'));
    const cur = app.ui.calCursor || W.today();
    app.ui.calCursor = app.ui.calView === 'month' ? D.addMonths(cur, dir) : D.addDays(cur, dir * 7);
    app.render();
  };
  WH.actions['cal-jump'] = (app, el) => {
    if (D.isISODate(el.value)) { app.ui.calCursor = el.value; app.render(); }
  };

  WH.calendar = { itemsByDate };
})(globalThis.WH = globalThis.WH || {});
