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

# Parent package-lock.json breaks backend install (only ~39 packages, no express)
rm -f ../package-lock.json
rm -rf node_modules package-lock.json

npm install --omit=dev express@4.21.2 cors@2.8.5 dotenv@16.4.7 bcryptjs@2.4.3 jsonwebtoken@9.0.2 better-sqlite3@9.6.0
npm rebuild better-sqlite3 --build-from-source

ls node_modules/express node_modules/bcryptjs

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
