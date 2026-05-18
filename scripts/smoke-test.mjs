/**
 * Production smoke test — run with backend up: npm run smoke-test
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadBackendEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

loadBackendEnv();

const BASE = (process.env.SMOKE_TEST_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const APP_SECRET = process.env.SMOKE_APP_SECRET || process.env.APP_API_SECRET;
const ADMIN_USER = process.env.SMOKE_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS || 'admin123';

const results = [];
let failed = 0;

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  results.push({ ok: false, name, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { res, data };
}

async function main() {
  console.log(`\nSmoke test → ${BASE}\n`);

  // Health
  try {
    const { res, data } = await request('/api/health');
    if (res.ok && data.status === 'ok') pass('GET /api/health', data.service);
    else fail('GET /api/health', `status ${res.status}`);
  } catch (e) {
    fail('GET /api/health', e.message);
    console.error('\nStart backend: npm run backend\n');
    process.exit(1);
  }

  // PWA static (when WEB_DIST_PATH set, same server serves these)
  for (const asset of ['/manifest.json', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png']) {
    try {
      const res = await fetch(`${BASE}${asset}`);
      if (res.ok) pass(`GET ${asset}`, `${res.headers.get('content-type') || res.status}`);
      else fail(`GET ${asset}`, `HTTP ${res.status}`);
    } catch (e) {
      fail(`GET ${asset}`, e.message);
    }
  }

  // Admin login + protected routes
  let adminToken;
  try {
    const { res, data } = await request('/admin/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    if (res.ok && data.token) {
      adminToken = data.token;
      pass('Admin login');
    } else fail('Admin login', data?.error?.message || `HTTP ${res.status}`);
  } catch (e) {
    fail('Admin login', e.message);
  }

  if (adminToken) {
    const auth = { Authorization: `Bearer ${adminToken}` };
    for (const route of ['/admin/api/point-packages', '/admin/api/integrations', '/admin/api/settings']) {
      const { res, data } = await request(route, { headers: auth });
      if (res.ok) pass(`GET ${route}`);
      else fail(`GET ${route}`, `HTTP ${res.status}`);
    }
  }

  // App API (requires APP_API_SECRET)
  if (!APP_SECRET) {
    fail('App API auth', 'Set APP_API_SECRET or SMOKE_APP_SECRET in env');
  } else {
    const appHeaders = { 'X-MedAssistant-Key': APP_SECRET };
    const testEmail = `smoke_${Date.now()}@test.local`;
    const { res: regRes, data: regData } = await request('/api/auth/register', {
      method: 'POST',
      headers: appHeaders,
      body: JSON.stringify({
        email: testEmail,
        password: 'smoke123456',
        fullName: 'Smoke Test',
      }),
    });
    if (regRes.ok && regData.token) {
      pass('POST /api/auth/register');
      const { res: meRes } = await request('/api/me', {
        headers: { ...appHeaders, Authorization: `Bearer ${regData.token}` },
      });
      if (meRes.ok) pass('GET /api/me');
      else fail('GET /api/me', `HTTP ${meRes.status}`);
    } else if (regRes.status === 409) {
      pass('POST /api/auth/register', 'skipped (duplicate)');
    } else {
      fail('POST /api/auth/register', regData?.error?.message || `HTTP ${regRes.status}`);
    }
  }

  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
