/*
 * App shell: routing (#/page addresses), layout, saving after each change,
 * form error display and focus handling.
 *
 * Screens register themselves in WH.views (render functions), WH.actions (button clicks
 * with data-action="name") and WH.forms (form submits with data-form="name").
 */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const D = WH.dates;
  const ui = WH.ui;

  WH.views = WH.views || {};
  WH.actions = WH.actions || {};
  WH.forms = WH.forms || {};

  const team = () => WH.remote.isTeam();

  const app = {
    state: null,
    user: null,
    rev: 0,
    route: { name: 'welcome', params: [] },
    ui: {
      tasksView: 'list',
      filters: { requester: '', status: 'open', priority: '', project: '', from: '', to: '' },
      weekCursor: null,
      calView: 'month',
      calCursor: null,
      decisionWeek: null,
      capWeek: null,
      base: '#/home'
    }
  };
  WH.app = app;
  WH.panels = WH.panels || {};

  // ---------- routing ----------
  // Pages: home, tasks, calendar, about, welcome.
  // Panels open over the last page you were on: task details, new/edit request, priorities, new meeting.

  const ROUTES = [
    [/^\/?$/, 'root'],
    [/^\/welcome$/, 'welcome'],
    [/^\/home$/, 'home'],
    [/^\/tasks$/, 'tasks', { view: 'list' }],
    [/^\/tasks\/week$/, 'tasks', { view: 'week' }],
    [/^\/tasks\/board$/, 'tasks', { view: 'board' }],
    [/^\/tasks\/new$/, 'panel', { panel: 'requestForm' }],
    [/^\/tasks\/priorities$/, 'panel', { panel: 'priorities' }],
    [/^\/tasks\/([^/]+)\/edit$/, 'panel', { panel: 'requestForm' }],
    [/^\/tasks\/([^/]+)$/, 'panel', { panel: 'task' }],
    [/^\/calendar$/, 'calendar', { tab: 'calendar' }],
    [/^\/calendar\/meetings$/, 'calendar', { tab: 'meetings' }],
    [/^\/calendar\/leave$/, 'calendar', { tab: 'leave' }],
    [/^\/calendar\/meetings\/new$/, 'panel', { panel: 'meetingForm' }],
    [/^\/about$/, 'about'],
    [/^\/settings$/, 'settings'],
    [/^\/signin$/, 'signin'],
    [/^\/join\/([^/]+)$/, 'join'],
    [/^\/reset\/([^/]+)$/, 'reset']
  ];
  // Full-page screens without the navigation (demo profile picker; team sign-in and invitation pages).
  const SOLO = ['welcome', 'signin', 'join', 'reset'];

  // Older addresses keep working.
  const REDIRECTS = {
    '/dashboard': '#/home', '/workload': '#/tasks', '/decisions': '#/tasks/priorities', '/meetings': '#/calendar/meetings',
    '/meetings/new': '#/calendar/meetings/new', '/capacity': '#/calendar/leave', '/requests/new': '#/tasks/new'
  };

  function parseRoute() {
    const path = decodeURIComponent((location.hash || '#/').slice(1));
    for (const [re, name, extra] of ROUTES) {
      const m = path.match(re);
      if (m) return Object.assign({ name, params: m.slice(1), path }, extra || {});
    }
    return { name: 'notFound', params: [], path };
  }

  function go(hash) {
    if (location.hash === hash) render({ focus: true });
    else location.hash = hash;
  }
  app.go = go;

  function closePanel() { go(app.ui.base || '#/home'); }
  app.closePanel = closePanel;

  // ---------- layout ----------

  function navItems() {
    return [
      ['home', '#/home', 'Home', 'home'],
      ['tasks', '#/tasks', 'Tasks', 'list'],
      ['calendar', '#/calendar', 'Calendar', 'calendar']
    ];
  }

  function profileMenu(p) {
    const items = team()
      ? '<p class="menu-note" role="presentation">Private pilot workspace. Signed in as ' + esc(app.me ? app.me.email : p.name) + '.</p>' +
        (WH.permissions.isOwner(app.user) ? '<a role="menuitem" href="#/settings">Workspace settings</a>' : '') +
        '<a role="menuitem" href="#/about">About this workspace</a>' +
        '<button type="button" role="menuitem" data-action="sign-out">Sign out</button>'
      : '<p class="menu-note" role="presentation">Demo workspace: simulated sign-in. Changes are saved in this browser only.</p>' +
        '<button type="button" role="menuitem" data-action="switch-profile">Switch profile</button>' +
        '<a role="menuitem" href="#/about">About this prototype</a>' +
        '<button type="button" role="menuitem" data-action="export-demo-tasks">Export tasks to keep</button>' +
        '<button type="button" role="menuitem" data-action="reset-data">Reset sample data</button>';
    return '<div class="menu profile-menu">' +
      '<button type="button" class="profile-btn-top" data-action="menu-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="profile-menu">' +
      '<span class="avatar" aria-hidden="true">' + esc(p.first.charAt(0)) + '</span><span class="who"><strong>' + esc(p.name) + '</strong><small>' + esc(p.title) + '</small></span>' +
      '<span class="caret" aria-hidden="true">▾</span><span class="visually-hidden">Profile menu</span></button>' +
      '<div class="menu-list" id="profile-menu" role="menu" hidden>' + items + '</div></div>';
  }

  function shell(content, panelHtml) {
    const p = WH.people.get(app.user);
    const section = app.route.section;
    const nav = navItems().map(([key, href, label, ic]) =>
      '<li><a href="' + href + '"' + (section === key ? ' aria-current="page"' : '') + '>' + ui.icon(ic).replace('<svg', '<svg width="18" height="18"') +
      '<span>' + esc(label) + '</span></a></li>').join('');
    return '<div class="app-frame"' + (panelHtml ? ' inert' : '') + '>' +
      '<header class="topbar"><a class="brand" href="#/home"><span class="brand-name">Communications Workspace</span>' +
      '<span class="brand-org">Women’s Habitat of Etobicoke</span></a>' +
      (team()
        ? '<span class="demo-label pilot-label" title="Shared team workspace, private pilot. Do not enter client or resident information.">Private pilot</span>'
        : '<span class="demo-label" title="Simulated sign-in. All tasks, meetings and dates are fictional sample data, saved in this browser only.">Demo workspace<span class="demo-extra"> · fictional data</span></span>') +
      profileMenu(p) + '</header>' +
      '<div class="shell"><nav class="sidenav" aria-label="Main"><ul>' + nav + '</ul></nav>' +
      '<main id="main" tabindex="-1">' + content + '</main></div></div>' + (panelHtml || '');
  }

  function panelFrame(p) {
    return '<div class="panel-layer"><div class="panel-backdrop" data-action="close-panel" aria-hidden="true"></div>' +
      '<aside class="panel' + (p.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="panel-title">' +
      '<header class="panel-head"><div class="panel-titles">' + (p.eyebrow ? '<p class="eyebrow">' + esc(p.eyebrow) + '</p>' : '') +
      '<h2 id="panel-title" tabindex="-1">' + esc(p.title) + '</h2></div>' +
      '<button type="button" class="icon-btn" data-action="close-panel" aria-label="Close">' + ui.icon('x') + '</button></header>' +
      '<div class="panel-body" id="panel-body">' + p.html + '</div></aside></div>';
  }

  // ---------- rendering ----------

  function render(opts) {
    const o = opts || {};
    const root = document.getElementById('app');
    let route = parseRoute();
    if (REDIRECTS[route.path]) { location.replace(REDIRECTS[route.path]); return; }
    if (app.user && !WH.people.get(app.user)) app.user = null;
    const entry = team() ? 'signin' : 'welcome';
    const publicPages = team() ? ['signin', 'join', 'reset', 'about'] : ['welcome', 'about'];
    if (!team() && ['signin', 'join', 'reset', 'settings'].includes(route.name)) route = { name: 'welcome', params: [], path: '/welcome' };
    if (team() && route.name === 'welcome') route = { name: 'signin', params: [], path: '/signin' };
    if (route.name === 'root') route = Object.assign(route, { name: app.user ? 'home' : entry });
    if (!app.user && !publicPages.includes(route.name)) {
      if (team() && route.path && route.path !== '/') app.afterSignIn = '#' + route.path;
      route = { name: entry, params: [], path: '/' + entry };
    }
    if (app.user && team() && route.name === 'signin') route = Object.assign(parseRouteFrom('#/home'), {});
    app.route = route;

    // Remember the page under a panel, so closing returns there.
    if (['home', 'tasks', 'calendar'].includes(route.name)) app.ui.base = '#' + route.path;
    const baseRoute = route.name === 'panel' ? parseBase() : route;
    route.section = baseRoute.name;

    let html;
    let panelHtml = '';
    try {
      if (SOLO.includes(route.name)) {
        html = WH.views[route.name](app, route);
      } else if (!app.user) {
        html = '<main id="main" tabindex="-1" class="solo">' + WH.views.about(app) + '<p><a href="#/' + entry + '">' + (team() ? 'Back to sign in' : 'Back to profiles') + '</a></p></main>';
      } else if (route.name === 'notFound' || (route.name !== 'panel' && !WH.views[route.name])) {
        html = '<h1>Page not found</h1><p><a href="#/home">Back to Home</a></p>';
      } else {
        html = WH.views[baseRoute.name](app, baseRoute);
        if (route.name === 'panel') panelHtml = panelFrame(WH.panels[route.panel](app, route.params));
      }
    } catch (e) {
      console.error(e);
      html = '<div class="callout danger"><p>Something went wrong showing this page: ' + esc(e.message) + '</p></div>';
    }

    const scrollY = window.scrollY;
    const oldPanel = document.getElementById('panel-body');
    const panelScroll = oldPanel ? oldPanel.scrollTop : 0;
    const activeId = document.activeElement && document.activeElement.id;
    // Remember which collapsible sections were open, so a redraw of the same page keeps them.
    const samePage = app.lastPath === route.path;
    const sections = {};
    if (samePage) root.querySelectorAll('details[id]').forEach((d) => { sections[d.id] = d.open; });
    const typed = samePage && o.keepInputs ? keepTyped(root) : null;
    app.lastPath = route.path;
    root.innerHTML = (SOLO.includes(route.name) || !app.user) ? html : shell(html, panelHtml);
    Object.keys(sections).forEach((id) => { const d = document.getElementById(id); if (d) d.open = sections[id]; });
    root.querySelectorAll('form[data-form]').forEach((f) => { f.baseRev = app.rev; });
    if (typed) restoreTyped(root, typed, o.keepBase);
    document.body.classList.toggle('panel-open', !!panelHtml);
    document.title = pageTitle(route) + ' · Communications Workspace' + (team() ? '' : ' (demo)');

    const panelBody = document.getElementById('panel-body');
    if (o.focus) {
      if (panelHtml) {
        document.getElementById('panel-title').focus({ preventScroll: true });
      } else {
        window.scrollTo(0, 0);
        const h1 = root.querySelector('h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
    } else {
      window.scrollTo(0, scrollY);
      if (panelBody) panelBody.scrollTop = panelScroll;
      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) el.focus({ preventScroll: true });
        else if (panelHtml) document.getElementById('panel-title').focus({ preventScroll: true });
      }
    }
  }
  app.render = render;

  function parseRouteFrom(hash) {
    const path = hash.slice(1);
    for (const [re, name, extra] of ROUTES) {
      const m = path.match(re);
      if (m) return Object.assign({ name, params: m.slice(1), path }, extra || {});
    }
    return { name: 'home', params: [], path: '/home' };
  }

  // ---------- keeping typed text when the page is redrawn with newer data ----------

  const formKey = (f) => f.getAttribute('data-form') + '|' + (f.getAttribute('data-id') || '');

  /** Remembers what the person has typed or changed (and which revision the form started from). */
  function keepTyped(root) {
    const out = {};
    root.querySelectorAll('form[data-form]').forEach((f) => {
      const changed = [];
      Array.from(f.elements).forEach((el) => {
        if (!el.name || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked !== el.defaultChecked) changed.push({ name: el.name, value: el.value, checked: el.checked }); }
        else if (el.tagName === 'SELECT') { if (Array.from(el.options).some((o) => o.selected !== o.defaultSelected)) changed.push({ name: el.name, value: el.value }); }
        else if (el.value !== el.defaultValue) changed.push({ name: el.name, value: el.value, start: el.selectionStart, end: el.selectionEnd });
      });
      if (changed.length) out[formKey(f)] = { changed, baseRev: f.baseRev };
    });
    return out;
  }

  function restoreTyped(root, typed, keepBase) {
    root.querySelectorAll('form[data-form]').forEach((f) => {
      const k = typed[formKey(f)];
      if (!k) return;
      k.changed.forEach((c) => {
        const els = Array.from(f.elements).filter((el) => el.name === c.name);
        els.forEach((el) => {
          if (el.type === 'checkbox') { if (el.value === c.value) el.checked = c.checked; }
          else if (el.type === 'radio') { el.checked = el.value === c.value && c.checked; }
          else {
            el.value = c.value;
            if (el === document.activeElement && c.start !== null && c.start !== undefined) { try { el.setSelectionRange(c.start, c.end); } catch (e) { /* not a text field */ } }
          }
        });
      });
      // A form someone was already filling in keeps the revision it started from, so the
      // server can tell if someone else changed the same thing in the meantime.
      if (keepBase && k.baseRev !== undefined) f.baseRev = k.baseRev;
    });
  }

  function parseBase() {
    const hash = app.ui.base || '#/home';
    const path = decodeURIComponent(hash.slice(1));
    for (const [re, name, extra] of ROUTES) {
      const m = path.match(re);
      if (m && name !== 'panel') return Object.assign({ name, params: m.slice(1), path }, extra || {});
    }
    return { name: 'tasks', params: [], path: '/tasks', view: 'list' };
  }

  function pageTitle(route) {
    if (route.name === 'panel') return ({ task: 'Task', requestForm: 'Request', priorities: 'Priorities', meetingForm: 'Request a meeting' })[route.panel] || 'Details';
    return ({ welcome: 'Welcome', signin: 'Sign in', join: 'Create your account', reset: 'Choose a new password', settings: 'Workspace settings', home: 'Home', tasks: 'Tasks', calendar: 'Calendar',
      about: team() ? 'About this workspace' : 'About this prototype' })[route.name] || 'Page';
  }

  // ---------- changes ----------

  /**
   * Runs a change, saves, re-renders and shows a message.
   * Validation and permission errors are shown to the person instead of being swallowed.
   */
  /**
   * Applies a change. Demo: runs it and saves in this browser. Team workspace: sends it to the
   * server, which checks it again and saves it for everyone. Resolves with the change's result.
   */
  function apply(fn, opts) {
    const o = opts || {};
    if (team()) return WH.remote.apply(app, fn, o.base);
    let result;
    try {
      result = fn();
    } catch (e) {
      return Promise.reject(e);
    }
    if (!WH.store.save(app.state)) toast('Could not save in this browser. Changes will be lost on refresh.', 'error');
    return Promise.resolve(result);
  }
  app.apply = apply;

  function setBusy(form, busy) {
    if (!form) return;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    form.querySelectorAll('button[type="submit"]').forEach((b) => { b.disabled = busy; });
  }

  /**
   * Runs a change, saves, re-renders and shows a message.
   * Validation, permission and conflict errors are shown to the person instead of being swallowed.
   */
  function mutate(fn, message, opts) {
    const o = opts || {};
    const base = o.form && o.form.baseRev !== undefined ? o.form.baseRev : app.rev;
    setBusy(o.form, true);
    return apply(fn, { base }).then((result) => {
      if (o.go) go(o.go); else render();
      if (message) toast(typeof message === 'function' ? message(result) : message);
      const warnings = result && result.warnings;
      if (warnings && warnings.length) warnings.forEach((w) => toast(w, 'warn'));
      return result || true;
    }, (e) => {
      setBusy(o.form, false);
      handleError(e, o.form);
      return null;
    });
  }
  app.mutate = mutate;

  /** After a redraw, finds the form that replaced `old` (same form and item). */
  function sameForm(old) {
    if (!old) return null;
    const id = old.getAttribute('data-id');
    return document.querySelector('form[data-form="' + CSS.escape(old.getAttribute('data-form')) + '"]' + (id ? '[data-id="' + CSS.escape(id) + '"]' : ''));
  }

  function handleError(e, form) {
    if (e && e.name === 'SignInError') { signedOut(e.message); return; }
    if (e && e.name === 'ConflictError') {
      // Someone else changed the same thing: show the latest version, keep what this person typed.
      render({ keepInputs: true });
      const f = sameForm(form);
      if (f) {
        for (let d = f.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
        showErrors(f, { _conflict: e.message });
      } else toast(e.message, 'error');
      return;
    }
    if (e instanceof WH.util.ValidationError) {
      if (form) showErrors(form, e.fields);
      else toast(e.message, 'error');
    } else if (e instanceof WH.util.PermissionError) {
      toast(e.message, 'error');
    } else {
      console.error(e);
      toast('Something went wrong: ' + e.message, 'error');
    }
  }
  app.handleError = handleError;

  function clearErrors(form) {
    form.querySelectorAll('.field-error, .form-error').forEach((n) => n.remove());
    form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
    form.querySelectorAll('[aria-invalid]').forEach((n) => { n.removeAttribute('aria-invalid'); });
  }

  function showErrors(form, fields) {
    clearErrors(form);
    let firstControl = null;
    const unplaced = [];
    Object.keys(fields).forEach((key) => {
      const wrap = form.querySelector('[data-field="' + CSS.escape(key) + '"]');
      if (!wrap) { unplaced.push(fields[key]); return; }
      wrap.classList.add('invalid');
      // Open any collapsed section that hides the field, so the message can be seen.
      for (let d = wrap.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
      const msg = document.createElement('div');
      msg.className = 'field-error';
      msg.id = 'err-' + key.replace(/[^a-z0-9-]/gi, '') + '-' + Math.random().toString(36).slice(2, 7);
      msg.textContent = fields[key];
      wrap.appendChild(msg);
      const control = wrap.querySelector('input, select, textarea');
      if (control) {
        control.setAttribute('aria-invalid', 'true');
        const prev = (control.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && !x.startsWith('err-'));
        control.setAttribute('aria-describedby', prev.concat(msg.id).join(' '));
        if (!firstControl) firstControl = control;
      }
    });
    const summary = document.createElement('div');
    summary.className = 'form-error';
    summary.setAttribute('role', 'alert');
    const count = Object.keys(fields).length;
    summary.textContent = unplaced.length ? unplaced.join(' ') : (count === 1 ? 'Please fix the highlighted field.' : 'Please fix the ' + count + ' highlighted fields.');
    form.insertBefore(summary, form.firstChild);
    if (firstControl) firstControl.focus();
    else summary.scrollIntoView({ block: 'center' });
  }
  app.showErrors = showErrors;

  function toast(message, kind) {
    const region = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), kind === 'error' || kind === 'warn' ? 9000 : 4500);
  }
  app.toast = toast;

  /** Reads a form into a plain object. Checkboxes become true/false. */
  function formData(form) {
    const out = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'file') out[el.name] = el.files;
      else out[el.name] = el.value;
    });
    return out;
  }
  app.formData = formData;

  // ---------- events ----------

  function onClick(ev) {
    if (!ev.target.closest('.menu')) closeMenus();
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    if (el.closest('.menu-list')) closeMenus();
    const name = el.getAttribute('data-action');
    const handler = WH.actions[name];
    if (!handler) return;
    ev.preventDefault();
    handler(app, el, ev);
  }

  function onSubmit(ev) {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const handler = WH.forms[form.getAttribute('data-form')];
    if (!handler) return;
    clearErrors(form);
    handler(app, form, formData(form));
  }

  function onChange(ev) {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    const handler = WH.actions[el.getAttribute('data-change')];
    if (handler) handler(app, el, ev);
  }

  function onInput(ev) {
    const el = ev.target.closest('[data-input]');
    if (!el) return;
    const handler = WH.actions[el.getAttribute('data-input')];
    if (handler) handler(app, el, ev);
  }

  // ---------- menus (profile menu and row action menus) ----------

  function closeMenus(except) {
    document.querySelectorAll('.menu-list:not([hidden])').forEach((list) => {
      if (except && list === except) return;
      list.hidden = true;
      const btn = list.parentElement.querySelector('[data-action="menu-toggle"]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  WH.actions['menu-toggle'] = (a, btn) => {
    const list = btn.parentElement.querySelector('.menu-list');
    const opening = list.hidden;
    closeMenus(list);
    list.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    if (opening) {
      const first = list.querySelector('[role="menuitem"], [role="menuitemcheckbox"]');
      if (first) first.focus();
    }
  };

  function onKeydown(ev) {
    const list = ev.target.closest && ev.target.closest('.menu-list');
    if (ev.key === 'Escape') {
      if (list && !list.hidden) {
        ev.preventDefault();
        closeMenus();
        const btn = list.parentElement.querySelector('[data-action="menu-toggle"]');
        if (btn) btn.focus();
        return;
      }
      if (document.body.classList.contains('panel-open')) { ev.preventDefault(); closePanel(); }
      return;
    }
    if (list && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      const items = Array.from(list.querySelectorAll('[role^="menuitem"]'));
      const i = items.indexOf(document.activeElement);
      const next = items[(i + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      if (next) next.focus();
    }
    // Keep keyboard focus inside an open panel.
    if (ev.key === 'Tab' && document.body.classList.contains('panel-open')) {
      const panel = document.querySelector('.panel');
      const focusables = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex="-1"]'))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!panel.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }

  // ---------- shared actions ----------

  WH.actions['close-panel'] = () => closePanel();

  WH.actions['switch-profile'] = (a) => {
    a.user = null;
    WH.store.setProfile(null);
    go('#/welcome');
  };

  function signedOut(message) {
    if (team()) WH.remote.stopPolling();
    app.user = null;
    app.state = null;
    go('#/signin');
    if (message) toast(message, 'warn');
  }
  app.signedOut = signedOut;

  WH.actions['sign-out'] = () => {
    WH.remote.signOut(app).then(() => { go('#/signin'); toast('Signed out.'); });
  };

  WH.actions.reload = () => location.reload();

  WH.actions['skip-to-main'] = () => {
    const m = document.getElementById('main');
    if (m) m.focus();
  };

  WH.actions['reset-data'] = (a) => {
    if (!window.confirm('Reset all data to the original fictional sample? Your changes in this browser, including uploaded files, will be removed.')) return;
    a.state = WH.store.reset();
    toast('Sample data restored.');
    render({ focus: true });
  };

  // ---------- start ----------

  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('hashchange', () => render({ focus: true }));
  }

  function startTeam() {
    bindEvents();
    document.getElementById('app').innerHTML = '<main id="main" class="solo" tabindex="-1"><p class="muted">Opening the workspace…</p></main>';
    WH.remote.init(app).then(() => render({ focus: false })).catch((e) => {
      document.getElementById('app').innerHTML = '<main id="main" class="solo" tabindex="-1"><div class="callout danger"><p>' + esc(e.message) +
        '</p><p><button type="button" class="btn" data-action="reload">Try again</button></p></div></main>';
    });
  }

  function start() {
    if (team()) { startTeam(); return; }
    app.state = WH.store.load();
    app.user = WH.store.getProfile();
    if (app.user && !WH.people.get(app.user)) app.user = null;
    if (WH.store.wasMigrated()) {
      setTimeout(() => toast('Updated: Carla’s approval of completed work is back. Your saved tasks and history were kept.', 'warn'), 300);
    } else if (WH.store.wasUpgraded()) {
      setTimeout(() => toast('The prototype was updated. Sample data was refreshed.', 'warn'), 300);
    }
    if (!WH.store.storageOk()) {
      setTimeout(() => toast('This browser is blocking local storage. Changes will not be saved after refresh.', 'error'), 300);
    }
    bindEvents();
    // Keep tabs of the same browser in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === 'wh-comms-prototype-v1') { app.state = WH.store.load(); render(); }
    });
    render({ focus: false });
  }

  WH.start = start;
  WH.D = D;
})(globalThis.WH = globalThis.WH || {});
