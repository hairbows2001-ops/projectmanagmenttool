# Before wider use

The team workspace is ready for a **private pilot** with a small group. This page lists what is in place and what is still needed before wider or more sensitive use.

## In place

| Area | What exists now |
| --- | --- |
| Accounts | One account per person, created from an invitation link that works **once** and expires after **72 hours**. Only a scrambled (hashed) form of each link and password is stored. Passwords need at least 12 characters. |
| Sign-in | Email and password. Repeated wrong passwords are blocked for 15 minutes. Sessions end after 14 days without use (30 days at most). Sign out is in the profile menu. |
| Permissions | Enforced **on the server** for every change, using the same rules as the screens (`js/core/permissions.js`). Only Carla can set priorities, propose schedule changes and approve finished work. Only Maha can estimate, schedule, confirm dates and finish work. Changing the page in a browser cannot get around this (tested). |
| Who sees what | Everyone sees what Maha is working on (title, requester, status, dates, effort). The brief, comments, documents and history of a request are visible only to the requester, Maha and Carla. |
| Roles | Maha can invite **managers** only. Owner and executive accounts are created from the server command line, so nobody can grant themselves Carla's permissions in the app. |
| Shared data | One database on the server: tasks, comments, estimates, schedules, meetings, decisions and history. |
| Documents | Stored privately on the server (not in the web folder), up to 10 MB each. Every download checks permission. |
| Overwriting | If someone else changed the same thing after you opened it, your change is **refused**, you are told who changed what, and what you typed stays on the form. Comments and other additions never conflict. |
| Backups | Daily automatic backups (14 kept) plus a one-click full download for Maha. Tested restore. See `backup-and-recovery.md`. |
| Web security | HTTPS when hosted, secure cookies, protection against other websites making changes on someone's behalf, strict content security policy, private server files never served. |
| Demo separation | The demo (fictional data, browser only) is separate. Nothing is imported unless Maha imports an export file. |

## Still needed before wider use

1. **Privacy review.** Agree what may be entered (never client or resident details), how long data is kept, and check against organisational policy and applicable privacy law. Confirm the hosting location is acceptable.
2. **Stronger sign-in.** Add a second factor (an authenticator app), or better, sign in with the organisation's work accounts (Microsoft single sign-on) if IT supports it. That also handles people leaving.
3. **Virus scanning of uploads**, if documents will come from outside the organisation.
4. **Notifications** (new request, clarification needed, proposal awaiting confirmation, work awaiting approval). Deferred: needs an IT-approved email or Teams integration. Nothing is sent today; people see updates when they open the app, which refreshes every 15 seconds while open.
5. **Email approvals.** Deferred. Carla approves inside the app.
6. **Outlook integration.** Deferred. See the questions for IT below.
7. **Accessibility testing** with a screen reader (NVDA or JAWS) by the people who will use it.
8. **Confirm the rules** with Carla: capacity numbers (37.7 h; 6 h social media), lieu time for evening events, statutory holidays, and "Carla proposes, Maha confirms".

## Outlook integration: questions for IT

Women's Habitat uses Outlook through its own server, and the exact setup is unknown. Nothing connects to it. Before planning an integration, ask IT:

1. **What runs the mail server?** Microsoft 365 / Exchange Online, an on-premises Exchange Server (which version?), a hosted Exchange provider, or something else?
2. **Can approved apps connect to calendars?** On Microsoft 365 this is usually Microsoft Graph with an app registration. On-premises Exchange may offer Exchange Web Services (EWS). Is either allowed?
3. **Whose calendar?** Only Maha's, or also managers' (to check their availability)? Read-only, or may the app create meeting invitations?
4. **Sign-in:** can staff sign in to this app with their work accounts (single sign-on)? This would also cover item 2 above.
5. **Security requirements:** is there an approval process for third-party or custom apps? Where must data be hosted?
6. **Alternatives if direct connection isn't allowed:** a calendar file (`.ics`) export that Maha imports manually.

Until then, the app's calendar is the source of truth for scheduling, and confirmed meetings must also be added to Outlook by hand.
