#!/usr/bin/env node
/*
 * Administration from the command line (for whoever runs the server). Nothing is emailed:
 * links are printed so you can share them yourself when the pilot starts.
 *
 *   node server/admin.js invite --role owner --name "Maha ..." [--title "..."] [--email ...]
 *   node server/admin.js invite --role executive --name "Carla Neto" --title "Executive Director"
 *   node server/admin.js invite --role manager --name "..." --title "..."
 *   node server/admin.js users
 *   node server/admin.js invites
 *   node server/admin.js revoke-invite <number from "invites">
 *   node server/admin.js reset-link --email person@example.org
 *   node server/admin.js deactivate --email person@example.org     (and: reactivate)
 *   node server/admin.js backup [--out folder]
 *   node server/admin.js restore <backup.tar>        (stop the app first)
 *
 * Uses the same settings as the server (DATA_DIR, PUBLIC_URL).
 */
'use strict';

const path = require('path');
const dbm = require('./db');
const auth = require('./auth');
const backup = require('./backup');
const config = require('./config').load();

function args(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) { out[list[i].slice(2)] = list[i + 1]; i += 1; } else out._.push(list[i]);
  }
  return out;
}

function userByEmail(db, email) {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!u) throw new Error('No account with that email. Run: node server/admin.js users');
  return u;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  if (!cmd || cmd === 'help') { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]); return; }

  if (cmd === 'restore') {
    const file = a._[0];
    if (!file) throw new Error('Name the backup file: node server/admin.js restore path/to/backup.tar');
    const r = backup.restoreBackup(path.resolve(file), config.dataDir);
    console.log('Restored ' + path.basename(file) + ' (' + r.restoredFiles + ' documents).');
    console.log('The data that was there before was moved (not deleted) to: ' + r.previousDataMovedTo);
    console.log('Start the app again. Everyone will need to sign in again if their session is not in the backup.');
    return;
  }

  const db = dbm.open(config.dataDir);
  try {
    if (cmd === 'invite') {
      if (!auth.ROLES[a.role]) throw new Error('Use --role owner, --role executive or --role manager');
      const inv = auth.createInvite(db, { name: a.name, title: a.title, role: a.role, email: a.email, createdBy: 'admin-cli', hours: a.hours ? Number(a.hours) : undefined });
      console.log('Invitation for ' + a.name + ' (' + a.role + '). Works once, until ' + inv.expiresAt + ' (UTC):');
      console.log(config.publicUrl + '/#/join/' + inv.token);
      console.log('Not sent. Share it privately (not in a group chat) when the pilot starts.');
    } else if (cmd === 'users') {
      auth.listUsers(db).forEach((u) => console.log([u.inactive ? 'OFF' : 'on ', u.role.padEnd(9), u.email.padEnd(32), u.name].join('  ')));
    } else if (cmd === 'invites') {
      auth.listInvites(db).forEach((i) => console.log(['#' + i.ref, i.kind, i.status.padEnd(7), (i.name || i.userId || '').padEnd(24), i.role || '', 'expires ' + i.expiresAt].join('  ')));
    } else if (cmd === 'revoke-invite') {
      console.log(auth.revokeInvite(db, a._[0]) ? 'Cancelled.' : 'Nothing to cancel (already used, cancelled or not found).');
    } else if (cmd === 'reset-link') {
      const u = userByEmail(db, a.email);
      const r = auth.createResetLink(db, { userId: u.id, createdBy: 'admin-cli' });
      console.log('Password reset link for ' + u.name + '. Works once, until ' + r.expiresAt + ' (UTC):');
      console.log(config.publicUrl + '/#/reset/' + r.token);
    } else if (cmd === 'deactivate' || cmd === 'reactivate') {
      const u = userByEmail(db, a.email);
      auth.setActive(db, u.id, cmd === 'reactivate');
      console.log(u.name + (cmd === 'reactivate' ? ' can sign in again.' : ' can no longer sign in (signed out everywhere). Their history is kept.'));
    } else if (cmd === 'backup') {
      const f = backup.createBackup(db, config.dataDir, { dir: a.out ? path.resolve(a.out) : undefined });
      console.log('Backup written: ' + f);
    } else {
      throw new Error('Unknown command "' + cmd + '". Run: node server/admin.js help');
    }
  } finally {
    db.close();
  }
}

try {
  main();
} catch (e) {
  console.error(e.fields ? e.message + ' ' + Object.values(e.fields).join(' ') : e.message);
  process.exit(1);
}
