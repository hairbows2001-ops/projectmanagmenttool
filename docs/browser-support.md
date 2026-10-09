# Browser support: what was tested and what still needs checking

The team uses **Windows** (Carla and Lina) and **Mac**. Supported browsers, current versions:

| | Windows | Mac |
| --- | --- | --- |
| Microsoft Edge | ✔ supported | — |
| Google Chrome | ✔ supported | ✔ supported |
| Safari | — | ✔ supported (15.5 or newer) |

Managers need only the website link and their own sign-in. Nothing is installed on their computers (see `manager-guide.md`).

## What was actually tested

All automated browser testing so far ran in **one browser: Chromium 141 on Linux**, in a cloud test machine. Chromium is the engine inside both Microsoft Edge and Google Chrome, so these results are a strong indication for Edge and Chrome. But **no test has yet run on a real Windows PC or a real Mac, and none in Safari.**

| Check | Chromium 141 (Linux), tested | How |
| --- | --- | --- |
| Account from invitation; sign in; sign out | ✔ | With the keyboard only (Tab, typing, Enter) |
| Wrong password refused; used and cancelled links refused | ✔ | |
| Task submission with an upload | ✔ | Keyboard only; Space opens the file picker; file name with spaces, a long dash and brackets kept |
| Downloads | ✔ | Keyboard Enter on **Open**; original name kept, including accented names such as `Résumé – v2.pdf` (also checked in the server tests) |
| No access to someone else's file | ✔ | The server refuses, and the browser shows a message instead of downloading an error |
| Calendar controls | ✔ | Previous / Next, Month / Week, Meetings, and typing into the date and time fields with the keyboard |
| Keyboard navigation | ✔ | Skip link; visible focus outline; panel keeps focus inside and closes with Esc; profile menu with arrow keys |
| Two people at once | ✔ | Separate browser sessions: request → schedule → status seen by the manager → finished → approved; conflicting change refused with typing kept |
| Windows-like screens | ✔ (simulated) | 1920×1080, 1536×864, 1366×768, 1280×720 and 1024×768 windows, with 17 px always-visible scrollbars like Windows: no sideways scrolling; side panel fits the window |
| Browser zoom 200% | ✔ | Layout reflows without sideways scrolling |
| Windows Contrast themes | ✔ (simulated) | `forced-colors` mode: capacity bar and labels keep visible outlines |
| Phones | ✔ | 390 px wide: no sideways scrolling |

Automated server tests (`npm test`, 35 tests) don't depend on the browser. They cover accounts, permissions, private files, conflicts, import, and backup and restore.

## Not yet verified

| Browser | Status | Why it's likely fine | What could differ |
| --- | --- | --- | --- |
| **Edge on Windows** (Carla, Lina) | Not tested on real Windows | Same engine as the tested Chromium | Windows fonts (falls back to standard fonts), how downloads are shown, SmartScreen download prompts, company browser policies |
| **Chrome on Windows** | Not tested on real Windows | Same engine | As above |
| **Chrome on Mac** | Not tested on a real Mac | Same engine | Mac fonts and the date picker look |
| **Safari on Mac** | **Not tested at all**: a different engine (WebKit) that cannot run in the test machine | The code was reviewed for Safari: it uses only features Safari has supported since 15.5, avoids date formats Safari reads differently, and lets the server name downloaded files (Safari handles that reliably) | Look of the date and time pickers, keyboard Tab behaviour (see below), small layout differences in collapsible sections |

**Known Safari difference:** by default Safari's Tab key skips links. This is a Safari setting, not an app problem. The manager guide explains how to turn it on (Safari → Settings → Advanced → *Press Tab to highlight each item*), or use Option+Tab.

## Changes made for Windows and Mac

- Downloads in the team workspace are named by the server, which keeps names with spaces and accents on every browser. The browser checks access first, so "no access" appears as a message.
- The side panel is sized to the window, not to the screen. This is a precaution for Windows' always-visible scrollbars; the earlier version also fitted in testing, because the page behind the panel stops scrolling.
- Windows Contrast themes: borders keep the capacity bar, status labels and cards visible.
- Very old browsers (for example Internet Explorer, or Safari before 15.5) show "Please update your browser" instead of a broken page.
- Sign-in fields are marked for password managers (Edge, Chrome, iCloud Keychain).

## Manual check before the pilot (15 minutes per browser)

Do this once on the hosted workspace, using a test manager account. Do it in **Edge on a Windows PC** (ideally Carla's or Lina's usual computer) and in **Safari on a Mac**. Chrome on either is a bonus.

Tick each item, and note the browser version (Edge: `…` menu → Help and feedback → About Microsoft Edge; Safari: Safari → About Safari).

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open a new invitation link, create the account | Lands on Home; the link no longer appears in the address bar |
| 2 | Sign out, then sign in | Home again; the browser offers to save the password |
| 3 | **Request a task** with a title and one Word or PDF file whose name has a space (e.g. `Brief draft.docx`) | "Request sent to Maha. 1 document uploaded." |
| 4 | Open the request → Documents and links → **Open** | The file downloads with the same name and opens normally |
| 5 | In another browser or a private window, as Maha: open the request and schedule it | Back in the first window, the status changes to Scheduled within about 15 seconds, without refreshing |
| 6 | Calendar: **Next →**, **← Previous**, **Week**, **Month** | The calendar moves and switches view |
| 7 | **Request a meeting**: pick a date and time with the date and time pickers | The pickers open and the request is sent |
| 8 | Keyboard only (no mouse): Tab to **Request a task**, Enter, Tab to the title, type, Tab to the send button, Enter. Then Esc | Each focused item shows an outline; the panel opens, sends and closes. (Safari: turn on the Tab setting first.) |
| 9 | Zoom to 150% (`Ctrl` + `+` on Windows, `Cmd` + `+` on Mac) | Everything readable; no sideways scrolling |
| 10 | Windows only: turn on a Contrast theme (Settings → Accessibility → Contrast themes) and look at Home | Text, buttons and the capacity bar are visible. Turn the theme off again afterwards |

Record the results in the table below (or send them to whoever maintains the app):

| Browser and version | Computer | Date | Steps passed | Problems |
| --- | --- | --- | --- | --- |
| Edge … | Windows … | | | |
| Safari … | Mac … | | | |
| Chrome … | | | | |
