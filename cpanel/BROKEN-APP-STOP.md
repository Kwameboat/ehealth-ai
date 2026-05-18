# App won’t STOP in cPanel (venv missing)

If you see **Unable to find app venv folder** … `/nodevenv/ehealth-ai`, the Node.js UI **cannot STOP or RESTART** the app. The app is already not running correctly (API 503).

## Option 1 — DESTROY (recommended)

You do **not** need STOP before destroy.

1. **Setup Node.js App** → your app
2. Click **DESTROY** (red, top right)
3. Confirm

Then follow **`cpanel/FIX-VENV-ERROR.md`** to create a fresh app.

## Option 2 — Kill processes in Terminal

cPanel → **Terminal**:

```bash
pkill -u "$(whoami)" -f "ehealth-ai" 2>/dev/null || true
pkill -u "$(whoami)" -f "Passenger.*ehealth" 2>/dev/null || true
echo "Done. Ignore 'no process' messages."
```

Then **DESTROY** the app in the UI, or fix `package.json` and **Run NPM Install**.

## Option 3 — Fix package.json, then NPM Install

Terminal:

```bash
cd /home/ehealtha/ehealth-ai
cp -f package.json package.json.expo 2>/dev/null || true
cat > package.json << 'EOF'
{
  "name": "ehealth-ai-api",
  "private": true,
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18" }
}
EOF
ls backend/server.js || echo "ERROR: upload or deploy backend/ folder first"
```

Then in Node.js app: **Run NPM Install** → **RESTART**.

## If DESTROY also errors

Open a **Stormerhost support ticket**: ask them to remove the broken Node.js application **ehealth-ai** for user **ehealtha**.
