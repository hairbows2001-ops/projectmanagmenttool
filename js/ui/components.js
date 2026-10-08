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

  // ---------- compact rows (Home and Tasks) ----------

  /** One status label: Blocked replaces the status when work is blocked. */
  function statusLabel(task) {
    return task.blocked ? blockedChip(task) : statusChip(task.status);
  }

  /** Priority only when it helps decide: Critical or High. */
  function usefulPriority(task) {
    return task.priority === 'P1' || task.priority === 'P2' ? priorityChip(task) : '';
  }

  function dueText(task) {
    if (task.agreedDeadline) return 'Due ' + D.fmtShort(task.agreedDeadline);
    if (task.requestedDeadline) return 'Requested for ' + D.fmtShort(task.requestedDeadline);
    return 'No date yet';
  }

  /**
   * Accessible action menu. items: [{ label, action, attrs }] where attrs is extra data-* text.
   */
  function actionMenu(label, items) {
    if (!items.length) return '';
    const id = 'm-' + Math.random().toString(36).slice(2, 9);
    return '<div class="menu row-menu"><button type="button" class="icon-btn" data-action="menu-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="' + id + '" aria-label="' + esc(label) + '">' +
      '<span aria-hidden="true" class="dots">•••</span></button><div class="menu-list" id="' + id + '" role="menu" hidden>' +
      items.map((it) => '<button type="button" role="menuitem" data-action="' + it.action + '" ' + (it.attrs || '') + '>' + esc(it.label) + '</button>').join('') + '</div></div>';
  }

  /**
   * A compact task row: title, requester and due date, one status label, priority when useful.
   * opts.meta: extra short text (e.g. "6 h this week"); opts.menu: actionMenu HTML; opts.lead: checkbox HTML.
   */
  function taskRow(task, opts) {
    const o = opts || {};
    return '<li class="trow' + (o.lead ? ' has-lead' : '') + '">' + (o.lead || '') +
      '<div class="trow-main"><a class="trow-title" href="#/tasks/' + encodeURIComponent(task.id) + '">' + esc(task.title) + '</a>' +
      '<span class="trow-meta">' + esc(people.name(task.requesterId)) + ' · ' + esc(dueText(task)) + (o.meta ? ' · ' + o.meta : '') + '</span></div>' +
      '<div class="trow-side">' + usefulPriority(task) + statusLabel(task) + (o.menu || '') + '</div></li>';
  }

  function taskList(tasks, opts) {
    const o = opts || {};
    if (!tasks.length) return '<p class="empty">' + esc(o.empty || 'Nothing here right now.') + '</p>';
    return '<ul class="tlist">' + tasks.map((t) => taskRow(t, o.rowOpts ? o.rowOpts(t) : {})).join('') + '</ul>';
  }

  // ---------- capacity summary (one bar) ----------

  function capacitySummary(s, opts) {
    const o = opts || {};
    const cap = s.capacity;
    const planned = s.committed;
    const scale = Math.max(cap, planned, 0.1);
    const fill = Math.min(planned, cap) / scale * 100;
    const overW = Math.max(0, planned - cap) / scale * 100;
    const status = s.over > 0
      ? '<p class="cap-status over">' + icon('alert') + '<span>' + fmtHours(s.over) + ' over capacity</span></p>'
      : '<p class="cap-status">' + fmtHours(s.remaining) + ' remaining</p>';
    const pending = (s.pendingHours > 0 || s.needsEstimate.length)
      ? '<p class="cap-note">Not yet scheduled: ' + fmtHours(s.pendingHours) + ' requested' +
        (s.needsEstimate.length ? ' + ' + s.needsEstimate.length + ' needing an estimate' : '') + '</p>' : '';
    const proposals = (s.proposedOut > 0 || s.proposedIn > 0)
      ? '<p class="cap-note">Pending change: ' + (s.remainingIfProposalsConfirmed < 0 ? fmtHours(-s.remainingIfProposalsConfirmed) + ' over' : fmtHours(s.remainingIfProposalsConfirmed) + ' free') + ' if Maha confirms</p>' : '';
    const breakdown = '<details class="breakdown" id="breakdown-' + s.weekStart + '"><summary>View breakdown</summary><dl class="facts cap-numbers">' +
      '<div><dt>Weekly capacity' + (s.adjusted ? ' (' + esc(s.adjustReason) + ')' : '') + '</dt><dd>' + fmtHours(cap) + '</dd></div>' +
      '<div><dt>Social media reserve</dt><dd>' + fmtHours(s.social) + '</dd></div>' +
      '<div><dt>Confirmed meetings</dt><dd>' + fmtHours(s.meetingHours) + '</dd></div>' +
      '<div><dt>Events</dt><dd>' + fmtHours(s.eventHours) + '</dd></div>' +
      '<div><dt>Scheduled tasks</dt><dd>' + fmtHours(s.taskHours) + '</dd></div>' +
      '<div class="cap-total"><dt>Planned</dt><dd>' + fmtHours(planned) + '</dd></div></dl>' +
      '<p class="small muted">Requests not yet scheduled are not included in planned hours.</p></details>';
    return '<section class="cap-summary' + (s.over > 0 ? ' is-over' : '') + '" aria-labelledby="cap-' + s.weekStart + '">' +
      '<div class="sec-head"><h2 id="cap-' + s.weekStart + '">' + esc(o.title || 'This week') + '</h2><span class="muted small">' + esc(D.fmtWeek(s.weekStart)) + '</span></div>' +
      '<div class="cap-bar" role="img" aria-label="' + esc(fmtHours(planned) + ' planned of ' + fmtHours(cap) + ' available') + '">' +
      '<span class="cap-fill" style="width:' + fill.toFixed(1) + '%"></span>' + (overW ? '<span class="cap-over" style="width:' + overW.toFixed(1) + '%"></span>' : '') + '</div>' +
      '<p class="cap-line"><strong>' + fmtHours(planned) + ' planned</strong> / ' + fmtHours(cap) + ' available</p>' +
      status + pending + proposals + (o.noBreakdown ? '' : breakdown) + (o.footer || '') + '</section>';
  }

  WH.ui = {
    icon, statusChip, blockedChip, priorityChip, urgencyChip, effortText, dateOr, requestedDeadline,
    historyList, field, checkbox, personName, STATUS_ICONS,
    statusLabel, usefulPriority, dueText, actionMenu, taskRow, taskList, capacitySummary
  };
})(globalThis.WH = globalThis.WH || {});
