/*
 * Updates data saved by earlier versions of the prototype, keeping tasks and history.
 *
 * Version 2 → 3 (workflow simplified, later partly reversed by 3 → 4):
 *  - No request approval and no completed-work approval. Maha marks work Complete.
 *  - Tasks that were "Awaiting approval" move back to "In progress" with a history note.
 *  - Requests that were pending or declined approval get a note; they no longer block scheduling.
 *  - Old approval fields and simulated email records are left in the saved data, unused.
 */
(function (WH) {
  'use strict';

  const CURRENT = 4;
  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress'];

  function v2to3(state, at) {
    let moved = 0;
    let released = 0;
    state.tasks.forEach((t) => {
      if (t.status === 'awaiting_approval') {
        t.status = 'in_progress';
        t.history.push({
          at, by: 'system', action: 'Status changed', detail: 'Awaiting approval → In progress · Workflow simplified: completed-work approval was removed. ' +
            'Maha can now mark this task Complete (remaining effort ' + (t.remainingHours || 0) + ' h).'
        });
        moved += 1;
      }
      const ra = t.requestApproval;
      if (ra && (ra.status === 'pending' || ra.status === 'declined') && OPEN.includes(t.status)) {
        t.history.push({
          at, by: 'system', action: 'Request approval removed',
          detail: 'Workflow simplified: requests no longer need Carla’s approval. Earlier status "' + (ra.status === 'pending' ? 'Pending' : 'Declined') +
            '" no longer applies; Maha can review, estimate and schedule this request.'
        });
        released += 1;
      }
    });
    state.log = state.log || [];
    state.log.push({ at, by: 'system', action: 'Workflow simplified', detail: moved + ' task(s) moved from Awaiting approval to In progress; ' + released + ' request(s) no longer waiting for approval.', ref: null });
    state.migrations = (state.migrations || []).concat({ from: 2, to: 3, at, moved, released });
    state.schemaVersion = 3;
    return { moved, released };
  }

  /**
   * Version 3 → 4 (completed-work approval restored):
   *  - Managers' requests need Carla's approval of completed work (Maha's own tasks do not).
   *  - Tasks the version 3 update moved from "Awaiting approval" back to "In progress" are restored,
   *    keeping their original "sent to Carla" time.
   *  - The fictional poster that was finished but not closed waits for approval again.
   */
  function v3to4(state, at) {
    let restored = 0;
    state.tasks.forEach((t) => {
      if (t.approvalRequired === undefined) t.approvalRequired = t.requesterId !== 'maha';
      const wasMoved = t.status === 'in_progress' && (t.history || []).some((h) => h.by === 'system' && /completed-work approval was removed/.test(h.detail || ''));
      const sampleDone = t.status === 'in_progress' && t.sample && t.id === 'sample-recognition' && (t.remainingHours === 0);
      if (wasMoved || sampleDone) {
        const old = t.approval || {};
        const lastDone = (t.history || []).slice().reverse().find((h) => /Remaining effort updated|Awaiting approval/.test(h.action + ' ' + h.detail));
        const completedAt = old.submittedAt || (lastDone ? lastDone.at : at);
        t.approval = {
          completedAt, completedBy: 'maha', note: old.note || '', requestedAt: old.submittedAt || null, requestedBy: old.submittedAt ? 'maha' : null,
          decision: null, decidedBy: null, decidedAt: null, decisionNote: ''
        };
        t.completedAt = t.completedAt || completedAt;
        t.completedBy = t.completedBy || 'maha';
        t.status = 'awaiting_approval';
        t.history.push({ at, by: 'system', action: 'Status changed', detail: 'In progress → Awaiting approval · Completed-work approval restored: Carla approves finished work before it is closed.' });
        restored += 1;
      }
    });
    state.log = state.log || [];
    state.log.push({ at, by: 'system', action: 'Completed-work approval restored', detail: restored + ' task(s) waiting for Carla’s approval again.', ref: null });
    state.migrations = (state.migrations || []).concat({ from: 3, to: 4, at, restored });
    state.schemaVersion = 4;
    return { restored };
  }

  /** Returns { state, migrated } or null if the data is too old to update. */
  function run(state, now) {
    if (!state || typeof state !== 'object') return null;
    if (state.schemaVersion === CURRENT) return { state, migrated: false };
    const at = (now || new Date()).toISOString();
    if (state.schemaVersion === 2) v2to3(state, at);
    if (state.schemaVersion === 3) {
      v3to4(state, at);
      return { state, migrated: true };
    }
    return null;
  }

  WH.migrate = { CURRENT, run };
})(globalThis.WH = globalThis.WH || {});
