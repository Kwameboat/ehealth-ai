#!/bin/bash
# Reset admin password — cPanel Terminal
# Example: ADMIN_PASSWORD='MySecurePass123' bash ~/ehealth-ai/cpanel/reset-admin-password.sh
set -e
# shellcheck disable=SC1091
. /home/ehealtha/ehealth-ai/cpanel/activate-nodevenv.sh
cd /home/ehealtha/ehealth-ai/backend

export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

node <<'NODE'
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { initDatabase, getDb } = require('./db/init');
const user = process.env.ADMIN_USERNAME || 'admin';
const pass = process.env.ADMIN_PASSWORD || 'admin123';
initDatabase()
  .then(() => {
    const db = getDb();
    const hash = bcrypt.hashSync(pass, 10);
    const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(user);
    if (row) {
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, row.id);
    } else {
      db.prepare('INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(),
        user,
        hash,
        new Date().toISOString()
      );
    }
    console.log('OK — login with username:', user, 'password:', pass);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
NODE
