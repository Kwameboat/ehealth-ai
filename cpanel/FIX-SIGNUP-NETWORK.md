# Fix signup "NetworkError when attempting to fetch resource"

## Cause

1. PWA missing **API key** header (`X-MedAssistant-Key`) — must match cPanel `APP_API_SECRET`
2. Or **CORS** blocking the custom header (fixed in latest `server.js`)

## Quick fix on server (no full redeploy)

```bash
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

curl -fsSL -o ~/ehealth-ai/backend/server.js "$BASE/backend/server.js"
curl -fsSL -o ~/public_html/.htaccess "$BASE/public_html.htaccess"

# Inject runtime config script into PWA (if not already there)
INDEX=~/public_html/index.html
grep -q 'app-config.js' "$INDEX" || sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$INDEX"

# Test config + API
curl -s https://www.ehealthaigh.com/app-config.js | head -c 120
curl -s https://www.ehealthaigh.com/api/health
```

`app-config.js` should include `"appApiSecret":"..."` (same as cPanel `APP_API_SECRET`).

**RESTART** Node.js app in cPanel, then hard-refresh the site (Ctrl+Shift+R) and try signup again.

## cPanel checks

| Variable | Must match |
|----------|------------|
| `APP_API_SECRET` | Set (long random string) |
| GitHub secret `APP_API_SECRET` | Same value (for future builds) |
| `ALLOWED_ORIGINS` | Include `https://www.ehealthaigh.com` and `https://ehealthaigh.com` |

## Test register from terminal

```bash
SECRET='YOUR_APP_API_SECRET_FROM_CPANEL'
curl -s -X POST https://www.ehealthaigh.com/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-MedAssistant-Key: $SECRET" \
  -d '{"email":"test@example.com","password":"test1234","fullName":"Test"}'
```

Should return JSON with `"token"` (or 409 if email exists), not HTML or connection error.
