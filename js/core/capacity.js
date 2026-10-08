/*
 * Capacity rules.
 *
 *  - Weekly capacity is 37.7 h (authoritative; never inferred from the 9–5 window).
 *  - 6 h per week is reserved for recurring social media work.
 *  - Accepted meetings and events use capacity. Events outside regular hours do NOT add hours.
 *  - Scheduled tasks count only in the weeks they are allocated to.
 *  - For unfinished work, the *remaining* estimate is spread over current and future
 *    allocated weeks in proportion to the plan.
 *  - Requests not yet scheduled are shown separately as "potential impact".
 *  - Tasks without an estimate are listed as "Estimate needed", never counted as zero.
 */
(function (WH) {
  'use strict';

  const D = WH.dates;
  const { round1 } = WH.util;

  const DEFAULT_CAPACITY = 37.7;
  const DEFAULT_SOCIAL = 6;
  const WORK_START = '09:00';
  const WORK_END = '17:00';

  // Committed work counts toward capacity; pending work is only "potential impact".
  const COMMITTED_STATUSES = ['scheduled', 'in_progress'];
  const PENDING_STATUSES = ['submitted', 'clarification'];

  function weekSettings(state, week) {
    const adj = (state.capacity || {})[week];
    if (!adj) return { capacity: DEFAULT_CAPACITY, social: DEFAULT_SOCIAL, adjusted: false, reason: '' };
    return {
      capacity: adj.capacity,
      social: adj.social,
      adjusted: true,
      reason: adj.reason || ''
    };
  }

  function meetingHours(m) { return m.durationMin / 60; }

  function meetingEnd(m) { return D.minutesToTime(D.timeToMinutes(m.start) + m.durationMin); }

  function eventHours(e) {
    return Math.max(0, D.timeToMinutes(e.end) - D.timeToMinutes(e.start)) / 60;
  }

  function isOutsideRegularHours(date, start, end) {
    return D.isWeekend(date) ||
      D.timeToMinutes(start) < D.timeToMinutes(WORK_START) ||
      D.timeToMinutes(end) > D.timeToMinutes(WORK_END);
  }

  function remainingOf(task) {
    if (task.remainingHours !== null && task.remainingHours !== undefined) return task.remainingHours;
    return task.estimateHours;
  }

  /**
   * Hours a task counts in each week.
   * Returns { weeks: [{weekStart, hours, planned}], unplaced }
   *  - Past weeks keep their planned hours (a record of what was planned).
   *  - Current and future weeks share the remaining estimate in proportion to the plan.
   *  - `unplaced` is remaining effort with no current/future week to sit in.
   */
  function effectiveAllocations(task, currentWeek) {
    const allocs = (task.allocations || []).slice().sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    const past = allocs.filter((a) => a.weekStart < currentWeek)
      .map((a) => ({ weekStart: a.weekStart, hours: a.hours, planned: a.hours }));

    if (!COMMITTED_STATUSES.includes(task.status)) {
      // Completed work keeps its past record; cancelled or pending work counts nowhere.
      return { weeks: task.status === 'complete' || task.status === 'archived' ? past : [], unplaced: 0 };
    }

    const future = allocs.filter((a) => a.weekStart >= currentWeek);
    const sumFuture = future.reduce((s, a) => s + a.hours, 0);
    const remaining = remainingOf(task);

    if (remaining === null || remaining === undefined) {
      return { weeks: past.concat(future.map((a) => ({ weekStart: a.weekStart, hours: a.hours, planned: a.hours }))), unplaced: 0 };
    }
    if (sumFuture <= 0) {
      return { weeks: past, unplaced: remaining };
    }
    const factor = remaining / sumFuture;
    return {
      weeks: past.concat(future.map((a) => ({ weekStart: a.weekStart, hours: a.hours * factor, planned: a.hours }))),
      unplaced: 0
    };
  }

  function hoursInWeek(task, week, currentWeek) {
    const entry = effectiveAllocations(task, currentWeek).weeks.find((w) => w.weekStart === week);
    return entry ? entry.hours : 0;
  }

  /**
   * Potential impact of requests that are not yet scheduled.
   * Estimated requests with a requested date are spread evenly from the current week
   * to the requested-deadline week. Requests without a date go in an "undated" bucket.
   */
  function pendingImpact(state, currentWeek) {
    const weeks = {};
    const undated = { hours: 0, tasks: [], needsEstimate: [] };
    const bucket = (w) => (weeks[w] = weeks[w] || { hours: 0, tasks: [], needsEstimate: [] });

    state.tasks.filter((t) => PENDING_STATUSES.includes(t.status)).forEach((t) => {
      const hasEstimate = typeof t.estimateHours === 'number' && t.estimateHours > 0;
      if (!t.requestedDeadline) {
        if (hasEstimate) { undated.hours += t.estimateHours; undated.tasks.push({ task: t, hours: t.estimateHours }); }
        else undated.needsEstimate.push(t);
        return;
      }
      const dueWeek = D.weekStart(t.requestedDeadline);
      const span = dueWeek < currentWeek ? [currentWeek] : D.weeksBetween(currentWeek, t.requestedDeadline);
      if (!hasEstimate) {
        bucket(span[span.length - 1]).needsEstimate.push(t);
        return;
      }
      const per = t.estimateHours / span.length;
      span.forEach((w) => {
        const b = bucket(w);
        b.hours += per;
        b.tasks.push({ task: t, hours: per });
      });
    });
    return { weeks, undated };
  }

  function weekSummary(state, week, currentWeek) {
    const settings = weekSettings(state, week);
    const inWeek = (date) => D.weekStart(date) === week;

    const meetings = state.meetings.filter((m) => m.status === 'accepted' && inWeek(m.date));
    const pendingMeetings = state.meetings.filter((m) => (m.status === 'pending' || m.status === 'counter') &&
      inWeek(m.status === 'counter' && m.counter ? m.counter.date : m.date));
    const events = state.events.filter((e) => inWeek(e.date));

    const tasks = [];
    const socialTasks = [];
    state.tasks.forEach((t) => {
      const hours = hoursInWeek(t, week, currentWeek);
      if (hours <= 0) return;
      if (t.coveredBySocial) socialTasks.push({ task: t, hours });
      else tasks.push({ task: t, hours });
    });

    const meetingTotal = meetings.reduce((s, m) => s + meetingHours(m), 0);
    const eventTotal = events.reduce((s, e) => s + eventHours(e), 0);
    const taskTotal = tasks.reduce((s, x) => s + x.hours, 0);
    const committed = settings.social + meetingTotal + eventTotal + taskTotal;
    const remaining = settings.capacity - committed;

    const impact = week >= currentWeek ? (pendingImpact(state, currentWeek).weeks[week] || { hours: 0, tasks: [], needsEstimate: [] })
      : { hours: 0, tasks: [], needsEstimate: [] };
    const pendingMeetingHours = pendingMeetings.reduce((s, m) => s + (m.status === 'counter' && m.counter ? m.counter.durationMin : m.durationMin) / 60, 0);

    // Pending Carla proposals that would move work out of / into this week (not applied yet).
    const pendingProposals = (state.proposals || []).filter((p) => p.status === 'pending');
    let proposedOut = 0;
    let proposedIn = 0;
    pendingProposals.forEach((p) => p.moves.forEach((mv) => {
      if (p.weekStart === week) proposedOut += mv.hours;
      if (mv.toWeek === week) proposedIn += mv.hours;
    }));

    return {
      weekStart: week,
      capacity: settings.capacity,
      social: settings.social,
      adjusted: settings.adjusted,
      adjustReason: settings.reason,
      afterSocial: round1(settings.capacity - settings.social),
      meetingHours: round1(meetingTotal),
      eventHours: round1(eventTotal),
      taskHours: round1(taskTotal),
      committed: round1(committed),
      remaining: round1(remaining),
      over: round1(Math.max(0, -remaining)),
      meetings, events, tasks, socialTasks, pendingMeetings,
      pendingHours: round1(impact.hours + pendingMeetingHours),
      pendingTasks: impact.tasks,
      needsEstimate: impact.needsEstimate,
      potentialRemaining: round1(remaining - impact.hours - pendingMeetingHours),
      proposedOut: round1(proposedOut),
      proposedIn: round1(proposedIn),
      remainingIfProposalsConfirmed: round1(remaining + proposedOut - proposedIn)
    };
  }

  /** Weeks over capacity (committed) or that would be over if pending requests were scheduled. */
  function conflicts(state, currentWeek, horizon) {
    const out = [];
    for (let i = 0; i < (horizon || 8); i++) {
      const w = D.addDays(currentWeek, i * 7);
      const s = weekSummary(state, w, currentWeek);
      if (s.over > 0) out.push({ kind: 'committed', summary: s });
      else if (s.potentialRemaining < 0) out.push({ kind: 'potential', summary: s });
    }
    return out;
  }

  /** Tasks (committed or pending) that have no effort estimate. */
  function tasksNeedingEstimate(state) {
    return state.tasks.filter((t) => (PENDING_STATUSES.includes(t.status) || COMMITTED_STATUSES.includes(t.status)) &&
      !(typeof t.estimateHours === 'number' && t.estimateHours > 0));
  }

  WH.capacity = {
    DEFAULT_CAPACITY, DEFAULT_SOCIAL, WORK_START, WORK_END, COMMITTED_STATUSES, PENDING_STATUSES,
    weekSettings, meetingHours, meetingEnd, eventHours, isOutsideRegularHours, remainingOf,
    effectiveAllocations, hoursInWeek, pendingImpact, weekSummary, conflicts, tasksNeedingEstimate
  };
})(globalThis.WH = globalThis.WH || {});
