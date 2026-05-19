# Fix API 404 (LiteSpeed "Not Found" on /api/health)

## What it means

HTML **404** from LiteSpeed = `/api` is **not** reaching Node.js.  
Admin **"API not found (404)"** is the same issue.

**Common cause:** `.htaccess` was overwritten without the **Passenger** block (e.g. old `repair-production.sh` used `curl` on `.htaccess`).

## Quick fix (30 seconds)

```bash
bash ~/ehealth-ai/cpanel/fix-api-404.sh
```

Then **cPanel → Setup Node.js App → RESTART**.

Open https://www.ehealthaigh.com/api/health — you must see **JSON**, not HTML "404 Not Found".

## Checklist (if quick fix fails)

### 1. Files exist (Terminal)

```bash
ls -la /home/ehealtha/ehealth-ai/server.js
ls -la /home/ehealtha/ehealth-ai/backend/server.js
ls -la /home/ehealtha/nodevenv/ehealth-ai/22/bin/node
```

All three must exist. If `backend` is missing, wait for GitHub deploy or re-run deploy workflow.

### 2. Slim package.json (Terminal)

```bash
cd /home/ehealtha/ehealth-ai
cat > package.json << 'EOF'
{
  "name": "ehealth-ai-api",
  "private": true,
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18" }
}
EOF
```

### 3. cPanel Node.js app

| Field | Value |
|-------|--------|
| Application root | `ehealth-ai` |
| Startup file | `server.js` |

1. **Run NPM Install** (must succeed)
2. Add all **environment variables** (NODE_ENV, secrets, DATABASE_PATH, etc.)
3. **SAVE**
4. **RESTART** ← writes Passenger into `public_html/.htaccess`

### 4. Install backend deps (Terminal)

```bash
source /home/ehealtha/nodevenv/ehealth-ai/22/bin/activate
cd /home/ehealtha/ehealth-ai/backend
npm install --omit=dev
npm rebuild better-sqlite3
```

### 5. Verify Passenger in .htaccess

```bash
grep -i "PASSENGER CONFIGURATION" /home/ehealtha/public_html/.htaccess | head -2
```

Must show lines. If empty → click **RESTART** again in cPanel.

### 6. Test

https://www.ehealthaigh.com/api/health → JSON `{"status":"ok",...}`
