# Fix 503 on admin login

## Cause

**503** = Node app is not running on the server (Passenger cannot start it).  
SSL can be fine while the API is still down.

## Fix in cPanel (do in order)

### 1. Change startup file (important)

**Setup Node.js App** → edit your app:

| Field | Set to |
|-------|--------|
| Application startup file | **`server.js`** (root file, not `backend/server.js`) |

Click **SAVE**.

### 2. Add env vars if missing

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://ehealthaigh.com,https://www.ehealthaigh.com,http://ehealthaigh.com,http://www.ehealthaigh.com` |

### 3. Stop → Install → Start

1. **STOP APP**
2. **Run NPM Install**
3. **RESTART**

### 4. Test API

Open: **https://www.ehealthaigh.com/api/health**

- **Good:** `{"status":"ok","db":true,...}`
- **DB error JSON:** run **Run NPM Install** again, then **RESTART**
- **HTML 503 page:** click **RESTART** again; check `~/ehealth_ai/startup-check.log` in File Manager

### 5. Admin login

**https://www.ehealthaigh.com/admin** — `admin` / your `ADMIN_PASSWORD` (default `admin123`)

## Keep these settings

| Field | Value |
|-------|--------|
| Application root | `ehealth_ai` |
| Application URL | `ehealthaigh.com` |

Code deploys to `ehealth-ai` and syncs to `ehealth_ai` automatically.
