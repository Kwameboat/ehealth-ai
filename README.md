# eHealth AI

AI-powered health assistance app (Expo + React Native) with admin dashboard, points economy, Paystack payments, and PWA support.

**Tagline:** AI Health Assistance — Not a Doctor

## Stack

- **App:** Expo SDK 53, React Native, expo-router (web + mobile)
- **API:** Node.js, Express, SQLite (`better-sqlite3`)
- **AI:** Google Gemini (server-side)
- **Payments:** Paystack

## Quick start

```bash
# Install
npm install
cd backend && npm install && cd ..

# Configure (copy examples, add your keys)
cp .env.example .env
cp backend/.env.example backend/.env

# Run API
npm run backend

# Run app (separate terminal)
npx expo start --web
```

- **App:** http://localhost:8081  
- **API + Admin:** http://127.0.0.1:3001 — admin at `/admin` (default `admin` / `admin123` — change in production)

## Production

See [DEPLOY.md](./DEPLOY.md) for GitHub → cPanel deployment, PWA install prompt, and smoke tests.

```bash
npm run build:web
npm run smoke-test
```

## License

Private — all rights reserved.
