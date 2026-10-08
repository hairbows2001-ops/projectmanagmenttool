/* Meetings: requests from managers; Maha accepts, declines or proposes another time. */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const P = WH.permissions;
  const ui = WH.ui;
  const people = WH.people;

  function statusChip(m) {
    const map = {
      pending: '<span class="chip pending">' + ui.icon('clock') + 'Pending</span>',
      counter: '<span class="chip pending s-clarification">' + ui.icon('clock') + 'New time proposed</span>',
      accepted: '<span class="chip s-in_progress">' + ui.icon('check') + 'Confirmed</span>',
      declined: '<span class="chip s-cancelled">' + ui.icon('x') + 'Declined</span>',
      withdrawn: '<span class="chip s-cancelled">' + ui.icon('x') + 'Withdrawn</span>'
    };
    return map[m.status];
  }

  function meetingCard(app, m) {
    const task = m.taskId ? app.state.tasks.find((t) => t.id === m.taskId) : null;
    const u = app.user;
    const conflicts = (m.status === 'pending') ? W.meetingConflicts(app.state, m.date, m.start, m.durationMin, m.id) : [];
    let actions = '';
    if (m.status === 'pending' && P.can(u, 'meeting.respond', m)) {
      actions = '<div class="btn-row" style="margin-top:10px"><button type="button" class="btn small accent" data-action="meeting-accept" data-id="' + esc(m.id) + '">' + ui.icon('check') + 'Accept</button></div>' +
        '<details class="action" style="margin-top:10px"><summary>Propose another time</summary><div class="action-body"><form data-form="meeting-counter" data-id="' + esc(m.id) + '" novalidate><div class="form-grid">' +
        ui.field({ name: 'date', label: 'Date', type: 'date', required: true, id: 'ct-date-' + m.id, min: W.today() }) +
        ui.field({ name: 'start', label: 'Start time', type: 'time', required: true, id: 'ct-start-' + m.id }) + '</div>' +
        ui.field({ name: 'note', label: 'Note', id: 'ct-note-' + m.id }) + '<button type="submit" class="btn small primary">Send new time</button></form></div></details>' +
        '<details class="action"><summary>Decline</summary><div class="action-body"><form data-form="meeting-decline" data-id="' + esc(m.id) + '" novalidate>' +
        ui.field({ name: 'note', label: 'Reason (optional)', id: 'dc-note-' + m.id }) + '<button type="submit" class="btn small danger">Decline request</button></form></div></details>';
    }
    if (m.status === 'counter' && P.can(u, 'meeting.acceptCounter', m)) {
      actions = '<div class="btn-row" style="margin-top:10px"><button type="button" class="btn small accent" data-action="meeting-accept-counter" data-id="' + esc(m.id) + '">' + ui.icon('check') + 'Accept new time</button>' +
        '<button type="button" class="btn small" data-action="meeting-withdraw" data-id="' + esc(m.id) + '">Withdraw request</button></div>';
    } else if ((m.status === 'pending' || m.status === 'accepted') && P.can(u, 'meeting.withdraw', m) && m.date >= W.today()) {
      actions += '<div class="btn-row" style="margin-top:10px"><button type="button" class="btn small" data-action="meeting-withdraw" data-id="' + esc(m.id) + '">' + (m.status === 'accepted' ? 'Cancel meeting' : 'Withdraw request') + '</button></div>';
    }
    const when = esc(D.fmtShort(m.date)) + ', ' + esc(D.fmtTime(m.start)) + ' · ' + m.durationMin + ' min';
    return '<li><div class="row-line"><span class="row-title">' + esc(m.purpose) + '</span><span class="chips">' + statusChip(m) + '</span></div>' +
      '<div class="row-meta"><span>' + esc(people.name(m.requesterId)) + '</span><span>' + (m.status === 'counter' ? '<s>' + when + '</s>' : when) + '</span>' +
      (m.location ? '<span>' + esc(m.location) + '</span>' : '') + (task ? '<span>Task: <a href="#/tasks/' + encodeURIComponent(task.id) + '">' + esc(task.title) + '</a></span>' : '') + '</div>' +
      (m.status === 'counter' ? '<div class="callout warn small" style="margin-top:8px"><p><strong>Maha proposed:</strong> ' + esc(D.fmtShort(m.counter.date)) + ', ' + esc(D.fmtTime(m.counter.start)) +
        (m.responseNote ? ' · “' + esc(m.responseNote) + '”' : '') + '</p></div>' : '') +
      ((m.status === 'declined' || m.status === 'accepted') && m.responseNote ? '<div class="row-meta"><span>Maha: ' + esc(m.responseNote) + '</span></div>' : '') +
      (conflicts.length ? '<div style="margin-top:8px">' + WH.conflictCallout(conflicts) + '</div>' : '') + actions + '</li>';
  }

  function list(app, items, empty) {
    return items.length ? '<ul class="rows">' + items.map((m) => meetingCard(app, m)).join('') + '</ul>' : '<p class="empty">' + esc(empty) + '</p>';
  }

  WH.calendarTabs = WH.calendarTabs || {};
  WH.calendarTabs.meetings = function (app) {
    const s = app.state;
    const today = W.today();
    const sortAsc = (a, b) => (a.date + a.start < b.date + b.start ? -1 : 1);
    const pending = s.meetings.filter((m) => m.status === 'pending').sort(sortAsc);
    const counter = s.meetings.filter((m) => m.status === 'counter').sort(sortAsc);
    const upcoming = s.meetings.filter((m) => m.status === 'accepted' && m.date >= today).sort(sortAsc);
    const past = s.meetings.filter((m) => (m.status === 'accepted' && m.date < today) || m.status === 'declined' || m.status === 'withdrawn').sort((a, b) => -sortAsc(a, b));
    const sec = (id, title, items, empty) => '<section class="block" aria-labelledby="' + id + '"><div class="sec-head"><h2 id="' + id + '">' + title + '</h2><span class="muted small">' + items.length + '</span></div>' + list(app, items, empty) + '</section>';
    return '<p class="small muted">Confirmed meetings count toward Maha’s capacity. Requests do not, until accepted.</p>' +
      '<div class="grid grid-2">' +
      '<div>' + sec('mp-h', 'Waiting for Maha', pending, 'No meeting requests waiting.') + (counter.length ? sec('mc-h', 'New time proposed', counter, '') : '') + '</div>' +
      '<div>' + sec('mu-h', 'Confirmed and upcoming', upcoming, 'No upcoming meetings.') +
      '<details class="psec" id="meet-past"><summary><span>Past, declined and withdrawn</span><span class="psec-count">' + past.length + '</span></summary><div class="psec-body">' + list(app, past, 'Nothing here yet.') + '</div></details></div>' +
      '</div>';
  };

  const mid = (el) => el.getAttribute('data-id');
  WH.actions['meeting-accept'] = (app, el) => app.mutate(() => W.respondMeeting(app.state, app.user, mid(el), 'accept', {}), 'Meeting confirmed. It now counts toward capacity.');
  WH.actions['meeting-accept-counter'] = (app, el) => app.mutate(() => W.acceptCounter(app.state, app.user, mid(el)), 'New time accepted. The meeting is confirmed.');
  WH.actions['meeting-withdraw'] = (app, el) => app.mutate(() => W.withdrawMeeting(app.state, app.user, mid(el)), 'Meeting withdrawn.');
  WH.forms['meeting-counter'] = (app, form, d) => app.mutate(() => W.respondMeeting(app.state, app.user, mid(form), 'counter', d), 'New time sent. Waiting for the requester to accept.', { form });
  WH.forms['meeting-decline'] = (app, form, d) => app.mutate(() => W.respondMeeting(app.state, app.user, mid(form), 'decline', d), 'Meeting request declined.', { form });
})(globalThis.WH = globalThis.WH || {});
