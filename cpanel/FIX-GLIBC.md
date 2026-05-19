# GLIBC / SQLite on cPanel

Native `better-sqlite3` fails on Stormerhost (`GLIBC_2.29 not found`).

**Fix:** The API uses **sql.js** (no native binary). Follow **`cpanel/TERMINAL-FIX.md`**, then RESTART Node.js and check `/api/health` for `"db":true`.
