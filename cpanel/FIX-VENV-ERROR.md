# Fix: "Unable to find app venv folder" / %(app_venv)s

cPanel cannot find the Node virtual environment for this app. The app registration is **broken**. Repair by **recreating** the Node.js app with the **same folder name as GitHub deploy**.

## Step 1 — Destroy the broken app

1. **Setup Node.js App**
2. Open **ehealth_ai** (or ehealthaigh.com)
3. Click **DESTROY** (top right)
4. Confirm

## Step 2 — Create a new app

Click **Create Application**:

| Field | Value |
|-------|--------|
| Node.js version | **22** (or 20) |
| Application mode | **Production** |
| Application root | **`ehealth-ai`** ← hyphen, matches FTP deploy |
| Application URL | `ehealthaigh.com` |
| Application startup file | **`server.js`** |

Click **CREATE**.

## Step 3 — Environment variables

Click **ADD VARIABLE** for each:

```
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
APP_API_SECRET=your_secret
JWT_SECRET=your_different_jwt_secret
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.0-flash
ALLOWED_ORIGINS=https://ehealthaigh.com,https://www.ehealthaigh.com,http://ehealthaigh.com,http://www.ehealthaigh.com
DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
```

Replace `ehealtha` with your cPanel username if different.

Click **SAVE**.

## Step 4 — Install and start

1. **Run NPM Install** (must succeed — creates `nodevenv/ehealth-ai/`)
2. **RESTART**

## Step 5 — Test

- https://www.ehealthaigh.com/api/health → JSON `{"status":"ok",...}`
- https://www.ehealthaigh.com/admin → login

## Why this happened

Deploy uploads to **`ehealth-ai`**. The old app used **`ehealth_ai`** (underscore). cPanel created a venv for one name but files lived in the other — the venv path broke.

**Always use application root: `ehealth-ai`** (hyphen).
