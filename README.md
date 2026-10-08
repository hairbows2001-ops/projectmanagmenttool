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

The sample data is set up so you can act out the main scenario:

1. **Maha**: open the dashboard. This week is **2.3 h over capacity** because Lina's urgent gala sponsor posts were added. Christine's urgent flyer is also waiting, which would make it 7.5 h over.
2. **Carla**: open *Priorities & decisions*. See the competing commitments, tick the work to move (for example, Christine's brochure), choose the new week, write a reason and **Propose these changes to Maha**. Nothing moves yet.
3. **Maha**: open *Priorities & decisions*, check the dates and **Confirm these dates**. The schedule and agreed deadlines update, and each task's history records who did what and when.
4. Next week there is already a pending proposal from Carla (Maha has a vacation day and an evening gala). Maha can confirm it, or decline it with a reason.
5. **Christine** or **Lina**: *Request a task* (try submitting empty to see validation), attach a document, then *Request a meeting*.
6. **Maha**: estimate, schedule, start work and submit for approval. Answer the meeting request, or propose another time.
7. **Carla**: approve the work or request revisions.

### Request approval walk-through

1. **Carla**: the dashboard has two separate approval cards. *Requests awaiting your approval* covers new requests from Christine, Leslie and Sheila. *Completed work awaiting your approval* covers finished work.
2. Open **Simulated email** (left menu). Each waiting request has a simulated approval email to Carla. Open *Simulate Carla's reply* and try:
   - "Approve" (with or without quoted history): the request is approved.
   - The same reply again: ignored as a duplicate.
   - "Unclear reply": stays pending.
   - A different sender using the name "Carla Neto": rejected.
   - "Arrives after the expiry date": rejected.
   - Sheila's older email (version 1, outdated because she changed the deadline): rejected.
3. **Lina**: submit a request. It shows *Request approval: Not required* and goes straight to Maha.
4. **Christine**: submit a request. It shows *Request approval: Pending*, and Maha can clarify and estimate but cannot schedule it until Carla approves. Edit the requested deadline after approval, and it needs approval again.

## 3. What works

| Area | What you can do |
| --- | --- |
| Welcome | Demo profile selector with names and titles; personal greeting ("Welcome, Carla."). Clearly labelled as simulated access. |
| Requests | Submit with required title, description and automatic requester; optional project, deliverable type, audience, purpose, requested date or "Date not known yet", deadline reason, externally fixed, urgency and why, materials, links, documents, missing info and notes. Edit your own brief later; add comments, links and documents. |
| Maha's workspace | Today's plan, this week's capacity, new requests, clarification, awaiting approval, conflicts and decisions. Ask for clarification, estimate effort, schedule hours by week with an agreed deadline ("spread evenly" helper), start work, update remaining effort, flag/clear blocked, mark routine social posts as covered by the social media reserve, submit for approval. |
| Manager dashboards | Your requests and statuses, prominent "Request a task" and "Request a meeting", upcoming deadlines, things needing your input, Maha's four-week workload summary. |
| Carla's dashboard | Everything managers see, plus priority conflicts, work awaiting approval (approve in one click), proposed changes awaiting Maha, and open requests without a priority. |
| Priorities & decisions | Over-capacity weeks with the amount over, competing commitments, pending requests' potential impact. Carla selects work to move, a target week, an optional proposed deadline and a required reason. Maha confirms (can adjust dates) or declines with a reason. Pending changes stay visibly pending. |
| Shared workload | List and board views; filter by requester, status, priority, project and deadline range. Each summary shows requester, title, status, priority, requested and agreed deadlines, and effort ("Estimate needed" when missing). |
| Calendar | Month and week views; previous/next/today/jump to date. Agreed deadlines (solid), requested deadlines (dashed), proposed changes, confirmed meetings (solid teal) and pending meeting requests (striped, dashed) look different and are labelled in words. Weekly scheduled hours and capacity shown per week. |
| Capacity | 37.7 h week, 6 h social media reserve (31.7 h left), meetings, events, scheduled tasks, remaining or over. Maha can reduce a week's capacity for leave (reason required, never above 37.7 h) and add events. Evening or weekend events use time but never add hours. |
| Meetings | Managers propose purpose, date, time, duration, location/link and related task, with a live conflict check. Maha accepts, declines or proposes another time; the requester accepts the new time or withdraws. Accepted meetings count toward capacity. |
| Request approval | Separate from completed-work approval: *Not required*, *Pending*, *Approved* or *Declined*, shown beside the status everywhere. Lina's, Carla's and Maha's own requests skip it. Other managers' requests wait for Carla before Maha can schedule them (Maha can still clarify and estimate). Approval never confirms the requested deadline. Carla decides in the app or by a simulated email reply. Changing the title, description, deliverable, audience, purpose, requested deadline or urgency starts a new version that needs approval again. Decisions record who, when, version and channel, and notify Maha and the requester (simulated). |
| Simulated email | Approval email text with requester, title, brief, task link, requested deadline, urgency reason, estimate (or "Estimate pending"), capacity conflicts and reply instructions. A tool simulates Carla's reply and shows how it was handled: applied, unclear (still pending), duplicate, already decided, outdated, expired or unverified sender. |
| Workflow | Submitted → Needs clarification → Scheduled → In progress → Awaiting approval → Complete. Also: direct Submitted → Scheduled, revisions back to In progress, blocked flag with reason, cancel and archive (history kept). Only Carla approves. |
| History | Every important action records who, what and when, on the task (and in a log for capacity, events and decisions). |
| Saving | Changes survive a refresh. Tabs in the same browser stay in sync. |

### Capacity rules, in plain language

- Weekly capacity is **37.7 hours**. This is never worked out from the 9–5 window.
- **6 hours** are set aside every week for recurring social media work. Routine social requests can be marked "covered by social media time" so they are not counted twice.
- Task effort is split across the **specific weeks** Maha plans, so a three-week task doesn't all land in its deadline week.
- For unfinished work, the **remaining** estimate is used and spread over the current and future weeks of the plan.
- Requests not yet scheduled appear as **"Requested, not yet scheduled"** (potential impact), never mixed into committed hours.
- A request without an estimate shows **"Estimate needed"**. It is never counted as zero.

## 4. What is simulated or incomplete

- **Sign-in is simulated.** Choosing a name is not authentication. Anyone can choose Carla. Permission rules are checked in the browser: they stop mistakes, not someone determined to bypass them.
- **Data is local to one browser on one computer.** It is not shared with anyone. Clearing browser data erases it.
- **Documents are stored in the browser only** (up to 10 MB each). They can be reopened on the same computer and browser, but nobody else can open them. Sample documents are names only, with no file.
- **No Outlook connection.** The calendar is internal. Nothing is sent to or read from the Women's Habitat mail server.
- **No email is sent or received.** Approval emails and decision notices are simulated records inside the browser, shown on the *Simulated email* page and in dashboard "Notices". Carla's email address is deliberately not set. The reply simulator stands in for Carla's mail program, and its "verified sender" option stands in for the email service's sender checks.
- **Other notifications** (new request, clarification, meetings) are not sent; people see updates when they open the app.
- **Time of day for tasks** isn't scheduled; effort is planned by week. Meetings and events have times.
- The heading font (Cormorant Garamond) loads from Google Fonts when online; offline it falls back to Palatino/Georgia. This is the only outside request the page makes.

## 5. Before real team use

See **[docs/before-real-use.md](docs/before-real-use.md)** for what's required for:

- secure individual accounts (one-time invitation codes, then personal sign-in, with Carla's permissions enforced on a server),
- shared, persistent document storage,
- a later Outlook integration, and the questions to confirm with IT,
- real email approvals for Carla (what to configure and what IT must confirm).

## Project layout

```
index.html            The page that loads everything
css/styles.css        Visual design
js/core/              The rules: dates, people, settings (config.js), permissions, capacity,
                      request approval (approval.js), workflow, sample data
js/store.js           Saving in this browser (localStorage + IndexedDB for files)
js/app.js             Navigation, saving after each change, error messages
js/ui/                Screens
tests/                Automated rule tests (npm test)
serve.js              Optional local server (npm start)
PLAN.md               The implementation plan
docs/before-real-use.md
```
