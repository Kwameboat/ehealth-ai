# Fix GLIBC_2.29 / better-sqlite3 on cPanel

## Problem

API returns:

`GLIBC_2.29 not found ... nodevenv/.../lib/node_modules/better-sqlite3`

cPanel loads a **prebuilt** `better-sqlite3` from `nodevenv`, not your app. Your server has an older glibc.

## Fix (Terminal)

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH

cd /home/ehealtha/ehealth-ai/backend

# Remove broken cPanel global copies
rm -rf /home/ehealtha/nodevenv/ehealth-ai/20/lib/node_modules/better-sqlite3
rm -rf /home/ehealtha/nodevenv/ehealth-ai/22/lib/node_modules/better-sqlite3

# Install ALL backend dependencies (do NOT run npm install better-sqlite3 alone — skips bcryptjs)
npm install --omit=dev
npm rebuild better-sqlite3 --build-from-source

find node_modules/better-sqlite3 -name "*.node" -type f
unset NODE_PATH
node -e "require('./db/init').initDatabase(); console.log('DB OK');"
```

Must print **`DB OK`**.

## cPanel

1. **RESTART** Node.js app  
2. Browser: https://www.ehealthaigh.com/api/health → `"status":"ok","db":true`  
3. Login: https://www.ehealthaigh.com/admin  

## If build-from-source fails

Ask host to enable **C++ compiler** / `make`, or use Node **18** in cPanel and repeat.

If still failing, contact Stormerhost: "Need to compile native Node modules (better-sqlite3) on shared hosting."
