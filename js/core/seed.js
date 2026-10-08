/*
 * FICTIONAL SAMPLE DATA. Every item is marked `sample: true` and shown with a "Fictional sample" label.
 * Dates are relative to the current week so the demo always looks current.
 *
 * Scenario:
 *  - This week: Lina's urgent gala sponsor posts were scheduled on top of existing work,
 *    so the week is over capacity, and Christine has also sent an urgent flyer request.
 *    Carla needs to decide what moves.
 *  - Next week: Maha has a vacation day and an evening gala. Carla has proposed moving
 *    Christine's volunteer newsletter; it is waiting for Maha to confirm.
 *  - Last week: a resolved example (Carla moved signage work, Maha confirmed).
 */
(function (WH) {
  'use strict';

  const D = WH.dates;

  /** Converts a Toronto date + time to a UTC ISO timestamp. */
  function stamp(iso, time) {
    const [y, m, d] = iso.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    let guess = new Date(Date.UTC(y, m - 1, d, hh + 5, mm)); // EST guess
    const torontoHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: D.TZ, hour: '2-digit', hourCycle: 'h23' }).format(guess));
    if (torontoHour !== hh) guess = new Date(guess.getTime() - (torontoHour - hh) * 3600000);
    return guess.toISOString();
  }

  function build(now) {
    const today = D.todayISO(now);
    const w0 = D.weekStart(today);
    const day = (n) => D.addDays(w0, n);
    const wk = (n) => D.addDays(w0, n * 7);
    const h = (dayOffset, time, by, action, detail) => ({ at: stamp(day(dayOffset), time), by, action, detail: detail || '' });

    const base = {
      blocked: null, priority: null, priorityReason: '', estimateHours: null, remainingHours: null,
      agreedDeadline: null, allocations: [], coveredBySocial: false, plannedDates: [], documents: [], links: [],
      comments: [], history: [], sample: true, project: '', deliverableType: '', audience: '',
      purpose: '', requestedDeadline: null, dateUnknown: false, deadlineReason: '', deadlineFixed: false,
      requestedUrgency: 'normal', urgencyReason: '', materials: '', missingInfo: '', notes: ''
    };
    const task = (o) => Object.assign({}, base, o, { createdAt: o.history[0].at });
    const sampleDoc = (id, name, by, at) => ({ id, name, size: 0, type: '', stored: false, sample: true, addedBy: by, addedAt: at });

    const tasks = [
      task({
        id: 'sample-appeal', requesterId: 'lina', title: 'Fall appeal donor letter and email series',
        description: 'Fictional sample. A two-page appeal letter plus three follow-up emails for the fall giving campaign.',
        project: 'Fall Appeal (sample)', deliverableType: 'Donor or appeal letter', audience: 'Current monthly and annual donors',
        purpose: 'Raise funds for winter shelter programming.', requestedDeadline: day(9), deadlineReason: 'Mail house drop date.',
        requestedUrgency: 'high', urgencyReason: 'Print slot is booked.', status: 'in_progress', priority: 'P2', priorityReason: 'Largest fall revenue driver.',
        estimateHours: 15, remainingHours: 11, agreedDeadline: day(11),
        allocations: [{ weekStart: wk(-1), hours: 4 }, { weekStart: wk(0), hours: 6 }, { weekStart: wk(1), hours: 5 }],
        plannedDates: [today],
        materials: 'Last year\'s letter, approved program statistics.',
        documents: [sampleDoc('sample-doc-1', 'fall-appeal-outline-SAMPLE.docx', 'lina', stamp(day(-10), '10:05'))],
        links: [{ id: 'sample-lnk-1', url: 'https://example.org/sample-appeal-notes', label: 'Sample planning notes (example link)', addedBy: 'lina', addedAt: stamp(day(-10), '10:06') }],
        comments: [{ id: 'sample-c1', by: 'maha', at: stamp(day(-8), '11:20'), text: 'Draft letter shared. Emails next week.', kind: 'comment' }],
        history: [
          h(-10, '10:00', 'lina', 'Request submitted', 'Fall appeal donor letter and email series'),
          h(-9, '09:30', 'maha', 'Effort estimated', '15 h'),
          h(-9, '09:40', 'maha', 'Scheduled', 'Agreed deadline ' + D.fmtShort(day(11))),
          h(-9, '09:40', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(-8, '14:00', 'carla', 'Priority set', 'Not set → P2 High · Largest fall revenue driver.'),
          h(-7, '09:15', 'maha', 'Status changed', 'Scheduled → In progress')
        ]
      }),
      task({
        id: 'sample-brochure', requesterId: 'christine', title: 'Winter programs brochure',
        description: 'Fictional sample. Eight-panel brochure listing winter community programs and drop-in hours.',
        project: 'Winter Programs (sample)', deliverableType: 'Print piece (flyer, poster, brochure)', audience: 'Community members and partner agencies',
        purpose: 'Promote winter program registration.', requestedDeadline: day(18), deadlineReason: 'Registration opens the following week.',
        status: 'scheduled', priority: 'P3', estimateHours: 12, remainingHours: 12, agreedDeadline: day(18),
        allocations: [{ weekStart: wk(0), hours: 7 }, { weekStart: wk(1), hours: 5 }],
        missingInfo: 'Final program times from two facilitators.',
        history: [
          h(-6, '13:10', 'christine', 'Request submitted', 'Winter programs brochure'),
          h(-5, '10:00', 'maha', 'Effort estimated', '12 h'),
          h(-5, '10:05', 'maha', 'Scheduled', 'Agreed deadline ' + D.fmtShort(day(18))),
          h(-5, '10:05', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(-4, '15:00', 'carla', 'Priority set', 'Not set → P3 Normal')
        ]
      }),
      task({
        id: 'sample-gala-posts', requesterId: 'lina', title: 'Gala sponsor thank-you posts',
        description: 'Fictional sample. Custom graphics and posts thanking six gala sponsors, as promised in sponsor agreements.',
        project: 'Harvest Gala (sample)', deliverableType: 'Social media post or series', audience: 'Sponsors, donors and followers',
        purpose: 'Meet sponsor recognition commitments.', requestedDeadline: day(4), deadlineReason: 'Sponsor agreements promise recognition before the gala.',
        deadlineFixed: true, requestedUrgency: 'urgent', urgencyReason: 'Contractual sponsor commitment; logos arrived late.',
        status: 'scheduled', estimateHours: 9, remainingHours: 9, agreedDeadline: day(4),
        allocations: [{ weekStart: wk(0), hours: 9 }], plannedDates: [today],
        notes: 'Custom design work, beyond the routine weekly social media time.',
        documents: [sampleDoc('sample-doc-2', 'sponsor-logos-SAMPLE.zip', 'lina', stamp(day(-1), '16:40'))],
        history: [
          h(-1, '16:30', 'lina', 'Request submitted', 'Gala sponsor thank-you posts'),
          h(0, '09:10', 'maha', 'Effort estimated', '9 h'),
          h(0, '09:15', 'maha', 'Scheduled', 'Agreed deadline ' + D.fmtShort(day(4)) + ' · Week now over capacity'),
          h(0, '09:15', 'maha', 'Status changed', 'Submitted → Scheduled')
        ]
      }),
      task({
        id: 'sample-flyer', requesterId: 'christine', title: 'Drop-in program flyer update',
        description: 'Fictional sample. Update the drop-in flyer with new Thursday evening hours and reprint for the open house.',
        project: 'Winter Programs (sample)', deliverableType: 'Print piece (flyer, poster, brochure)', audience: 'Drop-in participants',
        purpose: 'Avoid people arriving at the old times.', requestedDeadline: day(3), deadlineReason: 'Community open house on Thursday.',
        deadlineFixed: true, requestedUrgency: 'urgent', urgencyReason: 'Hours change takes effect this week.',
        status: 'submitted', estimateHours: 4, remainingHours: 4,
        history: [
          h(0, '11:45', 'christine', 'Request submitted', 'Drop-in program flyer update'),
          h(0, '13:00', 'maha', 'Effort estimated', '4 h')
        ]
      }),
      task({
        id: 'sample-annual', requesterId: 'carla', title: 'Annual report highlights summary',
        description: 'Fictional sample. Two-page highlights summary for the board package.',
        project: 'Board Reporting (sample)', deliverableType: 'Report or summary', audience: 'Board of directors',
        requestedDeadline: day(5), status: 'in_progress', priority: 'P2', estimateHours: 8, remainingHours: 4, agreedDeadline: day(5),
        allocations: [{ weekStart: wk(-1), hours: 4 }, { weekStart: wk(0), hours: 4 }],
        history: [
          h(-12, '08:50', 'carla', 'Request submitted', 'Annual report highlights summary'),
          h(-11, '10:00', 'maha', 'Effort estimated', '8 h'),
          h(-11, '10:05', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(-6, '09:00', 'maha', 'Status changed', 'Scheduled → In progress'),
          h(-2, '16:00', 'maha', 'Remaining effort updated', '8 h → 4 h')
        ]
      }),
      task({
        id: 'sample-res-insert', requesterId: 'alicia', title: 'Residential newsletter insert',
        description: 'Fictional sample. One-page insert for residents about upcoming house meetings.',
        project: 'Resident Communications (sample)', deliverableType: 'Print piece (flyer, poster, brochure)',
        requestedDeadline: day(4), status: 'scheduled', priority: 'P3', estimateHours: 3, remainingHours: 3, agreedDeadline: day(4),
        allocations: [{ weekStart: wk(0), hours: 3 }],
        history: [
          h(-7, '14:20', 'alicia', 'Request submitted', 'Residential newsletter insert'),
          h(-6, '10:00', 'maha', 'Effort estimated', '3 h'),
          h(-6, '10:02', 'maha', 'Status changed', 'Submitted → Scheduled')
        ]
      }),
      task({
        id: 'sample-recognition', requesterId: 'leslie', title: 'Staff recognition week poster',
        description: 'Fictional sample. Poster and email banner celebrating staff recognition week.',
        project: 'Staff Engagement (sample)', deliverableType: 'Graphic or infographic', requestedDeadline: day(7),
        status: 'awaiting_approval', priority: 'P4', estimateHours: 3, remainingHours: 0, agreedDeadline: day(7),
        completedBy: 'maha', completedAt: stamp(day(1), '15:30'),
        approval: { completedAt: stamp(day(1), '15:30'), completedBy: 'maha', note: 'Final poster ready in shared drive (sample).', requestedAt: null, requestedBy: null, decision: null, decidedBy: null, decidedAt: null, decisionNote: '' },
        allocations: [{ weekStart: wk(-1), hours: 3 }],
        history: [
          h(-9, '11:00', 'leslie', 'Request submitted', 'Staff recognition week poster'),
          h(-8, '09:00', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(-7, '10:00', 'maha', 'Status changed', 'Scheduled → In progress'),
          h(1, '15:30', 'maha', 'Status changed', 'In progress → Awaiting approval · Completed by Maha; needs Carla’s approval before it is closed')
        ]
      }),
      task({
        id: 'sample-volunteer-news', requesterId: 'christine', title: 'Volunteer newsletter',
        description: 'Fictional sample. Quarterly volunteer newsletter with program updates and thank-yous.',
        project: 'Volunteer Program (sample)', deliverableType: 'Email or e-newsletter', requestedDeadline: day(11),
        status: 'scheduled', priority: 'P3', estimateHours: 12, remainingHours: 12, agreedDeadline: day(11),
        allocations: [{ weekStart: wk(1), hours: 10 }, { weekStart: wk(2), hours: 2 }],
        history: [
          h(-6, '15:00', 'christine', 'Request submitted', 'Volunteer newsletter'),
          h(-5, '11:00', 'maha', 'Effort estimated', '12 h'),
          h(-5, '11:05', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(1, '10:30', 'carla', 'Schedule change proposed (pending Maha)', 'Move 10 h from week of ' + D.fmtWeek(wk(1)) + ' to week of ' + D.fmtWeek(wk(2)) + ' · Reason: Maha is away Friday and the gala falls this week.')
        ]
      }),
      task({
        id: 'sample-gala-coverage', requesterId: 'lina', title: 'Gala night social coverage',
        description: 'Fictional sample. Live posts during the gala. Covered by the weekly social media allocation.',
        project: 'Harvest Gala (sample)', deliverableType: 'Social media post or series', requestedDeadline: day(12),
        status: 'scheduled', estimateHours: 3, remainingHours: 3, agreedDeadline: day(12), coveredBySocial: true,
        allocations: [{ weekStart: wk(1), hours: 3 }],
        history: [
          h(-3, '10:00', 'lina', 'Request submitted', 'Gala night social coverage'),
          h(-2, '09:30', 'maha', 'Status changed', 'Submitted → Scheduled · Covered by weekly social media time')
        ]
      }),
      task({
        id: 'sample-signage', requesterId: 'esperanca', title: 'Building accessibility signage',
        description: 'Fictional sample. Design six accessible wayfinding signs for the main floor.',
        project: 'Facilities (sample)', deliverableType: 'Print piece (flyer, poster, brochure)', requestedDeadline: day(-3),
        status: 'scheduled', priority: 'P4', estimateHours: 4, remainingHours: 4, agreedDeadline: day(17),
        allocations: [{ weekStart: wk(2), hours: 4 }],
        history: [
          h(-14, '10:00', 'esperanca', 'Request submitted', 'Building accessibility signage'),
          h(-13, '09:00', 'maha', 'Status changed', 'Submitted → Scheduled'),
          h(-6, '09:45', 'carla', 'Schedule change proposed (pending Maha)', 'Move 4 h from week of ' + D.fmtWeek(wk(-1)) + ' to week of ' + D.fmtWeek(wk(2)) + ' · Reason: Fall appeal comes first; installation date is flexible.'),
          h(-5, '10:15', 'maha', 'Schedule change confirmed', 'Moved to week of ' + D.fmtWeek(wk(2)) + ' · Agreed deadline ' + D.fmtShort(day(-3)) + ' → ' + D.fmtShort(day(17)))
        ]
      }),
      task({
        id: 'sample-job-posts', requesterId: 'leslie', title: 'Job posting graphics for two roles',
        description: 'Fictional sample. Social and website graphics for two open positions.',
        project: 'Recruitment (sample)', deliverableType: 'Graphic or infographic', requestedDeadline: day(10), status: 'clarification',
        comments: [{ id: 'sample-c2', by: 'maha', at: stamp(day(-1), '10:00'), text: 'Which two roles, and is there a posting close date?', kind: 'clarification' }],
        history: [
          h(-2, '14:00', 'leslie', 'Request submitted', 'Job posting graphics for two roles'),
          h(-1, '10:00', 'maha', 'Status changed', 'Submitted → Needs clarification · Question: Which two roles, and is there a posting close date?')
        ]
      }),
      task({
        id: 'sample-budget', requesterId: 'sheila', title: 'Annual budget infographic',
        description: 'Fictional sample. One-page infographic showing where funding comes from and how it is spent.',
        project: 'Board Reporting (sample)', deliverableType: 'Graphic or infographic', requestedDeadline: day(25), status: 'submitted',
        history: [h(-1, '09:20', 'sheila', 'Request submitted', 'Annual budget infographic')]
      }),
      task({
        id: 'sample-enews', requesterId: 'lina', title: 'November donor e-newsletter',
        description: 'Fictional sample. Monthly donor e-newsletter.', project: 'Donor Stewardship (sample)', deliverableType: 'Email or e-newsletter',
        requestedDeadline: day(28), status: 'submitted', estimateHours: 6, remainingHours: 6,
        history: [h(-1, '12:00', 'lina', 'Request submitted', 'November donor e-newsletter'), h(0, '13:05', 'maha', 'Effort estimated', '6 h')]
      }),
      task({
        id: 'sample-house-rules', requesterId: 'alicia', title: 'House rules poster refresh',
        description: 'Fictional sample. Plain-language refresh of the residence house rules poster.',
        project: 'Resident Communications (sample)', deliverableType: 'Print piece (flyer, poster, brochure)',
        requestedDeadline: day(-9), status: 'complete', priority: 'P3', estimateHours: 4, remainingHours: 0, agreedDeadline: day(-9),
        allocations: [{ weekStart: wk(-2), hours: 4 }],
        completedBy: 'maha', completedAt: stamp(day(-10), '15:00'), completionNote: 'Printed and posted in all houses (sample).',
        approval: { completedAt: stamp(day(-10), '15:00'), completedBy: 'maha', note: '', requestedAt: stamp(day(-10), '15:05'), requestedBy: 'maha', decision: 'approved', decidedBy: 'carla', decidedAt: stamp(day(-9), '09:30'), decisionNote: 'Clear and welcoming.' },
        history: [
          h(-16, '10:00', 'alicia', 'Request submitted', 'House rules poster refresh'),
          h(-12, '10:00', 'maha', 'Status changed', 'Scheduled → In progress'),
          h(-10, '15:00', 'maha', 'Status changed', 'In progress → Awaiting approval · Completed by Maha'),
          h(-10, '15:05', 'maha', 'Submitted for approval', 'Sent to Carla'),
          h(-9, '09:30', 'carla', 'Status changed', 'Awaiting approval → Complete · Approved by Carla · Closed · Clear and welcoming.')
        ]
      }),
      task({
        id: 'sample-camp-recap', requesterId: 'christine', title: 'Summer camp recap post',
        description: 'Fictional sample. Recap post with photos from summer camp.', project: 'Community Programs (sample)',
        deliverableType: 'Social media post or series', status: 'archived', archivedFrom: 'cancelled',
        history: [
          h(-30, '10:00', 'christine', 'Request submitted', 'Summer camp recap post'),
          h(-25, '11:00', 'christine', 'Status changed', 'Submitted → Cancelled · Photo consent forms not available.'),
          h(-20, '09:00', 'maha', 'Status changed', 'Cancelled → Archived · History kept')
        ]
      })
    ];

    const mtgBase = { counter: null, responseNote: '', taskId: null, location: '', sample: true };
    const meeting = (o) => Object.assign({}, mtgBase, o, { createdAt: o.history[0].at });
    const meetings = [
      meeting({ id: 'sample-m1', requesterId: 'carla', purpose: 'Weekly priorities check-in', date: day(0), start: '10:00', durationMin: 60, location: 'Carla\'s office', status: 'accepted',
        history: [h(-4, '09:00', 'carla', 'Meeting requested'), h(-4, '10:00', 'maha', 'Meeting confirmed')] }),
      meeting({ id: 'sample-m2', requesterId: 'lina', purpose: 'Fall appeal copy review', date: day(1), start: '14:00', durationMin: 60, location: 'Boardroom', status: 'accepted', taskId: 'sample-appeal',
        history: [h(-3, '11:00', 'lina', 'Meeting requested'), h(-3, '12:00', 'maha', 'Meeting confirmed')] }),
      meeting({ id: 'sample-m3', requesterId: 'christine', purpose: 'Winter brochure planning', date: day(8), start: '13:00', durationMin: 90, location: 'Program room', status: 'accepted', taskId: 'sample-brochure',
        history: [h(-2, '10:00', 'christine', 'Meeting requested'), h(-2, '11:30', 'maha', 'Meeting confirmed')] }),
      meeting({ id: 'sample-m4', requesterId: 'esperanca', purpose: 'Signage walk-through', date: day(9), start: '11:00', durationMin: 45, location: 'Main reception', status: 'pending', taskId: 'sample-signage',
        history: [h(-1, '15:00', 'esperanca', 'Meeting requested')] }),
      meeting({ id: 'sample-m5', requesterId: 'christine', purpose: 'Drop-in flyer quick review', date: day(8), start: '15:30', durationMin: 30, location: 'Video call (link to follow)', status: 'pending', taskId: 'sample-flyer',
        history: [h(0, '11:50', 'christine', 'Meeting requested')] }),
      meeting({ id: 'sample-m6', requesterId: 'sheila', purpose: 'Budget infographic kickoff', date: day(2), start: '09:00', durationMin: 30, location: 'Finance office', status: 'counter', taskId: 'sample-budget',
        counter: { date: day(7), start: '10:00', durationMin: 30 }, responseNote: 'This week is full. Could we meet Monday?',
        history: [h(-1, '09:30', 'sheila', 'Meeting requested'), h(0, '13:30', 'maha', 'New time proposed', D.fmtShort(day(7)) + ' 10 a.m.')] })
    ];

    const events = [
      { id: 'sample-e1', title: 'Community open house', date: day(3), start: '16:00', end: '19:00', notes: 'Fictional sample. Two hours fall outside regular hours; capacity is not increased.', createdBy: 'maha', createdAt: stamp(day(-7), '09:00'), sample: true },
      { id: 'sample-e2', title: 'Harvest Gala (evening)', date: day(12), start: '17:00', end: '22:00', notes: 'Fictional sample. Saturday evening event.', createdBy: 'maha', createdAt: stamp(day(-7), '09:05'), sample: true }
    ];

    const capacity = {};
    capacity[wk(1)] = { capacity: 30.2, social: 6, reason: 'Vacation day Friday (sample)', by: 'maha', at: stamp(day(-3), '09:00'), sample: true };

    const proposals = [
      {
        id: 'sample-p1', weekStart: wk(1), status: 'pending', triggerTaskId: null,
        reason: 'Maha is away Friday and the gala falls this week. Volunteer newsletter can go out a week later.',
        moves: [{ taskId: 'sample-volunteer-news', fromWeek: wk(1), toWeek: wk(2), hours: 10, proposedDeadline: day(18), previousDeadline: day(11) }],
        createdBy: 'carla', createdAt: stamp(day(1), '10:30'), decidedBy: null, decidedAt: null, decisionNote: '', sample: true
      },
      {
        id: 'sample-p0', weekStart: wk(-1), status: 'confirmed', triggerTaskId: 'sample-appeal',
        reason: 'Fall appeal comes first; installation date is flexible.',
        moves: [{ taskId: 'sample-signage', fromWeek: wk(-1), toWeek: wk(2), hours: 4, proposedDeadline: day(17), previousDeadline: day(-3), confirmedDeadline: day(17) }],
        createdBy: 'carla', createdAt: stamp(day(-6), '09:45'), decidedBy: 'maha', decidedAt: stamp(day(-5), '10:15'), decisionNote: 'Confirmed with Esperança.', sample: true
      }
    ];

    const log = [
      { at: stamp(day(-3), '09:00'), by: 'maha', action: 'Capacity adjusted', detail: 'Week of ' + D.fmtWeek(wk(1)) + ': 30.2 h capacity, 6 h social media · Vacation day Friday (sample)', ref: null },
      { at: stamp(day(-6), '09:45'), by: 'carla', action: 'Proposed schedule change', detail: 'Week of ' + D.fmtWeek(wk(-1)), ref: 'sample-p0' },
      { at: stamp(day(-5), '10:15'), by: 'maha', action: 'Confirmed schedule change', detail: 'Week of ' + D.fmtWeek(wk(-1)), ref: 'sample-p0' },
      { at: stamp(day(1), '10:30'), by: 'carla', action: 'Proposed schedule change', detail: 'Week of ' + D.fmtWeek(wk(1)), ref: 'sample-p1' }
    ];

    tasks.forEach((t) => { t.approvalRequired = t.requesterId !== 'maha'; });
    return { schemaVersion: 4, seededAt: now.toISOString(), seededWeek: w0, tasks, meetings, events, capacity, proposals, log };
  }

  WH.seed = { build, stamp };
})(globalThis.WH = globalThis.WH || {});
