# Deploy eHealth AI API on Railway

The **Node.js API** runs on Railway. **cPanel** serves only the static PWA (`www.ehealthaigh.com`).

```
Browser  →  www.ehealthaigh.com  (cPanel — static HTML/JS)
         →  api.ehealthaigh.com   (Railway — /api/*, /admin/api/*, webhooks)
```

---

## 1. Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select `Kwameboat/ehealth-ai`.
3. When asked for the root directory, set: **`backend`**
4. Railway detects `Dockerfile` and `railway.toml` automatically.

---

## 2. Add a persistent volume (required for SQLite)

1. In your Railway service → **Volumes** → **Add Volume**
2. Mount path: **`/data`**
3. In **Variables**, set:

   ```env
   DATABASE_PATH=/data/medassistant.db
   ```

Without a volume, the database resets on every deploy.

---

## 3. Set Railway environment variables

In Railway → **Variables** (production):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/data/medassistant.db` |
| `PUBLIC_APP_URL` | `https://www.ehealthaigh.com` |
| `ALLOWED_ORIGINS` | `https://www.ehealthaigh.com,https://ehealthaigh.com` |
| `APP_API_SECRET` | Same secret as cPanel/GitHub `APP_API_SECRET` |
| `JWT_SECRET` | Strong random string |
| `GEMINI_API_KEY` | Your Google AI key |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | Strong password |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_…` |
| `PAYSTACK_CALLBACK_URL` | `https://www.ehealthaigh.com/payment/callback.html` |

After deploy, copy your Railway public URL (e.g. `https://ehealth-api-production.up.railway.app`).

---

## 4. Custom domain (recommended)

1. Railway → **Settings** → **Networking** → **Custom Domain**
2. Add: **`api.ehealthaigh.com`**
3. In your DNS (cPanel Zone Editor), add a **CNAME**:

   ```
   api.ehealthaigh.com  →  <your-service>.up.railway.app
   ```

4. Use `https://api.ehealthaigh.com` as your API URL everywhere below.

---

## 5. GitHub secrets (auto-deploy)

In GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Purpose |
|--------|---------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens |
| `RAILWAY_PROJECT_ID` | Railway project → Settings → Project ID |
| `RAILWAY_SERVICE_ID` | Service → Settings → Service ID |
| `RAILWAY_PUBLIC_URL` | `https://api.ehealthaigh.com` (or Railway URL) |
| `APP_API_SECRET` | Same as Railway `APP_API_SECRET` |
| `FTP_*`, `SSH_*` | Existing cPanel deploy secrets |

Pushes to `main` will:

- **Deploy API** → Railway (`.github/workflows/deploy-railway.yml`)
- **Deploy PWA** → cPanel static files (`.github/workflows/deploy-cpanel.yml`)

---

## 6. Migrate database from cPanel

Download the existing DB from cPanel (File Manager or FTP):

```
~/ehealth-ai/data/medassistant.db
```

Upload to Railway volume (one-time options):

**Option A — Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway link
railway volume upload /data/medassistant.db ./medassistant.db
```

**Option B — Fresh start**

Skip migration; users re-register. Only use if acceptable.

---

## 7. Stop cPanel Node.js (important)

1. cPanel → **Setup Node.js App** → **STOP** or delete the old app.
2. Next GitHub deploy installs **static-only** `.htaccess` (no Passenger).
3. The site must **not** run Node on cPanel anymore — only Railway serves `/api/*`.

---

## 8. Update webhooks

| Service | New URL |
|---------|---------|
| Paystack webhook | `https://api.ehealthaigh.com/api/payments/webhook` |
| WhatsApp (Evolution) | `https://api.ehealthaigh.com/whatsapp-webhook` |

---

## 9. Verify

```bash
curl https://api.ehealthaigh.com/api/health
# → {"status":"ok","db":true,...}

curl https://www.ehealthaigh.com/app-config.js
# → apiUrl should point to Railway API host
```

Then hard-refresh the app (Ctrl+Shift+R) and test:

- Smart Health Chat
- Ghana Diet Coach
- Admin at `https://www.ehealthaigh.com/admin`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error in browser | Check `ALLOWED_ORIGINS` on Railway includes `https://www.ehealthaigh.com` |
| `db: false` on health | Volume mounted at `/data`, `DATABASE_PATH=/data/medassistant.db` |
| Admin 404 on API | `app-config.js` must have correct `apiUrl`; hard-refresh admin |
| Chat still “Server busy” | Old cPanel Node still running — stop it; confirm `app-config.js` points to Railway |

---

## Cost

Railway Hobby plan (~$5/mo) is enough for this API. You keep cPanel for static files + domain only.
