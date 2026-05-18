# Fix admin login & API 404

## Symptoms

- `/api/health` → LiteSpeed **404 Not Found**
- Admin login → **Request failed** or **API not found (404)**

## Root cause

The Node backend must run via **Phusion Passenger** (cPanel Node.js app). Each deploy must **keep** the Passenger block in `public_html/.htaccess`. Code lives in `~/ehealth-ai/` (FTP) and is synced to `~/ehealth_ai/` (your cPanel app root).

## cPanel setup

### 1. Create / verify Node.js app

| Field | Value |
|-------|--------|
| Node.js version | 18 or 20 (22 OK) |
| Application mode | Production |
| Application root | `ehealth_ai` |
| Application URL | `ehealthaigh.com` |
| Application startup file | `backend/server.js` |

### 2. Environment variables

```
NODE_ENV=production
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
APP_API_SECRET=...
JWT_SECRET=...          (must differ from APP_API_SECRET)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=...
ALLOWED_ORIGINS=https://ehealthaigh.com,https://www.ehealthaigh.com,http://ehealthaigh.com
WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
```

Replace `ehealtha` with your cPanel username if different.

### 3. Install & restart

1. **Run NPM Install**
2. **RESTART** the app (injects Passenger into `.htaccess`)

### 4. SSL

**SSL/TLS Status** → **Run AutoSSL** for `ehealthaigh.com`

### 5. Test

- http://ehealthaigh.com/api/health → JSON
- http://ehealthaigh.com/admin → login **admin** / your `ADMIN_PASSWORD`

## After every GitHub deploy

Deploy runs `scripts/cpanel-post-deploy.sh` which:

- Syncs `ehealth-ai` → `ehealth_ai`
- Publishes PWA + admin static files
- **Merges** `.htaccess` without removing Passenger

If API breaks after deploy: click **RESTART** once in cPanel Node.js app.
