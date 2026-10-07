/* About this prototype: what is real, what is simulated, where data lives. */
(function (WH) {
  'use strict';

  WH.views.about = function () {
    return '<div class="page-head"><div><p class="eyebrow">Read this first</p><h1>About this prototype</h1>' +
      '<p>A working local prototype for discussion. It is not ready for real workplace information.</p></div></div>' +
      '<div class="grid grid-2">' +
      '<section class="card alert"><h2>Simulated access</h2><p>The profile selector is <strong>not secure sign-in</strong>. Anyone using this browser can choose any name, including Carla. ' +
      'Permission rules are checked inside the browser, which prevents mistakes but cannot stop someone determined.</p>' +
      '<p>Real team use needs individual accounts, one-time invitation codes and server-side permission checks. See <code>docs/before-real-use.md</code>.</p></section>' +
      '<section class="card attention"><h2>Where data is saved</h2><p>Changes are saved in <strong>this browser on this computer only</strong> (browser local storage). They survive a refresh. ' +
      'Other people, other browsers and other computers do not see them. Clearing browser data erases them.</p>' +
      '<p><button type="button" class="btn small" data-action="reset-data">Reset to sample data</button></p></section>' +
      '<section class="card"><h2>Documents</h2><p>Uploaded files are stored in this browser’s own storage (IndexedDB), up to 10 MB each. They can be opened again here, but <strong>nobody else can open them</strong>. ' +
      'Sample documents are listed by name only and have no file attached.</p><p>Do not upload real client, resident, donor or staff information.</p></section>' +
      '<section class="card"><h2>Calendar and Outlook</h2><p>The calendar is internal to this app. It is <strong>not connected to Outlook</strong>, and nothing is sent to or read from the Women’s Habitat mail server. ' +
      'A later integration depends on how IT has set up Outlook (see <code>docs/before-real-use.md</code>).</p></section>' +
      '<section class="card"><h2>Sample content</h2><p>All tasks, meetings, events, comments and dates are <strong>fictional</strong>. They are there to demonstrate competing requests from Lina and Christine, a week over capacity, and Carla resolving it. Names and titles are used only to show the roles.</p></section>' +
      '<section class="card"><h2>Rules used</h2><ul class="small">' +
      '<li>Weekly capacity is 37.7 h; 6 h is reserved for social media, leaving 31.7 h.</li>' +
      '<li>Confirmed meetings and events use capacity. Evening and weekend events never add hours.</li>' +
      '<li>Task effort is allocated to specific weeks. Remaining effort is used for unfinished work.</li>' +
      '<li>Requests not yet scheduled are shown as potential impact, separate from committed hours.</li>' +
      '<li>Requests without an estimate show “Estimate needed” and are never counted as zero.</li>' +
      '<li>Managers request urgency; only Carla sets priority and approves work as Complete.</li>' +
      '<li>Carla proposes schedule changes; Maha confirms the dates. Nothing moves until confirmed.</li></ul></section>' +
      '</div>';
  };
})(globalThis.WH = globalThis.WH || {});
