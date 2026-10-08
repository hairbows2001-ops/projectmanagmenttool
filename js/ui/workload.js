/* Shared workload: list and board views with filters. Everyone can view all task summaries. */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const D = WH.dates;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval'];

  function applyFilters(tasks, f) {
    return tasks.filter((t) => {
      if (f.requester && t.requesterId !== f.requester) return false;
      if (f.status === 'open' && !OPEN.includes(t.status)) return false;
      if (f.status === 'all' && t.status === 'archived') return false;
      if (f.status === 'blocked' && !t.blocked) return false;
      if (f.status && !['open', 'all', 'blocked', 'everything'].includes(f.status) && t.status !== f.status) return false;
      if (f.priority === 'none' && t.priority) return false;
      if (f.priority && f.priority !== 'none' && t.priority !== f.priority) return false;
      if (f.project && t.project !== f.project) return false;
      if (f.requestApproval && (!t.requestApproval || t.requestApproval.status !== f.requestApproval)) return false;
      if (f.from || f.to) {
        const dates = [t.agreedDeadline, t.requestedDeadline].filter(Boolean);
        const hit = dates.some((d) => (!f.from || d >= f.from) && (!f.to || d <= f.to));
        if (!hit) return false;
      }
      return true;
    });
  }

  function sortTasks(list) {
    const order = { P1: 0, P2: 1, P3: 2, P4: 3 };
    return list.slice().sort((a, b) => {
      const pa = a.priority ? order[a.priority] : 9;
      const pb = b.priority ? order[b.priority] : 9;
      if (pa !== pb) return pa - pb;
      const da = a.agreedDeadline || a.requestedDeadline || '9999';
      const db = b.agreedDeadline || b.requestedDeadline || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  function filterBar(app) {
    const f = app.ui.filters;
    const projects = Array.from(new Set(app.state.tasks.map((t) => t.project).filter(Boolean))).sort();
    const opt = (v, l) => ({ value: v, label: l });
    const sel = (name, label, options) => ui.field({ name, label, type: 'select', value: f[name], options, id: 'flt-' + name })
      .replace('<select', '<select data-change="filter"');
    return '<form class="card filters" aria-label="Filter tasks" onsubmit="return false">' +
      sel('requester', 'Requester', [opt('', 'Everyone')].concat(people.requesters().map((p) => opt(p.id, p.name)))) +
      sel('status', 'Status', [opt('open', 'All open'), opt('all', 'All (not archived)'), opt('blocked', 'Blocked')]
        .concat(Object.keys(W.STATUSES).map((k) => opt(k, W.STATUSES[k])))) +
      sel('priority', 'Priority', [opt('', 'Any'), opt('none', 'No priority set')].concat(Object.keys(W.PRIORITIES).map((k) => opt(k, k + ' ' + W.PRIORITIES[k])))) +
      sel('project', 'Project', [opt('', 'All projects')].concat(projects.map((p) => opt(p, p)))) +
      sel('requestApproval', 'Request approval', [opt('', 'Any')].concat(Object.keys(WH.approval.REQUEST_APPROVAL).map((k) => opt(k, WH.approval.REQUEST_APPROVAL[k])))) +
      ui.field({ name: 'from', label: 'Deadline from', type: 'date', value: f.from, id: 'flt-from' }).replace('<input', '<input data-change="filter"') +
      ui.field({ name: 'to', label: 'Deadline to', type: 'date', value: f.to, id: 'flt-to' }).replace('<input', '<input data-change="filter"') +
      '</form>';
  }

  function board(tasks, f) {
    const cols = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval', 'complete'];
    if (f.status === 'all' || f.status === 'cancelled') cols.push('cancelled');
    if (f.status === 'archived') cols.splice(0, cols.length, 'archived');
    return '<div class="board" role="list" aria-label="Task board by status">' + cols.map((c) => {
      const items = tasks.filter((t) => t.status === c);
      return '<section class="board-col" role="listitem" aria-labelledby="col-' + c + '"><h3 id="col-' + c + '"><span>' + ui.icon(ui.STATUS_ICONS[c]).replace('<svg', '<svg width="14" height="14"') + ' ' +
        esc(W.STATUSES[c]) + '</span><span>' + items.length + '</span></h3>' +
        (items.length ? items.map((t) => '<article class="board-card"><a href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' +
          '<div class="muted small">' + esc(people.name(t.requesterId)) + '</div>' +
          '<div class="small">Requested: ' + (t.requestedDeadline ? esc(D.fmtShort(t.requestedDeadline)) : 'not known') +
          ' · Agreed: ' + (t.agreedDeadline ? esc(D.fmtShort(t.agreedDeadline)) : '—') + '</div>' +
          '<div class="chips">' + ui.priorityChip(t) + ui.blockedChip(t) + ui.requestApprovalChip(t) + ui.urgencyChip(t) + '</div>' +
          '<div class="small" style="margin-top:6px">Effort: ' + ui.effortText(t) + '</div>' +
          (t.sample ? '<div class="small muted">Fictional sample</div>' : '') + '</article>').join('')
          : '<p class="empty small">None</p>') + '</section>';
    }).join('') + '</div>';
  }

  WH.views.workload = function (app) {
    const f = app.ui.filters;
    const tasks = sortTasks(applyFilters(app.state.tasks, f));
    const view = app.ui.workloadView;
    const active = Object.keys(f).some((k) => f[k] && !(k === 'status' && f[k] === 'open'));
    return '<div class="page-head"><div><p class="eyebrow">Everyone can see this</p><h1>Shared workload</h1>' +
      '<p>All requests to communications, sorted by Carla’s priority, then deadline.</p></div>' +
      '<div class="btn-row"><div class="segmented" role="group" aria-label="View">' +
      '<button type="button" data-action="workload-view" data-view="list" aria-pressed="' + (view === 'list') + '">List</button>' +
      '<button type="button" data-action="workload-view" data-view="board" aria-pressed="' + (view === 'board') + '">Board</button></div>' +
      (app.user !== 'maha' ? '<a class="btn primary" href="#/requests/new">' + ui.icon('plus') + 'Request a task</a>' : '') + '</div></div>' +
      filterBar(app) +
      '<p class="small muted" aria-live="polite">' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + ' shown' +
      (active ? ' · <button type="button" class="linklike" data-action="clear-filters">Clear filters</button>' : '') + '</p>' +
      (view === 'board' ? board(tasks, f) : '<div class="card">' + ui.taskTable(tasks, { empty: 'No tasks match these filters.', caption: 'Shared workload' }) + '</div>');
  };

  WH.actions.filter = (app, el) => {
    app.ui.filters[el.name] = el.value;
    app.render();
  };

  WH.actions['clear-filters'] = (app) => {
    app.ui.filters = { requester: '', status: 'open', priority: '', project: '', requestApproval: '', from: '', to: '' };
    app.render();
  };

  WH.actions['workload-view'] = (app, el) => {
    app.ui.workloadView = el.getAttribute('data-view');
    app.render();
  };
})(globalThis.WH = globalThis.WH || {});
