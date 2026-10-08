/* Team workspace: sign in, create an account from an invitation, choose a new password from a reset link. */
(function (WH) {
  'use strict';

  const { esc } = WH.util;
  const ui = WH.ui;

  function page(title, body) {
    return '<main id="main" tabindex="-1" class="welcome account-page">' +
      '<div class="welcome-head"><p class="eyebrow">Women’s Habitat of Etobicoke</p>' +
      '<h1>Communications <span class="highlight">Workspace</span></h1></div>' +
      '<section class="arch account-card" aria-labelledby="acct-title"><h2 id="acct-title">' + esc(title) + '</h2>' + body + '</section>' +
      '<p class="disclaimer">Private pilot. Do not enter client, resident or donor personal information. <a href="#/about">About this workspace</a></p></main>';
  }

  const passwordFields = () =>
    ui.field({ name: 'password', label: 'Choose a password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 12 characters. A short sentence works well.' }) +
    ui.field({ name: 'confirm', label: 'Type it again', type: 'password', required: true, autocomplete: 'new-password' });

  WH.views.signin = function (app) {
    if (app.user) return page('You are signed in', '<p><a class="btn primary" href="#/home">Go to Home</a></p>');
    return page('Sign in', '<form data-form="signin" novalidate>' +
      ui.field({ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'username' }) +
      ui.field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }) +
      '<div class="btn-row form-actions"><button type="submit" class="btn primary">Sign in</button></div></form>' +
      '<p class="small muted">New here? Use the invitation link Maha sent you. Forgot your password? Ask Maha for a reset link.</p>');
  }

  // Invitation and reset pages first check the link with the server.
  function linkPage(app, route, kind) {
    const token = route.params[0];
    const key = kind + ':' + token;
    const info = app.ui.link && app.ui.link.key === key ? app.ui.link : null;
    if (app.user) {
      return page('You are already signed in', '<p>You are signed in as ' + esc(app.me ? app.me.name : '') + '. To use this link for someone else’s account, sign out first.</p>' +
        '<div class="btn-row"><a class="btn primary" href="#/home">Go to Home</a><button type="button" class="btn" data-action="sign-out">Sign out</button></div>');
    }
    if (!info) {
      app.ui.link = { key, loading: true };
      WH.remote.describeLink(kind, token).then((d) => { app.ui.link = { key, data: d }; app.render(); })
        .catch((e) => { app.ui.link = { key, error: e.message }; app.render(); });
      return page(kind === 'invite' ? 'Create your account' : 'Choose a new password', '<p class="muted">Checking your link…</p>');
    }
    if (info.loading) return page(kind === 'invite' ? 'Create your account' : 'Choose a new password', '<p class="muted">Checking your link…</p>');
    if (info.error) return page('This link cannot be used', '<div class="callout warn"><p>' + esc(info.error) + '</p></div><p><a href="#/signin">Go to sign in</a></p>');
    const d = info.data;
    if (kind === 'invite') {
      return page('Create your account', '<p>Welcome, <strong>' + esc(d.name) + '</strong>. You have been invited as <strong>' + esc(d.title) + '</strong>.</p>' +
        '<form data-form="join" data-id="' + esc(token) + '" novalidate>' +
        (d.email ? '<p>Your sign-in email: <strong>' + esc(d.email) + '</strong></p>'
          : ui.field({ name: 'email', label: 'Your work email', type: 'email', required: true, autocomplete: 'username', hint: 'You will use it to sign in.' })) +
        passwordFields() +
        '<div class="btn-row form-actions"><button type="submit" class="btn primary">Create my account</button></div></form>' +
        '<p class="small muted">This link works once. It expires ' + esc(WH.dates.fmtStamp(d.expiresAt)) + '</p>');
    }
    return page('Choose a new password', '<p>For <strong>' + esc(d.name) + '</strong> (' + esc(d.email) + '). You will be signed out everywhere else.</p>' +
      '<form data-form="reset" data-id="' + esc(token) + '" novalidate>' + passwordFields() +
      '<div class="btn-row form-actions"><button type="submit" class="btn primary">Save new password</button></div></form>');
  }

  WH.views.join = (app, route) => linkPage(app, route, 'invite');
  WH.views.reset = (app, route) => linkPage(app, route, 'reset');

  function busy(form, on) {
    form.querySelectorAll('button[type="submit"]').forEach((b) => { b.disabled = on; });
  }

  function failed(app, form, e) {
    busy(form, false);
    if (e instanceof WH.util.ValidationError) app.showErrors(form, e.fields);
    else app.showErrors(form, { _: e.message });
  }

  function enter(app, message) {
    const next = app.afterSignIn || '#/home';
    app.afterSignIn = null;
    app.ui.link = null;
    // Replace the link in the address bar so it is not left in the browser history.
    history.replaceState(null, '', next);
    app.render({ focus: true });
    if (message) app.toast(message);
  }

  WH.forms.signin = (app, form, d) => {
    busy(form, true);
    WH.remote.signIn(app, d.email, d.password).then(() => enter(app)).catch((e) => failed(app, form, e));
  };

  WH.forms.join = (app, form, d) => {
    busy(form, true);
    WH.remote.useLink(app, 'invite', form.getAttribute('data-id'), { email: d.email, password: d.password, confirm: d.confirm })
      .then(() => { app.afterSignIn = '#/home'; enter(app, 'Your account is ready. Welcome!'); }).catch((e) => failed(app, form, e));
  };

  WH.forms.reset = (app, form, d) => {
    busy(form, true);
    WH.remote.useLink(app, 'reset', form.getAttribute('data-id'), { password: d.password, confirm: d.confirm })
      .then(() => { app.afterSignIn = '#/home'; enter(app, 'Password changed.'); }).catch((e) => failed(app, form, e));
  };
})(globalThis.WH = globalThis.WH || {});
