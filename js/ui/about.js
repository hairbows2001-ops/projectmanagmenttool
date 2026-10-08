/* About this prototype: what is real, what is simulated, where data lives. */
(function (WH) {
  'use strict';

  function rules() {
    return '<section class="card"><h2>Rules used</h2><ul class="small">' +
      '<li>Weekly capacity is 37.7 h; 6 h is reserved for social media, leaving 31.7 h.</li>' +
      '<li>Confirmed meetings and events use capacity. Evening and weekend events never add hours.</li>' +
      '<li>Task effort is allocated to specific weeks. Remaining effort is used for unfinished work.</li>' +
      '<li>Requests not yet scheduled are shown as potential impact, separate from committed hours.</li>' +
      '<li>Requests without an estimate show “Estimate needed” and are never counted as zero.</li>' +
      '<li>All requests go directly to Maha for review, clarification, estimates and scheduling. Requests are not approved in advance.</li>' +
      '<li>Statuses: Submitted → Needs clarification → Scheduled → In progress → Awaiting approval → Complete, plus Blocked, Cancelled and Archived.</li>' +
      '<li>Finished work on managers’ requests needs Carla’s approval: Maha finishes it and sends it to Carla, Carla approves it (it is then closed) or returns it with changes. Maha’s own tasks are closed when she finishes them. Maha or Carla can switch this per task.</li>' +
      '<li>Managers request urgency; Carla, as lead manager, sets priorities and resolves competing requests.</li>' +
      '<li>Carla proposes schedule changes; Maha confirms the dates. Nothing moves until confirmed.</li></ul></section>';
  }

  function teamAbout() {
    return '<div class="page-head"><div><p class="eyebrow">Private pilot</p><h1>About this workspace</h1>' +
      '<p>The shared team workspace for communications requests. It is in a private pilot with a small group.</p></div></div>' +
      '<div class="grid grid-2">' +
      '<section class="card"><h2>Accounts and permissions</h2><p>Everyone has their own account, created from a single-use invitation link that expires. ' +
      'The server checks every change against the signed-in account: only Carla can set priorities and approve finished work, only Maha can schedule and confirm dates.</p></section>' +
      '<section class="card"><h2>Who sees what</h2><p>Everyone can see what Maha is working on: titles, who asked, status, dates and effort. ' +
      'The brief, comments, documents and history of a request are visible only to the person who asked, Maha and Carla.</p></section>' +
      '<section class="card"><h2>Where data is kept</h2><p>Tasks, comments, schedules, meetings, decisions and history are saved in a shared database on the workspace server. ' +
      'Documents are stored privately on the server and can be opened only by people allowed to see that request. Backups are made daily.</p></section>' +
      '<section class="card attention"><h2>Not connected yet</h2><p>No email is sent and there are no notifications: people see updates when they open the app (it refreshes every few seconds while open). ' +
      'It is <strong>not connected to Outlook</strong>. Do not enter client, resident or donor personal information during the pilot.</p></section>' +
      '<section class="card"><h2>If two people change the same thing</h2><p>Nothing is overwritten silently. If someone else changed the same item after you opened it, your change is not saved, ' +
      'you see who changed what, and what you typed stays on the form so you can check and try again.</p></section>' +
      rules() + '</div>';
  }

  WH.views.about = function () {
    if (WH.remote.isTeam()) return teamAbout();
    return '<div class="page-head"><div><p class="eyebrow">Read this first</p><h1>About this prototype</h1>' +
      '<p>A working local prototype for discussion. It is not ready for real workplace information.</p></div></div>' +
      '<div class="grid grid-2">' +
      '<section class="card alert"><h2>Simulated access</h2><p>The profile selector is <strong>not secure sign-in</strong>. Anyone using this browser can choose any name, including Carla. ' +
      'Permission rules are checked inside the browser, which prevents mistakes but cannot stop someone determined.</p>' +
      '<p>The separate team workspace has individual accounts and server-side permission checks. This demo never shares data with it, unless you export tasks and Maha imports them.</p></section>' +
      '<section class="card attention"><h2>Where data is saved</h2><p>Changes are saved in <strong>this browser on this computer only</strong> (browser local storage). They survive a refresh. ' +
      'Other people, other browsers and other computers do not see them. Clearing browser data erases them.</p>' +
      '<p><button type="button" class="btn small" data-action="reset-data">Reset to sample data</button></p></section>' +
      '<section class="card"><h2>Documents</h2><p>Uploaded files are stored in this browser’s own storage (IndexedDB), up to 10 MB each. They can be opened again here, but <strong>nobody else can open them</strong>. ' +
      'Sample documents are listed by name only and have no file attached.</p><p>Do not upload real client, resident, donor or staff information.</p></section>' +
      '<section class="card"><h2>Calendar and Outlook</h2><p>The calendar is internal to this app. It is <strong>not connected to Outlook</strong>, and nothing is sent to or read from the Women’s Habitat mail server. ' +
      'A later integration depends on how IT has set up Outlook (see <code>docs/before-real-use.md</code>).</p></section>' +
      '<section class="card"><h2>Sample content</h2><p>All tasks, meetings, events, comments and dates are <strong>fictional</strong>. They are there to demonstrate competing requests from Lina and Christine, a week over capacity, and Carla resolving it. Names and titles are used only to show the roles.</p></section>' +
      rules() +
      '</div>';
  };
})(globalThis.WH = globalThis.WH || {});
