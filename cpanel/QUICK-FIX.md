# Fix 503 + "Unable to find app venv folder"

## Red error in cPanel

> Unable to find app venv folder by this path: '%(app_venv)s'

The Node.js app is **broken**. You must **destroy it and create a new one** with root **`ehealth-ai`** (hyphen).

**Full steps:** see **`cpanel/FIX-VENV-ERROR.md`**

### Short version

1. **DESTROY** the current Node.js app (`ehealth_ai`)
2. **Create Application** with root **`ehealth-ai`**, startup **`server.js`**, URL **ehealthaigh.com**
3. Re-add env vars (include **`NODE_ENV=production`**)
4. **Run NPM Install** → must complete without red errors
5. **RESTART**
6. Test: https://www.ehealthaigh.com/api/health

### Env paths (use hyphen `ehealth-ai`)

```
DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
```

Do **not** use application root `ehealth_ai` (underscore) — that caused the venv error.
