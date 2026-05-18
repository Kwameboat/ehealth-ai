# One-time production fix (API 404 + admin login)

## What went wrong

1. **Deploy replaced `.htaccess`** and removed cPanel’s **Passenger** block, so `/api/*` never reached Node (LiteSpeed 404).
2. **FTP deploys to `ehealth-ai`** but your Node app root is **`ehealth_ai`** — code was out of sync.

GitHub deploy now runs `scripts/cpanel-post-deploy.sh` to fix both automatically.

## Do this once in cPanel (2 minutes)

### 1. Add missing env var

In **Setup Node.js App** → **Environment variables** → **ADD VARIABLE**:

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |

Click **SAVE**.

### 2. Install dependencies on the server

Click **Run NPM Install** in the Node.js app screen (installs into `ehealth_ai` with the correct Node version).

### 3. Restart Node (required)

Click **RESTART** (not just Save).

This applies Passenger + restarts the API. **Required after every deploy** if you see 503 or login errors.

### 4. Run AutoSSL

**SSL/TLS Status** → **Run AutoSSL** for `ehealthaigh.com` (fixes “Dangerous” / broken HTTPS).

### 5. Test

| URL | Expected |
|-----|----------|
| http://ehealthaigh.com/api/health | JSON: `{"status":"ok",...}` |
| http://ehealthaigh.com/admin | Styled login |
| Login `admin` / `admin123` | Dashboard loads |

Use **http://** until AutoSSL finishes if HTTPS still warns.

## Your Node app settings (keep as-is)

| Field | Value |
|-------|--------|
| Application root | `ehealth_ai` |
| Startup file | `server.js` (root — loads `backend/server.js`) |
| Application URL | `ehealthaigh.com` |

If startup is still `backend/server.js`, that also works after the latest deploy.

Deploy syncs `~/ehealth-ai/` → `~/ehealth_ai/` on every push.

## Security

Rotate **GEMINI_API_KEY** if it was shared in a screenshot. Do not commit `.env` to GitHub.
