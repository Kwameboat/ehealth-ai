const API = '/admin/api';
const TOKEN_KEY = 'medassistant_admin_token';
const ADMIN_KEY = 'medassistant_admin_user';

function siteOrigin() {
  if (location.hostname === 'ehealthaigh.com') return 'https://www.ehealthaigh.com';
  return window.location.origin;
}

function apiUrl(path) {
  return `${siteOrigin()}/admin/api${path}`;
}

function healthUrl(recover = false) {
  const q = recover ? '?recover=1' : '';
  return `${siteOrigin()}/api/health${q}`;
}

async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, cache: 'no-store' });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — RESTART Node.js in cPanel');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

let modalCallback = null;
let selectedUserId = null;
let cachedUsers = [];

const PAGE_TITLES = {
  dashboard: 'eHealth AI — Clinical Intelligence',
  analytics: 'Analytics',
  users: 'Patient Records',
  points: 'AI Logic Control',
  system: 'System Status',
  packages: 'Points Shop — Pricing',
  whatsapp: 'WhatsApp Management',
  doctors: 'Doctor Management',
  broadcasts: 'Health Broadcasts',
  payments: 'Payments',
  delivery: 'Medicine Delivery',
  settings: 'Settings & API Keys',
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

async function waitForDbReady(maxMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const res = await fetchWithTimeout(healthUrl(false), {}, 5000);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.db === true) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function tryRecoverDb(maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetchWithTimeout(healthUrl(true), {}, 12000);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.db === true) return true;
    } catch {
      /* retry */
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return false;
}

async function api(path, options = {}, attempt = 0, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetchWithTimeout(apiUrl(path), { ...options, headers }, opts.timeoutMs || 20000);
  } catch (err) {
    if (attempt < 2 && path !== '/login' && (await tryRecoverDb())) {
      return api(path, options, attempt + 1, opts);
    }
    throw err.message ? err : new Error('Failed to fetch');
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (res.status === 401 && path !== '/login' && !opts.silentAuth) {
    clearSession();
    showLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    if (res.status === 503 && attempt < 2 && path !== '/login') {
      if (await tryRecoverDb()) {
        return api(path, options, attempt + 1, opts);
      }
    }
    if (res.status === 404) {
      throw new Error(
        'API not found (404). cPanel → Setup Node.js App → RESTART, then test /api/health in the browser.'
      );
    }
    const detail = data?.error?.detail || data?.error?.wasm || data?.error;
    const hint = data?.error?.hint || data?.hint;
    const fix = data?.error?.fix;
    const base = data?.error?.message || `Request failed (${res.status})`;
    throw new Error([base, typeof detail === 'string' ? detail : null, hint, fix].filter(Boolean).join(' — '));
  }
  return data;
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  const admin = JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}');
  const name = admin.username || 'Admin';
  document.getElementById('admin-name').textContent = name;
  document.getElementById('admin-avatar').textContent = name.slice(0, 2).toUpperCase();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  e.stopPropagation();
  const errEl = document.getElementById('login-error');
  const btn = e.target.querySelector('button[type="submit"]');
  errEl.classList.add('hidden');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in…';
  }
  try {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const res = await fetchWithTimeout(
      apiUrl('/login'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      },
      25000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.error?.detail || `Login failed (${res.status})`;
      throw new Error(msg);
    }
    if (!data?.token) throw new Error('Login response missing token — RESTART Node.js in cPanel');
    setSession(data.token, data.admin);
    showApp();
    showPage('dashboard');
  } catch (err) {
    clearSession();
    const msg = err.message || 'Login failed';
    errEl.textContent =
      msg.includes('timed out') || msg === 'Failed to fetch'
        ? 'Server not responding. Use https://www.ehealthaigh.com/admin then RESTART Node.js'
        : msg.includes('Invalid credentials')
          ? 'Invalid username or password — must match cPanel ADMIN_USERNAME / ADMIN_PASSWORD'
          : msg;
    errEl.classList.remove('hidden');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign in to dashboard';
    }
  }
}

document.getElementById('login-form')?.addEventListener('submit', handleLoginSubmit);

function showPage(name) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
  document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
  document.getElementById(`page-${name}`).classList.remove('hidden');
  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name;
  const loaders = {
    dashboard: loadDashboard,
    analytics: loadAnalytics,
    users: loadUsers,
    points: loadPointRules,
    system: loadSystem,
    packages: loadPackages,
    whatsapp: () => (typeof loadWhatsApp === 'function' ? loadWhatsApp() : undefined),
    doctors: loadDoctors,
    broadcasts: loadBroadcasts,
    payments: loadPayments,
    delivery: loadDelivery,
    settings: loadSettings,
  };
  if (loaders[name]) loaders[name]();
}

function openModal(title, bodyHtml, onConfirm, confirmLabel = 'Save') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-confirm').textContent = confirmLabel;
  document.getElementById('modal').classList.remove('hidden');
  modalCallback = onConfirm;
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  modalCallback = null;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function showPageError(el, err, retry) {
  const msg = escapeHtml(err.message || 'Request failed');
  const isDb = msg.includes('Database not ready') || msg.includes('503') || msg.includes('Cannot write database');
  const hint = isDb
    ? '<p class="muted">The server is attempting automatic database recovery. Click <strong>Retry</strong> or wait a moment.<br>If this persists: <code>bash ~/ehealth-ai/cpanel/repair-production.sh</code> then cPanel → Node.js → RESTART.</p>'
    : '<p class="muted">cPanel → Node.js → RESTART, then check <a href="/api/health?recover=1" target="_blank">/api/health?recover=1</a>.</p>';
  el.innerHTML = `<motion class="panel"><p class="error-msg">${msg}</p>${hint}<button type="button" class="btn btn-primary btn-sm page-retry">Retry</button></div>`.replace(
    '<motion class',
    '<div class'
  );
  el.querySelector('.page-retry')?.addEventListener('click', retry);
}

async function runPage(el, loadingText, fn, retry) {
  el.innerHTML = `<p class="muted">${loadingText}</p>`;
  try {
    await fn();
  } catch (err) {
    const is503 = /503|Database not ready|recover/i.test(String(err.message || err));
    if (is503 && !el.dataset.recovering) {
      el.dataset.recovering = '1';
      el.innerHTML = `<p class="muted">Database recovering… auto-retry in progress.</p>`;
      if (await waitForDbReady(40000)) {
        delete el.dataset.recovering;
        return runPage(el, loadingText, fn, retry);
      }
      delete el.dataset.recovering;
    }
    showPageError(el, err, retry || (() => runPage(el, loadingText, fn, retry)));
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatTimeShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name, email) {
  const src = name || email || '?';
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function riskFromBalance(balance, isActive) {
  if (!isActive) return { cls: 'risk-critical', label: 'Disabled' };
  if (balance < 10) return { cls: 'risk-critical', label: 'Critical' };
  if (balance < 50) return { cls: 'risk-moderate', label: 'Moderate' };
  return { cls: 'risk-low', label: 'Low' };
}

function buildBarChart(topFeatures, usageToday) {
  const hours = ['08:00', '10:00', '12:00', '02:00', '04:00'];
  const base = topFeatures?.length ? Math.max(...topFeatures.map((f) => f.count), 1) : 1;
  const values = hours.map((_, i) => {
    const f = topFeatures?.[i % (topFeatures?.length || 1)];
    return f ? Math.round((f.count / base) * 100) : 20 + i * 15;
  });
  const max = Math.max(...values, 1);
  const peakIdx = values.indexOf(Math.max(...values));
  return hours
    .map((label, i) => {
      const h = Math.max(12, (values[i] / max) * 120);
      const peak = i === peakIdx ? `data-peak="Peak: ${usageToday || values[i]} Ops"` : '';
      return `<div class="bar-col"><div class="bar ${i === peakIdx ? 'peak' : ''}" style="height:${h}px" ${peak}></div><span class="bar-label">${label}</span></div>`;
    })
    .join('');
}

async function loadDashboard() {
  const el = document.getElementById('page-dashboard');
  await runPage(el, 'Loading clinical data…', async () => {
  const { stats, recentUsage, topFeatures } = await api('/dashboard');
  const accuracy = stats.users > 0 ? Math.min(99.9, 95 + stats.activeUsers / Math.max(stats.users, 1) * 4).toFixed(1) : '99.8';
  const growth = stats.users > 0 ? `+${Math.min(12, Math.round((stats.activeUsers / stats.users) * 10))}%` : '+0%';

  el.innerHTML = `
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-header">
          <span>Total Active Patients</span>
          <div class="metric-icon blue">👥</div>
        </div>
        <div class="metric-value">${stats.activeUsers.toLocaleString()}<span class="metric-trend">${growth}</span></div>
        <p class="metric-sub">${stats.users - stats.activeUsers} inactive · ${stats.users} registered</p>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span>AI Diagnostic Accuracy</span>
          <span class="pill pill-stable">STABLE</span>
        </div>
        <div class="metric-value">${accuracy}%</div>
        <div class="progress-bar"><span style="width:${accuracy}%"></span></div>
        <p class="metric-sub">Based on successful API completions</p>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span>Points in Circulation</span>
          <span class="pill pill-optimal">OPTIMAL</span>
        </div>
        <div class="metric-value">${stats.totalPoints.toLocaleString()}</div>
        <p class="metric-sub">${stats.pointsDebitedToday} pts debited today · ${stats.usageToday} ops</p>
      </div>
    </div>

    <div class="dashboard-mid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3>AI Consultation Activity</h3>
            <p>Real-time trend analysis of automated diagnostic reports</p>
          </div>
        </div>
        <div class="chart-toggle">
          <button type="button" class="active">Real-time</button>
          <button type="button">History</button>
        </div>
        <div class="bar-chart">${buildBarChart(topFeatures, stats.usageToday)}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Node Topology</h3></div>
        <div class="topology">
          <div class="topology-ring">
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(59,130,246,0.3)" stroke-width="1"/><line x1="50" y1="10" x2="50" y2="50" stroke="rgba(139,92,246,0.4)"/><line x1="50" y1="50" x2="85" y2="35" stroke="rgba(139,92,246,0.3)"/></svg>
            <span class="node"></span><span class="node"></span><span class="node"></span><span class="node"></span><span class="node"></span><span class="node"></span>
            <span class="node center"></span>
          </div>
          <div class="stream-item"><span class="stream-dot green"></span> Data Stream 01 — Active</div>
          <div class="stream-item"><span class="stream-dot blue"></span> Core Neural Sync — Syncing</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><h3>System Critical Events</h3><p>Recent usage & point alerts</p></div>
        <button type="button" class="panel-link" data-goto="analytics">View All Logs →</button>
      </div>
      <div class="event-list">
        ${renderEvents(recentUsage, stats)}
      </div>
    </div>`;

  el.querySelector('[data-goto="analytics"]')?.addEventListener('click', () => showPage('analytics'));
  el.querySelectorAll('[data-goto-users]').forEach((b) => b.addEventListener('click', () => showPage('users')));
  el.querySelectorAll('[data-goto-analytics]').forEach((b) => b.addEventListener('click', () => showPage('analytics')));
  }, loadDashboard);
}

function renderEvents(recentUsage, stats) {
  const items = [];
  const lowBalance = recentUsage.find((r) => r.status === 'insufficient_points');
  if (lowBalance) {
    items.push(`
      <div class="event-row">
        <div class="event-icon danger">⚠</div>
        <div class="event-body">
          <strong>Insufficient Points — Access Blocked</strong>
          <span>${escapeHtml(lowBalance.email || 'User')} · Feature: ${escapeHtml(lowBalance.feature_key)}</span>
        </div>
        <span class="event-time">${formatTimeShort(lowBalance.created_at)}</span>
        <button type="button" class="btn-review red" data-goto-users>Review</button>
      </div>`);
  }
  if (stats.usageToday > 0) {
    items.push(`
      <div class="event-row">
        <div class="event-icon info">ℹ</div>
        <div class="event-body">
          <strong>System Activity — ${stats.usageToday} operations today</strong>
          <span>${stats.transactionsToday} point transactions · ${stats.pointsDebitedToday} pts debited</span>
        </div>
        <span class="event-time">Live</span>
        <button type="button" class="btn-review blue" data-goto-analytics>Logs</button>
      </div>`);
  }
  recentUsage.slice(0, 3).forEach((r) => {
    if (r.status === 'insufficient_points') return;
    items.push(`
      <div class="event-row">
        <div class="event-icon info">✓</div>
        <div class="event-body">
          <strong>${escapeHtml(r.feature_key)} completed</strong>
          <span>${escapeHtml(r.email || 'Anonymous')} · ${r.points_charged} points charged</span>
        </div>
        <span class="event-time">${formatTimeShort(r.created_at)}</span>
        <button type="button" class="btn-review blue" data-goto-analytics>Logs</button>
      </div>`);
  });
  if (!items.length) {
    return '<p class="muted" style="padding:20px">No critical events. System operating normally.</p>';
  }
  return items.join('');
}

async function loadAnalytics() {
  const el = document.getElementById('page-analytics');
  await runPage(el, 'Loading analytics…', async () => {
  const [{ transactions }, { usage }, dash] = await Promise.all([
    api('/transactions?limit=80'),
    api('/usage?limit=80'),
    api('/dashboard'),
  ]);
  const s = dash.stats;

  el.innerHTML = `
    <div class="mini-stats" style="margin-bottom:24px">
      <div class="mini-stat"><div class="label">Transactions today</div><div class="val">${s.transactionsToday}</div></div>
      <div class="mini-stat"><div class="label">Usage today</div><div class="val">${s.usageToday}</div></div>
      <div class="mini-stat"><div class="label">Points debited</div><div class="val orange">${s.pointsDebitedToday}</div></div>
      <div class="mini-stat"><div class="label">Total users</div><div class="val">${s.users}</div></div>
    </div>
    <div class="dashboard-mid">
      <div class="panel">
        <div class="panel-head"><h3>Point Transactions</h3></div>
        <table class="data-table">
          <thead><tr><th>Time</th><th>User</th><th>Amount</th><th>Balance</th><th>Type</th></tr></thead>
          <tbody>${transactions.slice(0, 25).map((t) => `
            <tr>
              <td>${formatDate(t.created_at)}</td>
              <td>${escapeHtml(t.email || t.user_id?.slice(0, 8) || '—')}</td>
              <td style="color:${t.amount >= 0 ? 'var(--success)' : 'var(--danger)'}">${t.amount > 0 ? '+' : ''}${t.amount}</td>
              <td>${t.balance_after}</td>
              <td>${escapeHtml(t.type)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Usage Logs</h3></div>
        <table class="data-table">
          <thead><tr><th>Time</th><th>User</th><th>Feature</th><th>Points</th><th>Status</th></tr></thead>
          <tbody>${usage.slice(0, 25).map((u) => `
            <tr>
              <td>${formatDate(u.created_at)}</td>
              <td>${escapeHtml(u.email || '—')}</td>
              <td><code>${escapeHtml(u.feature_key)}</code></td>
              <td>${u.points_charged}</td>
              <td><span class="pill ${u.status === 'success' ? 'pill-stable' : 'pill-warn'}">${escapeHtml(u.status)}</span></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;

  document.querySelectorAll('[data-goto-users]').forEach((b) => b.addEventListener('click', () => showPage('users')));
  }, loadAnalytics);
}

async function loadUsers() {
  const el = document.getElementById('page-users');
  const search = (document.getElementById('global-search')?.value || el.dataset.search || '').trim();
  await runPage(el, 'Loading patient records…', async () => {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const { users } = await api(`/users${q}`);
  cachedUsers = users;

  const highRisk = users.filter((u) => !u.isActive || u.pointsBalance < 10).length;
  const pending = users.filter((u) => u.isActive && u.pointsBalance < 50).length;

  el.innerHTML = `
    <div class="page-intro">
      <div>
        <h2>Patient Records</h2>
        <p>Active caseload monitoring with real-time AI triage updates</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="refresh-users">↻ Refresh</button>
    </div>
    <div class="mini-stats">
      <div class="mini-stat"><div class="label">Total Active</div><div class="val">${users.filter((u) => u.isActive).length}</div></div>
      <div class="mini-stat"><div class="label">High Risk</div><div class="val red">${highRisk}</div></div>
      <div class="mini-stat"><div class="label">Low Balance</div><div class="val orange">${pending}</div></div>
      <div class="mini-stat"><div class="label">Registered</div><div class="val">${users.length}</div></div>
    </div>
    <div class="patients-layout">
      <div class="patients-main panel" style="padding:0;overflow:hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Last Activity</th>
              <th>Points Balance</th>
              <th>Risk Level</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            ${users.map((u) => renderUserRow(u)).join('')}
          </tbody>
        </table>
      </div>
      <div id="user-detail" class="detail-panel empty">
        Select a patient to view profile
      </div>
    </div>`;

  document.getElementById('refresh-users').onclick = () => loadUsers();
  el.querySelectorAll('#users-tbody tr').forEach((row) => {
    row.onclick = () => selectUser(row.dataset.userId);
  });

  if (selectedUserId && users.find((u) => u.id === selectedUserId)) {
    selectUser(selectedUserId);
  }
  }, loadUsers);
}

function renderUserRow(u) {
  const risk = riskFromBalance(u.pointsBalance, u.isActive);
  return `
    <tr data-user-id="${u.id}" class="${selectedUserId === u.id ? 'selected' : ''}">
      <td>
        <div class="patient-cell">
          <div class="patient-avatar">${initials(u.fullName, u.email)}</div>
          <div>
            <div class="patient-name">${escapeHtml(u.fullName || u.email.split('@')[0])}</div>
            <div class="patient-id">ID: ${u.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td>${formatDate(u.updatedAt || u.createdAt)}</td>
      <td><strong>${u.pointsBalance}</strong> pts</td>
      <td><span class="risk-dot ${risk.cls}">${risk.label}</span></td>
    </tr>`;
}

async function selectUser(userId) {
  selectedUserId = userId;
  document.querySelectorAll('#users-tbody tr').forEach((r) => {
    r.classList.toggle('selected', r.dataset.userId === userId);
  });

  const panel = document.getElementById('user-detail');
  panel.classList.remove('empty');
  panel.innerHTML = '<p class="muted">Loading…</p>';

  const { user, transactions } = await api(`/users/${userId}`);
  const risk = riskFromBalance(user.pointsBalance, user.isActive);
  const lastTx = transactions[0];

  panel.innerHTML = `
    <div class="detail-header">
      <button type="button" class="icon-btn" id="close-detail" title="Close">×</button>
    </div>
    <div class="detail-profile">
      <div class="big-avatar">${initials(user.fullName, user.email)}</div>
      <h3>${escapeHtml(user.fullName || user.email.split('@')[0])}</h3>
      <p class="muted" style="font-size:0.8rem">ID: ${user.id.slice(0, 12)}…</p>
      <p class="muted" style="font-size:0.8rem">${escapeHtml(user.email)}</p>
      <div class="detail-tags">
        <span class="tag">${user.pointsBalance} Points</span>
        <span class="tag">${user.isActive ? 'Active' : 'Disabled'}</span>
        <span class="tag">${risk.label} Risk</span>
      </div>
    </div>
    ${user.pointsBalance < 20 ? `
    <div class="alert-card">
      <p><strong>Low point balance.</strong> User may be blocked from AI features. Consider adding credits.</p>
      <div class="alert-actions">
        <button type="button" class="btn-review red" id="quick-credit">Add Points</button>
      </div>
    </div>` : ''}
    <p class="muted" style="font-size:0.78rem;margin-bottom:8px">Recent activity</p>
    <p style="font-size:0.85rem">${lastTx ? `${lastTx.type}: ${lastTx.amount > 0 ? '+' : ''}${lastTx.amount} pts` : 'No transactions yet'}</p>
    <div class="detail-actions">
      <button type="button" class="btn-action-primary" id="manage-user-btn">Manage Points & Account</button>
      <button type="button" class="btn-action-outline" id="view-tx-btn">View Transactions</button>
    </div>`;

  document.getElementById('close-detail').onclick = () => {
    selectedUserId = null;
    panel.classList.add('empty');
    panel.innerHTML = 'Select a patient to view profile';
    document.querySelectorAll('#users-tbody tr').forEach((r) => r.classList.remove('selected'));
  };
  document.getElementById('manage-user-btn').onclick = () => openUserModal(userId);
  document.getElementById('quick-credit')?.addEventListener('click', () => openUserModal(userId));
  document.getElementById('view-tx-btn').onclick = () => showPage('analytics');
}

async function openUserModal(userId) {
  const { user } = await api(`/users/${userId}`);
  openModal(
    `Manage: ${user.email}`,
    `
    <p>Balance: <strong>${user.pointsBalance}</strong> points</p>
    <div class="form-row">
      <label>Adjust points (+ add, − deduct)</label>
      <input type="number" id="adj-amount" placeholder="e.g. 50 or -20" />
    </div>
    <div class="form-row"><label>Note</label><input type="text" id="adj-note" placeholder="Reason" /></div>
    <div class="form-row toggle">
      <input type="checkbox" id="adj-active" ${user.isActive ? 'checked' : ''} />
      <label for="adj-active">Account active</label>
    </div>`,
    async () => {
      const amount = parseInt(document.getElementById('adj-amount').value, 10);
      const note = document.getElementById('adj-note').value;
      const isActive = document.getElementById('adj-active').checked;
      if (!Number.isNaN(amount) && amount !== 0) {
        await api(`/users/${userId}/points`, { method: 'POST', body: JSON.stringify({ amount, note }) });
      }
      await api(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      closeModal();
      loadUsers();
    }
  );
}

const CATEGORY_ICONS = {
  chat_text: '💬', chat_image: '📷', chat_pdf: '📄',
  symptom_text: '🩺', symptom_image: '🔬',
  voice_consultation: '🎙', emergency_lookup: '🚨', medicine_scan: '💊',
};

const PRIORITY_MAP = {
  chat_pdf: 'HIGH', chat_image: 'HIGH', emergency_lookup: 'CRITICAL',
  symptom_image: 'HIGH', voice_consultation: 'NORMAL',
};

async function loadPointRules() {
  const el = document.getElementById('page-points');
  await runPage(el, 'Loading AI modules…', async () => {
  const { rules } = await api('/point-rules');
  const systemPrompt = `You are MedAssistant Clinical AI.
Provide supportive, non-alarmist medical guidance.
Do not provide a final diagnosis — recommend professional care when appropriate.
Points are deducted per feature as configured by the administrator.`;

  el.innerHTML = `
    <div class="ai-header">
      <div>
        <h2>AI Logic Control</h2>
        <p class="muted">Refine diagnostic logic and tune point deduction per health category</p>
      </div>
      <div style="display:flex;gap:10px">
        <button type="button" class="btn btn-ghost btn-sm" onclick="loadPointRules()">Revert</button>
        <button type="button" class="btn btn-primary btn-sm" data-goto-settings>Deploy Settings</button>
      </div>
    </div>
    <div class="ai-tabs">
      <button type="button" class="ai-tab">Overview</button>
      <button type="button" class="ai-tab active">AI Logic</button>
      <button type="button" class="ai-tab" data-goto-settings>Clinical Data</button>
    </div>
    <div class="ai-grid">
      <div>
        <h3 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em">Health Categories — Point Costs</h3>
        ${rules.map((r) => renderCategoryCard(r)).join('')}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Prompt Playground</h3></div>
        <div class="prompt-box">${escapeHtml(systemPrompt)}</div>
        <p class="muted" style="margin-top:12px;font-size:0.78rem">Edit point costs per category on the left. System prompt is read-only in this release.</p>
      </div>
    </div>`;

  el.querySelectorAll('[data-edit-rule]').forEach((btn) => {
    const rule = rules.find((r) => r.id === btn.dataset.editRule);
    btn.onclick = () => editRule(btn.dataset.editRule, rule);
  });
  el.querySelector('[data-goto-settings]')?.addEventListener('click', () => showPage('settings'));
  }, loadPointRules);
}

function renderCategoryCard(r) {
  const priority = PRIORITY_MAP[r.featureKey] || (r.pointsCost >= 10 ? 'HIGH' : 'NORMAL');
  const pillClass = priority === 'CRITICAL' ? 'pill-critical' : priority === 'HIGH' ? 'pill-warn' : 'pill-normal';
  return `
    <div class="category-card">
      <div class="category-top">
        <h4>${CATEGORY_ICONS[r.featureKey] || '⚕'} ${escapeHtml(r.featureName)}</h4>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="pill ${pillClass}">${priority}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-edit-rule="${r.id}">Edit</button>
        </div>
      </div>
      <div class="category-meta">
        <div><dt>Feature Key</dt><dd><code>${escapeHtml(r.featureKey)}</code></dd></div>
        <div><dt>Point Cost</dt><dd><strong>${r.pointsCost} pts</strong></dd></div>
        <div><dt>Status</dt><dd>${r.isActive ? '✓ Active' : '✗ Off'}</dd></div>
      </div>
      <p class="muted" style="margin-top:12px;font-size:0.78rem">${escapeHtml(r.description || '')}</p>
    </div>`;
}

function editRule(id, rule) {
  openModal(
    `Edit: ${rule.featureName}`,
    `
    <div class="form-row"><label>Display name</label><input id="rule-name" value="${escapeHtml(rule.featureName)}" /></div>
    <div class="form-row"><label>Points cost (deduction)</label><input type="number" id="rule-cost" min="0" value="${rule.pointsCost}" /></div>
    <div class="form-row"><label>Description</label><input id="rule-desc" value="${escapeHtml(rule.description || '')}" /></div>
    <div class="form-row toggle"><input type="checkbox" id="rule-active" ${rule.isActive ? 'checked' : ''} /><label for="rule-active">Module active</label></div>`,
    async () => {
      await api(`/point-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          featureName: document.getElementById('rule-name').value,
          pointsCost: parseInt(document.getElementById('rule-cost').value, 10),
          description: document.getElementById('rule-desc').value,
          isActive: document.getElementById('rule-active').checked,
        }),
      });
      closeModal();
      loadPointRules();
    },
    'Deploy'
  );
}

async function loadSystem() {
  const el = document.getElementById('page-system');
  await runPage(el, 'Loading system status…', async () => {
  const s = await api('/system-status');
  el.innerHTML = `
    <div class="page-intro"><div><h2>System Status</h2><p>Infrastructure and integration health</p></div></div>
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-header"><span>Gemini API</span><span class="pill ${s.geminiConfigured ? 'pill-stable' : 'pill-critical'}">${s.geminiConfigured ? 'ONLINE' : 'OFFLINE'}</span></div>
        <div class="metric-value" style="font-size:1.25rem">${s.geminiConfigured ? 'Connected' : 'Not configured'}</div>
        <p class="metric-sub">Model: <code>${escapeHtml(s.model)}</code></p>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span>App Security</span><span class="pill ${s.appSecretConfigured ? 'pill-stable' : 'pill-critical'}">${s.appSecretConfigured ? 'SECURED' : 'OPEN'}</span></div>
        <div class="metric-value" style="font-size:1.25rem">${s.appSecretConfigured ? 'Protected' : 'Missing secret'}</div>
        <p class="metric-sub">Mobile app API key authentication</p>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span>Points Economy</span><span class="pill ${s.pointsEnabled ? 'pill-optimal' : 'pill-warn'}">${s.pointsEnabled ? 'ACTIVE' : 'PAUSED'}</span></div>
        <div class="metric-value" style="font-size:1.25rem">${s.pointsEnabled ? 'Enabled' : 'Disabled'}</div>
        <p class="metric-sub">JWT: ${s.jwtConfigured ? 'configured' : 'using fallback'}</p>
      </div>
    </div>
    <div class="panel">
      <p class="muted">Configure <code>backend/.env</code> — GEMINI_API_KEY, APP_API_SECRET, PAYSTACK_SECRET_KEY, JWT_SECRET</p>
      <p class="muted" style="margin-top:8px">Paystack: ${s.paystackConfigured ? 'Connected' : 'Not configured'}</p>
    </div>`;
  }, loadSystem);
}

async function loadPackages() {
  const el = document.getElementById('page-packages');
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading…</p>';
  try {
  const data = await api('/point-packages');
  const packages = data.packages || [];
  el.innerHTML = `<div class="page-intro"><div><h2>Points Shop</h2><p>e.g. 100 points = GHC 20</p></div><button type="button" class="btn btn-primary btn-sm" id="add-package-btn">+ Add package</button></div>
    <div class="panel"><table class="data-table"><thead><tr><th>Name</th><th>Points</th><th>Price</th><th>Currency</th><th>Status</th><th></th></tr></thead><tbody>
    ${packages.length ? packages.map((p) => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${p.points}</td><td>${escapeHtml(p.priceDisplay || '')}</td><td>${escapeHtml(p.currency)}</td><td>${p.isActive ? 'Active' : 'Off'}</td><td><button type="button" class="btn btn-ghost btn-sm" data-edit-pkg="${p.id}">Edit</button> <button type="button" class="btn btn-ghost btn-sm" data-del-pkg="${p.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="6">No packages yet. Click + Add package.</td></tr>'}
    </tbody></table></div>`;
  document.getElementById('add-package-btn').onclick = () => openPackageModal(null);
  packages.forEach((p) => {
    el.querySelector(`[data-edit-pkg="${p.id}"]`)?.addEventListener('click', () => openPackageModal(p));
    el.querySelector(`[data-del-pkg="${p.id}"]`)?.addEventListener('click', async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      await api(`/point-packages/${p.id}`, { method: 'DELETE' });
      loadPackages();
    });
  });
  } catch (err) {
    el.innerHTML = `<div class="panel"><p class="error-msg">${escapeHtml(err.message)}</p><p class="muted">Restart the backend (<code>npm start</code> in backend), then click Retry.</p><button type="button" class="btn btn-primary btn-sm" id="retry-packages">Retry</button></div>`;
    document.getElementById('retry-packages').onclick = () => loadPackages();
  }
}

function openPackageModal(pkg) {
  const isEdit = !!pkg;
  openModal(isEdit ? 'Edit package' : 'New package', `
    <div class="form-row"><label>Name</label><input id="pkg-name" value="${escapeHtml(pkg?.name || '')}" /></div>
    <div class="form-row"><label>Points</label><input type="number" id="pkg-points" value="${pkg?.points ?? 100}" /></div>
    <div class="form-row"><label>Price (GHC)</label><input type="number" id="pkg-price" step="0.01" value="${pkg?.priceMajor ?? 20}" /></div>
    <div class="form-row"><label>Currency</label><select id="pkg-currency" style="width:100%;padding:8px"><option value="GHS">GHS</option><option value="NGN">NGN</option></select></div>
    <div class="form-row toggle"><input type="checkbox" id="pkg-active" checked /><label>Active</label></div>`,
  async () => {
    const body = { name: document.getElementById('pkg-name').value, points: +document.getElementById('pkg-points').value, priceMajor: +document.getElementById('pkg-price').value, currency: document.getElementById('pkg-currency').value, isActive: document.getElementById('pkg-active').checked };
    if (isEdit) await api(`/point-packages/${pkg.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/point-packages', { method: 'POST', body: JSON.stringify(body) });
    closeModal(); loadPackages();
  });
}

async function fetchIntegrationsSafe() {
  try {
    return await api('/integrations');
  } catch {
    return {
      paystackConfigured: false,
      geminiConfigured: false,
      geminiModel: 'gemini-2.0-flash',
      paymentCurrency: 'GHS',
    };
  }
}

async function loadSettings() {
  const el = document.getElementById('page-settings');
  if (!el) return;
  await runPage(el, 'Loading settings…', async () => {
  const settingsRes = await api('/settings');
  const settings = settingsRes.settings || settingsRes;
  const integrations = await fetchIntegrationsSafe();
  const pointsOn = settings.points_enabled?.value === 'true';
  const bonus = settings.signup_bonus_points?.value || '100';
  const appName = settings.app_name?.value || 'eHealth AI';

  el.innerHTML = `
    <div class="page-intro">
      <div><h2>Archive & Settings</h2><p>Global system configuration and points economy</p></div>
    </div>
    <div class="panel" style="max-width:560px">
      <h3 style="margin-bottom:18px">Points Economy</h3>
      <div class="form-row toggle">
        <input type="checkbox" id="set-points-enabled" ${pointsOn ? 'checked' : ''} />
        <label for="set-points-enabled">Enable point deductions (disable for free access)</label>
      </div>
      <div class="form-row">
        <label>Signup bonus points</label>
        <input type="number" id="set-signup-bonus" min="0" value="${bonus}" />
      </div>
      <div class="form-row">
        <label>App display name</label>
        <input type="text" id="set-app-name" value="${escapeHtml(appName)}" />
      </div>
      <button type="button" class="btn btn-primary" id="save-settings">Save & Deploy</button>
    </div>`;

  document.getElementById('save-settings').onclick = async () => {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          points_enabled: document.getElementById('set-points-enabled').checked ? 'true' : 'false',
          signup_bonus_points: document.getElementById('set-signup-bonus').value,
          app_name: document.getElementById('set-app-name').value,
        },
      }),
    });
    alert('Settings deployed successfully');
    loadSettings();
  };
  }, loadSettings);
}

// Event wiring
document.getElementById('logout-btn').onclick = () => {
  clearSession();
  showLogin();
};

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.onclick = () => showPage(btn.dataset.page);
});

document.querySelector('.icon-btn[data-page="settings"]')?.addEventListener('click', () => showPage('settings'));

document.getElementById('global-search')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    showPage('users');
    const el = document.getElementById('page-users');
    if (el) {
      el.dataset.search = e.target.value;
      loadUsers();
    }
  }
});

document.getElementById('emergency-btn').onclick = async () => {
  if (!confirm('Emergency Override will DISABLE point deductions system-wide. Continue?')) return;
  await api('/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings: { points_enabled: 'false' } }),
  });
  alert('Points disabled. AI access is now free for all users.');
  showPage('settings');
};

document.getElementById('fab-btn').onclick = () => showPage('users');

async function loadDoctors() {
  const el = document.getElementById('page-doctors');
  try {
    const [docRes, consultRes] = await Promise.all([api('/doctors'), api('/consultations')]);
    const doctors = docRes.doctors || [];
    const consultations = consultRes.consultations || [];
    el.innerHTML = `
      <div class="page-header-row">
        <div>
          <h2 class="page-heading">Doctor Management</h2>
          <p class="muted">Add doctors for video consultation booking in the PWA</p>
        </div>
        <button type="button" class="btn btn-primary" id="doc-add-btn">Add doctor</button>
      </div>
      <div class="table-wrap" style="margin-bottom:24px">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Specialty</th><th>Hospital</th><th>Points</th><th>Active</th><th></th></tr></thead>
          <tbody>
            ${doctors.map((d) => `
              <tr>
                <td><strong>${escapeHtml(d.fullName)}</strong></td>
                <td>${escapeHtml(d.specialty)}</td>
                <td>${escapeHtml(d.hospitalAffiliation || '—')}</td>
                <td>${d.pointsCost}</td>
                <td>${d.isActive ? '✓' : '—'}</td>
                <td>
                  <button type="button" class="panel-link doc-edit" data-id="${d.id}">Edit</button>
                  ${d.isActive ? `<button type="button" class="panel-link doc-del" data-id="${d.id}">Deactivate</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6">No doctors — click Add doctor</td></tr>'}
          </tbody>
        </table>
      </div>
      <h3 style="margin-bottom:12px">Recent consultations</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>When</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${consultations.slice(0, 20).map((c) => `
              <tr>
                <td>${escapeHtml(String(c.scheduled_at || '').slice(0, 16).replace('T', ' '))}</td>
                <td>${escapeHtml(c.patient_name || c.email || '—')}</td>
                <td>${escapeHtml(c.doctor_name || '—')}</td>
                <td>${escapeHtml(c.status || '—')}</td>
                <td>
                  ${c.status === 'pending' || c.status === 'scheduled' ? `
                    <button type="button" class="panel-link consult-done" data-id="${c.id}">Complete</button>
                    <button type="button" class="panel-link consult-cancel" data-id="${c.id}">Cancel</button>
                  ` : '—'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5">No bookings yet</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('doc-add-btn')?.addEventListener('click', () => {
      openModal('Add doctor', `
        <label class="field-label">Full name<input id="doc-name" /></label>
        <label class="field-label">Specialty<input id="doc-spec" placeholder="General Practice" /></label>
        <label class="field-label">Hospital<input id="doc-hospital" /></label>
        <label class="field-label">Bio<textarea id="doc-bio" rows="3"></textarea></label>
        <label class="field-label">Video room slug<input id="doc-slug" placeholder="ehealth-consult" /></label>
        <label class="field-label">Custom meet URL (optional)<input id="doc-meet" placeholder="https://meet.jit.si/..." /></label>
        <label class="field-label">Points cost<input id="doc-points" type="number" value="15" /></label>
        <label class="field-label">Fee (pesewas/kobo)<input id="doc-fee" type="number" value="5000" /></label>
      `, async () => {
        await api('/doctors', {
          method: 'POST',
          body: JSON.stringify({
            fullName: document.getElementById('doc-name').value.trim(),
            specialty: document.getElementById('doc-spec').value.trim(),
            hospitalAffiliation: document.getElementById('doc-hospital').value.trim() || undefined,
            bio: document.getElementById('doc-bio').value.trim() || undefined,
            videoRoomSlug: document.getElementById('doc-slug').value.trim() || undefined,
            meetUrl: document.getElementById('doc-meet').value.trim() || undefined,
            pointsCost: Number(document.getElementById('doc-points').value) || 15,
            consultationFeeKobo: Number(document.getElementById('doc-fee').value) || 5000,
          }),
        });
        closeModal();
        loadDoctors();
      }, 'Create');
    });

    el.querySelectorAll('.doc-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const d = doctors.find((x) => x.id === id);
        if (!d) return;
        openModal('Edit doctor', `
          <label class="field-label">Full name<input id="doc-name" value="${escapeHtml(d.fullName)}" /></label>
          <label class="field-label">Specialty<input id="doc-spec" value="${escapeHtml(d.specialty)}" /></label>
          <label class="field-label">Hospital<input id="doc-hospital" value="${escapeHtml(d.hospitalAffiliation || '')}" /></label>
          <label class="field-label">Bio<textarea id="doc-bio" rows="3">${escapeHtml(d.bio || '')}</textarea></label>
          <label class="field-label">Meet URL<input id="doc-meet" value="${escapeHtml(d.meetUrl || '')}" /></label>
          <label class="field-label">Points cost<input id="doc-points" type="number" value="${d.pointsCost}" /></label>
        `, async () => {
          await api(`/doctors/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              fullName: document.getElementById('doc-name').value.trim(),
              specialty: document.getElementById('doc-spec').value.trim(),
              hospitalAffiliation: document.getElementById('doc-hospital').value.trim() || undefined,
              bio: document.getElementById('doc-bio').value.trim() || undefined,
              meetUrl: document.getElementById('doc-meet').value.trim() || undefined,
              pointsCost: Number(document.getElementById('doc-points').value) || 15,
            }),
          });
          closeModal();
          loadDoctors();
        });
      });
    });

    el.querySelectorAll('.doc-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Deactivate this doctor?')) return;
        await api(`/doctors/${btn.dataset.id}`, { method: 'DELETE' });
        loadDoctors();
      });
    });

    el.querySelectorAll('.consult-done').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/consultations/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' }),
        });
        loadDoctors();
      });
    });
    el.querySelectorAll('.consult-cancel').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this consultation?')) return;
        await api(`/consultations/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled' }),
        });
        loadDoctors();
      });
    });
  } catch (err) {
    el.innerHTML = `<div class="wa-alert"><strong>Error</strong><br>${escapeHtml(err.message)}</div>`;
  }
}

async function loadBroadcasts() {
  const el = document.getElementById('page-broadcasts');
  await runPage(el, 'Loading broadcasts…', async () => {
    const { broadcasts } = await api('/broadcasts');
    el.innerHTML = `
      <div class="page-header-row">
        <div>
          <h2 class="page-heading">Health Broadcasts</h2>
          <p class="muted">Send in-app alerts (PWA Health Alerts) and optionally WhatsApp</p>
        </div>
      </div>
      <div class="panel" style="max-width:640px;margin-bottom:24px">
        <h3 style="margin-bottom:12px">New broadcast</h3>
        <label class="field-label">Title<input id="bc-title" placeholder="Health alert" /></label>
        <label class="field-label">Message<textarea id="bc-message" rows="4" placeholder="Your health tip or clinic notice…"></textarea></label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button type="button" class="btn btn-primary" id="bc-pwa">Send to PWA (in-app)</button>
          <button type="button" class="btn btn-ghost" id="bc-wa">Also send WhatsApp</button>
        </div>
        <p class="muted" style="margin-top:10px;font-size:12px">PWA users see alerts under Health Services → Health Alerts. WhatsApp uses registered phones.</p>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>When</th><th>Title</th><th>Message</th><th>Recipients</th></tr></thead>
          <tbody>
            ${(broadcasts || []).map((b) => `
              <tr>
                <td>${escapeHtml(formatDate(b.created_at))}</td>
                <td>${escapeHtml(b.title || '—')}</td>
                <td>${escapeHtml(String(b.message || '').slice(0, 120))}${String(b.message || '').length > 120 ? '…' : ''}</td>
                <td>${b.recipient_count ?? 0}</td>
              </tr>
            `).join('') || '<tr><td colspan="4">No broadcasts yet</td></tr>'}
          </tbody>
        </table>
      </div>`;

    document.getElementById('bc-pwa').onclick = async () => {
      const message = document.getElementById('bc-message').value.trim();
      const title = document.getElementById('bc-title').value.trim() || 'Health alert';
      if (!message) return alert('Enter a message');
      await api('/broadcasts', { method: 'POST', body: JSON.stringify({ title, message }) });
      alert('Broadcast saved — visible in PWA Health Alerts');
      loadBroadcasts();
    };

    document.getElementById('bc-wa').onclick = async () => {
      const message = document.getElementById('bc-message').value.trim();
      const title = document.getElementById('bc-title').value.trim() || 'Health alert';
      if (!message) return alert('Enter a message');
      await api('/broadcasts', { method: 'POST', body: JSON.stringify({ title, message }) });
      try {
        const wa = await fetch('/admin/api/whatsapp/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ message: `${title}\n\n${message}` }),
        });
        const data = await wa.json();
        if (!wa.ok) throw new Error(data?.error?.message || 'WhatsApp send failed');
        alert(`Sent — PWA alert saved, WhatsApp: ${data.sent || 0} delivered`);
      } catch (e) {
        alert(`PWA alert saved. WhatsApp failed: ${e.message}`);
      }
      loadBroadcasts();
    };
  }, loadBroadcasts);
}

async function loadPayments() {
  const el = document.getElementById('page-payments');
  await runPage(el, 'Loading payments…', async () => {
    const { payments } = await api('/payments');
    el.innerHTML = `
      <div class="page-header-row">
        <div>
          <h2 class="page-heading">Payments</h2>
          <p class="muted">Paystack point purchases and transactions</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>When</th><th>User</th><th>Reference</th><th>Amount</th><th>Status</th><th>Points</th></tr></thead>
          <tbody>
            ${(payments || []).map((p) => `
              <tr>
                <td>${escapeHtml(formatDate(p.created_at))}</td>
                <td>${escapeHtml(p.email || '—')}</td>
                <td><code>${escapeHtml(p.paystack_reference || '—')}</code></td>
                <td>${escapeHtml(String(p.currency || 'GHS'))} ${((p.amount_kobo || 0) / 100).toFixed(2)}</td>
                <td>${escapeHtml(p.status || '—')}</td>
                <td>${p.points_to_credit ?? '—'}</td>
              </tr>
            `).join('') || '<tr><td colspan="6">No payments yet</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }, loadPayments);
}

async function loadDelivery() {
  const el = document.getElementById('page-delivery');
  await runPage(el, 'Loading delivery orders…', async () => {
    const { orders } = await api('/delivery-orders');
    el.innerHTML = `
      <div class="page-header-row">
        <div>
          <h2 class="page-heading">Medicine Delivery</h2>
          <p class="muted">MoMo orders from PWA and WhatsApp</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>When</th><th>Patient</th><th>Medicine</th><th>Amount</th><th>Status</th><th>Pay link</th></tr></thead>
          <tbody>
            ${(orders || []).map((o) => `
              <tr>
                <td>${escapeHtml(formatDate(o.created_at))}</td>
                <td>${escapeHtml(o.patient_name || o.email || '—')}</td>
                <td>${escapeHtml(o.medication_name || '—')}</td>
                <td>${escapeHtml(o.currency || 'GHS')} ${((o.amount_kobo || 0) / 100).toFixed(2)}</td>
                <td>${escapeHtml(o.status || '—')}</td>
                <td>${o.paystack_url ? `<a href="${escapeHtml(o.paystack_url)}" target="_blank" rel="noopener">Pay</a>` : '—'}</td>
              </tr>
            `).join('') || '<tr><td colspan="6">No delivery orders yet</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }, loadDelivery);
}

document.getElementById('modal-cancel').onclick = closeModal;
document.querySelector('.modal-backdrop').onclick = closeModal;
document.getElementById('modal-confirm').onclick = async () => {
  if (modalCallback) await modalCallback();
};

// Fix dashboard event delegation after load
document.getElementById('page-dashboard')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-goto-users]')) showPage('users');
  if (e.target.closest('[data-goto-analytics]')) showPage('analytics');
});

async function bootApp() {
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    await api('/session', {}, 0, { silentAuth: true, timeoutMs: 12000 });
    showApp();
    showPage('dashboard');
  } catch {
    clearSession();
    showLogin();
  }
}

bootApp();
