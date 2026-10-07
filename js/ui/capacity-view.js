/* Capacity: week-by-week numbers, leave/event adjustments (Maha), events list. */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  function weekTable(app, cw, selected) {
    const rows = [];
    for (let i = -1; i < 8; i++) {
      const w = D.addDays(cw, i * 7);
      const s = C.weekSummary(app.state, w, cw);
      rows.push('<tr' + (w === selected ? ' class="current"' : '') + '><td><button type="button" class="linklike" data-action="cap-week" data-week="' + w + '"' + (w === selected ? ' aria-current="true"' : '') + '>' +
        (i === 0 ? 'This week' : 'Week of ' + esc(D.fmtWeek(w))) + '</button>' + (s.adjusted ? '<span class="sub muted small" style="display:block">' + esc(s.adjustReason) + '</span>' : '') + '</td>' +
        '<td>' + fmtHours(s.capacity) + '</td><td class="hide-sm">' + fmtHours(s.social) + '</td><td class="hide-sm">' + fmtHours(s.meetingHours + s.eventHours) + '</td>' +
        '<td class="hide-sm">' + fmtHours(s.taskHours) + '</td>' +
        '<td>' + (s.over > 0 ? '<span class="over-text">+' + fmtHours(s.over) + ' over</span>' : '<span class="ok-text">' + fmtHours(s.remaining) + '</span>') + '</td>' +
        '<td class="hide-sm">' + (w < cw ? '—' : fmtHours(s.pendingHours) + (s.needsEstimate.length ? ' + ' + s.needsEstimate.length + ' est. needed' : '')) + '</td></tr>');
    }
    return '<div class="table-wrap"><table class="week-table"><caption class="visually-hidden">Capacity by week</caption><thead><tr><th scope="col">Week</th><th scope="col">Capacity</th>' +
      '<th scope="col" class="hide-sm">Social media</th><th scope="col" class="hide-sm">Meetings &amp; events</th><th scope="col" class="hide-sm">Scheduled tasks</th>' +
      '<th scope="col">Remaining</th><th scope="col" class="hide-sm">Requested, not scheduled</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function breakdown(app, s, cw) {
    const taskItems = s.tasks.map((x) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a><span class="num">' + fmtHours(x.hours) + '</span></div>' +
      '<div class="row-meta"><span>' + esc(people.name(x.task.requesterId)) + '</span><span>' + esc(W.STATUSES[x.task.status]) + '</span>' + (x.task.priority ? '<span>' + esc(x.task.priority + ' ' + W.PRIORITIES[x.task.priority]) + '</span>' : '<span>No priority</span>') + '</div></li>').join('');
    const social = s.socialTasks.map((x) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a><span class="num muted">' + fmtHours(x.hours) + '</span></div><div class="row-meta"><span>Within the ' + fmtHours(s.social) + ' social media allocation</span></div></li>').join('');
    const meetings = s.meetings.map((m) => '<li><div class="row-line"><span class="row-title">' + esc(D.fmtShort(m.date)) + ', ' + esc(D.fmtTime(m.start)) + ' · ' + esc(m.purpose) + '</span><span class="num">' + fmtHours(C.meetingHours(m)) + '</span></div><div class="row-meta"><span>Confirmed meeting with ' + esc(people.name(m.requesterId)) + '</span></div></li>').join('');
    const events = s.events.map((e) => '<li><div class="row-line"><span class="row-title">' + esc(D.fmtShort(e.date)) + ', ' + esc(D.fmtTime(e.start)) + '–' + esc(D.fmtTime(e.end)) + ' · ' + esc(e.title) + '</span><span class="num">' + fmtHours(C.eventHours(e)) + '</span></div>' +
      '<div class="row-meta"><span>Event</span>' + (C.isOutsideRegularHours(e.date, e.start, e.end) ? '<span>Outside regular hours: uses time, does not add capacity</span>' : '') + '</div></li>').join('');
    const pending = s.pendingTasks.map((x) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(x.task.id) + '">' + esc(x.task.title) + '</a><span class="num muted">' + fmtHours(x.hours) + ' potential</span></div><div class="row-meta"><span>' + esc(people.name(x.task.requesterId)) + '</span><span>' + esc(W.STATUSES[x.task.status]) + '</span></div></li>').join('') +
      s.pendingMeetings.map((m) => '<li><div class="row-line"><span class="row-title">Meeting request: ' + esc(m.purpose) + '</span><span class="num muted">' + fmtHours((m.counter ? m.counter.durationMin : m.durationMin) / 60) + ' potential</span></div></li>').join('') +
      s.needsEstimate.map((t) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a><span class="chip estimate-needed">Estimate needed</span></div></li>').join('');
    const block = (title, body, empty) => '<h3 class="eyebrow" style="margin-top:16px">' + esc(title) + '</h3>' + (body ? '<ul class="rows">' + body + '</ul>' : '<p class="empty small">' + esc(empty) + '</p>');
    return '<section class="card" aria-labelledby="bd-h"><div class="card-head"><h2 id="bd-h">What makes up this week</h2>' + (s.weekStart >= cw ? '<a href="#/decisions" data-action="open-decision" data-week="' + s.weekStart + '">Priorities for this week</a>' : '') + '</div>' +
      block('Scheduled tasks', taskItems, 'No task hours this week.') +
      block('Covered by social media time', social, 'No requests are marked as routine social media work.') +
      block('Confirmed meetings', meetings, 'No confirmed meetings.') +
      block('Events', events, 'No events.') +
      block('Requested, not yet scheduled (not counted above)', pending, 'Nothing pending for this week.') + '</section>';
  }

  function mahaTools(app, s) {
    const settings = C.weekSettings(app.state, s.weekStart);
    const adjust = '<section class="card" aria-labelledby="adj-h"><div class="card-head"><h2 id="adj-h">Adjust this week</h2></div>' +
      '<p class="small muted">For leave, holidays or other reduced weeks. Capacity cannot go above 37.7 h. Evening or weekend events do not add hours.</p>' +
      '<form data-form="cap-adjust" data-week="' + s.weekStart + '" novalidate><div class="form-grid">' +
      ui.field({ name: 'capacity', label: 'Capacity (hours)', type: 'number', min: 0, max: 37.7, step: 0.1, value: settings.capacity, id: 'adj-cap' }) +
      ui.field({ name: 'social', label: 'Social media (hours)', type: 'number', min: 0, step: 0.5, value: settings.social, id: 'adj-soc' }) + '</div>' +
      ui.field({ name: 'reason', label: 'Reason', value: settings.reason, id: 'adj-reason', hint: 'e.g. “Vacation Thursday and Friday”' }) +
      '<div class="btn-row"><button type="submit" class="btn small primary">Save for week of ' + esc(D.fmtWeek(s.weekStart)) + '</button>' +
      (settings.adjusted ? '<button type="button" class="btn small" data-action="cap-reset" data-week="' + s.weekStart + '">Reset to standard week</button>' : '') + '</div></form></section>';
    const evForm = '<section class="card" aria-labelledby="ev-h" id="events"><div class="card-head"><h2 id="ev-h">Add an event</h2></div>' +
      '<p class="small muted">Events use capacity for their full length.</p>' +
      '<form data-form="event-add" novalidate>' + ui.field({ name: 'title', label: 'Event', required: true, id: 'ev-title' }) +
      '<div class="form-grid">' + ui.field({ name: 'date', label: 'Date', type: 'date', required: true, id: 'ev-date' }) +
      '<div></div>' + ui.field({ name: 'start', label: 'Start', type: 'time', required: true, id: 'ev-start' }) + ui.field({ name: 'end', label: 'End', type: 'time', required: true, id: 'ev-end' }) + '</div>' +
      ui.field({ name: 'notes', label: 'Notes', id: 'ev-notes' }) + '<button type="submit" class="btn small primary">Add event</button></form></section>';
    return adjust + evForm;
  }

  function eventsList(app) {
    const cw = W.currentWeek();
    const upcoming = app.state.events.filter((e) => e.date >= cw).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
    const canManage = P.can(app.user, 'event.manage');
    return '<section class="card" aria-labelledby="evl-h"><div class="card-head"><h2 id="evl-h">Upcoming events</h2></div>' +
      (upcoming.length ? '<ul class="rows">' + upcoming.map((e) => '<li><div class="row-line"><span class="row-title">' + esc(e.title) + '</span>' +
        (canManage ? '<button type="button" class="btn small quiet" data-action="event-remove" data-id="' + esc(e.id) + '">Remove<span class="visually-hidden"> ' + esc(e.title) + '</span></button>' : '') + '</div>' +
        '<div class="row-meta"><span>' + esc(D.fmtShort(e.date)) + ', ' + esc(D.fmtTime(e.start)) + '–' + esc(D.fmtTime(e.end)) + '</span><span>' + fmtHours(C.eventHours(e)) + '</span>' +
        (C.isOutsideRegularHours(e.date, e.start, e.end) ? '<span>Outside regular hours</span>' : '') + (e.sample ? '<span>Fictional sample</span>' : '') + '</div>' +
        (e.notes ? '<div class="row-meta"><span>' + esc(e.notes) + '</span></div>' : '') + '</li>').join('') + '</ul>' : '<p class="empty">No upcoming events.</p>') + '</section>';
  }

  WH.views.capacity = function (app) {
    const cw = W.currentWeek();
    const selected = app.ui.capWeek || cw;
    const s = C.weekSummary(app.state, selected, cw);
    const undated = C.pendingImpact(app.state, cw).undated;
    const isMaha = app.user === 'maha';
    return '<div class="page-head"><div><p class="eyebrow">Maha’s working time</p><h1>Capacity</h1>' +
      '<p>37.7 h per week, Monday to Friday, 9 a.m. to 5 p.m. (Toronto). 6 h is reserved for recurring social media, leaving 31.7 h for meetings, events and tasks.</p></div></div>' +
      '<section class="card" style="margin-bottom:20px" aria-labelledby="weeks-h"><div class="card-head"><h2 id="weeks-h">Week by week</h2><span class="small muted">Select a week to see details</span></div>' + weekTable(app, cw, selected) +
      (undated.hours > 0 || undated.needsEstimate.length ? '<p class="small muted" style="margin-top:10px">Also requested with no date yet: ' + fmtHours(undated.hours) +
        (undated.needsEstimate.length ? ' + ' + undated.needsEstimate.length + ' with estimate needed' : '') + '.</p>' : '') + '</section>' +
      '<div class="grid grid-main"><div class="stack">' + breakdown(app, s, cw) + eventsList(app) + '</div><div class="stack">' + ui.capacityCard(s, { title: 'Week of ' + D.fmtWeek(selected), link: false }) +
      (isMaha ? mahaTools(app, s) : '<div class="callout info small"><p>Only Maha can adjust capacity or add events.</p></div>') + '</div></div>';
  };

  WH.actions['cap-week'] = (app, el) => { app.ui.capWeek = el.getAttribute('data-week'); app.render(); };
  WH.forms['cap-adjust'] = (app, form, d) => app.mutate(() => W.setCapacity(app.state, app.user, form.getAttribute('data-week'), d), 'Capacity updated for this week.', { form });
  WH.actions['cap-reset'] = (app, el) => app.mutate(() => W.clearCapacity(app.state, app.user, el.getAttribute('data-week')), 'Week reset to the standard 37.7 h.');
  WH.forms['event-add'] = (app, form, d) => app.mutate(() => W.addEvent(app.state, app.user, d), 'Event added. It counts toward capacity.', { form });
  WH.actions['event-remove'] = (app, el) => {
    if (!window.confirm('Remove this event? The removal is recorded in the activity log.')) return;
    app.mutate(() => W.removeEvent(app.state, app.user, el.getAttribute('data-id')), 'Event removed.');
  };
})(globalThis.WH = globalThis.WH || {});
