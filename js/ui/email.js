/*
 * Simulated email: approval emails to Carla, a tool that simulates Carla's reply,
 * the reply-processing log, and notices to Maha and requesters.
 * NOTHING IS SENT OR RECEIVED. This page stands in for an email service.
 */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const D = WH.dates;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const EMAIL_STATUS = { awaiting_reply: 'Awaiting reply', decided: 'Decision received', decided_in_app: 'Decided in the app', superseded: 'Outdated (request changed)', expired: 'Expired' };
  const OUTCOMES = {
    applied: ['Applied', 'applied'],
    ambiguous: ['Unclear, still pending', 'ambiguous'],
    duplicate: ['Duplicate, ignored', 'ignored'],
    already_decided: ['Already decided, ignored', 'ignored'],
    superseded: ['Outdated, rejected', 'rejected'],
    expired: ['Expired, rejected', 'rejected'],
    rejected_sender: ['Sender not verified, rejected', 'rejected'],
    unknown_reference: ['Unknown reference, rejected', 'rejected']
  };

  const SAMPLE_REPLIES = {
    approve: 'Approve',
    decline: 'Decline\nPlease hold this until January.',
    quoted: 'approve\n\nThanks,\nCarla\n\n-----Original Message-----\nFrom: Communications Workspace\nTO DECIDE BY EMAIL: reply with the single word APPROVE or DECLINE',
    unclear: 'Looks OK but let me check with Lina first.'
  };

  function simulator(app, e) {
    const late = W.emailStatus(e) === 'awaiting_reply';
    return '<details class="action"><summary>Simulate Carla’s reply to this email</summary><div class="action-body">' +
      '<form data-form="sim-reply" data-token="' + esc(e.token) + '" novalidate>' +
      '<p class="small muted">Stands in for Carla’s email program and the email service. In real use, Carla would simply reply to the email.</p>' +
      '<div class="btn-row" style="margin-bottom:10px" role="group" aria-label="Fill in a sample reply">' +
      Object.keys(SAMPLE_REPLIES).map((k) => '<button type="button" class="btn small" data-action="sim-fill" data-kind="' + k + '">' +
        ({ approve: '“Approve”', decline: '“Decline” + reason', quoted: 'Approve with quoted history', unclear: 'Unclear reply' })[k] + '</button>').join('') + '</div>' +
      ui.field({ name: 'body', label: 'Reply text', type: 'textarea', rows: 5, value: 'Approve', id: 'sim-body-' + e.id }) +
      '<fieldset style="padding-top:8px"><legend class="label" style="font-family:var(--sans);font-size:0.9rem">Sender</legend>' +
      '<label class="check"><input type="radio" name="sender" value="carla" checked><span>Carla’s configured address (verified by the email service)</span></label>' +
      '<label class="check"><input type="radio" name="sender" value="spoof"><span>A different address using the display name “Carla Neto”</span></label></fieldset>' +
      (late ? ui.checkbox({ name: 'late', label: 'Arrives after the expiry date (' + D.fmtStamp(e.expiresAt) + ')', id: 'sim-late-' + e.id }) : '') +
      '<button type="submit" class="btn small primary">Process simulated reply</button></form></div></details>';
  }

  function emailCard(app, e) {
    const task = app.state.tasks.find((t) => t.id === e.taskId);
    const st = W.emailStatus(e);
    const open = app.ui.openEmail === e.id;
    return '<article class="email-sim" id="email-' + esc(e.id) + '" style="margin-bottom:16px">' +
      '<dl class="email-head"><dt>Status</dt><dd><span class="chip ' + (st === 'awaiting_reply' ? 'pending' : st === 'decided' ? 's-complete' : 's-cancelled') + '">' + esc(EMAIL_STATUS[st]) + '</span> <span class="sim-label">Simulated · not sent</span></dd>' +
      '<dt>To</dt><dd>Carla Neto &lt;' + (e.toAddress ? esc(e.toAddress) : '<em>address not configured</em>') + '&gt;</dd>' +
      '<dt>Subject</dt><dd><strong>' + esc(e.subject) + '</strong></dd>' +
      '<dt>Request</dt><dd>' + (task ? '<a href="#/tasks/' + encodeURIComponent(task.id) + '">' + esc(task.title) + '</a> · ' + ui.requestApprovalChip(task, true) : 'Removed') + '</dd>' +
      '<dt>Version</dt><dd>' + e.approvalVersion + (task && task.briefVersion !== e.approvalVersion ? ' <span class="muted">(request is now version ' + task.briefVersion + ')</span>' : '') + '</dd>' +
      '<dt>Created</dt><dd>' + esc(D.fmtStamp(e.sentAt)) + ' · expires ' + esc(D.fmtStamp(e.expiresAt)) + '</dd>' +
      '<dt>Reference</dt><dd><code>' + esc(e.token) + '</code></dd></dl>' +
      '<details' + (open ? ' open' : '') + '><summary style="padding:10px 16px;cursor:pointer;font-weight:600">Show email text</summary><pre class="email-body">' + esc(e.body) + '</pre></details>' +
      '<div style="padding:0 16px 6px">' + simulator(app, e) + '</div></article>';
  }

  WH.views.email = function (app) {
    const s = app.state;
    const emails = (s.emails || []).slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    const awaiting = emails.filter((e) => W.emailStatus(e) === 'awaiting_reply');
    const other = emails.filter((e) => W.emailStatus(e) !== 'awaiting_reply');
    const inbound = (s.inbound || []).slice().reverse();
    const notices = (s.notifications || []).slice().sort((a, b) => (a.at < b.at ? 1 : -1));
    const mine = notices.filter((n) => n.toUserId === app.user);

    return '<div class="page-head"><div><p class="eyebrow">Prototype simulation</p><h1>Simulated email</h1>' +
      '<p>What the real system would send to Carla for request approvals, and how her replies would be handled.</p></div></div>' +
      '<div class="callout warn"><p><strong>No email is sent or received.</strong> Carla’s address is not configured, and this prototype is not connected to the Women’s Habitat mail server. ' +
      'The messages below are records created inside this browser. Use “Simulate Carla’s reply” to test how replies would be handled. ' +
      'See <code>docs/before-real-use.md</code> for what IT needs to confirm.</p></div>' +
      '<div class="grid grid-main"><div>' +
      '<h2>Waiting for Carla’s reply <span class="muted small">(' + awaiting.length + ')</span></h2>' +
      (awaiting.length ? awaiting.map((e) => emailCard(app, e)).join('') : '<p class="empty">No approval emails are waiting for a reply.</p>') +
      '<h2 style="margin-top:28px">Earlier approval emails <span class="muted small">(' + other.length + ')</span></h2>' +
      '<p class="small muted">Replies to these are still processed, so you can test duplicates and outdated or expired replies.</p>' +
      (other.length ? other.map((e) => emailCard(app, e)).join('') : '<p class="empty">None yet.</p>') +
      '</div><div class="stack">' +
      '<section class="card" aria-labelledby="log-h"><div class="card-head"><h2 id="log-h">Reply processing log</h2></div>' +
      (inbound.length ? '<ul class="rows">' + inbound.map((r) => {
        const o = OUTCOMES[r.outcome] || [r.outcome, 'ignored'];
        const task = s.tasks.find((t) => t.id === r.taskId);
        return '<li><div class="row-line"><span class="outcome outcome-' + o[1] + '">' + esc(o[0]) + '</span><span class="small muted">' + esc(D.fmtStamp(r.at)) + '</span></div>' +
          '<div class="row-meta"><span>' + (task ? esc(task.title) : 'Unknown request') + '</span>' + (r.approvalVersion ? '<span>Email version ' + r.approvalVersion + '</span>' : '') +
          '<span>From “' + esc(r.displayName || '') + '”' + (r.authenticatedSender === W.SIMULATED_APPROVER ? ' (verified)' : ' (not verified)') + '</span></div>' +
          '<p class="small" style="margin:4px 0 0">' + esc(r.message) + '</p></li>';
      }).join('') + '</ul>' : '<p class="empty">No replies processed yet.</p>') + '</section>' +
      '<section class="card" aria-labelledby="ntc-h"><div class="card-head"><h2 id="ntc-h">Decision notices</h2></div>' +
      '<p class="small muted">Sent to Maha and the requester after each decision (simulated).' + (mine.length ? ' ' + mine.length + ' addressed to you.' : '') + '</p>' +
      (notices.length ? '<ul class="rows">' + notices.map((n) => '<li><div class="row-line"><span class="row-title small">To ' + esc(people.name(n.toUserId)) + '</span><span class="small muted">' + esc(D.fmtStamp(n.at)) + '</span></div>' +
        '<div class="small"><strong>' + esc(n.subject) + '</strong></div><p class="small" style="margin:2px 0 0">' + esc(n.text) + '</p></li>').join('') + '</ul>' : '<p class="empty">No notices yet.</p>') + '</section>' +
      '</div></div>';
  };

  WH.actions['open-email'] = (app, el) => { app.ui.openEmail = el.getAttribute('data-id'); app.go('#/email'); };

  WH.actions['sim-fill'] = (app, el) => {
    const form = el.closest('form');
    form.querySelector('textarea[name="body"]').value = SAMPLE_REPLIES[el.getAttribute('data-kind')];
  };

  WH.forms['sim-reply'] = (app, form, d) => {
    const token = form.getAttribute('data-token');
    const email = app.state.emails.find((e) => e.token === token);
    let result;
    try {
      // Simulated late arrival: process as if received one hour after expiry.
      if (d.late && email) W.setClock(() => new Date(new Date(email.expiresAt).getTime() + 3600000));
      result = W.processEmailReply(app.state, {
        token,
        authenticatedSender: d.sender === 'carla' ? W.SIMULATED_APPROVER : 'unverified:someone-else',
        displayName: 'Carla Neto',
        body: d.body
      });
    } finally {
      if (d.late) W.setClock(() => new Date());
    }
    WH.store.save(app.state);
    app.render();
    const o = OUTCOMES[result.outcome] || ['', 'ignored'];
    app.toast('Simulated reply: ' + result.message, o[1] === 'applied' ? '' : o[1] === 'rejected' ? 'error' : 'warn');
  };
})(globalThis.WH = globalThis.WH || {});
