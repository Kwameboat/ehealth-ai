# Fix admin login — "Failed to fetch"

The admin page is HTML only. Login calls **`/admin/api/login`**, which needs the **Node.js backend**.

LiteSpeed is serving `public_html` (static files). The API is in `~/ehealth-ai/` but Node is not running yet.

## Fix (cPanel — about 5 minutes)

### 1. Create Node.js app

1. **cPanel** → search **Setup Node.js App**
2. **Create Application**
3. Fill in:

| Field | Value |
|-------|--------|
| Node.js version | **18** or **20** |
| Application mode | **Production** |
| Application root | `ehealth-ai` |
| Application URL | `ehealthaigh.com` |
| Application startup file | `backend/server.js` |

4. **Create**

### 2. Environment variables

In the same Node.js screen, add variables (or create `~/ehealth-ai/backend/.env`):

```
NODE_ENV=production
GEMINI_API_KEY=your_key
APP_API_SECRET=medassistant_dev_secret_change_in_production
JWT_SECRET=any_long_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123
ALLOWED_ORIGINS=https://ehealthaigh.com,http://ehealthaigh.com
WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
```

Use your real cPanel username instead of `ehealtha` if different.

### 3. Install & start

1. Click **Run NPM Install** (runs in `ehealth-ai`)
2. Open **Terminal** in cPanel:
   ```bash
   cd ~/ehealth-ai/backend && npm install
   ```
3. Click **Restart** on the Node.js app

### 4. SSL

**SSL/TLS Status** → **Run AutoSSL** for `ehealthaigh.com`

### 5. Test

- http://ehealthaigh.com/api/health → should show JSON `{"status":"ok",...}`
- https://ehealthaigh.com/admin → login **admin** / password from `ADMIN_PASSWORD` (default seed: **admin123** if never set)

## Default admin (first install only)

- Username: `admin`
- Password: `admin123` (unless you set `ADMIN_PASSWORD` in `.env` before first DB seed)

If you already set `ADMIN_PASSWORD` in `.env` before the app first ran, use that password instead.
