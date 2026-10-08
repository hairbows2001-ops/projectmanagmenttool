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
      // NOT SET ON PURPOSE. Carla's real address must be confirmed and entered by an administrator
      // in the production system. The prototype never sends or receives email.
      approverAddress: null,
      // Base web address for task links in emails, once the app is hosted. Unknown for now.
      appBaseUrl: null
    }
  };
})(globalThis.WH = globalThis.WH || {});
