# Deploy eHealth AI (GitHub → cPanel)

## Auto-deploy from GitHub (recommended)

Every push to `main` runs [.github/workflows/deploy-cpanel.yml](.github/workflows/deploy-cpanel.yml).

**Add these secrets** in GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Example |
|--------|---------|
| `FTP_SERVER` | `ftp.ehealthaigh.com` |
| `FTP_USERNAME` | cPanel user |
| `FTP_PASSWORD` | cPanel password |
| `FTP_PORT` | `21` |
| `FTP_REMOTE_DIR` | `./ehealth-ai/` |
| `APP_API_SECRET` | same as server `APP_API_SECRET` |

Then complete one-time cPanel Node setup: [cpanel/SETUP.md](cpanel/SETUP.md).

Manual run: **Actions** tab → **Deploy to cPanel** → **Run workflow**.

---

## Prerequisites

- Node.js 18+ on cPanel (Setup Node.js App)
- HTTPS enabled (required for PWA install prompt)
- Paystack + Gemini keys

## 1. Push to GitHub

Do not commit secrets. Only commit `.env.example` files.

```bash
git init
git add .
git commit -m "eHealth AI production build"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 2. Build on server (or locally, then upload `dist/`)

```bash
npm ci
npm run pwa:icons
cp .env.example .env   # edit EXPO_PUBLIC_APP_API_SECRET (match backend)
npm run build:web
```

## 3. Backend `.env` (cPanel Node app)

Create `backend/.env`:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
GEMINI_API_KEY=...
APP_API_SECRET=...          # same as EXPO_PUBLIC_APP_API_SECRET in app .env
JWT_SECRET=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong_password_here
ALLOWED_ORIGINS=https://yourdomain.com
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_CALLBACK_URL=https://yourdomain.com/payment/callback.html
DATABASE_PATH=/home/USER/ehealth/data/medassistant.db
WEB_DIST_PATH=/home/USER/ehealth/dist
```

## 4. cPanel Node.js application

1. **Setup Node.js App** → Create application  
2. Application root: project folder (e.g. `ehealth`)  
3. Application startup file: `backend/server.js`  
4. Run `npm install` in project root and `npm install` in `backend/`  
5. Environment variables: copy from `backend/.env` or set in cPanel UI  
6. Map domain/subdomain to this app (HTTPS)

## 5. Paystack webhook

In Paystack dashboard → Webhooks:

`https://yourdomain.com/api/payments/webhook`

## 6. Verify

```bash
npm run smoke-test
# SMOKE_TEST_BASE=https://yourdomain.com APP_API_SECRET=... npm run smoke-test
```

Open `https://yourdomain.com` — install prompt should appear (Chrome/Edge Android/desktop after ~3s).

## PWA checklist

| Item | Location |
|------|----------|
| manifest | `/manifest.json` |
| service worker | `/sw.js` |
| icons 192/512 | `/icons/icon-192.png`, `/icons/icon-512.png` |
| Install UI | `PwaInstallPrompt` in app layout |
| HTTPS | Required in production |

## Troubleshooting

- **Install prompt missing**: Use HTTPS; check DevTools → Application → Manifest & Service Workers.
- **API 401**: `EXPO_PUBLIC_APP_API_SECRET` must match `APP_API_SECRET`.
- **CORS errors**: Add your site URL to `ALLOWED_ORIGINS` (only needed if API and app are on different domains).
- **Admin 404 on packages**: Restart Node app after deploy.
