/* Reusable pieces of interface. Each returns an HTML string. All user text goes through esc(). */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const W = WH.workflow;
  const C = WH.capacity;
  const people = WH.people;

  // Small line icons (decorative; meaning is always also given as text).
  const ICON_PATHS = {
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14"/><path d="M12 17.5v.01"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.3 2.5 3.5 5.2"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    scale: '<path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7h6zM17 8l-3 7h6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICON_PATHS[name] || '') + '</svg>';
  }

  const STATUS_ICONS = {
    submitted: 'inbox', clarification: 'question', scheduled: 'calendar', in_progress: 'play',
    awaiting_approval: 'hourglass', complete: 'check', cancelled: 'x', archived: 'archive'
  };

  function statusChip(status) {
    return '<span class="chip s-' + status + '">' + icon(STATUS_ICONS[status]) + esc(W.STATUSES[status]) + '</span>';
  }

  function blockedChip(task) {
    return task.blocked ? '<span class="chip blocked" title="' + esc(task.blocked.reason) + '">' + icon('alert') + 'Blocked</span>' : '';
  }

  function priorityChip(task) {
    if (!task.priority) return '<span class="chip prio prio-none" title="Carla has not set a priority">No priority set</span>';
    return '<span class="chip prio prio-' + task.priority + '">' + (task.priority === 'P1' ? icon('flag') : '') +
      esc(task.priority + ' ' + W.PRIORITIES[task.priority]) + '</span>';
  }

  function urgencyChip(task) {
    if (task.requestedUrgency !== 'urgent' && task.requestedUrgency !== 'high') return '';
    return '<span class="chip urgent" title="Requested by ' + esc(people.first(task.requesterId)) + '; not a confirmed priority">Requested: ' +
      esc(W.URGENCY[task.requestedUrgency]) + '</span>';
  }

  function sampleChip(item) {
    return item && item.sample ? '<span class="chip sample" title="Fictional sample content">Fictional sample</span>' : '';
  }

  function effortText(task) {
    if (!(task.estimateHours > 0)) return '<span class="chip estimate-needed">' + icon('alert') + 'Estimate needed</span>';
    const rem = C.remainingOf(task);
    const open = C.COMMITTED_STATUSES.includes(task.status);
    return '<span class="num">' + fmtHours(task.estimateHours) + '</span>' +
      (open && rem !== task.estimateHours ? ' <span class="sub">' + fmtHours(rem) + ' left</span>' : '');
  }

  function dateOr(iso, fallback) {
    return iso ? esc(D.fmtShort(iso)) : '<span class="muted">' + esc(fallback || '—') + '</span>';
  }

  function requestedDeadline(task) {
    if (!task.requestedDeadline) return '<span class="muted">Not known yet</span>';
    return esc(D.fmtShort(task.requestedDeadline)) + (task.deadlineFixed ? ' <span class="sub">Externally fixed</span>' : '');
  }

  function taskLink(task) {
    return '<a href="#/tasks/' + encodeURIComponent(task.id) + '">' + esc(task.title) + '</a>';
  }

  /** The standard task summary table used in dashboards and the workload view. */
  function taskTable(tasks, opts) {
    const o = opts || {};
    if (!tasks.length) return '<p class="empty">' + esc(o.empty || 'Nothing here right now.') + '</p>';
    const rows = tasks.map((t) => '<tr>' +
      '<td class="title-cell">' + taskLink(t) + '<span class="sub">' + esc(t.project || t.deliverableType || '') + '</span>' +
        (t.sample ? '<span class="sub">Fictional sample</span>' : '') + '</td>' +
      (o.hideRequester ? '' : '<td data-label="Requester">' + esc(people.name(t.requesterId)) + '</td>') +
      '<td data-label="Status"><span class="chips">' + statusChip(t.status) + blockedChip(t) + '</span></td>' +
      '<td data-label="Priority"><span class="chips">' + priorityChip(t) + urgencyChip(t) + '</span></td>' +
      '<td data-label="Requested">' + requestedDeadline(t) + '</td>' +
      '<td data-label="Agreed">' + dateOr(t.agreedDeadline, 'Not agreed') + '</td>' +
      '<td data-label="Effort">' + effortText(t) + '</td>' +
      '</tr>').join('');
    return '<div class="table-wrap"><table class="tasks"><caption class="visually-hidden">' + esc(o.caption || 'Tasks') + '</caption><thead><tr>' +
      '<th scope="col">Task</th>' + (o.hideRequester ? '' : '<th scope="col">Requester</th>') +
      '<th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Requested deadline</th>' +
      '<th scope="col">Agreed deadline</th><th scope="col">Estimated effort</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /** Compact list of tasks with one line of meta. */
  function taskRows(tasks, opts) {
    const o = opts || {};
    if (!tasks.length) return '<p class="empty">' + esc(o.empty || 'Nothing here right now.') + '</p>';
    return '<ul class="rows">' + tasks.map((t) => '<li><div class="row-line"><a class="row-title" href="#/tasks/' + encodeURIComponent(t.id) + '">' +
      esc(t.title) + '</a><span class="chips">' + statusChip(t.status) + blockedChip(t) + (o.showPriority ? priorityChip(t) : '') + '</span></div>' +
      '<div class="row-meta"><span>' + esc(people.name(t.requesterId)) + '</span>' +
      (o.extra ? '<span>' + o.extra(t) + '</span>' : '') + (t.sample ? '<span>Fictional sample</span>' : '') + '</div></li>').join('') + '</ul>';
  }

  /** Weekly capacity card: bar + numbers. */
  function capacityCard(s, opts) {
    const o = opts || {};
    const cap = Math.max(s.capacity, 0.1);
    const scale = Math.max(cap, s.committed);
    const pct = (h) => Math.max(0, (h / scale) * 100).toFixed(2) + '%';
    const meetEvents = s.meetingHours + s.eventHours;
    const usedTasks = Math.min(s.taskHours, Math.max(0, cap - s.social - meetEvents));
    const overflow = s.over;
    const bar = '<div class="cap-bar" role="img" aria-label="' + esc(fmtHours(s.committed) + ' committed of ' + fmtHours(s.capacity)) + '">' +
      '<span class="cap-social" style="width:' + pct(Math.min(s.social, cap)) + '"></span>' +
      '<span class="cap-meet" style="width:' + pct(meetEvents) + '"></span>' +
      '<span class="cap-task" style="width:' + pct(usedTasks) + '"></span>' +
      (overflow > 0 ? '<span class="cap-over" style="width:' + pct(overflow) + '"></span>' : '') + '</div>';
    const legend = '<ul class="cap-legend"><li><i class="cap-social"></i>Social media</li><li><i class="cap-meet"></i>Meetings &amp; events</li>' +
      '<li><i class="cap-task"></i>Scheduled tasks</li>' + (overflow > 0 ? '<li><i class="cap-over"></i>Over capacity</li>' : '') + '</ul>';
    const status = s.over > 0
      ? '<p class="cap-status over">' + icon('alert').replace('<svg', '<svg width="22" height="22"') + ' ' + fmtHours(s.over) + ' over capacity</p>'
      : '<p class="cap-status">' + fmtHours(s.remaining) + ' remaining</p>';
    const numbers = '<dl class="facts cap-numbers">' +
      '<div><dt>Weekly capacity' + (s.adjusted ? ' (adjusted: ' + esc(s.adjustReason) + ')' : '') + '</dt><dd>' + fmtHours(s.capacity) + '</dd></div>' +
      '<div><dt>Social media allocation</dt><dd>− ' + fmtHours(s.social) + '</dd></div>' +
      '<div><dt>Confirmed meetings</dt><dd>− ' + fmtHours(s.meetingHours) + '</dd></div>' +
      '<div><dt>Events</dt><dd>− ' + fmtHours(s.eventHours) + '</dd></div>' +
      '<div><dt>Scheduled tasks</dt><dd>− ' + fmtHours(s.taskHours) + '</dd></div>' +
      '<div class="cap-total"><dt>' + (s.remaining < 0 ? 'Over capacity' : 'Remaining') + '</dt><dd class="' + (s.remaining < 0 ? 'over-text' : '') + '">' +
        (s.remaining < 0 ? '+ ' + fmtHours(-s.remaining) : fmtHours(s.remaining)) + '</dd></div>' +
      '</dl>';
    const pending = (s.pendingHours > 0 || s.needsEstimate.length)
      ? '<div class="callout ' + (s.potentialRemaining < 0 ? 'warn' : 'info') + ' small" style="margin-top:14px"><p><strong>Requested, not yet scheduled:</strong> ' +
        fmtHours(s.pendingHours) + (s.needsEstimate.length ? ' + ' + s.needsEstimate.length + ' request' + (s.needsEstimate.length > 1 ? 's' : '') + ' with estimate needed' : '') +
        '. If all were scheduled: ' + (s.potentialRemaining < 0 ? '<strong>' + fmtHours(-s.potentialRemaining) + ' over</strong>' : fmtHours(s.potentialRemaining) + ' remaining') + '.</p></div>'
      : '';
    const proposals = (s.proposedOut > 0 || s.proposedIn > 0)
      ? '<div class="callout warn small"><p><strong>Pending change (not confirmed):</strong> ' +
        (s.proposedOut ? fmtHours(s.proposedOut) + ' proposed to move out' : '') + (s.proposedOut && s.proposedIn ? ', ' : '') +
        (s.proposedIn ? fmtHours(s.proposedIn) + ' proposed to move in' : '') +
        '. If Maha confirms: ' + (s.remainingIfProposalsConfirmed < 0 ? fmtHours(-s.remainingIfProposalsConfirmed) + ' over' : fmtHours(s.remainingIfProposalsConfirmed) + ' remaining') + '.</p></div>'
      : '';
    return '<section class="card ' + (s.over > 0 ? 'alert' : 'accent') + '" aria-labelledby="cap-' + s.weekStart + '">' +
      '<div class="card-head"><h2 id="cap-' + s.weekStart + '">' + esc(o.title || 'Weekly capacity') + '</h2>' +
      '<span class="muted small">Week of ' + esc(D.fmtWeek(s.weekStart)) + '</span></div>' +
      status + bar + legend + numbers + pending + proposals +
      (o.link === false ? '' : '<p class="small" style="margin-top:12px"><a href="#/capacity">See all weeks</a></p>') + '</section>';
  }

  function personName(id) { return esc(people.name(id)); }

  function historyList(entries) {
    if (!entries.length) return '<p class="empty">No history yet.</p>';
    return '<ol class="history">' + entries.slice().reverse().map((h) => '<li><strong>' + esc(h.action) + '</strong> · ' + personName(h.by) +
      '<span class="h-when">' + esc(D.fmtStamp(h.at)) + '</span>' + (h.detail ? '<span class="h-detail">' + esc(h.detail) + '</span>' : '') + '</li>').join('') + '</ol>';
  }

  function field(o) {
    const id = o.id || ('f-' + o.name);
    const hint = o.hint ? '<span class="hint" id="' + id + '-hint">' + esc(o.hint) + '</span>' : '';
    const req = o.required ? ' <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(required)</span>' : '';
    const desc = o.hint ? ' aria-describedby="' + id + '-hint"' : '';
    const value = o.value === null || o.value === undefined ? '' : o.value;
    let control;
    if (o.type === 'textarea') {
      control = '<textarea id="' + id + '" name="' + o.name + '"' + desc + (o.required ? ' required' : '') + (o.rows ? ' rows="' + o.rows + '"' : '') + '>' + esc(value) + '</textarea>';
    } else if (o.type === 'select') {
      control = '<select id="' + id + '" name="' + o.name + '"' + desc + (o.required ? ' required' : '') + '>' +
        o.options.map((op) => '<option value="' + esc(op.value) + '"' + (String(op.value) === String(value) ? ' selected' : '') + '>' + esc(op.label) + '</option>').join('') + '</select>';
    } else {
      control = '<input id="' + id + '" name="' + o.name + '" type="' + (o.type || 'text') + '" value="' + esc(value) + '"' + desc +
        (o.required ? ' required' : '') + (o.min !== undefined ? ' min="' + o.min + '"' : '') + (o.max !== undefined ? ' max="' + o.max + '"' : '') +
        (o.step ? ' step="' + o.step + '"' : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') + '>';
    }
    return '<div class="field' + (o.wide ? ' wide' : '') + '" data-field="' + o.name + '"><label for="' + id + '">' + esc(o.label) + req + hint + '</label>' + control + '</div>';
  }

  function checkbox(o) {
    const id = o.id || ('f-' + o.name);
    return '<div class="field' + (o.wide ? ' wide' : '') + '" data-field="' + o.name + '"><label class="check" for="' + id + '"><input type="checkbox" id="' + id + '" name="' + o.name + '"' +
      (o.checked ? ' checked' : '') + '><span>' + esc(o.label) + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</span></label></div>';
  }

  function weekOptions(fromWeek, count, selected) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const w = D.addDays(fromWeek, i * 7);
      out.push({ value: w, label: 'Week of ' + D.fmtWeek(w) });
    }
    return out.map((o) => '<option value="' + o.value + '"' + (o.value === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
  }

  WH.ui = {
    icon, statusChip, blockedChip, priorityChip, urgencyChip, sampleChip, effortText, dateOr, requestedDeadline,
    taskLink, taskTable, taskRows, capacityCard, historyList, field, checkbox, weekOptions, personName, STATUS_ICONS
  };
})(globalThis.WH = globalThis.WH || {});
