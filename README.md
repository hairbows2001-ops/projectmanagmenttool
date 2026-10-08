# Communications Workspace

**Women's Habitat of Etobicoke**: helps managers request communications work, see Maha's workload, and helps Carla decide what comes first.

This project contains two separate versions of the same app:

| | **Demo** | **Team workspace** (private pilot) |
| --- | --- | --- |
| Purpose | Try the workflow with fictional sample data | Real use by a small pilot group |
| Sign-in | Pick any profile (simulated, not secure) | Personal accounts from single-use, expiring invitations |
| Permissions | Checked in the browser | Enforced by the server |
| Data | Saved in your browser only | Shared database and private document storage on the server |
| Start | Double-click `index.html` (or `npm run demo`) | `npm start` (or hosted: see [docs/hosting.md](docs/hosting.md)) |

They never share data. To keep tasks you made in the demo, export them from the demo and import them in the team workspace (Maha, under *Workspace settings*).

- **Setting up the pilot:** [docs/pilot-setup.md](docs/pilot-setup.md) (hosting choice, first accounts, checklist before inviting anyone)
- **Hosting options, accounts and costs:** [docs/hosting.md](docs/hosting.md)
- **Backups and recovery:** [docs/backup-and-recovery.md](docs/backup-and-recovery.md)
- **Before wider use:** [docs/before-real-use.md](docs/before-real-use.md)

Email, notifications and Outlook are **not** connected in either version.

---

## 1. How to open the demo

> The demo uses simulated sign-in and fictional sample data, saved only in your browser. Do not enter real information in it.

You don't need to install anything to look at it.

**Option A: double-click (simplest)**

1. Download or copy this folder to your computer.
2. Double-click `index.html`. It opens in your web browser (Chrome or Edge recommended).

**Option B: run the small demo server (recommended if Option A has problems)**

Some browsers restrict saving files when a page is opened by double-clicking. If uploads don't work, use this:

1. Install [Node.js](https://nodejs.org) (the "LTS" version) if it isn't installed.
2. Open a terminal in this folder and run:
   ```
   npm run demo
   ```
3. Open <http://localhost:8080> in your browser.
4. Press `Ctrl+C` in the terminal to stop.

The server only accepts connections from your own computer, so nobody else on the network can open it.

**Running the automated checks** (optional): `npm test` runs the rule tests (capacity math, workflow and permissions) and the team server tests (accounts, server-enforced permissions, private files, conflict protection, import, backup and restore). It needs Node.js 22.13 or newer and no extra packages.

**Starting over:** use "Reset sample data" at the bottom of any page.

## 2. Try this walk-through

The app has three sections: **Home**, **Tasks** and **Calendar**. Your name at the top right opens the profile menu (switch profile, about this prototype, reset sample data). Task details, forms and priorities open in a panel on the right (full screen on a phone); press **Esc** or **×** to close it.

1. **Maha**: Home shows *Today*, this week's capacity (**40 h planned / 37.7 h available, 2.3 h over capacity**) and *Needs attention*. Tick a task in Today to mark it finished, or use the ••• menu to remove it from Today. The line under the greeting (*3 new requests · 2 decisions needed · 1 awaiting approval · 2 weeks over capacity*) links to each section.
2. **Maha**: below *Needs attention*, **Conflicts & decisions** lists what is waiting on a decision (over-capacity weeks, Carla's proposed change, meeting requests, missing estimates). Beside it, **Completed work awaiting Carla's approval** shows the *Staff recognition week poster*: choose **Request approval** to send it to Carla.
3. **Carla**: Home shows the poster under *Completed work awaiting your approval*. Choose **Approve**: it shows *✓ Approved* for the rest of the day and is closed. (Or open it and **Request changes** to return it to Maha.)
4. **Maha**: *View this week* (or Tasks → This week) lists everything scheduled this week. Use the ••• menu to add a task to Today.
5. **Carla**: Tasks shows a slim line about over-capacity weeks. Choose **Review priorities**, tick the work to move (for example, Christine's brochure), pick a week, give a reason and **Propose changes to Maha**. Nothing moves yet.
6. **Maha**: open the same Priorities panel and **Confirm these dates**. The schedule and deadlines update, with history.
7. **Lina** or **Christine**: **Request a task**. Only a title is needed; add a brief, optional details and attachments now or later.
8. **Maha**: open the request. The panel's top section shows the next step: estimate, then schedule, then **Start work**, then **Mark complete**, then **Request approval** (managers' requests only).
9. **Calendar**: month and week views, *Meetings* (answer or propose another time) and *Events & leave* (add events, reduce a week's capacity for leave).

**Keeping tasks you made in the demo:** profile menu → **Export tasks to keep** downloads your own tasks (never the sample ones) with their documents, for Maha to import into the team workspace.

## 3. What works

| Area | What you can do |
| --- | --- |
| Navigation | Three sections (Home, Tasks, Calendar); profile menu with switch profile, about and reset; a small "Demo workspace" label. Old links still work. |
| Home (Maha) | Compact greeting; Today list with completion checkboxes and an accessible ••• menu; one-bar weekly capacity with "View breakdown"; Needs attention (a short summary whose rows jump to the sections below); **Conflicts & decisions** (over-capacity weeks and who must decide, Carla's proposed changes, meeting requests, missing estimates, blocked work); **Completed work awaiting Carla's approval**. One primary button: **Create task**. |
| Home (managers) | Greeting; **Request a task** (primary) and **Request a meeting**; active requests with one status each; Maha's capacity summary; anything needing your input. Carla also sees conflicts to decide, requests without a priority, changes waiting for Maha, and finished work to approve. |
| Tasks | This week, All tasks (list) and Board. Status and requester filters, with priority, project and dates under *More filters*. Rows show title, requester, due date, one status and priority only when it is Critical or High. |
| Task details | Side panel (full screen on phones): next step first, then collapsible Brief, Schedule and effort, Documents and links, Comments, More actions, and Activity history. Sections stay open while you work in them. |
| Requests | Essentials (title, short brief, requested deadline or "Not known yet"), optional details, and attachments. Only the title is required; edit the brief and add documents, links and comments later. |
| Priorities | A panel within Tasks: changes waiting for Maha, the week's competing work, Carla's proposal form (move fields appear when a task is ticked) and earlier decisions. Carla proposes; Maha confirms the dates. |
| Calendar | Month and week views with tasks, deadlines (requested vs agreed), meetings (pending vs confirmed) and events. *Meetings* and *Events & leave* tabs. |
| Capacity | 37.7 h week, 6 h social media reserve, meetings, events and scheduled tasks; remaining or over. Unscheduled requests are shown separately. Maha can reduce a week's capacity for leave and add events. |
| Workflow | Submitted → Needs clarification → Scheduled → In progress → Awaiting approval → Complete, plus Blocked, Cancelled and Archived. All requests go directly to Maha. Finished work on managers' requests waits for Carla's approval (Maha finishes it → sends it → Carla approves → closed, or Carla returns it with changes). Maha's own tasks close when she finishes them; either can switch this per task. |
| History & saving | Every important action records who, what and when. Changes survive a refresh. |

### Capacity rules, in plain language

- Weekly capacity is **37.7 hours**. This is never worked out from the 9–5 window.
- **6 hours** are set aside every week for recurring social media work. Routine social requests can be marked "covered by social media time" so they are not counted twice.
- Task effort is split across the **specific weeks** Maha plans, so a three-week task doesn't all land in its deadline week.
- For unfinished work, the **remaining** estimate is used and spread over the current and future weeks of the plan.
- Requests not yet scheduled appear as **"Requested, not yet scheduled"** (potential impact), never mixed into committed hours.
- A request without an estimate shows **"Estimate needed"**. It is never counted as zero.

### Team workspace (private pilot)

| Area | What it does |
| --- | --- |
| Accounts | Maha invites managers from *Workspace settings*. Each link works once and expires after 72 hours, and it is shown to copy, never emailed. Maha's and Carla's accounts are created from the server command line (`npm run admin`). Password reset links, and turning accounts off. |
| Permissions | The server runs the same rules as the screens for every change, as the signed-in person. A manager cannot approve, set priorities or schedule, even by tampering with the page. |
| Privacy | Everyone sees what Maha is working on (title, requester, status, dates, effort). The brief, comments, documents and history of a request are visible only to the requester, Maha and Carla. Documents are stored privately on the server and checked on every download. |
| Changes by two people | If someone else changed the same thing after you opened it, your change is refused, you see who changed what and when, and your typing is kept. Comments and other additions are merged. Open pages refresh every 15 seconds. |
| Data | One SQLite database file plus a documents folder (`DATA_DIR`, default `./data`). It starts empty: no sample data. |
| Import and export | Maha imports an export file (from the demo, or from another team workspace) after checking the list. Sample tasks are always skipped, and nothing is duplicated. |
| Backups | Daily automatic backups (14 kept), a one-click download for Maha, and restore by command or by placing `restore-this.tar` in the data folder. |

### If you used an earlier version

The first time you open this version, data saved in your browser is updated automatically and a message says so. Nothing is deleted. Requests that were waiting for (or declined) request approval get a note and can be scheduled normally. Finished work that an earlier update moved back to *In progress* returns to *Awaiting approval*, keeping its original "sent to Carla" time, with a history note.

## 4. What is simulated or not built yet

In the **demo**:

- **Sign-in is simulated.** Choosing a name is not authentication. Anyone can choose Carla. Permission rules are checked in the browser: they stop mistakes, not someone determined to bypass them.
- **Data is local to one browser on one computer.** It is not shared with anyone. Clearing browser data erases it.
- **Documents are stored in the browser only** (up to 10 MB each). They can be reopened on the same computer and browser, but nobody else can open them. Sample documents are names only, with no file.

In **both** versions:

- **No Outlook connection.** The calendar is internal. Nothing is sent to or read from the Women's Habitat mail server.
- **No email.** The app does not send or receive email. Carla approves completed work inside the app. An earlier version simulated approval emails to Carla; that page was removed (the code is kept in the project's history).
- **No notifications** (new request, clarification, meetings) are sent; people see updates when they open the app (the team workspace refreshes open pages every 15 seconds).
- **Time of day for tasks** isn't scheduled; effort is planned by week. Meetings and events have times.
- The heading font (Cormorant Garamond) loads from Google Fonts when online; offline it falls back to Palatino/Georgia. This is the only outside request the page makes.

## 5. Before wider use

The team workspace is ready for a private pilot. **[docs/before-real-use.md](docs/before-real-use.md)** lists what is in place and what is still needed before wider use: privacy review, stronger sign-in (second factor or Microsoft single sign-on), notifications, and the questions for IT about Outlook.

## Project layout

```
index.html            The page that loads everything (both versions)
css/styles.css        Visual design
js/core/              The rules: dates, people, permissions, capacity, workflow, sample data,
                      and migrate.js (updates data saved by earlier versions)
js/config.js          Says "demo"; the team server replaces it with "team"
js/store.js           Demo: saving in this browser (localStorage + IndexedDB for files)
js/remote.js          Team workspace: sends changes to the server, refreshes, uploads and downloads
js/app.js             Navigation, saving after each change, error messages
js/ui/                Screens: home.js, tasks.js, task.js (detail panel), forms.js, decisions.js
                      (priorities panel), calendar.js, meetings.js and capacity-view.js (Calendar tabs),
                      account.js (sign-in, invitation, reset), settings.js (Maha's workspace settings)
server/               Team workspace server: index.js (web and API), auth.js (accounts, invitations,
                      sessions), workspace.js (runs the rules, saves, conflict checks, privacy, import),
                      db.js (SQLite database), backup.js, admin.js (command line), config.js (settings)
tests/                Automated tests (npm test)
serve.js              Demo server (npm run demo)
Dockerfile, fly.toml  Hosting settings (not deployed)
PLAN.md               The implementation plan
docs/                 hosting.md, pilot-setup.md, backup-and-recovery.md, before-real-use.md
```
