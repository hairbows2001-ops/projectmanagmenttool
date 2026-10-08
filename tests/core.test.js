const test = require('node:test');
const assert = require('node:assert/strict');
const WH = require('./load');

const D = WH.dates;
const C = WH.capacity;
const W = WH.workflow;

// Fixed "now": Wednesday, October 7, 2026, 10 a.m. Toronto time.
const NOW = new Date('2026-10-07T14:00:00Z');
W.setClock(() => NOW);
const W0 = '2026-10-05';
const W1 = '2026-10-12';
const W2 = '2026-10-19';

function fresh() { return WH.seed.build(NOW); }
function emptyState() {
  return { schemaVersion: 3, tasks: [], meetings: [], events: [], capacity: {}, proposals: [], log: [] };
}

test('dates use Toronto time and Monday weeks', () => {
  assert.equal(D.todayISO(new Date('2026-10-08T03:30:00Z')), '2026-10-07'); // 11:30 p.m. in Toronto
  assert.equal(D.weekStart('2026-10-11'), W0); // Sunday belongs to the week starting Monday
  assert.deepEqual(D.weeksBetween('2026-10-07', '2026-10-20'), [W0, W1, W2]);
  assert.equal(D.isISODate('2026-02-30'), false);
});

test('standard week: 37.7 h capacity, 6 h social media, 31.7 h after social', () => {
  const s = C.weekSummary(emptyState(), W0, W0);
  assert.equal(s.capacity, 37.7);
  assert.equal(s.social, 6);
  assert.equal(s.afterSocial, 31.7);
  assert.equal(s.remaining, 31.7);
});

test('sample week 0 is over capacity by 2.3 h, with pending work shown separately', () => {
  const st = fresh();
  const s = C.weekSummary(st, W0, W0);
  assert.equal(s.meetingHours, 2);
  assert.equal(s.eventHours, 3);
  assert.equal(s.taskHours, 29);
  assert.equal(s.committed, 40);
  assert.equal(s.over, 2.3);
  // Christine's 4 h flyer + 1.2 h of Lina's e-newsletter spread over 5 weeks
  assert.equal(s.pendingHours, 5.2);
  assert.equal(s.potentialRemaining, -7.5);
});

test('sample week 1: adjusted capacity, social coverage not double counted, proposal preview', () => {
  const st = fresh();
  const s = C.weekSummary(st, W1, W0);
  assert.equal(s.capacity, 30.2);
  assert.equal(s.adjusted, true);
  assert.equal(s.taskHours, 20); // gala coverage (3 h) sits inside the social media reserve
  assert.equal(s.socialTasks.length, 1);
  assert.equal(s.eventHours, 5); // evening gala uses time, does not add capacity
  assert.equal(s.over, 2.3);
  assert.equal(s.proposedOut, 10);
  assert.equal(s.remainingIfProposalsConfirmed, 7.7);
  assert.equal(s.needsEstimate.length, 1); // Leslie's job posts
});

test('multi-week task counts only in its allocated weeks, using remaining effort', () => {
  const st = emptyState();
  st.tasks.push({ id: 't', status: 'in_progress', estimateHours: 20, remainingHours: 6,
    allocations: [{ weekStart: '2026-09-28', hours: 8 }, { weekStart: W0, hours: 8 }, { weekStart: W1, hours: 4 }] });
  assert.equal(C.hoursInWeek(st.tasks[0], '2026-09-28', W0), 8); // past week keeps plan
  assert.equal(C.hoursInWeek(st.tasks[0], W0, W0), 4); // 6 remaining shared 8:4
  assert.equal(C.hoursInWeek(st.tasks[0], W1, W0), 2);
  assert.equal(C.hoursInWeek(st.tasks[0], W2, W0), 0);
});

test('tasks without estimates are listed as needing an estimate, not counted as zero', () => {
  const st = fresh();
  const need = C.tasksNeedingEstimate(st).map((t) => t.id);
  assert.ok(need.includes('sample-budget'));
  assert.ok(need.includes('sample-job-posts'));
});

test('conflicts list committed and potential overloads', () => {
  const st = fresh();
  const list = C.conflicts(st, W0, 4);
  assert.equal(list[0].summary.weekStart, W0);
  assert.equal(list[0].kind, 'committed');
  assert.equal(list[1].summary.weekStart, W1);
});

test('creating a request: required fields, requester from profile, urgency is not priority', () => {
  const st = emptyState();
  assert.throws(() => W.createTask(st, 'lina', { title: '', description: '' }), (e) => !!(e.fields.title && e.fields.description));
  assert.throws(() => W.createTask(st, 'lina', { title: 'x', description: 'y', requestedUrgency: 'urgent' }), (e) => !!e.fields.urgencyReason);
  assert.throws(() => W.createTask(st, 'lina', { title: 'x', description: 'y', requestedDeadline: '2026-10-01' }), (e) => !!e.fields.requestedDeadline);
  const t = W.createTask(st, 'lina', { title: 'Post', description: 'Need a post', requestedUrgency: 'urgent', urgencyReason: 'Event' });
  assert.equal(t.requesterId, 'lina');
  assert.equal(t.status, 'submitted');
  assert.equal(t.priority, null);
  assert.equal(t.dateUnknown, true);
  assert.equal(t.history[0].action, 'Request submitted');
  assert.equal(t.history[0].by, 'lina');
});

test('managers edit only their own briefs; edits are recorded', () => {
  const st = fresh();
  assert.throws(() => W.updateBrief(st, 'christine', 'sample-appeal', { title: 'Hijack', description: 'x' }), WH.util.PermissionError);
  const t = W.updateBrief(st, 'lina', 'sample-enews', { title: 'November donor e-newsletter', description: 'Updated', requestedDeadline: '2026-11-02' });
  const last = t.history[t.history.length - 1];
  assert.equal(last.by, 'lina');
  assert.match(last.detail, /Description/);
});

test('full workflow: clarify, estimate, schedule, start, block, complete (no approval step)', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', { title: 'Flyer', description: 'A flyer', requestedDeadline: '2026-10-20' });
  assert.throws(() => W.requestClarification(st, 'carla', t.id, 'q'), WH.util.PermissionError);
  W.requestClarification(st, 'maha', t.id, 'What size?');
  assert.equal(t.status, 'clarification');
  W.provideInfo(st, 'christine', t.id, 'Letter size');
  assert.equal(t.status, 'submitted');
  assert.throws(() => W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 2 }] }), (e) => !!e.fields.estimate);
  assert.throws(() => W.setEstimate(st, 'maha', t.id, 0), (e) => !!e.fields.estimate);
  assert.throws(() => W.setEstimate(st, 'maha', t.id, -3), (e) => !!e.fields.estimate);
  W.setEstimate(st, 'maha', t.id, 5);
  assert.throws(() => W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 2 }] }), (e) => /match/.test(e.fields.allocations));
  assert.throws(() => W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-09', allocations: [{ weekStart: W0, hours: 3 }, { weekStart: W1, hours: 2 }] }), (e) => /after the agreed deadline/.test(e.fields.allocations));
  W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 3 }, { weekStart: W1, hours: 2 }] });
  assert.equal(t.status, 'scheduled');
  assert.equal(t.agreedDeadline, '2026-10-16');

  W.startWork(st, 'maha', t.id);
  W.setBlocked(st, 'maha', t.id, 'Waiting for photos');
  assert.throws(() => W.completeTask(st, 'maha', t.id), /block/i);
  W.clearBlocked(st, 'maha', t.id);
  // Only Maha marks work complete
  assert.throws(() => W.completeTask(st, 'carla', t.id), WH.util.PermissionError);
  assert.throws(() => W.completeTask(st, 'christine', t.id), WH.util.PermissionError);
  W.completeTask(st, 'maha', t.id, 'Printed');
  assert.equal(t.status, 'complete');
  assert.equal(t.remainingHours, 0);
  assert.equal(t.completedBy, 'maha');
  assert.match(t.history[t.history.length - 1].detail, /In progress → Complete/);
  assert.ok(t.history.length >= 8);
  assert.ok(t.history.every((h) => h.by && h.at && h.action));
});

test('invalid status transitions are refused', () => {
  const st = emptyState();
  const t = W.createTask(st, 'lina', { title: 'x', description: 'y' });
  assert.throws(() => W.startWork(st, 'maha', t.id), (e) => !!e.fields.status);
  assert.throws(() => W.completeTask(st, 'maha', t.id), (e) => !!e.fields.status); // must be In progress first
  assert.throws(() => W.archiveTask(st, 'maha', t.id), WH.util.PermissionError);
  W.cancelTask(st, 'lina', t.id, 'No longer needed');
  assert.equal(t.status, 'cancelled');
  W.archiveTask(st, 'maha', t.id);
  assert.equal(t.status, 'archived');
  assert.equal(st.tasks.length, 1); // history kept, nothing deleted
});

test('only Carla sets priority or proposes changes; only Maha confirms', () => {
  const st = fresh();
  assert.throws(() => W.setPriority(st, 'lina', 'sample-gala-posts', 'P1'), WH.util.PermissionError);
  assert.throws(() => W.setPriority(st, 'maha', 'sample-gala-posts', 'P1'), WH.util.PermissionError);
  W.setPriority(st, 'carla', 'sample-gala-posts', 'P1', 'Contractual');
  assert.throws(() => W.createProposal(st, 'maha', { weekStart: W0, reason: 'x', moves: [] }), WH.util.PermissionError);
  assert.throws(() => W.confirmProposal(st, 'carla', 'sample-p1', {}), WH.util.PermissionError);
});

test('proposal stays pending until Maha confirms; then work moves', () => {
  const st = fresh();
  const brochure = st.tasks.find((t) => t.id === 'sample-brochure');
  assert.throws(() => W.createProposal(st, 'carla', { weekStart: W0, reason: '', moves: [{ taskId: 'sample-brochure', toWeek: W2 }] }), (e) => !!e.fields.reason);
  const p = W.createProposal(st, 'carla', { weekStart: W0, reason: 'Sponsor posts are contractual', moves: [{ taskId: 'sample-brochure', toWeek: W2 }] });
  assert.equal(p.status, 'pending');
  assert.equal(p.moves[0].hours, 7);
  // Not applied yet
  assert.equal(C.hoursInWeek(brochure, W0, W0), 7);
  assert.equal(C.weekSummary(st, W0, W0).remainingIfProposalsConfirmed, 4.7);
  // Same task cannot get a second pending proposal
  assert.throws(() => W.createProposal(st, 'carla', { weekStart: W0, reason: 'x', moves: [{ taskId: 'sample-brochure', toWeek: W1 }] }), (e) => /pending/.test(e.fields.moves));

  W.confirmProposal(st, 'maha', p.id, { 'sample-brochure': '2026-10-23' }, 'OK');
  assert.equal(p.status, 'confirmed');
  assert.equal(C.hoursInWeek(brochure, W0, W0), 0);
  assert.equal(C.hoursInWeek(brochure, W2, W0), 7);
  assert.equal(brochure.agreedDeadline, '2026-10-23');
  assert.equal(C.weekSummary(st, W0, W0).over, 0);
});

test('declining a proposal needs a reason and leaves the schedule unchanged', () => {
  const st = fresh();
  assert.throws(() => W.declineProposal(st, 'maha', 'sample-p1', ''), (e) => !!e.fields.note);
  W.declineProposal(st, 'maha', 'sample-p1', 'Newsletter date is fixed by the volunteer fair');
  const t = st.tasks.find((x) => x.id === 'sample-volunteer-news');
  assert.equal(C.hoursInWeek(t, W1, W0), 10);
});

test('meetings: validation, accept counts toward capacity, counter-proposal flow', () => {
  const st = emptyState();
  assert.throws(() => W.requestMeeting(st, 'maha', { purpose: 'x', date: '2026-10-08', start: '10:00', durationMin: 30 }), WH.util.PermissionError);
  assert.throws(() => W.requestMeeting(st, 'lina', { purpose: 'x', date: '2026-10-08', start: '10:00', durationMin: 0 }), (e) => !!e.fields.durationMin);
  assert.throws(() => W.requestMeeting(st, 'lina', { purpose: 'x', date: '2026-10-08', start: '10:00', durationMin: 600 }), (e) => !!e.fields.durationMin);
  const m = W.requestMeeting(st, 'lina', { purpose: 'Review', date: '2026-10-08', start: '10:00', durationMin: 90 });
  assert.equal(C.weekSummary(st, W0, W0).meetingHours, 0);
  assert.equal(C.weekSummary(st, W0, W0).pendingHours, 1.5);
  W.respondMeeting(st, 'maha', m.id, 'accept');
  assert.equal(C.weekSummary(st, W0, W0).meetingHours, 1.5);

  const m2 = W.requestMeeting(st, 'christine', { purpose: 'Plan', date: '2026-10-08', start: '10:30', durationMin: 30 });
  assert.ok(W.meetingConflicts(st, m2.date, m2.start, m2.durationMin, m2.id).some((c) => /Overlaps/.test(c)));
  assert.ok(W.meetingConflicts(st, '2026-10-10', '10:00', 30).some((c) => /regular hours/.test(c)));
  W.respondMeeting(st, 'maha', m2.id, 'counter', { date: '2026-10-09', start: '11:00' });
  assert.throws(() => W.acceptCounter(st, 'lina', m2.id), WH.util.PermissionError);
  W.acceptCounter(st, 'christine', m2.id);
  assert.equal(m2.status, 'accepted');
  assert.equal(m2.date, '2026-10-09');
});

test('capacity adjustments: only Maha, cannot exceed 37.7, reason required', () => {
  const st = emptyState();
  assert.throws(() => W.setCapacity(st, 'carla', W1, { capacity: 30, social: 6, reason: 'x' }), WH.util.PermissionError);
  assert.throws(() => W.setCapacity(st, 'maha', W1, { capacity: 45, social: 6, reason: 'x' }), (e) => !!e.fields.capacity);
  assert.throws(() => W.setCapacity(st, 'maha', W1, { capacity: 30, social: 6, reason: '' }), (e) => !!e.fields.reason);
  assert.throws(() => W.setCapacity(st, 'maha', W1, { capacity: 4, social: 6, reason: 'x' }), (e) => !!e.fields.social);
  W.setCapacity(st, 'maha', W1, { capacity: 22.6, social: 3, reason: 'Two days leave' });
  assert.equal(C.weekSummary(st, W1, W0).remaining, 19.6);
});

test('events outside regular hours use time but never add capacity', () => {
  const st = emptyState();
  W.addEvent(st, 'maha', { title: 'Evening gala', date: '2026-10-10', start: '18:00', end: '22:00' });
  const s = C.weekSummary(st, W0, W0);
  assert.equal(s.capacity, 37.7);
  assert.equal(s.eventHours, 4);
  assert.equal(s.remaining, 27.7);
  assert.throws(() => W.addEvent(st, 'maha', { title: 'x', date: '2026-10-10', start: '18:00', end: '17:00' }), (e) => !!e.fields.end);
});

test('permission table: managers cannot act as Carla or Maha', () => {
  const can = WH.permissions.can;
  const task = { requesterId: 'lina', status: 'in_progress' };
  ['lina', 'christine', 'leslie', 'sheila', 'alicia', 'esperanca'].forEach((u) => {
    assert.equal(can(u, 'task.complete', task), false);
    assert.equal(can(u, 'task.setPriority', task), false);
    assert.equal(can(u, 'proposal.create'), false);
    assert.equal(can(u, 'task.schedule', task), false);
    assert.equal(can(u, 'view'), true);
  });
  assert.equal(can('christine', 'task.editBrief', { requesterId: 'lina', status: 'submitted' }), false);
  assert.equal(can('christine', 'task.comment', { requesterId: 'lina', status: 'submitted' }), false);
  assert.equal(can('lina', 'task.editBrief', { requesterId: 'lina', status: 'complete' }), false);
  assert.equal(can('nobody', 'view'), false);
});

test('no approval step blocks submitting, scheduling or completing, for any requester', () => {
  ['lina', 'christine', 'leslie', 'sheila', 'alicia', 'esperanca', 'carla', 'maha'].forEach((who) => {
    const st = emptyState();
    const t = W.createTask(st, who, { title: 'Request from ' + who, description: 'Something' });
    assert.equal(t.status, 'submitted', who);
    assert.equal(t.requestApproval, undefined, who);
    W.setEstimate(st, 'maha', t.id, 2);
    W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 2 }] });
    W.startWork(st, 'maha', t.id);
    W.completeTask(st, 'maha', t.id);
    assert.equal(t.status, 'complete', who);
  });
  assert.equal(W.STATUSES.awaiting_approval, undefined);
  assert.deepEqual(W.MAIN_FLOW, ['submitted', 'clarification', 'scheduled', 'in_progress', 'complete']);
  ['submitForApproval', 'approve', 'requestRevisions', 'decideRequest', 'processEmailReply'].forEach((fn) => assert.equal(W[fn], undefined, fn));
});

test('Carla keeps priorities and change proposals; Maha confirms dates', () => {
  const can = WH.permissions.can;
  assert.equal(can('carla', 'task.setPriority', { status: 'submitted' }), true);
  assert.equal(can('carla', 'proposal.create'), true);
  assert.equal(can('carla', 'proposal.confirm'), false);
  assert.equal(can('maha', 'proposal.confirm'), true);
  assert.equal(can('maha', 'task.complete', { status: 'in_progress' }), true);
  assert.equal(can('carla', 'task.complete', { status: 'in_progress' }), false);
});

test('sample data uses the simplified workflow', () => {
  const st = fresh();
  assert.equal(st.schemaVersion, 3);
  assert.ok(st.tasks.every((t) => W.STATUSES[t.status]));
  assert.equal(st.tasks.find((t) => t.id === 'sample-recognition').status, 'in_progress');
  assert.equal(st.emails, undefined);
});

test('migration from the approval version keeps data and history, and unblocks work', () => {
  // A saved state in the previous (version 2) format
  const st = fresh();
  st.schemaVersion = 2;
  const rec = st.tasks.find((t) => t.id === 'sample-recognition');
  rec.status = 'awaiting_approval';
  rec.approval = { submittedBy: 'maha', submittedAt: '2026-10-06T19:30:00Z', note: 'Ready', decision: null };
  const flyer = st.tasks.find((t) => t.id === 'sample-flyer');
  flyer.requestApproval = { status: 'pending', version: 1 };
  const budget = st.tasks.find((t) => t.id === 'sample-budget');
  budget.requestApproval = { status: 'declined', version: 2 };
  const brochure = st.tasks.find((t) => t.id === 'sample-brochure');
  brochure.requestApproval = { status: 'approved', version: 1 };
  st.emails = [{ id: 'e1', taskId: 'sample-flyer' }];
  const before = JSON.parse(JSON.stringify(st));
  const historyCounts = Object.fromEntries(st.tasks.map((t) => [t.id, t.history.length]));

  const result = WH.migrate.run(st, NOW);
  assert.equal(result.migrated, true);
  assert.equal(st.schemaVersion, 3);
  // Awaiting approval → In progress, with an explanatory note
  assert.equal(rec.status, 'in_progress');
  const note = rec.history[rec.history.length - 1];
  assert.equal(note.by, 'system');
  assert.match(note.detail, /Awaiting approval → In progress/);
  assert.match(note.detail, /completed-work approval was removed/);
  assert.equal(WH.people.name('system'), 'Workflow update');
  // Pending and declined request approvals get a note and no longer block
  assert.match(flyer.history[flyer.history.length - 1].detail, /no longer need Carla/);
  assert.match(budget.history[budget.history.length - 1].detail, /Declined/);
  assert.equal(brochure.history.length, historyCounts['sample-brochure']); // approved: nothing to add
  W.setEstimate(st, 'maha', 'sample-budget', 3);
  W.scheduleTask(st, 'maha', 'sample-budget', { agreedDeadline: '2026-10-30', allocations: [{ weekStart: W1, hours: 3 }] });
  assert.equal(budget.status, 'scheduled');
  // Maha can now complete the migrated task
  W.completeTask(st, 'maha', 'sample-recognition');
  assert.equal(rec.status, 'complete');
  // Nothing else lost: same tasks, earlier history entries intact, old records kept
  assert.equal(st.tasks.length, before.tasks.length);
  before.tasks.forEach((bt) => {
    const t = st.tasks.find((x) => x.id === bt.id);
    assert.deepEqual(t.history.slice(0, bt.history.length), bt.history);
    assert.equal(t.title, bt.title);
    assert.deepEqual(t.documents, bt.documents);
    assert.deepEqual(t.comments, bt.comments);
  });
  assert.deepEqual(st.emails, before.emails);
  assert.equal(st.meetings.length, before.meetings.length);
  // Running again does nothing
  assert.equal(WH.migrate.run(st, NOW).migrated, false);
});
