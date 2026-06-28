# Fix admin panel 503 (Database not ready)

## Cause

sql.js + multiple Passenger workers can conflict when writing the SQLite file, leaving stale `.lock` / `.tmp` files after restarts.

## Automatic fixes (v2 — built into server)

The backend now:

- Clears stale lock/tmp files on **every startup**
- **Auto-recovers** the database on failed requests (clears locks + re-inits)
- **Debounces** disk writes (350ms) to reduce multi-worker collisions
- Limits Passenger to **1 worker** (`PassengerMaxPoolSize 1`)
- Admin UI **auto-retries** on 503 and calls `/api/health?recover=1`

You should rarely need manual steps after deploying the latest `server.js`, `db/ensureDb.js`, and `db/driver-sqljs.js`.

## One-shot repair (if 503 persists)

```bash
bash ~/ehealth-ai/cpanel/repair-production.sh
```

Then **cPanel → Node.js → RESTART**.

## Manual verify

- https://www.ehealthaigh.com/api/health → `"db": true`
- https://www.ehealthaigh.com/api/health?recover=1 → forces recovery if stuck
- Admin dashboard loads without 503

## cPanel environment

Set **DATABASE_PATH** to:

```
/home/ehealtha/ehealth-ai/data/medassistant.db
```

Ensure `chmod 775 ~/ehealth-ai/data`

## cPanel Node.js

If available, set **max application instances / workers to 1** (also enforced via `.htaccess` merge script).
