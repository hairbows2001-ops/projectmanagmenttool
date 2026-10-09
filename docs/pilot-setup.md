# Setting up the private pilot

Step-by-step instructions, in order. **Do not send invitations until step 5 says so.**

There are two separate things:

| | Demo | Team workspace |
| --- | --- | --- |
| What it is | Fictional sample data to try ideas | Real accounts and shared data for the pilot |
| Where data lives | Your browser only | The workspace server's database |
| How to open | Double-click `index.html`, or `npm run demo` | The hosted address (or `npm start` on your own computer to try it) |
| Sign-in | Pick any profile (simulated) | Personal email and password, from an invitation |

Nothing moves from the demo to the team workspace unless you export it and Maha imports it (step 6).

---

## 1. Optional: try the team workspace on your own computer first

This runs the real team version on your computer only, so you can click through it before paying for hosting. **This is for the person setting up the pilot. Managers never need to do this:** they only use the website link (see `manager-guide.md`).

### On Windows

1. Install **Node.js** from <https://nodejs.org>: choose the **LTS** version (22 or newer), then run the installer and accept the defaults.
2. Download the project ZIP. In Downloads, right-click it → **Extract All…** → **Extract**. Don't run it from inside the ZIP.
3. Open **Command Prompt**: press the Windows key, type `cmd`, press Enter. (Command Prompt avoids a PowerShell setting that can block `npm`.)
4. Go to the folder: type `cd /d ` (with a space at the end), drag the extracted folder into the window, and press Enter.
5. Create test invitations (they only work on this computer):
   ```
   npm run admin -- invite --role owner --name "Maha"
   npm run admin -- invite --role executive --name "Carla Neto" --title "Executive Director"
   npm run admin -- invite --role manager --name "Lina Almanzan" --title "Director of Philanthropy"
   ```
   Each prints a link like `http://localhost:8080/#/join/…`. To copy it, select it with the mouse and press Enter (or right-click).
6. Start it: `npm start`. Leave the window open. If Windows asks whether to allow Node.js on networks, you can choose **Cancel**: it only needs this computer.
7. Open the first link in **Edge** and create Maha's account. To be someone else at the same time, open the next link in an **InPrivate window** (`Ctrl+Shift+N`) or in Chrome: each window is a separate person.
8. Stop with `Ctrl+C` in the Command Prompt window. The test data is in the `data` folder inside the project folder; delete that folder to start over.

### On a Mac

1. Install **Node.js** from <https://nodejs.org>: choose the **LTS** version (22 or newer) and run the installer.
2. Download the project ZIP and double-click it to unzip.
3. Open **Terminal** (Cmd+Space, type `Terminal`, press Return).
4. Go to the folder: type `cd ` (with a space at the end), drag the folder into the Terminal window, and press Return.
5. Create test invitations (they only work on this Mac):
   ```
   npm run admin -- invite --role owner --name "Maha"
   npm run admin -- invite --role executive --name "Carla Neto" --title "Executive Director"
   npm run admin -- invite --role manager --name "Lina Almanzan" --title "Director of Philanthropy"
   ```
   Each prints a link like `http://localhost:8080/#/join/…` (Cmd+double-click opens it).
6. Start it: `npm start`. Leave the window open.
7. Open the first link in **Safari** and create Maha's account. To be someone else at the same time, open the next link in a **Private window** (`Cmd+Shift+N`) or in Chrome: each window is a separate person.
8. Stop with `Ctrl+C` in Terminal. The test data is in the `data` folder inside the project folder; delete that folder to start over.

## 2. Choose and create the hosting account

Read `hosting.md`, agree the choice with Carla (and IT if needed), then create the account. With Fly.io:

1. Sign up at <https://fly.io> and add a payment method.
2. Install Fly.io's command-line tool (`fly`) on the computer you will set up from:
   - **Windows:** open **PowerShell** (Windows key, type `powershell`, Enter) and run
     `iwr https://fly.io/install.ps1 -useb | iex`
     Then close it and open a **new Command Prompt** for the next steps.
   - **Mac:** in Terminal, run `curl -L https://fly.io/install.sh | sh` and follow the message it prints to add it to your PATH. Or, with Homebrew: `brew install flyctl`.
3. Sign in: `fly auth login` (opens your browser).

## 3. Deploy

In Command Prompt (Windows) or Terminal (Mac), inside the project folder (see step 1 for how to get there). The commands are the same on both:

1. Pick an app name, for example `wh-comms-pilot`. In `fly.toml` (open it with Notepad on Windows, or TextEdit on Mac), replace `wh-comms-workspace` with it in the **two** places it appears.
2. Create the app (no deploy yet): `fly apps create wh-comms-pilot`
3. Create the private disk in Toronto: `fly volumes create wh_data --region yyz --size 1 --app wh-comms-pilot`
4. Deploy: `fly deploy --ha=false`
   (`--ha=false` keeps **one** machine. Do not add more: the database is one file on one disk.)
5. Open `https://wh-comms-pilot.fly.dev`. You should see the sign-in page. Nobody has an account yet.

## 4. Create the first accounts (owner and executive)

Maha's and Carla's accounts are created from the command line, so that nobody can give themselves Carla's permissions from inside the app. (If the app has gone to sleep, open its address in a browser first to wake it, then run the command.)

```
fly ssh console --app wh-comms-pilot -C "node server/admin.js invite --role owner --name 'Maha' --title 'Communications Coordinator'"
```

Open the printed link yourself and create Maha's account. **Test the main flow** with a test manager account (step 1's flow works the same way). Then create Carla's invitation, but **do not send it yet**:

```
fly ssh console --app wh-comms-pilot -C "node server/admin.js invite --role executive --name 'Carla Neto' --title 'Executive Director'"
```

Invitation links work **once** and expire after **72 hours**. If one expires, make a new one.

## 5. Before sending any invitations: pilot checklist

- [ ] Carla (and IT if needed) agreed to the hosting choice and the pilot.
- [ ] Pilot group chosen (for example Maha, Carla, Lina, Christine).
- [ ] Everyone knows: **no client, resident or donor personal information** in requests, comments or documents.
- [ ] Backups checked: under **Workspace settings → Backups**, *Download full backup* works, and you know where it will be kept (see `backup-and-recovery.md`).
- [ ] A test restore was done once (on your own Windows PC or Mac is fine).
- [ ] The 15-minute browser check in `browser-support.md` passed in **Edge on Windows** and **Safari on a Mac** (ideally on Carla's or Lina's usual computer). Chrome is a bonus.
- [ ] Someone other than Maha knows how to get into the hosting account in an emergency.
- [ ] Decide how long the pilot runs and what you'll ask people afterwards.

When everything is ticked: in the app, open your name (top right) → **Workspace settings** → **Invite a manager** to create each manager's link. Links are shown, never emailed. Send each person their link together with `manager-guide.md` (or a PDF of it). Send each privately (for example, a direct Teams message or an email to that person only). Send Carla's link from step 4 the same way.

## 6. Bring in tasks you want to keep (optional)

1. In the **demo**, open your profile menu → **Export tasks to keep**. This downloads a `.json` file with the tasks you created (never the fictional sample tasks), including their documents.
2. In the **team workspace**, signed in as Maha: **Workspace settings → Bring in tasks you want to keep** → choose the file. Check the list, choose whose request each one is, and select **Import selected tasks**.
3. Importing the same file again does not create duplicates.

## Everyday administration

| Task | Where |
| --- | --- |
| Invite a manager, cancel an unused link | Workspace settings (Maha) |
| A manager forgot their password | Workspace settings → People → *Create password reset link* (works once, 24 hours) |
| Someone leaves | Workspace settings → People → *Turn off account* (their history stays) |
| Carla's or Maha's password reset | `fly ssh console --app … -C "node server/admin.js reset-link --email …"` |
| See accounts | `… -C "node server/admin.js users"` |
| Update the app after changes | `fly deploy --ha=false` (data is kept on the disk) |
| See errors | `fly logs --app wh-comms-pilot` |
