/*
 * Request approval rules (separate from completed-work approval).
 *
 *  - Who needs Carla's approval before Maha schedules a request.
 *  - Which brief changes are "material" (they reset an earlier approval).
 *  - Reading an email reply: keep only the newly written part, then look for a
 *    standalone "approve" or "decline". Anything unclear stays pending.
 *  - The text of the approval email.
 *
 * Pure helpers only: state changes happen in workflow.js.
 */
(function (WH) {
  'use strict';

  const D = WH.dates;
  const C = WH.capacity;
  const { fmtHours } = WH.util;

  const REQUEST_APPROVAL = {
    not_required: 'Not required',
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined'
  };

  // Changing any of these after submission means Carla must approve again.
  const MATERIAL_FIELDS = ['title', 'description', 'deliverableType', 'audience', 'purpose',
    'requestedDeadline', 'dateUnknown', 'deadlineFixed', 'requestedUrgency'];

  function cfg() { return WH.config.requestApproval; }

  function requiresApproval(requesterId) {
    return !cfg().exemptRequesters.includes(requesterId);
  }

  /** Plain-language reason shown on the task. */
  function ruleText(requesterId) {
    if (requesterId === 'lina') return 'Not required: Lina’s requests go directly to Maha.';
    if (requesterId === 'carla') return 'Not required: Carla’s own requests skip this step.';
    if (requesterId === 'maha') return 'Not required: Maha’s own work skips this step.';
    return 'Required: Carla approves this request before Maha commits it to the schedule.';
  }

  /** Can Maha commit this task to the schedule? */
  function canSchedule(task) {
    const ra = task.requestApproval;
    return !ra || ra.status === 'not_required' || ra.status === 'approved';
  }

  // ---------- addresses and delivery ----------

  function normalizeAddress(a) { return String(a || '').trim().toLowerCase(); }

  /** True when both addresses are set and equal, ignoring upper/lower case and surrounding spaces. */
  function sameAddress(a, b) {
    const x = normalizeAddress(a);
    return x !== '' && x === normalizeAddress(b);
  }

  function approverAddress() { return WH.config.email.approverAddress || null; }

  /**
   * 'simulated': integration off (the prototype default).
   * 'integration_unavailable': switched on in settings, but this browser prototype has no email
   * integration, so emails are still only simulated.
   */
  function deliveryMode() {
    const integ = WH.config.email.integration || {};
    return integ.enabled ? 'integration_unavailable' : 'simulated';
  }

  // ---------- reading replies ----------

  const QUOTE_START = [
    /^\s*>/, // quoted lines
    /^\s*On .+wrote:\s*$/i, // Gmail / Apple Mail
    /^\s*-{2,}\s*Original Message\s*-{2,}/i, // Outlook
    /^\s*_{5,}\s*$/, // Outlook separator line
    /^\s*From:\s.+/i, // forwarded/quoted header block
    /^\s*Sent:\s.+/i,
    /^--\s*$/, // standard signature delimiter
    /^\s*Sent from my /i // mobile signatures
  ];

  /** The part of the reply that Carla newly wrote (before quoted history or signature). */
  function newReplyText(body) {
    const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    for (const line of lines) {
      if (QUOTE_START.some((re) => re.test(line))) break;
      out.push(line);
    }
    return out.join('\n').trim();
  }

  const DECISION_WORD = /\b(approve|approved|decline|declined|reject|rejected|deny|denied)\b/i;

  /**
   * Finds a standalone decision. Returns { decision: 'approve'|'decline'|null, note, reason }.
   * A standalone decision is a line that is only the word, ignoring case, spaces and punctuation.
   * Mixed or hedged wording (for example "don't approve yet") is treated as unclear.
   */
  function parseDecision(body) {
    const text = newReplyText(body);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { decision: null, note: '', reason: 'The reply had no new text.' };
    const standalone = [];
    const other = [];
    lines.forEach((l) => {
      const word = l.toLowerCase().replace(/^[\s"'*_.,!:;-]+|[\s"'*_.,!:;-]+$/g, '');
      if (word === 'approve' || word === 'decline') standalone.push(word);
      else other.push(l);
    });
    const kinds = Array.from(new Set(standalone));
    if (kinds.length === 0) return { decision: null, note: '', reason: 'No standalone "approve" or "decline" was found.' };
    if (kinds.length > 1) return { decision: null, note: '', reason: 'The reply contains both "approve" and "decline".' };
    if (other.some((l) => DECISION_WORD.test(l))) {
      return { decision: null, note: '', reason: 'Other lines also mention approving or declining, so the meaning is unclear.' };
    }
    return { decision: kinds[0], note: other.join(' ').slice(0, 1000), reason: '' };
  }

  // ---------- email content ----------

  /** Capacity notes for the weeks up to the requested deadline. */
  function capacityNotes(state, task, currentWeek) {
    if (!task.requestedDeadline) return ['Requested date not known yet, so no week can be checked.'];
    const last = task.requestedDeadline < currentWeek ? currentWeek : task.requestedDeadline;
    const weeks = D.weeksBetween(currentWeek, last);
    const notes = [];
    weeks.forEach((w) => {
      const s = C.weekSummary(state, w, currentWeek);
      if (s.over > 0) notes.push('Week of ' + D.fmtWeek(w) + ': already ' + fmtHours(s.over) + ' over capacity.');
      else if (s.potentialRemaining < 0) notes.push('Week of ' + D.fmtWeek(w) + ': ' + fmtHours(s.remaining) + ' free, but ' + fmtHours(-s.potentialRemaining) + ' over if all pending requests (including this one) are scheduled.');
    });
    return notes.length ? notes : ['No capacity conflicts found up to the requested deadline.'];
  }

  function buildEmail(state, task, opts) {
    const people = WH.people;
    const appBase = WH.config.email.appBaseUrl;
    const link = (appBase ? appBase.replace(/\/$/, '') + '/' : '') + '#/tasks/' + task.id;
    const estimate = task.estimateHours > 0 ? fmtHours(task.estimateHours) : 'Estimate pending';
    const urgency = WH.workflow ? WH.workflow.URGENCY[task.requestedUrgency] : task.requestedUrgency;
    const notes = capacityNotes(state, task, opts.currentWeek);
    const subject = '[Approval needed] ' + task.title + ' (from ' + people.name(task.requesterId) + ')';
    const body = [
      'Carla,',
      '',
      people.name(task.requesterId) + ' has requested communications work that needs your approval before Maha schedules it.',
      '',
      'Requester: ' + people.name(task.requesterId) + ', ' + (people.get(task.requesterId) || {}).title,
      'Task: ' + task.title,
      '',
      'Brief:',
      task.description,
      (task.deliverableType ? 'Deliverable: ' + task.deliverableType : ''),
      (task.audience ? 'Audience: ' + task.audience : ''),
      (task.purpose ? 'Purpose: ' + task.purpose : ''),
      '',
      'Requested deadline: ' + (task.requestedDeadline ? D.fmtLong(task.requestedDeadline) + (task.deadlineFixed ? ' (externally fixed)' : '') : 'Not known yet'),
      (task.deadlineReason ? 'Reason for the date: ' + task.deadlineReason : ''),
      'Requested urgency: ' + urgency + (task.urgencyReason ? '. Reason: ' + task.urgencyReason : ''),
      'Estimated effort: ' + estimate,
      '',
      'Capacity:',
      notes.map((n) => '- ' + n).join('\n'),
      '',
      'Open the task: ' + link,
      '',
      'TO DECIDE BY EMAIL: reply with the single word APPROVE or DECLINE on its own line.',
      'You may add a short reason on the next line. Unclear replies stay pending.',
      'Approving does not set the deadline: Maha still confirms effort, capacity and the agreed date.',
      'This reply applies only to version ' + opts.version + ' of this request and expires ' + D.fmtLong(opts.expiresOn) + '.',
      '',
      'Reply reference: ' + opts.token
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
    return { subject, body, link, capacityNotes: notes, estimate };
  }

  WH.approval = {
    REQUEST_APPROVAL, MATERIAL_FIELDS, requiresApproval, ruleText, canSchedule,
    normalizeAddress, sameAddress, approverAddress, deliveryMode,
    newReplyText, parseDecision, capacityNotes, buildEmail
  };
})(globalThis.WH = globalThis.WH || {});
