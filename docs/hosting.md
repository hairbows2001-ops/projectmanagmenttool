# Hosting the team workspace: options, accounts and costs

The team workspace needs to run somewhere everyone can reach from a browser. **Nothing has been set up or paid for yet.** This page explains the choice so you (and Carla or IT, if needed) can decide before anyone creates an account.

## What the app needs

It was built to be as simple to host as possible:

| Need | What this app uses | Why it matters |
| --- | --- | --- |
| A program that runs all the time (or starts when someone visits) | One small Node.js server (`server/index.js`) | No other software or packages to install or update |
| A place to keep data | **One file** (`workspace.sqlite`) plus a folder of uploaded documents, on a private disk | Easy to back up (one `.tar` file), easy to move to another host |
| A secure web address | `https://…` provided by the host | Passwords and documents travel encrypted |
| Size | Small: a 256 MB machine and 1 GB of disk is plenty for a pilot | Low cost |

Because everything is in one folder, you can move to another host later by restoring a backup there (see `backup-and-recovery.md`).

## Recommendation: Fly.io, Toronto region

**Why:**
- Data stays in **Canada** (Toronto data centre).
- HTTPS (the padlock) is set up automatically.
- It runs the app exactly as it is (the `Dockerfile` and `fly.toml` in this folder are ready).
- It keeps a private disk for the database and documents, and takes its own daily disk snapshots, in addition to the app's own daily backups.
- It costs a few dollars a month at this size. The app can stop when nobody is using it, and it starts again on the next visit in a few seconds.

**What you need:**
1. **A Fly.io account** (sign up at fly.io with an email address). Fly.io asks for a **credit card**, even for small bills. Use an organisational card if possible, and check that this fits your purchasing rules.
2. **About 30 minutes on your Mac**, the first time, to install Fly.io's command-line tool and run the steps in `pilot-setup.md`. Alternatively, someone technical (or I, in a new session, if you add a deploy token: see below) can run them.

**Expected cost:** roughly **US$3–6 per month**: one small machine, 1 GB disk and snapshot storage, billed by use. Prices change, so check <https://fly.io/pricing> before you sign up. There is no cost for the default address (`https://your-app-name.fly.dev`).

**Optional later:** a friendlier address such as `requests.womenshabitat.ca`. That needs whoever manages the organisation's domain (usually IT) to add one DNS record. It isn't needed for the pilot.

## Other options considered

| Option | Monthly cost (approx.) | Canada? | Effort | Notes |
| --- | --- | --- | --- | --- |
| **Fly.io** (recommended) | US$3–6 | Yes (Toronto) | Low–medium: command-line tool | Ready-made settings in this project |
| Render.com | about US$7 plus disk | No Canadian region at time of writing | Low: web dashboard | A persistent disk needs a paid plan; data would be in the US |
| DigitalOcean server ("Droplet") in Toronto | about US$6, plus US$1–2 for their backups | Yes | **High**: you look after a whole Linux server (security updates, HTTPS setup) | More control, more responsibility |
| An office computer or server, through IT | No hosting fee | Yes | Depends on IT | IT must make it reachable securely from outside the office, keep it updated and back it up |
| Microsoft Azure / Microsoft 365 environment | Varies | Yes (Canada Central) | Medium–high | Worth asking IT if the organisation already uses Azure; it would also help with Outlook and single sign-on later |

## Before choosing

- **Ask Carla (and IT, if there is an IT provider)** whether a third-party host is acceptable for internal work-request information during a pilot, and whether there is a preferred provider.
- **Keep the pilot to internal work details.** Do not enter client, resident or donor personal information (the sign-in page says so too).
- Decide **who holds the hosting account** (ideally an organisational email, with a second person who can get in if needed) and **who receives the bill**.

## If you would like me to do the deployment

You can run the steps yourself (`pilot-setup.md`), or:

1. Create the Fly.io account and add a payment method (only you can do this).
2. In Fly.io, create a **deploy token** for the app (Account → Tokens).
3. In this Claude Code environment's settings (the environment menu in the session title bar → Edit), add it as an environment variable or secret named `FLY_API_TOKEN`. **Do not paste it into the chat.**
4. Allow the network to reach `fly.io`, `api.fly.io` and `registry.fly.io` (same settings page → Network access).
5. Start a new session and ask me to deploy. I would then deploy, create the first invitation for you only, and give you the link. Nobody else would be invited until you say so.
