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
- Workflow: Submitted → Needs clarification → Scheduled → In progress → Complete (+ blocked flag, cancelled, archived).
  No approval steps and no email: all requests go to Maha, who marks work Complete. Carla sets priorities and proposes
  schedule changes; Maha confirms dates. Saved data from older versions is upgraded by js/core/migrate.js (schemaVersion 3);
  bump the version and add a migration step when the saved data shape changes.
