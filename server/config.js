/*
 * Settings, read from environment variables (set by the hosting service or on the command line).
 *
 *   DATA_DIR    Where the database, documents and backups are kept. Default: ./data
 *   PORT        Port to listen on. Default: 8080
 *   HOST        Network address. Default 127.0.0.1 (this computer only). Hosting uses 0.0.0.0.
 *   PUBLIC_URL  The address people open, e.g. https://wh-comms.fly.dev. Used in invitation links.
 *               When it starts with https://, sign-in cookies are marked Secure.
 *   TRUST_PROXY Set to 1 when running behind the hosting service's HTTPS proxy (Fly.io does this),
 *               so the real visitor address is used for sign-in attempt limits.
 */
'use strict';

const path = require('path');

function load(env) {
  const e = env || process.env;
  const port = Number(e.PORT) || 8080;
  const publicUrl = (e.PUBLIC_URL || 'http://localhost:' + port).replace(/\/+$/, '');
  return {
    dataDir: path.resolve(e.DATA_DIR || path.join(__dirname, '..', 'data')),
    port,
    host: e.HOST || '127.0.0.1',
    publicUrl,
    secure: publicUrl.startsWith('https://'),
    trustProxy: e.TRUST_PROXY === '1',
    autoBackup: e.AUTO_BACKUP !== '0'
  };
}

module.exports = { load };
