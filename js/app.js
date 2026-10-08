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

  const app = {
    state: null,
    user: null,
    route: { name: 'welcome', params: [] },
    ui: {
      workloadView: 'list',
      filters: { requester: '', status: 'open', priority: '', project: '', requestApproval: '', from: '', to: '' },
      calView: 'month',
      calCursor: null,
      decisionWeek: null
    },
    justEntered: false
  };
  WH.app = app;

  // ---------- routing ----------

  const ROUTES = [
    [/^\/?$/, 'home'],
    [/^\/welcome$/, 'welcome'],
    [/^\/dashboard$/, 'dashboard'],
    [/^\/workload$/, 'workload'],
    [/^\/calendar$/, 'calendar'],
    [/^\/capacity$/, 'capacity'],
    [/^\/decisions$/, 'decisions'],
    [/^\/meetings$/, 'meetings'],
    [/^\/meetings\/new$/, 'meetingForm'],
    [/^\/requests\/new$/, 'requestForm'],
    [/^\/tasks\/([^/]+)\/edit$/, 'requestForm'],
    [/^\/tasks\/([^/]+)$/, 'task'],
    [/^\/email$/, 'email'],
    [/^\/about$/, 'about']
  ];

  function parseRoute() {
    const path = decodeURIComponent((location.hash || '#/').slice(1));
    for (const [re, name] of ROUTES) {
      const m = path.match(re);
      if (m) return { name, params: m.slice(1), path };
    }
    return { name: 'notFound', params: [], path };
  }

  function go(hash) {
    if (location.hash === hash) render({ focus: true });
    else location.hash = hash;
  }
  app.go = go;

  // ---------- layout ----------

  function navItems() {
    const s = app.state;
    const cw = WH.workflow.currentWeek();
    const conflictCount = WH.capacity.conflicts(s, cw, 8).filter((c) => c.kind === 'committed').length +
      s.proposals.filter((p) => p.status === 'pending').length;
    const pendingMeetings = s.meetings.filter((m) => m.status === 'pending' || m.status === 'counter').length;
    return [
      ['dashboard', '#/dashboard', 'Dashboard', 'home'],
      ['workload', '#/workload', 'Shared workload', 'list'],
      ['calendar', '#/calendar', 'Calendar', 'calendar'],
      ['capacity', '#/capacity', 'Capacity', 'gauge'],
      ['decisions', '#/decisions', 'Priorities & decisions', 'scale', conflictCount],
      ['meetings', '#/meetings', 'Meetings', 'users', pendingMeetings],
      ['email', '#/email', 'Simulated email', 'mail', (s.emails || []).filter((e) => WH.workflow.emailStatus(e) === 'awaiting_reply').length],
      ['about', '#/about', 'About this prototype', 'info']
    ];
  }

  function shell(content) {
    const p = WH.people.get(app.user);
    const current = app.route.name === 'requestForm' || app.route.name === 'task' ? 'workload'
      : app.route.name === 'meetingForm' ? 'meetings' : app.route.name;
    const nav = navItems().map(([key, href, label, ic, count]) =>
      '<li><a href="' + href + '"' + (current === key ? ' aria-current="page"' : '') + '>' + ui.icon(ic).replace('<svg', '<svg width="18" height="18"') +
      '<span>' + esc(label) + '</span>' + (count ? '<span class="nav-count" aria-label="' + count + ' items">' + count + '</span>' : '') + '</a></li>').join('');
    const cta = p.role === 'owner'
      ? '<a class="btn accent" href="#/capacity">' + ui.icon('plus') + 'Add event or leave</a><a class="btn" href="#/requests/new">' + ui.icon('plus') + 'Add my own task</a>'
      : '<a class="btn primary" href="#/requests/new">' + ui.icon('plus') + 'Request a task</a><a class="btn" href="#/meetings/new">' + ui.icon('users') + 'Request a meeting</a>';
    return '<header class="topbar"><a class="brand" href="#/dashboard"><span class="brand-name">Communications Workspace</span>' +
      '<span class="brand-org">Women’s Habitat of Etobicoke</span></a>' +
      '<div class="profile-box"><div class="who"><strong>' + esc(p.name) + '</strong><small>' + esc(p.title) + '</small></div>' +
      '<button class="btn small" type="button" data-action="switch-profile">Switch profile</button></div></header>' +
      '<div class="shell"><nav class="sidenav" aria-label="Main"><ul>' + nav + '</ul><div class="nav-cta">' + cta + '</div></nav>' +
      '<main id="main" tabindex="-1">' + content + '</main></div>' + footer();
  }

  function footer() {
    return '<footer class="site-foot"><span>Prototype. Changes are saved <strong>only in this browser on this computer</strong>; other people do not see them.</span>' +
      '<span><button type="button" class="linklike" data-action="reset-data">Reset sample data</button></span></footer>';
  }

  function notice() {
    return '<div class="notice" role="note"><strong>Prototype</strong> · Simulated access, not secure sign-in · All content is fictional sample data · ' +
      'Saved in this browser only · <a href="#/about">Details</a></div>';
  }

  // ---------- rendering ----------

  function render(opts) {
    const o = opts || {};
    const root = document.getElementById('app');
    app.route = parseRoute();
    if (app.user && !WH.people.get(app.user)) app.user = null;

    let name = app.route.name;
    if (name === 'home') name = app.user ? 'dashboard' : 'welcome';
    if (!app.user && name !== 'welcome' && name !== 'about') name = 'welcome';
    app.route.name = name;

    let html;
    try {
      if (name === 'welcome') {
        html = WH.views.welcome(app);
      } else if (name === 'notFound' || !WH.views[name]) {
        html = '<div class="page-head"><div><h1 tabindex="-1">Page not found</h1><p><a href="#/dashboard">Back to your dashboard</a></p></div></div>';
      } else if (!app.user) {
        html = '<main id="main" tabindex="-1" style="max-width:900px;margin:0 auto">' + WH.views[name](app) + '<p><a href="#/welcome">Back to profiles</a></p></main>';
      } else {
        html = WH.views[name](app, app.route.params);
      }
    } catch (e) {
      console.error(e);
      html = '<div class="callout danger"><p>Something went wrong showing this page: ' + esc(e.message) + '</p></div>';
    }

    const scrollY = window.scrollY;
    const activeId = document.activeElement && document.activeElement.id;
    if (name === 'welcome' || !app.user) {
      root.innerHTML = notice() + html;
    } else {
      root.innerHTML = notice() + shell(html);
    }
    document.title = pageTitle(name) + ' · Communications Workspace (prototype)';

    if (o.focus) {
      const h1 = root.querySelector('h1');
      window.scrollTo(0, 0);
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    } else {
      window.scrollTo(0, scrollY);
      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) el.focus({ preventScroll: true });
      }
    }
    if (typeof WH.afterRender === 'function') WH.afterRender(app);
  }
  app.render = render;

  function pageTitle(name) {
    return ({
      welcome: 'Welcome', dashboard: 'Dashboard', workload: 'Shared workload', calendar: 'Calendar', capacity: 'Capacity',
      decisions: 'Priorities & decisions', meetings: 'Meetings', meetingForm: 'Request a meeting', requestForm: 'Request a task',
      task: 'Task', email: 'Simulated email', about: 'About this prototype'
    })[name] || 'Page';
  }

  // ---------- changes ----------

  /**
   * Runs a change, saves, re-renders and shows a message.
   * Validation and permission errors are shown to the person instead of being swallowed.
   */
  function mutate(fn, message, opts) {
    const o = opts || {};
    let result;
    try {
      result = fn();
    } catch (e) {
      handleError(e, o.form);
      return null;
    }
    const saved = WH.store.save(app.state);
    if (o.go) go(o.go); else render();
    if (!saved) toast('Could not save in this browser. Changes will be lost on refresh.', 'error');
    else if (message) toast(typeof message === 'function' ? message(result) : message);
    const warnings = result && result.warnings;
    if (warnings && warnings.length) warnings.forEach((w) => toast(w, 'warn'));
    return result || true;
  }
  app.mutate = mutate;

  function handleError(e, form) {
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
    const el = ev.target.closest('[data-action]');
    if (!el) return;
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
    if (ev.submitter && ev.submitter.name === 'decision') form.setAttribute('data-decision', ev.submitter.value);
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

  // ---------- shared actions ----------

  WH.actions['switch-profile'] = (a) => {
    a.user = null;
    WH.store.setProfile(null);
    go('#/welcome');
  };

  WH.actions['reset-data'] = (a) => {
    if (!window.confirm('Reset all data to the original fictional sample? Your changes in this browser, including uploaded files, will be removed.')) return;
    a.state = WH.store.reset();
    toast('Sample data restored.');
    render({ focus: true });
  };

  // ---------- start ----------

  function start() {
    app.state = WH.store.load();
    app.user = WH.store.getProfile();
    if (app.user && !WH.people.get(app.user)) app.user = null;
    if (WH.store.wasUpgraded()) {
      setTimeout(() => toast('The prototype was updated with request approval. Sample data was refreshed.', 'warn'), 300);
    }
    if (!WH.store.storageOk()) {
      setTimeout(() => toast('This browser is blocking local storage. Changes will not be saved after refresh.', 'error'), 300);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    window.addEventListener('hashchange', () => render({ focus: true }));
    // Keep tabs of the same browser in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === 'wh-comms-prototype-v1') { app.state = WH.store.load(); render(); }
    });
    render({ focus: false });
  }

  WH.start = start;
  WH.D = D;
})(globalThis.WH = globalThis.WH || {});
