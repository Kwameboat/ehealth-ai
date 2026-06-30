const { ensureRouteDatabase } = require('./requestDb');

/** Ensures SQLite is ready for admin console routes (longer wait than global PWA gate). */
async function ensureAdminDatabase(req, res, next) {
  return ensureRouteDatabase(req, res, next, 25_000);
}

module.exports = { ensureAdminDatabase };
