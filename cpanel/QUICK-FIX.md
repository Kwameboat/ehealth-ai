# cPanel Node.js — venv + 503 fix

## Error you see

`Unable to find app venv folder: /home/ehealtha/nodevenv/ehealth-ai`

**Cause:** Root `package.json` tried to install Expo on the server and failed.

**Fix:** Use the slim API `package.json` — see **`cpanel/FIX-VENV-ERROR.md`** (Terminal commands).

Then: **Run NPM Install** → **RESTART** → test `/api/health`.
