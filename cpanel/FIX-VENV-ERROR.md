# Fix: Unable to find app venv folder `/home/ehealtha/nodevenv/ehealth-ai`

## Why it happens

cPanel **Run NPM Install** reads the **root** `package.json`. That file lists **Expo / React Native** (hundreds of packages). On shared hosting the install **fails or times out**, so cPanel never creates:

`/home/ehealtha/nodevenv/ehealth-ai/`

The API only needs **`backend/package.json`** (small).

## Fix A — cPanel Terminal (fastest, do this now)

1. cPanel → **Terminal**
2. Paste and run:

```bash
cd /home/ehealtha/ehealth-ai
cp -f package.json package.json.expo 2>/dev/null || true
cat > package.json << 'EOF'
{
  "name": "ehealth-ai-api",
  "private": true,
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18" }
}
EOF
ls -la backend/server.js || echo "MISSING backend/ — wait for GitHub deploy or upload backend folder"
```

3. **Setup Node.js App** → **Run NPM Install** (no `cd backend` in package.json)
4. If `backend/` exists, in Terminal:

```bash
source /home/ehealtha/nodevenv/ehealth-ai/22/bin/activate
cd /home/ehealtha/ehealth-ai/backend
npm install --omit=dev
npm rebuild better-sqlite3
```

5. **ADD VARIABLE** — re-add all env vars (NODE_ENV, GEMINI_API_KEY, etc.)
6. **RESTART**
7. Test: https://www.ehealthaigh.com/api/health

## Fix B — Recreate the Node app

If Fix A still shows the red venv error:

1. **DESTROY** the Node.js app
2. **Create Application**:
   - Root: **`ehealth-ai`**
   - Startup: **`server.js`**
   - URL: `ehealthaigh.com`
3. Run Fix A Terminal commands **first**, then **Run NPM Install** → **RESTART**

## App settings (keep)

| Field | Value |
|-------|--------|
| Application root | `ehealth-ai` |
| Startup file | `server.js` |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/home/ehealtha/ehealth-ai/backend/db/medassistant.db` |
| `WEB_DIST_PATH` | `/home/ehealtha/ehealth-ai/dist` |

GitHub deploy now swaps in the slim `package.json` automatically on each release.
