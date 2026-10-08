# Notes for AI assistants working on this project

- Owner is not an experienced developer: explain setup and decisions in plain language.
- Stack: plain HTML/CSS/JavaScript, no build step, no dependencies. Scripts are classic (non-module) files
  that attach to the global `WH` object so `index.html` works by double-click. Keep it that way unless asked.
- Rules live in `js/core/` (no DOM code) and are tested with `npm test` (Node built-in test runner).
  Every data change goes through `js/core/workflow.js`, which checks permissions, validates and records history.
- Screens in `js/ui/` register `WH.views[name]`, `WH.actions[name]` (data-action / data-change / data-input)
  and `WH.forms[name]` (form data-form). All user text must pass through `WH.util.esc`.
- Prototype constraints: simulated access, fictional sample data (`sample: true`), local browser storage only,
  no Outlook connection. Do not claim otherwise. See README.md and docs/before-real-use.md.
- Capacity: 37.7 h/week authoritative, 6 h social media reserve, allocations per week, remaining effort used,
  "Estimate needed" never counted as zero, pending requests shown separately.
- Request approval (js/core/approval.js + workflow.js) is separate from completed-work approval (`task.approval`).
  Exempt requesters live in js/core/config.js. Emails are SIMULATED records (`state.emails`, `state.inbound`,
  `state.notifications`); never claim real email is sent. Approver address is configured in js/core/config.js (CNeto@womens-habitat.ca),
  compared case-insensitively; `email.integration.enabled` stays false until a real server integration exists.
