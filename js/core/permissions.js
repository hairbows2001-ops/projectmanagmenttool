/*
 * Permission rules: who may do what.
 *
 * IMPORTANT: in this prototype these checks run in the browser, so they protect against
 * mistakes, not against someone determined to bypass them. In a real team version the
 * same rules must run on a server that knows who is signed in (see docs/before-real-use.md).
 */
(function (WH) {
  'use strict';

  const CLOSED = ['complete', 'cancelled', 'archived'];

  function roleOf(userId) {
    const p = WH.people.get(userId);
    return p ? p.role : null;
  }

  const isOwner = (u) => roleOf(u) === 'owner';
  const isExec = (u) => roleOf(u) === 'executive';
  const isRequester = (u, item) => !!item && item.requesterId === u;

  /**
   * can(userId, action, item) -> boolean
   * `item` is the task, meeting or proposal the action applies to (if any).
   */
  function can(userId, action, item) {
    if (!roleOf(userId)) return false;
    switch (action) {
      // Everyone can view all task summaries, priorities, deadlines, effort and status.
      case 'view':
        return true;

      case 'task.create':
        return true;

      case 'task.editBrief':
        return isRequester(userId, item) && !CLOSED.includes(item.status);

      case 'task.comment':
      case 'task.addDocument':
        return (isRequester(userId, item) || isOwner(userId) || isExec(userId)) && item.status !== 'archived';

      case 'task.provideInfo':
        return item.status === 'clarification' && (isRequester(userId, item) || isOwner(userId));

      // Maha's workspace actions
      case 'task.requestClarification':
      case 'task.estimate':
      case 'task.schedule':
      case 'task.start':
      case 'task.block':
      case 'task.complete':
      case 'task.requestApproval':
      case 'task.setRemaining':
      case 'task.planToday':
      case 'proposal.confirm':
      case 'proposal.decline':
      case 'meeting.respond':
      case 'capacity.adjust':
      case 'event.manage':
        return isOwner(userId);

      // Carla's decisions
      case 'task.setPriority':
      case 'proposal.create':
      case 'task.approve':
        return isExec(userId);

      case 'task.setApprovalRequired':
        return (isOwner(userId) || isExec(userId)) && !CLOSED.includes(item.status) && item.status !== 'awaiting_approval';

      case 'task.cancel':
        return !CLOSED.includes(item.status) &&
          (isOwner(userId) || isExec(userId) || isRequester(userId, item));

      case 'task.archive':
        return (item.status === 'complete' || item.status === 'cancelled') &&
          (isOwner(userId) || isExec(userId));

      case 'meeting.request':
        return !isOwner(userId);

      case 'meeting.acceptCounter':
        return isRequester(userId, item) && item.status === 'counter';

      case 'meeting.withdraw':
        return isRequester(userId, item) && (item.status === 'pending' || item.status === 'counter' || item.status === 'accepted');

      default:
        return false;
    }
  }

  function assert(userId, action, item) {
    if (!can(userId, action, item)) {
      const who = WH.people.name(userId);
      throw new WH.util.PermissionError(who + ' does not have permission to do this (' + action + ').');
    }
  }

  WH.permissions = { can, assert, roleOf, isOwner, isExec };
})(globalThis.WH = globalThis.WH || {});
