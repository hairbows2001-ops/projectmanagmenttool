# Backup and recovery

## What a backup is

One `.tar` file (an archive, like a ZIP) containing:

- `workspace.sqlite`: the database. It holds every task, comment, estimate, schedule, meeting, Carla's decisions and the full history, plus accounts. Passwords are stored only in a scrambled (hashed) form.
- `files/`: every uploaded document.
- `README.txt`: when it was made.

A backup contains everything, so treat it like the workspace itself: **keep it private**.

## Backups made for you

| Kind | When | Kept | Where |
| --- | --- | --- | --- |
| Automatic app backups | Once a day, when the server is running (also on start if the last one is over a day old) | Newest 14 | On the server disk, `/data/backups/auto-….tar` |
| Fly.io disk snapshots (if hosted on Fly.io) | Daily, by Fly.io | About 5 days by default | Fly.io (`fly volumes snapshots list`) |

Both of these are on the same hosting provider. If the provider account were lost or closed, they would be lost too. That is why you also need the weekly download below.

## Your weekly backup (5 minutes, Maha)

1. Sign in → your name (top right) → **Workspace settings** → **Backups** → **Download full backup**.
2. Move the file from Downloads to the agreed private place: for example an organisational OneDrive/SharePoint folder that only Maha and Carla can open, or as advised by IT. Do not keep it in a shared folder or on a USB stick that leaves the office.
3. Keep at least the last 4 weekly files; delete older ones.

*Download tasks (.json)* is not a full backup. It's a readable copy of the tasks only (used for importing), without accounts.

## Restoring (recovery)

Restoring replaces **everything** with the contents of the backup. Changes made after that backup are lost. The data being replaced is **moved aside, never deleted**, so a restore can be undone.

### On Fly.io

1. Tell the pilot group not to make changes for a few minutes. Open the app's address in a browser so it is awake.
2. Upload the backup to the server disk with the special name `restore-this.tar`:
   ```
   fly ssh sftp shell --app wh-comms-pilot
   put workspace-backup-2026-10-08T12-00-00.tar /data/restore-this.tar
   ```
   (Press `Ctrl+D` to leave.)
3. Restart: `fly apps restart wh-comms-pilot`
4. On start, the server restores the file and renames it `restored-<time>.tar`. The previous data goes into `/data/replaced-<time>/`. Check `fly logs` for a line starting "Restored restore-this.tar".
5. Sign in and check recent tasks. People may need to sign in again.

If the file is not a valid backup, nothing is replaced: it is renamed `restore-failed-<time>.tar` and the log says why.

### On a computer where you can run commands

Stop the app, then in Command Prompt (Windows) or Terminal (Mac), in the project folder:
```
npm run admin -- restore path/to/workspace-backup-….tar
npm start
```
(On Windows the path looks like `"%USERPROFILE%\Downloads\workspace-backup-….tar"`.)

### Moving to a different host

Set up the new host (see `pilot-setup.md`), restore the latest backup there using either method above, and check it. Only then shut down the old one.

## Practise once

Before the pilot starts, test that a backup actually restores:

1. Download a full backup (it goes to your Downloads folder).
2. Open the project folder in Command Prompt (Windows) or Terminal (Mac), as in step 1 of `pilot-setup.md`. Node.js must be installed.
3. Restore it into a separate test folder and start it there. Replace the file name with yours.

   **Windows (Command Prompt):**
   ```
   set DATA_DIR=restore-test
   set PORT=8081
   npm run admin -- restore "%USERPROFILE%\Downloads\workspace-backup-2026-10-08T12-00-00.tar"
   npm start
   ```
   **Mac (Terminal):**
   ```
   export DATA_DIR=restore-test PORT=8081
   npm run admin -- restore ~/Downloads/workspace-backup-2026-10-08T12-00-00.tar
   npm start
   ```
4. Open <http://localhost:8081> and sign in with your normal email and password. You should see the same tasks and be able to open documents.
5. Stop it (`Ctrl+C`), close the window (this clears the settings above), and delete the `restore-test` folder: it contains real data.

## If something goes wrong

| Situation | What to do |
| --- | --- |
| Someone deleted or changed something by mistake | Nothing is deleted in normal use: cancelled and archived tasks keep their history. Check the task's *Activity history* before restoring anything. |
| The app won't start | `fly logs --app …` shows the error. Restore the latest backup if the database is damaged. |
| Hosting account lost or closed | Create a new host (`pilot-setup.md`) and restore your latest weekly download. |
| A backup file was shared by mistake | It contains everyone's data. Change all passwords (reset links) and tell Carla. |
