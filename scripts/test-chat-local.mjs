/**
 * Local chat smoke test — run while backend is on :3001
 * Usage: node scripts/test-chat-local.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', 'backend', '.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const base = `http://127.0.0.1:${env.PORT || 3001}`;
const secret = env.APP_API_SECRET;
const headers = { 'Content-Type': 'application/json', 'X-MedAssistant-Key': secret };
const email = `smoke_${Date.now()}@local.test`;
const password = 'SmokeTest123!';

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

const reg = await fetch(`${base}/api/auth/register`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password, name: 'Smoke' }),
});
console.log('register', reg.status, await json(reg));

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password }),
});
const loginData = await json(login);
console.log('login', login.status, loginData.token ? 'token OK' : loginData);

if (!loginData.token) process.exit(1);

const chatHeaders = { ...headers, Authorization: `Bearer ${loginData.token}` };
for (const msg of ['hello', 'Need some help', 'I have a headache']) {
  const chat = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: chatHeaders,
    body: JSON.stringify({ history: [], userText: msg }),
  });
  const data = await json(chat);
  console.log(
    `\nchat "${msg}":`,
    chat.status,
    chat.headers.get('x-chat-engine'),
    data.reply?.slice(0, 120) || data.error?.message || data
  );
}
