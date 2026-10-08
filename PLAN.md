# Implementation plan — Communications Workspace prototype

Women's Habitat of Etobicoke · local prototype · fictional sample data only

## Goal

A local web app where managers submit communications requests to Maha, see
Maha's real workload, and where Carla decides what comes first when requests
compete. This version is a **prototype**: it runs on one computer, uses
simulated sign-in, and does not connect to any workplace system.

## Technical approach (plain language)

| Decision | Choice | Why |
| --- | --- | --- |
| Stack | Plain HTML, CSS and JavaScript. No frameworks, no install step. | The repository was empty. This needs no setup: open `index.html`, or run one command. |
| Saving data | Browser `localStorage` | Changes survive a refresh. Data stays **in one browser on one computer**. Nobody else sees it. |
| Saving documents | Browser IndexedDB | Uploaded files are actually stored, but **only in that browser**. Files are labelled that way. |
| Sign-in | Demo profile selector | Clearly labelled as **simulated access**. Anyone can pick any name. Not secure. |
| Time zone | America/Toronto | All "today" and week calculations use Toronto time. Weeks run Monday–Sunday. |
| Tests | Node's built-in test runner (`npm test`). No packages needed. | Checks capacity math, workflow rules and permissions. |

Code layout:

- `js/core/`: the rules (dates, people, permissions, capacity, workflow, sample data). No screen code, so it can be tested and later moved to a server.
- `js/ui/`: screens (welcome, dashboards, workload, calendar, task detail, forms, capacity, decisions, meetings).
- `css/styles.css`: the visual design.

## Build steps

1. **Rules first**: people and roles, permission checks, status transitions, task history, and capacity calculations (37.7 h week, 6 h social media reserve, meetings, events, weekly allocations, remaining effort, "Estimate needed").
2. **Sample data**: fictional scenario with competing requests from Lina and Christine, an over-capacity week, a pending change proposal from Carla, a past resolved one, meeting requests, and work in progress. Dates are relative to the current week so the demo always looks current.
3. **Screens**: welcome/profile selector; Home (Maha / manager / Carla); Tasks (this week, list, board, priorities panel); Calendar (month/week, meetings, events & leave); task details, request and meeting forms in a side panel. (Simplified navigation in a later update.)
4. **Design**: warm cream background, serif headings, sans-serif body, thin dividers, restrained cards. Teal `#61B3B5` and green `#B4DAA4` as accents with navy `#162939` text. Status is shown with icons and words, not just colour.
5. **Checks**: automated tests for rules; browser walk-through of the main flows, keyboard navigation, contrast and mobile layout.
6. **Documentation**: launch instructions, what works, what is simulated, and what's needed for secure team use, document storage and Outlook (`README.md`, `docs/before-real-use.md`).

## Team workspace (private pilot)

| Decision | Choice | Why |
| --- | --- | --- |
| Server | One small Node.js program (`server/`), no packages | Nothing to install or keep updated besides Node.js |
| Rules | The server runs the same `js/core` rules as the screens, as the signed-in account | One set of rules; permissions can't be bypassed from the browser |
| Database | SQLite (built into Node.js): one file | Simple to host, back up and move |
| Documents | Private folder on the server, permission checked on each download | Not in the web folder; only requester, Maha and Carla |
| Accounts | Single-use invitation links (72 h), email + password (scrypt), HttpOnly session cookies | No shared codes; nothing secret stored in plain text |
| Overwrite protection | Each field remembers the revision, person and time of its last change; a change based on an older revision of the same field is refused | Nobody's work is silently replaced; additions (comments, history) merge |
| Hosting | Proposed: Fly.io, Toronto (see `docs/hosting.md`); not deployed | Canadian data location, low cost, HTTPS included |
| Backups | Daily automatic `.tar` (14 kept) plus Maha's weekly download; restore by command or `restore-this.tar` | Recoverable even if the host is lost |

## Key rules encoded

- Statuses: Submitted → Needs clarification → Scheduled → In progress → Awaiting approval → Complete, plus Blocked (a flag with a reason), Cancelled and Archived (history kept).
- All requests go directly to Maha; requests are not approved in advance. Finished work on managers' requests waits for Carla's approval before it is closed (In progress → Completed by Maha → Submitted for approval → Awaiting Carla → Approved → Closed). Maha's own tasks close when she finishes them.
- Managers' urgency is a *request*; only Carla sets priority.
- Carla *proposes* schedule changes; Maha *confirms* dates. Nothing moves until Maha confirms.
- Unscheduled requests are shown as "potential impact", never mixed into committed hours.
- Every important action is recorded: who, what, when.
