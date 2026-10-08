/*
 * Tasks: the shared workload. Views: This week, All tasks (list) and Board.
 * Priority conflicts appear as one slim line that opens the Priorities panel.
 * Task details open in a side panel (see task.js).
 */
(function (WH) {
  'use strict';

  const { esc, fmtHours } = WH.util;
  const D = WH.dates;
  const C = WH.capacity;
  const W = WH.workflow;
  const ui = WH.ui;
  const people = WH.people;

  const OPEN = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval'];
  const PRIO = { P1: 0, P2: 1, P3: 2, P4: 3 };

  function applyFilters(tasks, f) {
    return tasks.filter((t) => {
      if (f.requester && t.requesterId !== f.requester) return false;
      if (f.status === 'open' && !OPEN.includes(t.status)) return false;
      if (f.status === 'all' && t.status === 'archived') return false;
      if (f.status === 'blocked' && !(t.blocked && OPEN.includes(t.status))) return false;
      if (f.status === 'estimate' && !(OPEN.includes(t.status) && !(t.estimateHours > 0))) return false;
      if (f.status && !['open', 'all', 'blocked', 'estimate'].includes(f.status) && t.status !== f.status) return false;
      if (f.priority === 'none' && (t.priority || !OPEN.includes(t.status))) return false;
      if (f.priority && f.priority !== 'none' && t.priority !== f.priority) return false;
      if (f.project && t.project !== f.project) return false;
      if (f.from || f.to) {
        const dates = [t.agreedDeadline, t.requestedDeadline].filter(Boolean);
        if (!dates.some((d) => (!f.from || d >= f.from) && (!f.to || d <= f.to))) return false;
      }
      return true;
    });
  }

  function sortTasks(list) {
    return list.slice().sort((a, b) => {
      const pa = a.priority ? PRIO[a.priority] : 9;
      const pb = b.priority ? PRIO[b.priority] : 9;
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
    const sel = (name, label, options) => ui.field({ name, label, type: 'select', value: f[name], options, id: 'flt-' + name }).replace('<select', '<select data-change="filter"');
    const more = ['priority', 'project', 'from', 'to'].filter((k) => f[k]).length;
    return '<form class="filters" aria-label="Filter tasks" onsubmit="return false">' +
      sel('status', 'Status', [opt('open', 'All open'), opt('all', 'All (not archived)'), opt('blocked', 'Blocked'), opt('estimate', 'Estimate needed')]
        .concat(Object.keys(W.STATUSES).map((k) => opt(k, W.STATUSES[k])))) +
      sel('requester', 'Requester', [opt('', 'Everyone')].concat(people.requesters().map((p) => opt(p.id, p.name)))) +
      '<details class="more-filters" id="more-filters"' + (more ? ' open' : '') + '><summary>More filters' + (more ? ' (' + more + ')' : '') + '</summary><div class="more-grid">' +
      sel('priority', 'Priority', [opt('', 'Any'), opt('none', 'No priority set')].concat(Object.keys(W.PRIORITIES).map((k) => opt(k, k + ' ' + W.PRIORITIES[k])))) +
      sel('project', 'Project', [opt('', 'All projects')].concat(projects.map((p) => opt(p, p)))) +
      ui.field({ name: 'from', label: 'Due from', type: 'date', value: f.from, id: 'flt-from' }).replace('<input', '<input data-change="filter"') +
      ui.field({ name: 'to', label: 'Due to', type: 'date', value: f.to, id: 'flt-to' }).replace('<input', '<input data-change="filter"') +
      '</div></details></form>';
  }

  /** One slim line about conflicts and pending decisions; opens the Priorities panel. */
  function prioritiesLine(app) {
    const s = app.state;
    const cw = W.currentWeek();
    const over = C.conflicts(s, cw, 8).filter((c) => c.kind === 'committed');
    const pending = s.proposals.filter((p) => p.status === 'pending').length;
    const parts = [];
    if (over.length) parts.push(over.length === 1 ? 'Week of ' + D.fmtWeek(over[0].summary.weekStart) + ' is ' + fmtHours(over[0].summary.over) + ' over capacity' : over.length + ' weeks are over capacity');
    if (pending) parts.push(pending + ' change' + (pending > 1 ? 's' : '') + ' waiting for Maha to confirm');
    if (!parts.length) return '<p class="prio-line ok"><span>No priority conflicts.</span><a href="#/tasks/priorities">Priorities</a></p>';
    const label = WH.permissions.isExec(app.user) ? 'Review priorities' : WH.permissions.isOwner(app.user) ? 'Review and confirm' : 'View priorities';
    return '<p class="prio-line">' + ui.icon('alert') + '<span>' + esc(parts.join(' · ')) + '</span><a class="btn small" href="#/tasks/priorities">' + label + '</a></p>';
  }

  function tabs(view) {
    const t = (key, href, label) => '<a href="' + href + '"' + (view === key ? ' aria-current="page"' : '') + '>' + label + '</a>';
    return '<nav class="tabs" aria-label="Task views">' + t('week', '#/tasks/week', 'This week') + t('list', '#/tasks', 'All tasks') + t('board', '#/tasks/board', 'Board') + '</nav>';
  }

  function weekView(app) {
    const s = app.state;
    const cw = W.currentWeek();
    const week = app.ui.weekCursor && app.ui.weekCursor >= cw ? app.ui.weekCursor : cw;
    const sum = C.weekSummary(s, week, cw);
    const today = W.today();
    const isMaha = WH.permissions.isOwner(app.user);
    const items = sum.tasks.concat(sum.socialTasks).sort((a, b) => {
      const pa = a.task.priority ? PRIO[a.task.priority] : 9;
      const pb = b.task.priority ? PRIO[b.task.priority] : 9;
      return pa - pb || ((a.task.agreedDeadline || '') < (b.task.agreedDeadline || '') ? -1 : 1);
    });
    const rows = items.map((x) => {
      const t = x.task;
      const inToday = (t.plannedDates || []).includes(today);
      return ui.taskRow(t, {
        meta: fmtHours(x.hours) + ' this week' + (t.coveredBySocial ? ' (social media time)' : '') + (inToday && week === cw ? ' · <strong>Today</strong>' : ''),
        menu: isMaha && week === cw && ['scheduled', 'in_progress'].includes(t.status) ? WH.todayRowMenu(t, inToday) : ''
      });
    });
    const statusText = sum.over > 0 ? '<span class="over-text">' + fmtHours(sum.over) + ' over capacity</span>' : fmtHours(sum.remaining) + ' remaining';
    return '<div class="week-nav"><button type="button" class="btn small" data-action="week-move" data-dir="-1"' + (week <= cw ? ' disabled' : '') + '>← Previous<span class="visually-hidden"> week</span></button>' +
      '<h2>Week of ' + esc(D.fmtWeek(week)) + '</h2>' +
      '<button type="button" class="btn small" data-action="week-move" data-dir="1">Next<span class="visually-hidden"> week</span> →</button></div>' +
      '<p class="week-summary">' + fmtHours(sum.committed) + ' planned / ' + fmtHours(sum.capacity) + ' available · ' + statusText +
      (sum.pendingHours ? ' · ' + fmtHours(sum.pendingHours) + ' requested, not scheduled' : '') + '</p>' +
      (rows.length ? '<ul class="tlist">' + rows.join('') + '</ul>' : '<p class="empty">No task hours scheduled this week.</p>') +
      (isMaha && week === cw ? '<p class="small muted">Use the ••• menu to add tasks to Today on Home.</p>' : '');
  }

  function board(tasks, f) {
    const cols = ['submitted', 'clarification', 'scheduled', 'in_progress', 'awaiting_approval', 'complete'];
    if (f.status === 'all' || f.status === 'cancelled') cols.push('cancelled');
    if (f.status === 'archived') cols.splice(0, cols.length, 'archived');
    return '<div class="board" aria-label="Tasks by status">' + cols.map((c) => {
      const items = tasks.filter((t) => t.status === c);
      return '<section class="board-col" aria-labelledby="col-' + c + '"><h3 id="col-' + c + '"><span>' + esc(W.STATUSES[c]) + '</span><span class="muted">' + items.length + '</span></h3>' +
        (items.length ? '<ul class="board-list">' + items.map((t) => '<li class="board-card"><a href="#/tasks/' + encodeURIComponent(t.id) + '">' + esc(t.title) + '</a>' +
          '<span class="trow-meta">' + esc(people.name(t.requesterId)) + ' · ' + esc(ui.dueText(t)) + '</span>' +
          ((t.blocked || ui.usefulPriority(t)) ? '<span class="chips">' + ui.blockedChip(t) + ui.usefulPriority(t) + '</span>' : '') + '</li>').join('') + '</ul>'
          : '<p class="empty small">None</p>') + '</section>';
    }).join('') + '</div>';
  }

  WH.views.tasks = function (app, route) {
    const view = route.view || 'list';
    app.ui.tasksView = view;
    const f = app.ui.filters;
    const primary = '<a class="btn primary" href="#/tasks/new">' + ui.icon('plus') + (WH.permissions.isOwner(app.user) ? 'Create task' : 'Request a task') + '</a>';
    let body;
    if (view === 'week') {
      body = weekView(app);
    } else {
      const tasks = sortTasks(applyFilters(app.state.tasks, f));
      const active = Object.keys(f).some((k) => f[k] && !(k === 'status' && f[k] === 'open'));
      body = filterBar(app) + '<p class="small muted results" aria-live="polite">' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') +
        (active ? ' · <button type="button" class="linklike" data-action="clear-filters">Clear filters</button>' : '') + '</p>' +
        (view === 'board' ? board(tasks, f) : ui.taskList(tasks, { empty: 'No tasks match these filters.' }));
    }
    return '<div class="page-head compact"><h1>Tasks</h1>' + primary + '</div>' + prioritiesLine(app) + tabs(view) + body;
  };

  WH.actions.filter = (app, el) => { app.ui.filters[el.name] = el.value; app.render(); };
  WH.actions['clear-filters'] = (app) => { app.ui.filters = { requester: '', status: 'open', priority: '', project: '', from: '', to: '' }; app.render(); };
  WH.actions['week-move'] = (app, el) => {
    const cw = W.currentWeek();
    const cur = app.ui.weekCursor && app.ui.weekCursor >= cw ? app.ui.weekCursor : cw;
    const next = D.addDays(cur, Number(el.getAttribute('data-dir')) * 7);
    app.ui.weekCursor = next < cw ? cw : next;
    app.render();
  };
})(globalThis.WH = globalThis.WH || {});
