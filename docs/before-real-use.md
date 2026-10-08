# Before real workplace use

This prototype is for trying out the workflow with fictional data. It is **not** safe for real information yet. This page lists what must be built or confirmed first, in plain language.

## 1. Secure individual access

**Today (prototype):** a profile selector. Anyone can pick any name, including Carla. Permission checks run in the browser, so a technically minded person could bypass them. There are no passwords and no accounts.

**What's needed:**

1. **A server and a shared database.** The rules in `js/core/` (permissions, workflow, capacity) were kept separate from the screens so they can move to a server. Every change must be checked *on the server*, which decides who the person is and what they may do.
2. **Individual accounts.** One account per person (Maha, Carla and each manager).
3. **One-time invitation codes to set up access.**
   - Maha (or an administrator) creates an invitation for a named person.
   - The code is random, used **once**, expires (for example, after 72 hours) and is sent privately (in person or by work email).
   - When used, the person sets up their own sign-in. The code then stops working.
4. **Individual sign-in after that.** Preferably through Women's Habitat's existing work accounts, if IT supports it (see section 3). Otherwise an email-and-password sign-in with multi-factor authentication.
5. **Server-enforced roles.**
   - Carla's abilities (set priorities, propose schedule changes) and Maha's (schedule, confirm dates, mark work complete) are granted to Carla's *account* on the server, never to whoever selects a name.
   - Managers can only edit their own briefs. Only Maha can schedule, estimate and confirm dates. The server rejects anything else, even if someone crafts a request by hand.
   - Role changes are themselves recorded in history.
6. **Things to avoid:** no shared or permanent access code, no passwords or keys written into the app's code, no way to gain privileges by choosing a name.
7. **Other basics:** HTTPS only; sessions that time out; a sign-out button; audit history stored on the server where users can't edit it; regular backups; a decision on where data is hosted (in Canada is often preferred) and how long it's kept.
8. **Privacy review.** Women's Habitat handles sensitive information. Agree what may and may not be put in requests (for example, never client or resident details), and review it against organisational policy and applicable privacy law before launch.

## 2. Persistent, shared document storage

**Today (prototype):** files are saved inside one browser (IndexedDB), up to 10 MB each. Only that browser on that computer can reopen them. Sample documents are names only.

**What's needed:**

- Store files on the server or in an approved storage service (for example, the organisation's existing SharePoint/OneDrive or file server, *if* IT approves an integration), not in the browser.
- Check permissions on every download: the same rules as viewing the task.
- Set file size and type limits and scan uploads for viruses.
- Keep documents when a task is cancelled or archived (as history is kept now), with an agreed retention period.
- Consider allowing links to existing shared-drive files instead of copies, to avoid duplicate versions.

## 3. Outlook integration: questions for IT

Women's Habitat uses Outlook through its own server, and the exact setup is unknown. Nothing in this prototype connects to it. Before planning an integration, ask IT:

1. **What runs the mail server?** Microsoft 365 / Exchange Online, an on-premises Exchange Server (which version?), a hosted Exchange provider, or something else?
2. **Can approved apps connect to calendars?** On Microsoft 365 this is usually Microsoft Graph with an app registration. On-premises Exchange may offer Exchange Web Services (EWS). Is either allowed?
3. **Whose calendar?** Only Maha's, or also managers' (to check their availability)? Read-only, or may the app create meeting invitations?
4. **Sign-in:** can staff sign in to this app with their work accounts (single sign-on)? This would also solve section 1.
5. **Security requirements:** is there an approval process for third-party or custom apps? Where must data be hosted?
6. **Alternatives if direct connection isn't allowed:** a calendar file (`.ics`) export that Maha imports manually, or emailed meeting invitations from the app.

Until then, the internal calendar is the source of truth for scheduling in this app, and confirmed meetings must also be added to Outlook by hand.

## 4. Other items before launch

- Email or Teams notifications (new request, clarification needed, proposal awaiting confirmation). This needs an IT-approved email or Teams integration; the prototype sends nothing.
- Confirm the provisional rule: *Carla sets priorities and proposes changes; Maha confirms the resulting schedule and dates.*
- Confirm the capacity numbers (37.7 h; 6 h social media) and how lieu time for evening events should be handled. Today Maha can only *reduce* a week's capacity.
- Statutory holidays: add them as reduced-capacity weeks, or build an Ontario holiday calendar.
- Accessibility testing with a screen reader (NVDA or JAWS on Windows) by the people who will use it.
- Replace all fictional sample data before real use.
