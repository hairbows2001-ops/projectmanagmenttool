/* Welcome screen: demo profile selector (simulated access, NOT secure sign-in). */
(function (WH) {
  'use strict';

  const { esc } = WH.util;

  function profileButton(p) {
    return '<li><button type="button" class="profile-btn" data-action="enter-profile" data-id="' + esc(p.id) + '">' +
      '<span><span class="pname">' + esc(p.name) + '</span><span class="ptitle">' + esc(p.title) + '</span></span>' +
      '<span class="go" aria-hidden="true">→</span></button></li>';
  }

  WH.views.welcome = function () {
    const all = WH.people.PEOPLE;
    const main = all.filter((p) => p.main && p.role !== 'owner');
    const owner = all.filter((p) => p.role === 'owner');
    const others = all.filter((p) => !p.main);
    return '<main id="main" tabindex="-1" class="welcome">' +
      '<div class="welcome-head"><p class="eyebrow">Women’s Habitat of Etobicoke</p>' +
      '<h1>Communications <span class="highlight">Workspace</span></h1>' +
      '<p class="muted">Requests, workload and priorities for communications work, in one place.</p></div>' +
      '<section class="arch" aria-labelledby="choose">' +
      '<p class="eyebrow">Demo profile selector</p>' +
      '<h2 id="choose" style="text-align:center">Who are you?</h2>' +
      '<div class="callout warn small" role="note"><p><strong>Simulated access, not secure sign-in.</strong> Anyone using this prototype can choose any name. ' +
      'Real team use needs individual accounts. See <a href="#/about">About this prototype</a>.</p></div>' +
      '<h3 class="eyebrow group-label">Main users</h3><ul class="profile-list">' + main.map(profileButton).join('') + '</ul>' +
      '<h3 class="eyebrow group-label">Communications</h3><ul class="profile-list">' + owner.map(profileButton).join('') + '</ul>' +
      '<h3 class="eyebrow group-label">Other managers</h3><ul class="profile-list">' + others.map(profileButton).join('') + '</ul>' +
      '<p class="disclaimer">All tasks, meetings and dates in this prototype are fictional sample content.</p>' +
      '</section></main>';
  };

  WH.actions['enter-profile'] = (app, el) => {
    const id = el.getAttribute('data-id');
    if (!WH.people.get(id)) return;
    app.user = id;
    app.justEntered = true;
    WH.store.setProfile(id);
    app.go('#/home');
  };
})(globalThis.WH = globalThis.WH || {});
