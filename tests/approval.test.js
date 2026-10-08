const test = require('node:test');
const assert = require('node:assert/strict');
const WH = require('./load');

const W = WH.workflow;
const A = WH.approval;

const NOW = new Date('2026-10-07T14:00:00Z'); // Wed, Oct 7, 2026, 10 a.m. Toronto
W.setClock(() => NOW);
const W0 = '2026-10-05';
const CARLA = WH.config.email.approverAddress;

function emptyState() {
  return { schemaVersion: 2, tasks: [], meetings: [], events: [], capacity: {}, proposals: [], log: [], emails: [], notifications: [], inbound: [] };
}
const brief = (extra) => Object.assign({ title: 'Poster', description: 'A poster', requestedDeadline: '2026-10-20' }, extra || {});
const emailsFor = (st, t) => st.emails.filter((e) => e.taskId === t.id);
const reply = (st, email, body, sender) => W.processEmailReply(st, { token: email.token, authenticatedSender: sender || CARLA, displayName: 'Carla Neto', body });
function schedule(st, t) {
  W.setEstimate(st, 'maha', t.id, 2);
  return W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 2 }] });
}

test('Lina’s requests bypass request approval and go straight to Maha', () => {
  const st = emptyState();
  const t = W.createTask(st, 'lina', brief());
  assert.equal(t.requestApproval.status, 'not_required');
  assert.equal(st.emails.length, 0);
  W.requestClarification(st, 'maha', t.id, 'Which sizes?');
  W.provideInfo(st, 'lina', t.id, 'Letter');
  schedule(st, t);
  assert.equal(t.status, 'scheduled');
});

test('Carla’s own requests and Maha’s own tasks bypass request approval', () => {
  const st = emptyState();
  const c = W.createTask(st, 'carla', brief());
  const m = W.createTask(st, 'maha', brief({ title: 'Media list cleanup' }));
  assert.equal(c.requestApproval.status, 'not_required');
  assert.equal(m.requestApproval.status, 'not_required');
  assert.equal(st.emails.length, 0);
  schedule(st, c);
  schedule(st, m);
  assert.equal(c.status, 'scheduled');
  assert.equal(m.status, 'scheduled');
});

test('other managers’ requests are pending until Carla approves; Maha can still clarify and estimate', () => {
  const st = emptyState();
  ['christine', 'leslie', 'sheila', 'alicia', 'esperanca'].forEach((who) => {
    const t = W.createTask(st, who, brief({ title: 'Request from ' + who }));
    assert.equal(t.requestApproval.status, 'pending', who);
    assert.equal(emailsFor(st, t).length, 1, who);
  });
  const t = st.tasks[0];
  W.setEstimate(st, 'maha', t.id, 2); // allowed while pending
  assert.throws(() => W.scheduleTask(st, 'maha', t.id, { agreedDeadline: '2026-10-16', allocations: [{ weekStart: W0, hours: 2 }] }), (e) => /approve/.test(e.fields.requestApproval));
  assert.equal(t.status, 'submitted');
});

test('approval does not confirm the requested deadline; Maha still schedules', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  W.decideRequest(st, 'carla', t.id, 'approve');
  assert.equal(t.requestApproval.status, 'approved');
  assert.equal(t.status, 'submitted');
  assert.equal(t.agreedDeadline, null);
  assert.equal(t.allocations.length, 0);
});

test('only Carla decides requests in the app; decision recorded with channel and version; Maha and requester notified', () => {
  const st = emptyState();
  const t = W.createTask(st, 'alicia', brief());
  assert.throws(() => W.decideRequest(st, 'maha', t.id, 'approve'), WH.util.PermissionError);
  assert.throws(() => W.decideRequest(st, 'lina', t.id, 'approve'), WH.util.PermissionError);
  W.decideRequest(st, 'carla', t.id, 'decline', 'Not this quarter');
  assert.equal(t.requestApproval.status, 'declined');
  assert.equal(t.requestApproval.channel, 'in_app');
  const h = t.history[t.history.length - 1];
  assert.equal(h.action, 'Request declined');
  assert.match(h.detail, /Version 1 · In the app/);
  assert.deepEqual(st.notifications.map((n) => n.toUserId).sort(), ['alicia', 'maha']);
  assert.throws(() => schedule(st, t), (e) => /declined/.test(e.fields.requestApproval));
  assert.throws(() => W.decideRequest(st, 'carla', t.id, 'approve'), (e) => !!e.fields.requestApproval);
});

test('email reply "approve" applies only to its own request', () => {
  const st = emptyState();
  const a = W.createTask(st, 'christine', brief({ title: 'A' }));
  const b = W.createTask(st, 'sheila', brief({ title: 'B' }));
  const r = reply(st, emailsFor(st, a)[0], 'Approve\n\nOn Tue, Maha wrote:\n> reply APPROVE or DECLINE');
  assert.equal(r.outcome, 'applied');
  assert.equal(a.requestApproval.status, 'approved');
  assert.equal(a.requestApproval.channel, 'email_simulated');
  assert.equal(b.requestApproval.status, 'pending');
  assert.match(a.history.find((h) => h.action === 'Request approved').detail, /Version 1 · Email reply \(simulated\)/);
});

test('duplicate replies are ignored', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const email = emailsFor(st, t)[0];
  assert.equal(reply(st, email, 'approve').outcome, 'applied');
  const notices = st.notifications.length;
  assert.equal(reply(st, email, 'approve').outcome, 'duplicate');
  assert.equal(reply(st, email, 'decline').outcome, 'duplicate');
  assert.equal(t.requestApproval.status, 'approved');
  assert.equal(st.notifications.length, notices);
});

test('a reply to a second email of the same version, after a decision, is ignored', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const first = emailsFor(st, t)[0];
  const second = W.resendApprovalEmail(st, 'maha', t.id);
  assert.equal(reply(st, second, 'decline').outcome, 'applied');
  assert.equal(reply(st, first, 'approve').outcome, 'already_decided');
  assert.equal(t.requestApproval.status, 'declined');
});

test('reply after an in-app decision is ignored', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const email = emailsFor(st, t)[0];
  W.decideRequest(st, 'carla', t.id, 'approve');
  assert.equal(reply(st, email, 'decline').outcome, 'already_decided');
  assert.equal(t.requestApproval.status, 'approved');
});

test('material brief changes invalidate approval; outdated replies are rejected', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const v1 = emailsFor(st, t)[0];
  W.decideRequest(st, 'carla', t.id, 'approve');
  // Non-material change keeps approval
  W.updateBrief(st, 'christine', t.id, brief({ notes: 'Logo in shared drive' }));
  assert.equal(t.requestApproval.status, 'approved');
  assert.equal(t.briefVersion, 1);
  // Material change (requested deadline) resets approval
  W.updateBrief(st, 'christine', t.id, brief({ requestedDeadline: '2026-10-14', notes: 'Logo in shared drive' }));
  assert.equal(t.briefVersion, 2);
  assert.equal(t.requestApproval.status, 'pending');
  assert.equal(t.requestApproval.version, 2);
  assert.ok(t.history.some((h) => /earlier approval no longer applies/.test(h.detail)));
  const emails = emailsFor(st, t);
  assert.equal(emails.length, 2);
  assert.equal(emails[1].approvalVersion, 2);
  // The old version-1 email cannot approve version 2
  assert.equal(reply(st, v1, 'approve').outcome, 'superseded');
  assert.equal(t.requestApproval.status, 'pending');
  // A pending v1 email superseded by an edit is also rejected
  W.updateBrief(st, 'christine', t.id, brief({ title: 'Poster (large)', requestedDeadline: '2026-10-14', notes: 'Logo in shared drive' }));
  assert.equal(emails[1].status, 'superseded');
  assert.equal(reply(st, emails[1], 'approve').outcome, 'superseded');
  assert.equal(reply(st, emailsFor(st, t)[2], 'approve').outcome, 'applied');
  assert.equal(t.requestApproval.version, 3);
});

test('expired replies are rejected', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const email = emailsFor(st, t)[0];
  W.setClock(() => new Date(NOW.getTime() + 8 * 86400000));
  try {
    assert.equal(reply(st, email, 'approve').outcome, 'expired');
    assert.equal(t.requestApproval.status, 'pending');
  } finally {
    W.setClock(() => NOW);
  }
  // Maha can resend; the new email works
  const fresh = W.resendApprovalEmail(st, 'maha', t.id);
  assert.equal(reply(st, fresh, 'approve').outcome, 'applied');
});

test('sender must be Carla’s authenticated address, not just the display name', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const r = reply(st, emailsFor(st, t)[0], 'approve', 'someone-else@example.invalid');
  assert.equal(r.outcome, 'rejected_sender');
  assert.equal(t.requestApproval.status, 'pending');
  assert.equal(W.processEmailReply(st, { token: 'WH-NOPE', authenticatedSender: CARLA, body: 'approve' }).outcome, 'unknown_reference');
});

test('ambiguous replies stay pending', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  const email = emailsFor(st, t)[0];
  ['Looks fine to me', "I don't approve yet", 'Approve\nDecline', 'Approve\nActually, decline this', '', 'approved it already?'].forEach((body) => {
    assert.equal(reply(st, email, body).outcome, 'ambiguous', JSON.stringify(body));
  });
  assert.equal(t.requestApproval.status, 'pending');
  assert.equal(reply(st, email, 'APPROVE.').outcome, 'applied');
});

test('reply parsing ignores quoted history and signatures', () => {
  assert.equal(A.parseDecision('Decline\nNot a priority this month.\n\n-- \nCarla Neto\nExecutive Director').decision, 'decline');
  assert.equal(A.parseDecision('Decline\nNot a priority this month.').note, 'Not a priority this month.');
  assert.equal(A.parseDecision('Thanks\n\n-----Original Message-----\nFrom: x\nAPPROVE').decision, null);
  assert.equal(A.parseDecision('approve\n________________________________\nFrom: Communications\nreply DECLINE').decision, 'approve');
  assert.equal(A.parseDecision('  Approve!  \nSent from my iPhone').decision, 'approve');
  assert.equal(A.parseDecision('> approve').decision, null);
});

test('request approval is separate from completed-work approval', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  W.decideRequest(st, 'carla', t.id, 'approve');
  assert.equal(t.approval, null); // completed-work approval untouched
  schedule(st, t);
  W.startWork(st, 'maha', t.id);
  W.submitForApproval(st, 'maha', t.id);
  assert.equal(t.status, 'awaiting_approval');
  assert.equal(t.requestApproval.status, 'approved');
  // Approving the request again is not possible and does not complete the work
  assert.throws(() => W.decideRequest(st, 'carla', t.id, 'approve'));
  assert.equal(t.status, 'awaiting_approval');
  // Approval emails cannot complete work either
  assert.equal(reply(st, emailsFor(st, t)[0], 'approve').outcome, 'already_decided');
  assert.equal(t.status, 'awaiting_approval');
  // Only Carla's completed-work approval completes it
  W.approve(st, 'carla', t.id);
  assert.equal(t.status, 'complete');
  assert.equal(t.approval.decision, 'approved');

  // A Lina task (request approval not required) still needs Carla's completed-work approval
  const l = W.createTask(st, 'lina', brief({ title: 'Lina task' }));
  schedule(st, l);
  W.startWork(st, 'maha', l.id);
  W.submitForApproval(st, 'maha', l.id);
  assert.throws(() => W.approve(st, 'maha', l.id), WH.util.PermissionError);
  assert.equal(l.status, 'awaiting_approval');
  W.approve(st, 'carla', l.id);
  assert.equal(l.status, 'complete');
});

test('Carla\u2019s configured address receives approval emails and is matched without case sensitivity', () => {
  assert.equal(CARLA, 'CNeto@womens-habitat.ca');
  for (const variant of ['cneto@womens-habitat.ca', 'CNETO@WOMENS-HABITAT.CA', '  CNeto@Womens-Habitat.ca ']) {
    const st = emptyState();
    const t = W.createTask(st, 'christine', brief());
    assert.equal(emailsFor(st, t)[0].toAddress, 'CNeto@womens-habitat.ca');
    assert.equal(reply(st, emailsFor(st, t)[0], 'approve', variant).outcome, 'applied', variant);
  }
  // Look-alike addresses are rejected
  for (const other of ['cneto@womens-habitat.com', 'c.neto@womens-habitat.ca', 'cneto@womens-habitat.ca.example.invalid', '']) {
    const st = emptyState();
    const t = W.createTask(st, 'christine', brief());
    const r = W.processEmailReply(st, { token: emailsFor(st, t)[0].token, authenticatedSender: other, displayName: 'Carla Neto', body: 'approve' });
    assert.equal(r.outcome, 'rejected_sender', other);
    assert.equal(t.requestApproval.status, 'pending');
  }
});

test('the approver address is configurable; with none configured, email replies are refused', () => {
  const saved = WH.config.email.approverAddress;
  try {
    WH.config.email.approverAddress = 'Approvals.Test@example.invalid';
    let st = emptyState();
    let t = W.createTask(st, 'christine', brief());
    assert.equal(emailsFor(st, t)[0].toAddress, 'Approvals.Test@example.invalid');
    assert.equal(reply(st, emailsFor(st, t)[0], 'approve', saved).outcome, 'rejected_sender'); // old address no longer authorized
    assert.equal(reply(st, emailsFor(st, t)[0], 'approve', 'approvals.test@EXAMPLE.invalid').outcome, 'applied');

    WH.config.email.approverAddress = null;
    st = emptyState();
    t = W.createTask(st, 'christine', brief());
    const r = reply(st, emailsFor(st, t)[0], 'approve', saved);
    assert.equal(r.outcome, 'rejected_sender');
    assert.match(r.message, /No approver email address is configured/);
    W.decideRequest(st, 'carla', t.id, 'approve'); // in-app approval still works
    assert.equal(t.requestApproval.status, 'approved');
  } finally {
    WH.config.email.approverAddress = saved;
  }
});

test('emails stay simulated unless a real integration exists', () => {
  assert.equal(WH.config.email.integration.enabled, false);
  assert.equal(A.deliveryMode(), 'simulated');
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief());
  assert.equal(emailsFor(st, t)[0].simulated, true);
  assert.equal(emailsFor(st, t)[0].delivery, 'simulated');
  WH.config.email.integration.enabled = true;
  try {
    assert.equal(A.deliveryMode(), 'integration_unavailable'); // never claims to send from the prototype
  } finally {
    WH.config.email.integration.enabled = false;
  }
});

test('approval email contains the required content', () => {
  const st = emptyState();
  const t = W.createTask(st, 'christine', brief({ requestedUrgency: 'urgent', urgencyReason: 'Event Thursday' }));
  const e = emailsFor(st, t)[0];
  assert.equal(e.toAddress, 'CNeto@womens-habitat.ca');
  assert.equal(e.simulated, true);
  ['Christine Boeck', 'Poster', 'A poster', '#/tasks/' + t.id, 'Requested deadline', 'Event Thursday', 'Estimate pending', 'Capacity', 'APPROVE or DECLINE', e.token]
    .forEach((needle) => assert.ok(e.body.includes(needle), needle));
  W.setEstimate(st, 'maha', t.id, 6);
  assert.match(W.resendApprovalEmail(st, 'maha', t.id).body, /Estimated effort: 6 h/);
});

test('sample data: correct approval states per requester', () => {
  const st = WH.seed.build(NOW);
  const get = (id) => st.tasks.find((t) => t.id === id).requestApproval.status;
  assert.equal(get('sample-appeal'), 'not_required'); // Lina
  assert.equal(get('sample-annual'), 'not_required'); // Carla
  assert.equal(get('sample-flyer'), 'pending'); // Christine
  assert.equal(get('sample-budget'), 'pending'); // Sheila, version 2
  assert.equal(get('sample-brochure'), 'approved'); // scheduled earlier
  const outdated = st.emails.find((e) => e.taskId === 'sample-budget' && e.approvalVersion === 1);
  assert.equal(reply(st, outdated, 'approve').outcome, 'superseded');
});
