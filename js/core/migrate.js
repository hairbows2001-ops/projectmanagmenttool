/*
 * Updates data saved by earlier versions of the prototype, keeping tasks and history.
 *
 * Version 2 → 3 (workflow simplified):
 *  - No request approval and no completed-work approval. Maha marks work Complete.
 *  - Tasks that were "Awaiting approval" move back to "In progress" with a history note.
 *  - Requests that were pending or declined approval get a note; they no longer block scheduling.
 *  - Old approval fields and simulated email records are left in the saved data, unused.
 */
(function (WH) {
  'use strict';

  const CURRENT = 3;
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

  /** Returns { state, migrated } or null if the data is too old to update. */
  function run(state, now) {
    if (!state || typeof state !== 'object') return null;
    if (state.schemaVersion === CURRENT) return { state, migrated: false };
    if (state.schemaVersion === 2) {
      v2to3(state, (now || new Date()).toISOString());
      return { state, migrated: true };
    }
    return null;
  }

  WH.migrate = { CURRENT, run };
})(globalThis.WH = globalThis.WH || {});
