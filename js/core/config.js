/*
 * Settings for request approval and approval emails.
 * Change these here rather than in the rules code.
 */
(function (WH) {
  'use strict';

  WH.config = {
    requestApproval: {
      // Carla approves requests before Maha commits them to the schedule.
      approverId: 'carla',
      // These requesters skip request approval: Lina (agreed exception), Carla (the approver)
      // and Maha (her own work). Everyone else needs Carla's approval.
      exemptRequesters: ['lina', 'carla', 'maha'],
      // How long an approval email's reply code stays valid.
      replyExpiryDays: 7
    },
    email: {
      // Recipient of request-approval emails AND the only address allowed to approve or decline by
      // email reply. Compared without regard to upper/lower case. In production this belongs in the
      // server's settings, changeable by an administrator.
      approverAddress: 'CNeto@womens-habitat.ca',
      // Base web address for task links in emails, once the app is hosted. Unknown for now.
      appBaseUrl: null,
      // Real sending and reply processing. OFF: the prototype only creates simulated email records.
      // Turning this on has no effect until the server-side email integration exists
      // (see docs/before-real-use.md); the prototype will say so rather than pretend to send.
      integration: { enabled: false, provider: null }
    }
  };
})(globalThis.WH = globalThis.WH || {});
