const bcrypt = require('bcryptjs');
const { getDb, uuid, now } = require('../db/init');

/**
 * Ensure admin exists and cPanel ADMIN_PASSWORD always matches the database.
 */
function ensureAdminUser() {
  const database = getDb();
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : '';
  const password = envPassword || 'admin123';
  const hash = bcrypt.hashSync(password, 10);
  const row = database.prepare('SELECT id FROM admins WHERE username = ?').get(username);

  if (row) {
    if (envPassword) {
      database.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, row.id);
      console.log(`[admin] Password synced from ADMIN_PASSWORD for "${username}"`);
    }
    return { username, created: false };
  }

  database
    .prepare('INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(uuid(), username, hash, now());
  console.log(`[admin] Created admin "${username}"`);
  return { username, created: true };
}

module.exports = { ensureAdminUser };
