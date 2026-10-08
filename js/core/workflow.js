/*
 * Workflow: every change to the data goes through these functions.
 * Each function checks permission, validates input, changes the state and records history.
 * They throw PermissionError or ValidationError instead of silently doing something else.
 */
(function (WH) {
  'use strict';

  const D = WH.dates;
  const C = WH.capacity;
  const { uid, round1, fmtHours, PermissionError, ValidationError } = WH.util;
  const P = WH.permissions;

  const STATUSES = {
    submitted: 'Submitted',
    clarification: 'Needs clarification',
    scheduled: 'Scheduled',
    in_progress: 'In progress',
    complete: 'Complete',
    cancelled: 'Cancelled',
    archived: 'Archived'
  };
  const MAIN_FLOW = ['submitted', 'clarification', 'scheduled', 'in_progress', 'complete'];

  const PRIORITIES = { P1: 'Critical', P2: 'High', P3: 'Normal', P4: 'Low' };
  const URGENCY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

  const DELIVERABLE_TYPES = [
    'Social media post or series',
    'Email or e-newsletter',
    'Print piece (flyer, poster, brochure)',
    'Donor or appeal letter',
    'Report or summary',
    'Website update',
    'Graphic or infographic',
    'Media release or statement',
    'Event support',
    'Other'
  ];

  const MEETING_STATUSES = {
    pending: 'Pending',
    counter: 'New time proposed',
    accepted: 'Confirmed',
    declined: 'Declined',
    withdrawn: 'Withdrawn'
  };

  // Clock is replaceable so tests can fix "now".
  let clock = () => new Date();
  function setClock(fn) { clock = fn; }
  function now() { return clock(); }
  function today() { return D.todayISO(now()); }
  function currentWeek() { return D.weekStart(today()); }

  // ---------- helpers ----------

  function findTask(state, id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) throw new ValidationError({ task: 'Task not found.' });
    return t;
  }

  function findMeeting(state, id) {
    const m = state.meetings.find((x) => x.id === id);
    if (!m) throw new ValidationError({ meeting: 'Meeting request not found.' });
    return m;
  }

  function record(task, actor, action, detail) {
    task.history.push({ at: now().toISOString(), by: actor, action, detail: detail || '' });
  }

  function logGlobal(state, actor, action, detail, ref) {
    state.log.push({ at: now().toISOString(), by: actor, action, detail: detail || '', ref: ref || null });
  }

  function str(v, max) {
    const s = (v === null || v === undefined) ? '' : String(v).trim();
    return max ? s.slice(0, max) : s;
  }

  function requireStatus(task, allowed, what) {
    if (!allowed.includes(task.status)) {
      throw new ValidationError({ status: 'Cannot ' + what + ' while the task is "' + STATUSES[task.status] + '".' });
    }
  }

  function setStatus(task, actor, next, detail) {
    const prev = task.status;
    task.status = next;
    record(task, actor, 'Status changed', STATUSES[prev] + ' → ' + STATUSES[next] + (detail ? ' · ' + detail : ''));
  }

  function parseHours(v, field, opts) {
    const o = opts || {};
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (v === '' || v === null || v === undefined || Number.isNaN(n)) {
      throw new ValidationError({ [field]: 'Enter a number of hours.' });
    }
    if (o.allowZero ? n < 0 : n <= 0) {
      throw new ValidationError({ [field]: o.allowZero ? 'Hours cannot be negative.' : 'Hours must be more than zero.' });
    }
    if (n > (o.max || 500)) throw new ValidationError({ [field]: 'That is more than ' + (o.max || 500) + ' hours. Please check.' });
    return round1(n);
  }

  function validateUrl(url) {
    return /^https?:\/\/[^\s]+\.[^\s]+/i.test(url);
  }

  // ---------- task briefs ----------

  /** Reads and validates the brief fields shared by create and edit. */
  function readBrief(data, opts) {
    const errors = {};
    const b = {
      title: str(data.title, 120),
      description: str(data.description, 3000),
      project: str(data.project, 120),
      deliverableType: str(data.deliverableType, 80),
      audience: str(data.audience, 500),
      purpose: str(data.purpose, 1000),
      requestedDeadline: str(data.requestedDeadline),
      dateUnknown: !!data.dateUnknown,
      deadlineReason: str(data.deadlineReason, 1000),
      deadlineFixed: !!data.deadlineFixed,
      requestedUrgency: str(data.requestedUrgency) || 'normal',
      urgencyReason: str(data.urgencyReason, 1000),
      materials: str(data.materials, 5000),
      missingInfo: str(data.missingInfo, 2000),
      notes: str(data.notes, 3000)
    };
    if (!b.title) errors.title = 'Add a short task title.';
    if (b.deliverableType && !DELIVERABLE_TYPES.includes(b.deliverableType)) errors.deliverableType = 'Choose a deliverable type from the list.';
    if (!URGENCY[b.requestedUrgency]) errors.requestedUrgency = 'Choose an urgency.';

    if (b.dateUnknown) {
      b.requestedDeadline = '';
    }
    if (b.requestedDeadline) {
      if (!D.isISODate(b.requestedDeadline)) errors.requestedDeadline = 'Enter a valid date.';
      else if (b.requestedDeadline < today() && b.requestedDeadline !== opts.previousDeadline) {
        errors.requestedDeadline = 'The requested date is in the past.';
      }
    } else {
      b.dateUnknown = true;
    }
    if (b.deadlineFixed && !b.requestedDeadline) errors.deadlineFixed = 'A fixed deadline needs a date.';

    if (Object.keys(errors).length) throw new ValidationError(errors);
    b.requestedDeadline = b.requestedDeadline || null;
    return b;
  }

  function createTask(state, actor, data) {
    P.assert(actor, 'task.create');
    const brief = readBrief(data, {});
    const links = [];
    (data.links || []).forEach((l) => {
      const url = str(l.url, 1000);
      if (!url) return;
      if (!validateUrl(url)) throw new ValidationError({ links: 'Links must start with http:// or https://' });
      links.push({ id: uid('lnk'), url, label: str(l.label, 120) || url, addedBy: actor, addedAt: now().toISOString() });
    });
    const task = Object.assign({
      id: uid('task'),
      requesterId: actor,
      status: 'submitted',
      blocked: null,
      priority: null,
      priorityReason: '',
      estimateHours: null,
      remainingHours: null,
      agreedDeadline: null,
      allocations: [],
      coveredBySocial: false,
      plannedDates: [],
      documents: [],
      links,
      comments: [],
      history: [],
      createdAt: now().toISOString(),
      sample: false
    }, brief);
    record(task, actor, 'Request submitted', brief.title);
    state.tasks.push(task);
    return task;
  }

  const BRIEF_LABELS = {
    title: 'Title', description: 'Description', project: 'Project or campaign', deliverableType: 'Deliverable type',
    audience: 'Audience', purpose: 'Purpose', requestedDeadline: 'Requested deadline', dateUnknown: 'Date not known yet',
    deadlineReason: 'Reason for deadline', deadlineFixed: 'Externally fixed', requestedUrgency: 'Requested urgency',
    urgencyReason: 'Reason for urgency', materials: 'Available materials', missingInfo: 'Missing information', notes: 'Notes'
  };

  function updateBrief(state, actor, taskId, data) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.editBrief', task);
    const brief = readBrief(data, { previousDeadline: task.requestedDeadline });
    const changed = [];
    Object.keys(brief).forEach((k) => {
      if ((task[k] || '') !== (brief[k] || '')) {
        if (k === 'requestedDeadline' || k === 'requestedUrgency' || k === 'title') {
          const fmt = (v) => (k === 'requestedDeadline' ? (v ? D.fmtShort(v) : 'none') : k === 'requestedUrgency' ? URGENCY[v] : v);
          changed.push(BRIEF_LABELS[k] + ': ' + fmt(task[k]) + ' → ' + fmt(brief[k]));
        } else {
          changed.push(BRIEF_LABELS[k]);
        }
        task[k] = brief[k];
      }
    });
    if (changed.length) record(task, actor, 'Brief edited', changed.join('; '));
    return task;
  }

  function addComment(state, actor, taskId, text, kind) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.comment', task);
    const body = str(text, 3000);
    if (!body) throw new ValidationError({ comment: 'Write a comment first.' });
    const c = { id: uid('cmt'), by: actor, at: now().toISOString(), text: body, kind: kind || 'comment' };
    task.comments.push(c);
    if (!kind || kind === 'comment') record(task, actor, 'Comment added');
    return c;
  }

  function addLink(state, actor, taskId, url, label) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.addDocument', task);
    const u = str(url, 1000);
    if (!validateUrl(u)) throw new ValidationError({ url: 'Enter a full link starting with http:// or https://' });
    const link = { id: uid('lnk'), url: u, label: str(label, 120) || u, addedBy: actor, addedAt: now().toISOString() };
    task.links.push(link);
    record(task, actor, 'Link added', link.label);
    return link;
  }

  /** Records document details. The file itself is stored separately (see store.js). */
  function addDocument(state, actor, taskId, meta) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.addDocument', task);
    if (!meta || !meta.name) throw new ValidationError({ file: 'Choose a file.' });
    const doc = {
      id: meta.id || uid('doc'),
      name: str(meta.name, 200),
      size: meta.size || 0,
      type: meta.type || '',
      stored: !!meta.stored,
      addedBy: actor,
      addedAt: now().toISOString()
    };
    task.documents.push(doc);
    record(task, actor, 'Document added', doc.name + (doc.stored ? '' : ' (file not stored)'));
    return doc;
  }

  // ---------- Maha's review and scheduling ----------

  function requestClarification(state, actor, taskId, question) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.requestClarification', task);
    requireStatus(task, ['submitted'], 'ask for clarification');
    const q = str(question, 2000);
    if (!q) throw new ValidationError({ question: 'Say what information is needed.' });
    addComment(state, actor, taskId, q, 'clarification');
    setStatus(task, actor, 'clarification', 'Question: ' + q);
    return task;
  }

  function provideInfo(state, actor, taskId, note) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.provideInfo', task);
    const n = str(note, 3000);
    if (!n) throw new ValidationError({ note: 'Add the information requested, or a short note.' });
    addComment(state, actor, taskId, n, 'answer');
    setStatus(task, actor, 'submitted', 'Information provided');
    return task;
  }

  function setEstimate(state, actor, taskId, hours) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.estimate', task);
    if (['complete', 'cancelled', 'archived'].includes(task.status)) {
      throw new ValidationError({ estimate: 'This task is closed.' });
    }
    const h = parseHours(hours, 'estimate');
    const prev = task.estimateHours;
    const notStarted = ['submitted', 'clarification', 'scheduled'].includes(task.status);
    task.estimateHours = h;
    if (notStarted || task.remainingHours === null || task.remainingHours === undefined) task.remainingHours = h;
    record(task, actor, 'Effort estimated', (prev ? fmtHours(prev) + ' → ' : '') + fmtHours(h));
    return task;
  }

  function setRemaining(state, actor, taskId, hours) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.setRemaining', task);
    requireStatus(task, ['scheduled', 'in_progress'], 'update remaining effort');
    const h = parseHours(hours, 'remaining', { allowZero: true });
    const prev = C.remainingOf(task);
    task.remainingHours = h;
    record(task, actor, 'Remaining effort updated', fmtHours(prev) + ' → ' + fmtHours(h));
    return task;
  }

  /**
   * Maha schedules (or reschedules) a task: agreed deadline + hours per week.
   * Only current and future weeks can be set; past allocations are kept as a record.
   * The hours must add up to the remaining estimate. Returns { task, warnings }.
   */
  function scheduleTask(state, actor, taskId, input) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.schedule', task);
    requireStatus(task, ['submitted', 'clarification', 'scheduled', 'in_progress'], 'schedule');
    if (!(task.estimateHours > 0)) throw new ValidationError({ estimate: 'Estimate needed before scheduling.' });

    const errors = {};
    const deadline = str(input.agreedDeadline);
    if (!D.isISODate(deadline)) errors.agreedDeadline = 'Enter the agreed deadline.';
    else if (deadline < today()) errors.agreedDeadline = 'The agreed deadline is in the past.';

    const cw = currentWeek();
    const seen = {};
    const allocs = [];
    (input.allocations || []).forEach((a) => {
      if (a.hours === '' || a.hours === null || a.hours === undefined || Number(a.hours) === 0) return;
      if (!D.isISODate(a.weekStart) || D.weekdayIndex(a.weekStart) !== 0) { errors.allocations = 'Each week must start on a Monday.'; return; }
      if (a.weekStart < cw) { errors.allocations = 'You can only schedule the current or future weeks.'; return; }
      if (seen[a.weekStart]) { errors.allocations = 'The same week appears twice.'; return; }
      let h;
      try { h = parseHours(a.hours, 'allocations', { max: 60 }); } catch (e) { errors.allocations = 'Week of ' + D.fmtShort(a.weekStart) + ': ' + e.fields.allocations; return; }
      seen[a.weekStart] = true;
      allocs.push({ weekStart: a.weekStart, hours: h });
    });
    if (!errors.allocations && !allocs.length) errors.allocations = 'Allocate the hours to at least one week.';
    if (!errors.agreedDeadline && !errors.allocations && allocs.some((a) => a.weekStart > D.weekStart(deadline))) {
      errors.allocations = 'Work is allocated after the agreed deadline week.';
    }
    const remaining = C.remainingOf(task);
    const total = round1(allocs.reduce((s, a) => s + a.hours, 0));
    if (!errors.allocations && Math.abs(total - remaining) > 0.05) {
      errors.allocations = 'Allocated ' + fmtHours(total) + ', but ' + fmtHours(remaining) + ' of effort remain. They need to match.';
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const warnings = [];
    if (task.requestedDeadline && deadline > task.requestedDeadline) {
      warnings.push((task.deadlineFixed ? 'The requested deadline is externally fixed. ' : '') +
        'Agreed deadline is later than requested (' + D.fmtShort(task.requestedDeadline) + ').');
    }

    const prevDeadline = task.agreedDeadline;
    const past = task.allocations.filter((a) => a.weekStart < cw);
    task.allocations = past.concat(allocs.sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)));
    task.agreedDeadline = deadline;
    const plan = allocs.map((a) => D.fmtWeek(a.weekStart) + ': ' + fmtHours(a.hours)).join(', ');
    record(task, actor, prevDeadline ? 'Schedule updated' : 'Scheduled',
      'Agreed deadline ' + (prevDeadline && prevDeadline !== deadline ? D.fmtShort(prevDeadline) + ' → ' : '') + D.fmtShort(deadline) + ' · ' + plan);
    if (task.status === 'submitted' || task.status === 'clarification') setStatus(task, actor, 'scheduled');

    // Warn about weeks now over capacity, so nothing is silently overloaded.
    allocs.forEach((a) => {
      const s = C.weekSummary(state, a.weekStart, cw);
      if (s.over > 0) warnings.push('Week of ' + D.fmtWeek(a.weekStart) + ' is now ' + fmtHours(s.over) + ' over capacity. Carla has been shown this conflict.');
    });
    return { task, warnings };
  }

  /** Marks routine social work as covered by the weekly 6 h social media reserve (so it is not counted twice). */
  function setCoveredBySocial(state, actor, taskId, on) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.schedule', task);
    if (task.coveredBySocial === !!on) return task;
    task.coveredBySocial = !!on;
    record(task, actor, on ? 'Covered by social media time' : 'Counted as separate task time',
      on ? 'Hours sit inside the weekly social media allocation' : 'Hours count toward scheduled task time');
    return task;
  }

  function startWork(state, actor, taskId) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.start', task);
    requireStatus(task, ['scheduled'], 'start work');
    setStatus(task, actor, 'in_progress');
    return task;
  }

  function setBlocked(state, actor, taskId, reason) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.block', task);
    requireStatus(task, ['scheduled', 'in_progress'], 'flag as blocked');
    const r = str(reason, 1000);
    if (!r) throw new ValidationError({ reason: 'Explain what is blocking the work.' });
    task.blocked = { reason: r, by: actor, at: now().toISOString() };
    record(task, actor, 'Flagged as blocked', r);
    return task;
  }

  function clearBlocked(state, actor, taskId) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.block', task);
    if (!task.blocked) return task;
    task.blocked = null;
    record(task, actor, 'Block cleared');
    return task;
  }

  function planToday(state, actor, taskId, on) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.planToday', task);
    const t = today();
    task.plannedDates = (task.plannedDates || []).filter((d) => d !== t);
    if (on) task.plannedDates.push(t);
    return task;
  }

  /** Maha marks finished work as Complete. No separate approval step. */
  function completeTask(state, actor, taskId, note) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.complete', task);
    requireStatus(task, ['in_progress'], 'mark as complete');
    if (task.blocked) throw new ValidationError({ status: 'Clear the block before marking the task complete.' });
    task.remainingHours = 0;
    task.completedBy = actor;
    task.completedAt = now().toISOString();
    task.completionNote = str(note, 2000);
    setStatus(task, actor, 'complete', task.completionNote ? 'Note: ' + task.completionNote.slice(0, 200) : '');
    return task;
  }

  // ---------- Carla's decisions ----------

  function setPriority(state, actor, taskId, priority, reason) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.setPriority', task);
    if (priority && !PRIORITIES[priority]) throw new ValidationError({ priority: 'Choose a priority.' });
    if (['complete', 'cancelled', 'archived'].includes(task.status)) throw new ValidationError({ priority: 'This task is closed.' });
    const prev = task.priority;
    task.priority = priority || null;
    task.priorityReason = str(reason, 1000);
    const label = (p) => (p ? p + ' ' + PRIORITIES[p] : 'Not set');
    record(task, actor, 'Priority set', label(prev) + ' → ' + label(task.priority) + (task.priorityReason ? ' · ' + task.priorityReason : ''));
    return task;
  }

  // ---------- cancel / archive ----------

  function cancelTask(state, actor, taskId, reason) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.cancel', task);
    const r = str(reason, 1000);
    if (!r) throw new ValidationError({ reason: 'Give a short reason for cancelling.' });
    task.blocked = null;
    setStatus(task, actor, 'cancelled', r);
    return task;
  }

  function archiveTask(state, actor, taskId) {
    const task = findTask(state, taskId);
    P.assert(actor, 'task.archive', task);
    task.archivedFrom = task.status;
    setStatus(task, actor, 'archived', 'History kept');
    return task;
  }

  // ---------- priority change proposals (Carla proposes, Maha confirms) ----------

  function createProposal(state, actor, input) {
    P.assert(actor, 'proposal.create');
    const errors = {};
    const week = str(input.weekStart);
    const cw = currentWeek();
    if (!D.isISODate(week) || D.weekdayIndex(week) !== 0) errors.weekStart = 'Choose the affected week.';
    const reason = str(input.reason, 2000);
    if (!reason) errors.reason = 'Record the reason for this decision.';
    const moves = [];
    (input.moves || []).forEach((mv) => {
      const task = state.tasks.find((t) => t.id === mv.taskId);
      if (!task) { errors.moves = 'A selected task no longer exists.'; return; }
      if (!C.COMMITTED_STATUSES.includes(task.status)) { errors.moves = '"' + task.title + '" is not scheduled work.'; return; }
      const hours = C.hoursInWeek(task, week, cw);
      if (hours <= 0) { errors.moves = '"' + task.title + '" has no hours in that week.'; return; }
      if (!D.isISODate(mv.toWeek) || D.weekdayIndex(mv.toWeek) !== 0 || mv.toWeek === week || mv.toWeek < cw) {
        errors.moves = 'Choose a different current or future week for "' + task.title + '".'; return;
      }
      const pd = str(mv.proposedDeadline);
      if (pd && (!D.isISODate(pd) || pd < mv.toWeek)) { errors.moves = 'The proposed deadline for "' + task.title + '" must be on or after the new week starts.'; return; }
      const clash = state.proposals.find((p) => p.status === 'pending' && p.moves.some((m) => m.taskId === task.id));
      if (clash) { errors.moves = '"' + task.title + '" already has a pending change.'; return; }
      moves.push({ taskId: task.id, fromWeek: week, toWeek: mv.toWeek, hours: round1(hours), proposedDeadline: pd || null, previousDeadline: task.agreedDeadline });
    });
    if (!errors.moves && !moves.length) errors.moves = 'Select at least one piece of work to move.';
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const proposal = {
      id: uid('prop'), weekStart: week, reason, moves, status: 'pending',
      triggerTaskId: input.triggerTaskId || null,
      createdBy: actor, createdAt: now().toISOString(),
      decidedBy: null, decidedAt: null, decisionNote: ''
    };
    state.proposals.push(proposal);
    moves.forEach((mv) => {
      const task = findTask(state, mv.taskId);
      record(task, actor, 'Schedule change proposed (pending Maha)',
        'Move ' + fmtHours(mv.hours) + ' from week of ' + D.fmtWeek(mv.fromWeek) + ' to week of ' + D.fmtWeek(mv.toWeek) +
        (mv.proposedDeadline ? '; proposed deadline ' + D.fmtShort(mv.proposedDeadline) : '') + ' · Reason: ' + reason);
    });
    logGlobal(state, actor, 'Proposed schedule change', 'Week of ' + D.fmtWeek(week) + ' · ' + reason, proposal.id);
    return proposal;
  }

  /**
   * Maha confirms a proposal. `deadlines` maps taskId -> confirmed agreed deadline.
   * Allocations planned in the affected week are moved into the new week.
   */
  function confirmProposal(state, actor, proposalId, deadlines, note) {
    P.assert(actor, 'proposal.confirm');
    const p = state.proposals.find((x) => x.id === proposalId);
    if (!p) throw new ValidationError({ proposal: 'Proposal not found.' });
    if (p.status !== 'pending') throw new ValidationError({ proposal: 'This proposal has already been decided.' });

    const errors = {};
    const finalDates = {};
    p.moves.forEach((mv) => {
      const task = findTask(state, mv.taskId);
      const chosen = str((deadlines || {})[mv.taskId]) || mv.proposedDeadline || task.agreedDeadline;
      if (!chosen || !D.isISODate(chosen)) errors['deadline-' + mv.taskId] = 'Confirm a date for "' + task.title + '".';
      else if (D.weekStart(chosen) < mv.toWeek) errors['deadline-' + mv.taskId] = 'The date for "' + task.title + '" falls before the week it moves to.';
      else finalDates[mv.taskId] = chosen;
    });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    p.moves.forEach((mv) => {
      const task = findTask(state, mv.taskId);
      const from = task.allocations.find((a) => a.weekStart === mv.fromWeek);
      const plannedHours = from ? from.hours : 0;
      task.allocations = task.allocations.filter((a) => a.weekStart !== mv.fromWeek);
      const to = task.allocations.find((a) => a.weekStart === mv.toWeek);
      if (to) to.hours = round1(to.hours + plannedHours);
      else task.allocations.push({ weekStart: mv.toWeek, hours: plannedHours });
      task.allocations.sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
      const prev = task.agreedDeadline;
      task.agreedDeadline = finalDates[mv.taskId];
      mv.confirmedDeadline = finalDates[mv.taskId];
      record(task, actor, 'Schedule change confirmed',
        'Moved to week of ' + D.fmtWeek(mv.toWeek) + ' · Agreed deadline ' + (prev ? D.fmtShort(prev) + ' → ' : '') + D.fmtShort(task.agreedDeadline));
    });
    p.status = 'confirmed';
    p.decidedBy = actor;
    p.decidedAt = now().toISOString();
    p.decisionNote = str(note, 2000);
    logGlobal(state, actor, 'Confirmed schedule change', 'Week of ' + D.fmtWeek(p.weekStart), p.id);
    return p;
  }

  function declineProposal(state, actor, proposalId, note) {
    P.assert(actor, 'proposal.decline');
    const p = state.proposals.find((x) => x.id === proposalId);
    if (!p) throw new ValidationError({ proposal: 'Proposal not found.' });
    if (p.status !== 'pending') throw new ValidationError({ proposal: 'This proposal has already been decided.' });
    const n = str(note, 2000);
    if (!n) throw new ValidationError({ note: 'Explain why the dates cannot work, so Carla can decide again.' });
    p.status = 'declined';
    p.decidedBy = actor;
    p.decidedAt = now().toISOString();
    p.decisionNote = n;
    p.moves.forEach((mv) => record(findTask(state, mv.taskId), actor, 'Schedule change not confirmed', n));
    logGlobal(state, actor, 'Declined schedule change', n, p.id);
    return p;
  }

  // ---------- meetings ----------

  function readMeetingTime(data, errors) {
    const date = str(data.date);
    const start = str(data.start);
    const dur = Number(data.durationMin);
    if (!D.isISODate(date)) errors.date = 'Enter a valid date.';
    else if (date < today()) errors.date = 'The date is in the past.';
    if (!D.isTime(start)) errors.start = 'Enter a start time.';
    if (!Number.isInteger(dur) || dur < 15 || dur > 480) errors.durationMin = 'Enter whole minutes between 15 and 480 (8 hours).';
    else if (D.isTime(start) && D.timeToMinutes(start) + dur > 24 * 60) errors.durationMin = 'The meeting would run past midnight.';
    return { date, start, durationMin: dur };
  }

  function requestMeeting(state, actor, data) {
    P.assert(actor, 'meeting.request');
    const errors = {};
    const purpose = str(data.purpose, 500);
    if (!purpose) errors.purpose = 'Say what the meeting is for.';
    const time = readMeetingTime(data, errors);
    const taskId = str(data.taskId) || null;
    if (taskId && !state.tasks.find((t) => t.id === taskId)) errors.taskId = 'That task no longer exists.';
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const m = Object.assign({
      id: uid('mtg'), requesterId: actor, purpose, location: str(data.location, 500), taskId,
      status: 'pending', counter: null, responseNote: '', history: [], createdAt: now().toISOString(), sample: false
    }, time);
    m.history.push({ at: now().toISOString(), by: actor, action: 'Meeting requested', detail: D.fmtShort(m.date) + ' ' + D.fmtTime(m.start) });
    state.meetings.push(m);
    return m;
  }

  function respondMeeting(state, actor, meetingId, response, data) {
    const m = findMeeting(state, meetingId);
    P.assert(actor, 'meeting.respond', m);
    if (m.status !== 'pending') throw new ValidationError({ meeting: 'Only pending requests can be answered.' });
    const note = str((data || {}).note, 1000);
    const at = now().toISOString();
    if (response === 'accept') {
      m.status = 'accepted';
      m.responseNote = note;
      m.history.push({ at, by: actor, action: 'Meeting confirmed', detail: note });
    } else if (response === 'decline') {
      m.status = 'declined';
      m.responseNote = note;
      m.history.push({ at, by: actor, action: 'Meeting declined', detail: note });
    } else if (response === 'counter') {
      const errors = {};
      const time = readMeetingTime(Object.assign({ durationMin: m.durationMin }, data), errors);
      if (Object.keys(errors).length) throw new ValidationError(errors);
      m.status = 'counter';
      m.counter = time;
      m.responseNote = note;
      m.history.push({ at, by: actor, action: 'New time proposed', detail: D.fmtShort(time.date) + ' ' + D.fmtTime(time.start) + (note ? ' · ' + note : '') });
    } else {
      throw new ValidationError({ response: 'Unknown response.' });
    }
    return m;
  }

  function acceptCounter(state, actor, meetingId) {
    const m = findMeeting(state, meetingId);
    P.assert(actor, 'meeting.acceptCounter', m);
    Object.assign(m, { date: m.counter.date, start: m.counter.start, durationMin: m.counter.durationMin });
    m.counter = null;
    m.status = 'accepted';
    m.history.push({ at: now().toISOString(), by: actor, action: 'Accepted new time', detail: D.fmtShort(m.date) + ' ' + D.fmtTime(m.start) });
    return m;
  }

  function withdrawMeeting(state, actor, meetingId) {
    const m = findMeeting(state, meetingId);
    P.assert(actor, 'meeting.withdraw', m);
    m.status = 'withdrawn';
    m.history.push({ at: now().toISOString(), by: actor, action: 'Meeting withdrawn' });
    return m;
  }

  /** Plain-language warnings for a meeting time: overlaps, outside hours, capacity. */
  function meetingConflicts(state, date, start, durationMin, ignoreId) {
    const out = [];
    if (!D.isISODate(date) || !D.isTime(start) || !(durationMin > 0)) return out;
    const s = D.timeToMinutes(start);
    const e = s + durationMin;
    const end = D.minutesToTime(Math.min(e, 1439));
    if (C.isOutsideRegularHours(date, start, end)) out.push('Outside Maha\'s regular hours (Mon–Fri, 9 a.m.–5 p.m.).');
    state.meetings.forEach((m) => {
      if (m.id === ignoreId || m.status !== 'accepted' || m.date !== date) return;
      const ms = D.timeToMinutes(m.start);
      if (ms < e && ms + m.durationMin > s) out.push('Overlaps confirmed meeting: ' + m.purpose + ' (' + D.fmtTime(m.start) + ').');
    });
    state.events.forEach((ev) => {
      if (ev.date !== date) return;
      if (D.timeToMinutes(ev.start) < e && D.timeToMinutes(ev.end) > s) out.push('Overlaps event: ' + ev.title + '.');
    });
    const cw = currentWeek();
    const week = D.weekStart(date);
    const summary = C.weekSummary(state, week, cw);
    const after = round1(summary.remaining - durationMin / 60);
    if (after < 0) out.push('Week of ' + D.fmtWeek(week) + ' would be ' + fmtHours(-after) + ' over capacity with scheduled work.');
    return out;
  }

  // ---------- capacity & events ----------

  function setCapacity(state, actor, week, data) {
    P.assert(actor, 'capacity.adjust');
    const errors = {};
    if (!D.isISODate(week) || D.weekdayIndex(week) !== 0) errors.week = 'Choose a week.';
    let cap; let social;
    try { cap = parseHours(data.capacity, 'capacity', { allowZero: true, max: C.DEFAULT_CAPACITY }); } catch (e) { errors.capacity = e.fields.capacity; }
    try { social = parseHours(data.social, 'social', { allowZero: true, max: C.DEFAULT_CAPACITY }); } catch (e) { errors.social = e.fields.social; }
    if (!errors.capacity && !errors.social && social > cap) errors.social = 'Social media time cannot exceed the week\'s capacity.';
    const reason = str(data.reason, 500);
    if (!reason) errors.reason = 'Add a reason, such as "Vacation Mon–Tue".';
    if (Object.keys(errors).length) throw new ValidationError(errors);
    state.capacity[week] = { capacity: cap, social, reason, by: actor, at: now().toISOString() };
    logGlobal(state, actor, 'Capacity adjusted', 'Week of ' + D.fmtWeek(week) + ': ' + fmtHours(cap) + ' capacity, ' + fmtHours(social) + ' social media · ' + reason);
  }

  function clearCapacity(state, actor, week) {
    P.assert(actor, 'capacity.adjust');
    if (!state.capacity[week]) return;
    delete state.capacity[week];
    logGlobal(state, actor, 'Capacity reset to standard', 'Week of ' + D.fmtWeek(week));
  }

  function addEvent(state, actor, data) {
    P.assert(actor, 'event.manage');
    const errors = {};
    const title = str(data.title, 200);
    if (!title) errors.title = 'Name the event.';
    const date = str(data.date);
    if (!D.isISODate(date)) errors.date = 'Enter a valid date.';
    const start = str(data.start);
    const end = str(data.end);
    if (!D.isTime(start)) errors.start = 'Enter a start time.';
    if (!D.isTime(end)) errors.end = 'Enter an end time.';
    else if (D.isTime(start) && D.timeToMinutes(end) <= D.timeToMinutes(start)) errors.end = 'The end time must be after the start time.';
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const ev = { id: uid('evt'), title, date, start, end, notes: str(data.notes, 1000), createdBy: actor, createdAt: now().toISOString(), sample: false };
    state.events.push(ev);
    logGlobal(state, actor, 'Event added', title + ' · ' + D.fmtShort(date));
    return ev;
  }

  function removeEvent(state, actor, eventId) {
    P.assert(actor, 'event.manage');
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev) return;
    state.events = state.events.filter((e) => e.id !== eventId);
    logGlobal(state, actor, 'Event removed', ev.title + ' · ' + D.fmtShort(ev.date));
  }

  WH.workflow = {
    STATUSES, MAIN_FLOW, PRIORITIES, URGENCY, DELIVERABLE_TYPES, MEETING_STATUSES,
    setClock, now, today, currentWeek,
    createTask, updateBrief, addComment, addLink, addDocument,
    requestClarification, provideInfo, setEstimate, setRemaining, scheduleTask, setCoveredBySocial, startWork,
    setBlocked, clearBlocked, planToday, completeTask,
    setPriority, cancelTask, archiveTask,
    createProposal, confirmProposal, declineProposal,
    requestMeeting, respondMeeting, acceptCounter, withdrawMeeting, meetingConflicts,
    setCapacity, clearCapacity, addEvent, removeEvent,
    PermissionError, ValidationError
  };
})(globalThis.WH = globalThis.WH || {});
