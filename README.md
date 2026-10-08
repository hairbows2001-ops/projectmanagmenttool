# Communications Workspace (prototype)

**Women's Habitat of Etobicoke**: a local prototype to help managers request communications work, see Maha's workload, and help Carla decide what comes first.

> **This is a prototype.** Sign-in is simulated (anyone can choose any name), all content is fictional sample data, and changes are saved only in the browser you use. Do not enter real client, resident, donor or staff information. See [docs/before-real-use.md](docs/before-real-use.md).

---

## 1. How to open it

You don't need to install anything to look at it.

**Option A: double-click (simplest)**

1. Download or copy this folder to your computer.
2. Double-click `index.html`. It opens in your web browser (Chrome or Edge recommended).

**Option B: run a small local server (recommended if Option A has problems)**

Some browsers restrict saving files when a page is opened by double-clicking. If uploads don't work, use this:

1. Install [Node.js](https://nodejs.org) (the "LTS" version) if it isn't installed.
2. Open a terminal in this folder and run:
   ```
   npm start
   ```
3. Open <http://localhost:8080> in your browser.
4. Press `Ctrl+C` in the terminal to stop.

The server only accepts connections from your own computer, so nobody else on the network can open it.

**Running the automated checks** (optional): `npm test` runs the rule tests (capacity math, workflow and permissions) with no extra packages.

**Starting over:** use "Reset sample data" at the bottom of any page.

## 2. Try this walk-through

The app has three sections: **Home**, **Tasks** and **Calendar**. Your name at the top right opens the profile menu (switch profile, about this prototype, reset sample data). Task details, forms and priorities open in a panel on the right (full screen on a phone); press **Esc** or **×** to close it.

1. **Maha**: Home shows *Today*, this week's capacity (**40 h planned / 37.7 h available, 2.3 h over capacity**) and *Needs attention*. Tick a task in Today to mark it complete, or use the ••• menu to remove it from Today.
2. **Maha**: *View this week* (or Tasks → This week) lists everything scheduled this week. Use the ••• menu to add a task to Today.
3. **Carla**: Tasks shows a slim line about over-capacity weeks. Choose **Review priorities**, tick the work to move (for example, Christine's brochure), pick a week, give a reason and **Propose changes to Maha**. Nothing moves yet.
4. **Maha**: open the same Priorities panel and **Confirm these dates**. The schedule and deadlines update, with history.
5. **Lina** or **Christine**: **Request a task**. Only a title is needed; add a brief, optional details and attachments now or later.
6. **Maha**: open the request. The panel's top section shows the next step: estimate, then schedule, then **Start work**, then **Mark complete**. There is no approval step.
7. **Calendar**: month and week views, *Meetings* (answer or propose another time) and *Events & leave* (add events, reduce a week's capacity for leave).

## 3. What works

| Area | What you can do |
| --- | --- |
| Navigation | Three sections (Home, Tasks, Calendar); profile menu with switch profile, about and reset; a small "Demo workspace" label. Old links still work. |
| Home (Maha) | Compact greeting; Today list with completion checkboxes and an accessible ••• menu; one-bar weekly capacity with "View breakdown"; Needs attention (new requests, clarification, estimates, meeting requests, schedule changes, conflicts, blocked work). One primary button: **Create task**. |
| Home (managers) | Greeting; **Request a task** (primary) and **Request a meeting**; active requests with one status each; Maha's capacity summary; anything needing your input. Carla also sees conflicts, requests without a priority, and changes waiting for Maha. |
| Tasks | This week, All tasks (list) and Board. Status and requester filters, with priority, project and dates under *More filters*. Rows show title, requester, due date, one status and priority only when it is Critical or High. |
| Task details | Side panel (full screen on phones): next step first, then collapsible Brief, Schedule and effort, Documents and links, Comments, More actions, and Activity history. Sections stay open while you work in them. |
| Requests | Essentials (title, short brief, requested deadline or "Not known yet"), optional details, and attachments. Only the title is required; edit the brief and add documents, links and comments later. |
| Priorities | A panel within Tasks: changes waiting for Maha, the week's competing work, Carla's proposal form (move fields appear when a task is ticked) and earlier decisions. Carla proposes; Maha confirms the dates. |
| Calendar | Month and week views with tasks, deadlines (requested vs agreed), meetings (pending vs confirmed) and events. *Meetings* and *Events & leave* tabs. |
| Capacity | 37.7 h week, 6 h social media reserve, meetings, events and scheduled tasks; remaining or over. Unscheduled requests are shown separately. Maha can reduce a week's capacity for leave and add events. |
| Workflow | Submitted → Needs clarification → Scheduled → In progress → Complete, plus Blocked, Cancelled and Archived. All requests go directly to Maha; Maha marks work Complete. |
| History & saving | Every important action records who, what and when. Changes survive a refresh. |

### Capacity rules, in plain language

- Weekly capacity is **37.7 hours**. This is never worked out from the 9–5 window.
- **6 hours** are set aside every week for recurring social media work. Routine social requests can be marked "covered by social media time" so they are not counted twice.
- Task effort is split across the **specific weeks** Maha plans, so a three-week task doesn't all land in its deadline week.
- For unfinished work, the **remaining** estimate is used and spread over the current and future weeks of the plan.
- Requests not yet scheduled appear as **"Requested, not yet scheduled"** (potential impact), never mixed into committed hours.
- A request without an estimate shows **"Estimate needed"**. It is never counted as zero.

### If you used an earlier version

The first time you open this version, data saved in your browser is updated automatically and a message says so. Nothing is deleted: tasks that were *Awaiting approval* move back to *In progress* with a history note, and requests that were waiting for (or declined) approval get a note and can be scheduled normally.

## 4. What is simulated or incomplete

- **Sign-in is simulated.** Choosing a name is not authentication. Anyone can choose Carla. Permission rules are checked in the browser: they stop mistakes, not someone determined to bypass them.
- **Data is local to one browser on one computer.** It is not shared with anyone. Clearing browser data erases it.
- **Documents are stored in the browser only** (up to 10 MB each). They can be reopened on the same computer and browser, but nobody else can open them. Sample documents are names only, with no file.
- **No Outlook connection.** The calendar is internal. Nothing is sent to or read from the Women's Habitat mail server.
- **No email.** The app does not send or receive email. An earlier version simulated approval emails to Carla; approvals and that page were removed to keep the workflow simple (the code is kept in the project's history).
- **No notifications** (new request, clarification, meetings) are sent; people see updates when they open the app.
- **Time of day for tasks** isn't scheduled; effort is planned by week. Meetings and events have times.
- The heading font (Cormorant Garamond) loads from Google Fonts when online; offline it falls back to Palatino/Georgia. This is the only outside request the page makes.

## 5. Before real team use

See **[docs/before-real-use.md](docs/before-real-use.md)** for what's required for:

- secure individual accounts (one-time invitation codes, then personal sign-in, with Carla's permissions enforced on a server),
- shared, persistent document storage,
- a later Outlook integration, and the questions to confirm with IT.

## Project layout

```
index.html            The page that loads everything
css/styles.css        Visual design
js/core/              The rules: dates, people, permissions, capacity, workflow, sample data,
                      and migrate.js (updates data saved by earlier versions)
js/store.js           Saving in this browser (localStorage + IndexedDB for files)
js/app.js             Navigation, saving after each change, error messages
js/ui/                Screens: home.js, tasks.js, task.js (detail panel), forms.js, decisions.js
                      (priorities panel), calendar.js, meetings.js and capacity-view.js (Calendar tabs)
tests/                Automated rule tests (npm test)
serve.js              Optional local server (npm start)
PLAN.md               The implementation plan
docs/before-real-use.md
```
