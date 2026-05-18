# cPanel setup — ehealthaigh.com

## 1. GitHub Actions secrets

In GitHub → **ehealth-ai** → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value |
|--------|--------|
| `FTP_SERVER` | `ftp.ehealthaigh.com` |
| `FTP_USERNAME` | your cPanel username |
| `FTP_PASSWORD` | your cPanel password |
| `FTP_PORT` | `21` (optional) |
| `FTP_REMOTE_DIR` | `./ehealth-ai/` (folder under your FTP home) |
| `APP_API_SECRET` | same long random string as on the server |

Push to `main` or run **Actions → Deploy to cPanel → Run workflow**.

## 2. First-time server setup (cPanel)

### A. Create folder

In **File Manager** or FTP, ensure `/home/USERNAME/ehealth-ai/` exists (or match `FTP_REMOTE_DIR`).

### B. Node.js application

1. cPanel → **Setup Node.js App** → Create application  
2. **Node version:** 18 or 20  
3. **Application root:** `ehealth-ai`  
4. **Application URL:** `ehealthaigh.com`  
5. **Application startup file:** `backend/server.js`  
6. Click **Create**

### C. Install dependencies (Terminal or cPanel “Run NPM Install”)

```bash
cd ~/ehealth-ai
npm install --production
cd backend && npm install --production
```

### D. Environment variables (cPanel Node.js UI or `backend/.env`)

```env
NODE_ENV=production
HOST=0.0.0.0
GEMINI_API_KEY=your_key
APP_API_SECRET=your_secret
JWT_SECRET=your_jwt_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me
ALLOWED_ORIGINS=https://ehealthaigh.com,https://www.ehealthaigh.com
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_CALLBACK_URL=https://ehealthaigh.com/payment/callback.html
DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
```

Replace `ehealtha` with your actual cPanel username if different.

### E. Restart Node app

cPanel → Node.js → **Restart** after each deploy.

## 3. SSL

cPanel → **SSL/TLS** → AutoSSL or Let's Encrypt for `ehealthaigh.com`.

## 4. Verify

- https://ehealthaigh.com/api/health  
- https://ehealthaigh.com/admin  
- PWA install prompt on mobile Chrome  

## Security

Rotate your cPanel/FTP password if it was ever shared in email or chat. Never commit `.env` files to GitHub.
