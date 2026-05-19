# Stable updates (do not break production)

## Golden rules

1. **Never** run `npm install` only inside `backend/` without removing parent `package-lock.json`.
2. **DATABASE_PATH** must be: `/home/ehealtha/ehealth-ai/data/medassistant.db` (not `backend/db/`).
3. After any code update: **RESTART** Node.js app in cPanel.
4. **`/api/health` shows LiteSpeed 404 HTML** → run **`bash ~/ehealth-ai/cpanel/fix-api-404.sh`** then RESTART Node.
5. Admin 503 / `db:false` → **`bash ~/ehealth-ai/cpanel/repair-production.sh`** then RESTART Node.

## cPanel environment (keep these)

| Variable | Value |
|----------|--------|
| `DATABASE_PATH` | `/home/ehealtha/ehealth-ai/data/medassistant.db` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `APP_API_SECRET` | (your secret) |
| `JWT_SECRET` | (your secret) |
| `WEB_DIST_PATH` | `/home/ehealtha/ehealth-ai/dist` |

## Safe update flow

1. Push to GitHub `main` → wait for deploy workflow (green).
2. SSH/Terminal:
   ```bash
   bash ~/ehealth-ai/cpanel/repair-production.sh
   ```
3. cPanel → Node.js → **RESTART**
4. Verify:
   - https://www.ehealthaigh.com/api/health → `"db":true`
   - https://www.ehealthaigh.com/admin → dashboard loads
   - Register / Health Chat works

## What repair script does (safe)

- Updates backend JS from GitHub (no wipe of `data/medassistant.db`)
- Clears stale `*.lock` / `*.tmp` only
- Ensures `data/` folder and wasm file exist
- Verifies DB + Gemini model
- Does **not** delete user data

## Do not

- Delete `~/ehealth-ai/data/medassistant.db` unless you want a fresh database
- Run `curl -o ~/public_html/.htaccess` (removes Passenger → API 404). Use `fix-api-404.sh` instead
- Change `Application root` away from `ehealth-ai`
