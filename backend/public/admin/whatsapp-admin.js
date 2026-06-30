function waToast(msg) {
  const existing = document.querySelector('.wa-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'wa-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function waStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('success') || s.includes('sent') || s.includes('taken')) return 'wa-status-success';
  if (s.includes('error') || s.includes('fail') || s.includes('insufficient')) return 'wa-status-error';
  if (s.includes('warn') || s.includes('snooze') || s.includes('pending')) return 'wa-status-warn';
  return 'wa-status-neutral';
}

function waConnectionPill(enabled, ok, state) {
  if (!enabled) return '<span class="pill pill-warn">DISABLED</span>';
  if (ok && state && state !== 'unknown') return `<span class="pill pill-stable">${String(state).toUpperCase()}</span>`;
  return '<span class="pill pill-critical">OFFLINE</span>';
}

function waGenSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function waCopyWebhook(url) {
  navigator.clipboard.writeText(url).then(() => waToast('Webhook URL copied')).catch(() => waToast('Copy failed'));
}

let waConnectPollTimer = null;
let waQrPollTimer = null;

function waStopConnectPoll() {
  if (waConnectPollTimer) {
    clearInterval(waConnectPollTimer);
    waConnectPollTimer = null;
  }
}

function waStopQrPoll() {
  if (waQrPollTimer) {
    clearInterval(waQrPollTimer);
    waQrPollTimer = null;
  }
}

function waStopAllPolls() {
  waStopConnectPoll();
  waStopQrPoll();
}

function waFormatPhone(phone) {
  if (!phone) return '—';
  const d = String(phone).replace(/\D/g, '');
  if (d.startsWith('233') && d.length >= 12) return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d.startsWith('+') ? d : `+${d}`;
}

function waUpdateConnectPanel(data) {
  const stateEl = document.getElementById('wa-conn-state');
  const phoneEl = document.getElementById('wa-conn-phone');
  const qrEl = document.getElementById('wa-conn-qr');
  const codeEl = document.getElementById('wa-conn-pairing');
  const hintEl = document.getElementById('wa-conn-hint');
  if (!stateEl) return;

  const state = String(data.state || 'close').toLowerCase();
  stateEl.textContent = state.toUpperCase();
  stateEl.className = `wa-status-pill ${state === 'open' ? 'wa-status-success' : state === 'connecting' ? 'wa-status-warn' : 'wa-status-neutral'}`;

  if (phoneEl) {
    phoneEl.textContent = data.phone ? waFormatPhone(data.phone) : 'Not linked yet';
  }

  if (state === 'open') {
    if (qrEl) qrEl.innerHTML = '<div class="wa-conn-success">✓ WhatsApp linked</div>';
    if (codeEl) codeEl.textContent = '';
    if (hintEl) hintEl.textContent = 'Your bot number is connected. Enable the bot and register the webhook.';
    waStopAllPolls();
    return;
  }

  if (hintEl) {
    hintEl.textContent =
      state === 'connecting'
        ? 'Phone is logging in — keep this page open. Do NOT click Refresh QR until it fails (wait up to 2 min).'
        : 'Enter phone number → Get link code, or click Show QR after saving Evolution credentials.';
  }
}

async function waPollConnection() {
  try {
    const data = await api('/whatsapp/connection');
    waUpdateConnectPanel(data);
    if (String(data.state || '').toLowerCase() === 'open') {
      waStopAllPolls();
      const status = await api('/whatsapp/status');
      const conn = status.connection || {};
      const phoneEl = document.getElementById('wa-conn-phone');
      if (phoneEl && conn.phone) phoneEl.textContent = waFormatPhone(conn.phone);
    }
  } catch (_) {
    /* ignore poll errors */
  }
}

function waStartConnectPoll() {
  waStopConnectPoll();
  waConnectPollTimer = setInterval(waPollConnection, 6000);
}

function waRenderQr(qrEl, qrBase64) {
  if (!qrEl || !qrBase64) return false;
  qrEl.replaceChildren();
  const img = document.createElement('img');
  img.src = qrBase64;
  img.alt = 'WhatsApp QR code';
  img.className = 'wa-qr-img';
  img.onerror = () => {
    qrEl.innerHTML = '<p class="muted">QR image failed to load — click Refresh QR.</p>';
  };
  qrEl.appendChild(img);
  return true;
}

function waQrImgFromCode(code) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(code)}`;
}

async function waDisplayQrResult(result) {
  const qrEl = document.getElementById('wa-conn-qr');
  const codeEl = document.getElementById('wa-conn-pairing');
  const state = String(result.state || '').toLowerCase();

  if (result.pairingCode) {
    waDisplayPairingCode(result.pairingCode, result.linkPhone);
    waStopQrPoll();
    return true;
  }

  if (result.qrBase64 && qrEl && waRenderQr(qrEl, result.qrBase64)) {
    waStopQrPoll();
    return true;
  }

  if (result.qrCode && qrEl) {
    waRenderQr(qrEl, waQrImgFromCode(result.qrCode));
    waStopQrPoll();
    return true;
  }

  if (result.pairingInProgress && !result.qrBase64 && !result.qrCode && qrEl) {
    qrEl.innerHTML =
      '<div class="wa-conn-wait"><p style="font-weight:600;margin-bottom:8px">Waiting for QR from Evolution…</p><p class="muted" style="font-size:0.85rem">This can take up to 15 seconds.</p></div>';
    return false;
  }

  if (state === 'open' && qrEl) {
    qrEl.innerHTML = '<div class="wa-conn-success">✓ WhatsApp linked</div>';
    waStopAllPolls();
    return true;
  }

  if (qrEl && !result.qrBase64 && !result.qrCode) {
    const hint = result.message || 'No QR yet — check Evolution API key and instance name, then click Show QR.';
    qrEl.innerHTML = `<p class="muted" style="text-align:center;padding:16px">${hint.replace(/</g, '&lt;')}</p>`;
  }
  return false;
}

function waStartQrPoll(phone) {
  waStopQrPoll();
  let tries = 0;
  waQrPollTimer = setInterval(async () => {
    tries += 1;
    if (tries > 12) {
      waStopQrPoll();
      return;
    }
    try {
      const result = await api('/whatsapp/connection/connect', {
        method: 'POST',
        body: JSON.stringify(phone ? { phone } : {}),
      });
      const shown = await waDisplayQrResult(result);
      if (shown || result.qrBase64 || result.qrCode) waStopQrPoll();
    } catch (_) {
      /* keep polling */
    }
  }, 4000);
}

function waNormalizePhoneInput(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = `233${d.slice(1)}`;
  if (!d.startsWith('233') && d.length === 9) d = `233${d}`;
  return d;
}

function waShowPairingLoading() {
  const qrEl = document.getElementById('wa-conn-qr');
  if (!qrEl) return;
  qrEl.innerHTML =
    '<div class="wa-conn-wait"><p style="font-weight:600;margin-bottom:8px">Getting link code…</p><p class="muted" style="font-size:0.85rem">Contacting Evolution API (up to 20 sec)</p></div>';
}

function waShowPairingError(message) {
  const qrEl = document.getElementById('wa-conn-qr');
  if (!qrEl) return;
  const safe = String(message || 'Link code failed').replace(/</g, '&lt;');
  qrEl.innerHTML = `<div class="wa-conn-wait"><p class="error-msg" style="margin-bottom:12px">${safe}</p><button type="button" class="wa-btn-whatsapp" id="wa-retry-pair">Try again</button></div>`;
  document.getElementById('wa-retry-pair')?.addEventListener('click', () => {
    const phone = document.getElementById('wa-link-phone')?.value?.trim();
    if (phone) waRequestPairing(phone);
    else waToast('Enter your phone number first');
  });
}

function waDisplayPairingCode(code, linkPhone) {
  const qrEl = document.getElementById('wa-conn-qr');
  const codeEl = document.getElementById('wa-conn-pairing');
  const formatted = String(code || '')
    .replace(/\W/g, '')
    .toUpperCase();
  const display =
    formatted.length === 8 ? `${formatted.slice(0, 4)}-${formatted.slice(4)}` : String(code || '').toUpperCase();
  const phoneHint = linkPhone ? waFormatPhone(linkPhone) : 'your number';

  if (codeEl) codeEl.textContent = '';
  if (!qrEl) return;

  qrEl.innerHTML = `
    <div class="wa-pairing-panel">
      <p class="wa-pairing-label">WhatsApp link code</p>
      <p class="wa-pairing-code" id="wa-pairing-code-text">${display}</p>
      <button type="button" class="wa-btn-ghost wa-copy-code" id="wa-copy-pairing">Copy code</button>
      <ol class="wa-pairing-steps">
        <li>Open <strong>WhatsApp</strong> on ${phoneHint}</li>
        <li>Tap <strong>⋮</strong> → <strong>Linked devices</strong></li>
        <li>Tap <strong>Link a device</strong> → <strong>Link with phone number</strong></li>
        <li>Enter the code above within <strong>60 seconds</strong></li>
      </ol>
    </div>`;

  document.getElementById('wa-copy-pairing')?.addEventListener('click', () => {
    navigator.clipboard
      .writeText(display.replace(/-/g, ''))
      .then(() => waToast('Link code copied'))
      .catch(() => waToast('Copy failed — note the code manually'));
  });
}

async function waCallPairApi(normalized) {
  try {
    return await api('/whatsapp/connection/pair', {
      method: 'POST',
      body: JSON.stringify({ phone: normalized }),
    });
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes('404') || msg.includes('not found') || msg.includes('API not found')) {
      return api('/whatsapp/connection/connect', {
        method: 'POST',
        body: JSON.stringify({ phone: normalized, mode: 'pair' }),
      });
    }
    throw err;
  }
}

async function waRequestPairing(phone, { quiet = false, attempt = 0 } = {}) {
  const normalized = waNormalizePhoneInput(phone);
  if (!normalized || normalized.length < 11) {
    waToast('Enter your Ghana WhatsApp number (e.g. 0501234567)');
    return null;
  }
  if (!quiet) waToast('Requesting link code from Evolution…');
  waShowPairingLoading();
  try {
    const result = await waCallPairApi(normalized);
    if (result.pairingCode) {
      waDisplayPairingCode(result.pairingCode, result.linkPhone || normalized);
      waUpdateConnectPanel(result);
      waStartConnectPoll();
      if (!quiet) waToast('Enter the code in WhatsApp now — expires in ~60 seconds');
      return result;
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2500));
      return waRequestPairing(phone, { quiet: true, attempt: attempt + 1 });
    }
    waShowPairingError(result.message || 'Evolution did not return a link code');
    if (!quiet) waToast('No link code — check Evolution credentials and try again');
    return result;
  } catch (err) {
    if (attempt < 1) {
      try {
        await fetch('/api/health?recover=1', { cache: 'no-store' });
      } catch (_) {
        /* ignore */
      }
      return waRequestPairing(phone, { quiet, attempt: attempt + 1 });
    }
    waShowPairingError(err.message);
    if (!quiet) waToast(err.message);
    throw err;
  }
}

async function waRequestConnect(phone, { forceRefresh = false, quiet = false, mode = 'qr' } = {}) {
  if (mode === 'pair') {
    return waRequestPairing(phone);
  }
  if (!quiet) waToast(forceRefresh ? 'Refreshing QR…' : 'Requesting QR from Evolution…');
  const body = { ...(phone ? { phone } : {}), ...(forceRefresh ? { forceRefresh: true } : {}) };
  const result = await api('/whatsapp/connection/connect', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const codeEl = document.getElementById('wa-conn-pairing');
  const state = String(result.state || '').toLowerCase();

  const shown = await waDisplayQrResult(result);

  if (codeEl && result.pairingCode) {
    codeEl.textContent = `Pairing code: ${result.pairingCode}`;
  } else if (codeEl && !result.pairingCode) {
    codeEl.textContent = '';
  }
  waUpdateConnectPanel(result);
  if (state !== 'open') waStartConnectPoll();
  if (!shown && state !== 'open' && !result.pairingCode) {
    waStartQrPoll(phone);
  }
  if (!quiet) {
    if (result.qrBase64 || result.qrCode) waToast('Scan QR now — do not refresh while logging in');
    else if (result.pairingCode) waToast('Enter pairing code on your phone');
    else if (result.pairingInProgress) waToast('Waiting for QR from Evolution…');
    else if (state === 'open') waToast('WhatsApp connected');
    else if (result.message) waToast(result.message);
    else waToast('No QR returned — verify Evolution URL, instance name, and API key');
  }
  return result;
}

async function loadWhatsApp() {
  const el = document.getElementById('page-whatsapp');
  el.innerHTML = '<div class="wa-page"><p class="muted" style="padding:24px">Loading WhatsApp module…</p></div>';

  try {
    const waOpts = { timeoutMs: 18000 };
    const [status, logs, webhookInfo] = await Promise.all([
      api('/whatsapp/status', {}, 0, waOpts),
      api('/whatsapp/logs?limit=50', {}, 0, waOpts),
      api('/whatsapp/webhook-info', {}, 0, waOpts).catch(() => null),
    ]);

    const conn = status.connection || {};
    const evo = status.evolution || {};
    const sync = status.sync || {};
    const webhookUrl = `${location.origin}/whatsapp-webhook`;
    const models = status.models || {};
    const costs = status.pointCosts || {};

    const webhookMatched = webhookInfo?.matched;
    const remoteWebhook = webhookInfo?.remote;

    const connPhone = conn.phone || null;
    const connState = String(conn.state || 'close').toLowerCase();
    const instanceExists = conn.instanceExists;

    const features = [
      'Medication reminders',
      'NHIS assistant',
      'Ghana diet coach',
      'Location finder',
      'Family profiles',
      'MoMo delivery',
      'BP tracker',
    ];

    el.innerHTML = `
      <div class="wa-page">
        <div class="wa-hero">
          <div class="wa-hero-icon" aria-hidden="true">💬</div>
          <div class="wa-hero-text">
            <h2>Agyenim on WhatsApp</h2>
            <p>Manage Evolution API connection, AI routing, health alerts, and broadcast messages to registered patients in Ghana.</p>
          </div>
          ${waConnectionPill(status.enabled, conn.ok, conn.state)}
        </div>

        ${conn.error ? `<div class="wa-alert"><span class="wa-alert-icon">⚠</span><div><strong>Connection issue</strong><br>${conn.error}${String(conn.error).includes('401') ? '<p style="margin-top:10px;font-size:0.85rem">Fix: In <strong>Evolution API key</strong>, paste the instance <strong>Token</strong> from CloudStation (e.g. 6BBEE79E-…) or your CloudStation <strong>global API key</strong>. Then Save and Refresh.</p>' : ''}</div></div>` : ''}

        <div class="wa-metrics">
          <div class="metric-card">
            <div class="metric-header"><span>Bot status</span><div class="metric-icon green">📱</div></div>
            <div class="metric-value" style="font-size:1.5rem">${status.enabled ? 'Live' : 'Off'}</div>
            <p class="metric-sub">${status.enabled ? 'Accepting WhatsApp messages' : 'Enable below to go live'}</p>
          </div>
          <div class="metric-card">
            <div class="metric-header"><span>Evolution instance</span><div class="metric-icon blue">🔗</div></div>
            <div class="metric-value" style="font-size:1.1rem">${evo.instanceName || '—'}</div>
            <p class="metric-sub">${connPhone ? 'Linked: ' + waFormatPhone(connPhone) : 'API key: ' + (evo.apiKeyConfigured ? '✓ configured' : '✗ missing')}</p>
          </div>
          <div class="metric-card">
            <div class="metric-header"><span>Registered phones</span><div class="metric-icon blue">👥</div></div>
            <div class="metric-value">${sync.registeredPhones ?? 0}</div>
            <p class="metric-sub">Users linked in Account settings</p>
          </div>
          <div class="metric-card">
            <div class="metric-header"><span>Activity logs</span><div class="metric-icon orange">📊</div></div>
            <div class="metric-value">${sync.totalLogs ?? 0}</div>
            <p class="metric-sub">Messages processed via webhook</p>
          </div>
        </div>

        <div class="wa-panel wa-connect-panel">
          <div class="wa-panel-head">
            <div>
              <h3>Connect WhatsApp number</h3>
              <p>Link via <strong>phone code</strong> (recommended) or QR scan <span class="wa-version-tag">v3</span></p>
            </div>
            <span id="wa-conn-state" class="wa-status-pill ${connState === 'open' ? 'wa-status-success' : connState === 'connecting' ? 'wa-status-warn' : 'wa-status-neutral'}">${connState.toUpperCase()}</span>
          </div>
          <div class="wa-connect-grid">
            <div>
              <p class="wa-field-hint" style="margin-bottom:8px">Connected number</p>
              <p id="wa-conn-phone" style="font-size:1.15rem;font-weight:700;margin-bottom:16px">${connPhone ? waFormatPhone(connPhone) : 'Not linked yet'}</p>
              <div class="wa-field" style="margin-bottom:12px">
                <label for="wa-link-phone">WhatsApp phone number</label>
                <input type="tel" id="wa-link-phone" placeholder="0501234567 or 233501234567" />
                <p class="wa-field-hint">Ghana number for <strong>link code</strong> (recommended if QR fails). Or leave blank for QR only.</p>
              </div>
              <div class="wa-actions" style="margin-top:0;flex-wrap:wrap">
                <button type="button" class="wa-btn-whatsapp" id="wa-pair-btn">Get link code</button>
                <button type="button" class="wa-btn-ghost" id="wa-connect-btn">Show QR</button>
                <button type="button" class="wa-btn-ghost" id="wa-refresh-qr">Refresh QR</button>
                ${!instanceExists && evo.apiKeyConfigured ? '<button type="button" class="wa-btn-ghost" id="wa-create-instance">Create instance</button>' : ''}
                <button type="button" class="wa-btn-ghost" id="wa-disconnect-btn">Disconnect</button>
              </div>
              <p id="wa-conn-hint" class="wa-field-hint" style="margin-top:14px">${connState === 'open' ? 'Number linked. Register webhook and enable the bot.' : 'Save Evolution credentials above, then connect here.'}</p>
              <p id="wa-conn-pairing" class="wa-field-hint" style="margin-top:8px;color:var(--cyan)"></p>
            </div>
            <div id="wa-conn-qr" class="wa-qr-wrap">
              ${connState === 'open' ? '<div class="wa-conn-success">✓ WhatsApp linked</div>' : '<p class="muted" style="color:#64748b;text-align:center;padding:20px">Enter your phone number and click <strong>Get link code</strong>, or click <strong>Show QR</strong></p>'}
            </div>
          </div>
        </div>

        <div class="wa-layout">
          <div class="wa-panel">
            <div class="wa-panel-head">
              <div><h3>Configuration</h3><p>CloudStation Evolution API v2 credentials</p></div>
            </div>

            <form id="wa-config-form">
              <div class="wa-toggle-row">
                <div>
                  <strong>Enable WhatsApp bot</strong>
                  <span>When off, users receive a maintenance message</span>
                </div>
                <label class="wa-switch">
                  <input type="checkbox" id="wa-enabled" ${status.enabled ? 'checked' : ''} />
                  <span class="wa-switch-slider"></span>
                </label>
              </div>

              <div class="wa-form-grid">
                <div class="wa-field">
                  <label for="wa-base-url">Evolution base URL</label>
                  <input type="url" id="wa-base-url" placeholder="https://cst-evolution-api-….usecloudstation.com" />
                </div>
                <div class="wa-field">
                  <label for="wa-instance">Instance name</label>
                  <input type="text" id="wa-instance" placeholder="ehealth-ai" />
                </div>
                <div class="wa-field">
                  <label for="wa-api-key">Evolution API key</label>
                  <input type="password" id="wa-api-key" placeholder="Leave blank to keep current" autocomplete="off" />
                  <p class="wa-field-hint">Stored securely in system settings</p>
                </div>
                <div class="wa-field">
                  <label for="wa-webhook-secret">Webhook secret</label>
                  <div style="display:flex;gap:8px">
                    <input type="password" id="wa-webhook-secret" placeholder="Leave blank to keep current" autocomplete="off" style="flex:1" />
                    <button type="button" class="wa-btn-ghost" id="wa-gen-secret">Generate</button>
                  </div>
                  <p class="wa-field-hint">Evolution sends this in x-webhook-secret header</p>
                </div>
                <div class="wa-field full">
                  <label for="wa-prompt">Agyenim system prompt</label>
                  <textarea id="wa-prompt" placeholder="You are Agyenim, the eHealth AI assistant on WhatsApp…"></textarea>
                </div>
              </div>

              <div class="wa-actions">
                <button type="submit" class="wa-btn-whatsapp">Save configuration</button>
                <button type="button" class="wa-btn-ghost" id="wa-reload-btn">Refresh status</button>
              </div>
            </form>
          </div>

          <div>
            <div class="wa-panel" style="margin-bottom:18px">
              <div class="wa-panel-head"><div><h3>AI models & points</h3><p>Per-message costs</p></div></div>
              <div class="wa-model-row"><span>Text / audio</span><span><code>${models.text || 'gemini-2.5-flash'}</code> · ${costs.text ?? 1} pt</span></div>
              <div class="wa-model-row"><span>Vision (lab / medicine)</span><span><code>${models.vision || 'gemini-2.5-pro'}</code> · ${costs.image ?? 5} pt</span></div>
              <div class="wa-model-row"><span>Voice notes</span><span>${costs.audio ?? 2} pt</span></div>
              <div class="wa-model-row"><span>NHIS / Diet / Facility</span><span>1–2 pt</span></div>
              <p style="font-size:0.75rem;color:var(--text-muted);margin-top:14px">Features enabled</p>
              <div class="wa-feature-grid">${features.map((f) => `<span class="wa-chip">${f}</span>`).join('')}</div>
            </div>

            <div class="wa-panel">
              <div class="wa-panel-head"><div><h3>Webhook URL</h3><p>Evolution → eHealth AI</p></div></div>
              <div class="wa-webhook-box">
                <code id="wa-webhook-url">${webhookUrl}</code>
                <button type="button" class="wa-btn-ghost" id="wa-copy-webhook">Copy</button>
              </div>
              <div class="wa-actions" style="margin-top:12px">
                <button type="button" class="wa-btn-whatsapp" id="wa-register-webhook">Register webhook on Evolution</button>
              </div>
              <ul class="wa-stat-list" style="margin-top:16px">
                <li><span>Evolution webhook</span><span>${webhookMatched ? '✓ Linked' : remoteWebhook?.url ? '⚠ Wrong URL' : '— Not registered'}</span></li>
                <li><span>Webhook secret</span><span>${evo.webhookSecretConfigured ? '✓ Set' : '— Not set'}</span></li>
                <li><span>Connection</span><span>${conn.state || '—'}</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div class="wa-layout">
          <div class="wa-panel">
            <div class="wa-panel-head">
              <div><h3>Broadcast alert</h3><p>Send to ${sync.registeredPhones ?? 0} registered numbers</p></div>
            </div>
            <form id="wa-broadcast-form" class="wa-broadcast-area">
              <textarea id="wa-broadcast-msg" maxlength="1000" required placeholder="Health alert, vaccination reminder, or promotion…"></textarea>
              <div class="wa-char-count"><span id="wa-char-n">0</span> / 1000</div>
              <div class="wa-actions">
                <button type="submit" class="wa-btn-whatsapp">Send broadcast</button>
              </div>
            </form>
          </div>

          <div class="wa-panel">
            <div class="wa-panel-head">
              <div><h3>Quick setup</h3><p>Evolution API checklist</p></div>
            </div>
            <ul class="wa-stat-list">
              <li><span>1. CloudStation instance</span><span>${evo.instanceName ? '✓ ' + evo.instanceName : 'Create in CloudStation'}</span></li>
              <li><span>2. Save credentials below</span><span>${evo.apiKeyConfigured ? '✓ Saved' : 'Pending'}</span></li>
              <li><span>3. Register webhook</span><span>${webhookMatched ? '✓ Done' : 'Click button →'}</span></li>
              <li><span>4. Connect WhatsApp number</span><span>${connState === 'open' ? '✓ Linked' : 'Use panel above'}</span></li>
              <li><span>5. Enable bot + link phones</span><span>Account screen</span></li>
            </ul>
          </div>
        </div>

        <div class="wa-panel">
          <div class="wa-panel-head">
            <div><h3>Activity logs</h3><p>Recent WhatsApp webhook events</p></div>
            <button type="button" class="panel-link" id="wa-refresh-logs">Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Time</th><th>Phone</th><th>Type</th><th>Pts</th><th>Status</th><th>Preview</th></tr></thead>
              <tbody id="wa-logs-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('wa-config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        enabled: document.getElementById('wa-enabled').checked,
        evolutionBaseUrl: document.getElementById('wa-base-url').value.trim(),
        instanceName: document.getElementById('wa-instance').value.trim(),
        systemPrompt: document.getElementById('wa-prompt').value.trim(),
      };
      const apiKey = document.getElementById('wa-api-key').value;
      const webhookSecret = document.getElementById('wa-webhook-secret').value;
      if (apiKey) body.evolutionApiKey = apiKey;
      if (webhookSecret) body.webhookSecret = webhookSecret;
      try {
        await api('/whatsapp/config', { method: 'POST', body: JSON.stringify(body) });
        waToast('Configuration saved');
        loadWhatsApp();
      } catch (err) {
        waToast(err.message);
      }
    });

    document.getElementById('wa-broadcast-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = document.getElementById('wa-broadcast-msg').value.trim();
      if (!confirm(`Send this message to ${sync.registeredPhones || 0} registered numbers?`)) return;
      try {
        const result = await api('/whatsapp/broadcast', {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        waToast(`Sent: ${result.sent} · Failed: ${result.failed}`);
        loadWhatsApp();
      } catch (err) {
        waToast(err.message);
      }
    });

    const broadcastEl = document.getElementById('wa-broadcast-msg');
    const charN = document.getElementById('wa-char-n');
    broadcastEl?.addEventListener('input', () => {
      if (charN) charN.textContent = String(broadcastEl.value.length);
    });

    document.getElementById('wa-copy-webhook')?.addEventListener('click', () => waCopyWebhook(webhookUrl));
    document.getElementById('wa-gen-secret')?.addEventListener('click', () => {
      const el = document.getElementById('wa-webhook-secret');
      if (el) {
        el.value = waGenSecret();
        waToast('Secret generated — click Save configuration');
      }
    });
    document.getElementById('wa-pair-btn')?.addEventListener('click', async () => {
      try {
        const phone = document.getElementById('wa-link-phone')?.value?.trim();
        if (!phone) {
          waToast('Enter your WhatsApp phone number first');
          document.getElementById('wa-link-phone')?.focus();
          return;
        }
        await waRequestPairing(phone);
      } catch (err) {
        waToast(err.message);
      }
    });
    document.getElementById('wa-connect-btn')?.addEventListener('click', async () => {
      try {
        await waRequestConnect(undefined, { mode: 'qr' });
      } catch (err) {
        waToast(err.message);
      }
    });
    document.getElementById('wa-refresh-qr')?.addEventListener('click', async () => {
      if (!confirm('Refresh QR? Only do this if pairing failed — refreshing cancels an in-progress login.')) return;
      try {
        await waRequestConnect(undefined, { forceRefresh: true, mode: 'qr' });
      } catch (err) {
        waToast(err.message);
      }
    });
    document.getElementById('wa-create-instance')?.addEventListener('click', async () => {
      try {
        waToast('Creating Evolution instance…');
        const result = await api('/whatsapp/connection/create', { method: 'POST', body: '{}' });
        await waDisplayQrResult(result);
        waUpdateConnectPanel(result);
        waStartConnectPoll();
        if (!result.qrBase64 && !result.qrCode) waStartQrPoll();
        waToast(result.qrBase64 || result.qrCode ? 'Instance created — scan QR' : 'Instance created — fetching QR…');
      } catch (err) {
        waToast(err.message);
      }
    });
    document.getElementById('wa-disconnect-btn')?.addEventListener('click', async () => {
      if (!confirm('Disconnect WhatsApp from Evolution?')) return;
      try {
        await api('/whatsapp/connection/logout', { method: 'POST', body: '{}' });
        waStopAllPolls();
        waToast('Disconnected');
        loadWhatsApp();
      } catch (err) {
        waToast(err.message);
      }
    });

    if (connState === 'connecting') {
      waStartConnectPoll();
      waRequestConnect(undefined, { quiet: true }).catch(() => {});
    } else waStopConnectPoll();

    document.getElementById('wa-register-webhook')?.addEventListener('click', async () => {
      try {
        waToast('Registering webhook on Evolution…');
        const result = await api('/whatsapp/register-webhook', {
          method: 'POST',
          body: JSON.stringify({ webhookUrl }),
        });
        waToast(result.remote?.url ? 'Webhook registered on Evolution' : 'Webhook request sent');
        loadWhatsApp();
      } catch (err) {
        waToast(err.message);
      }
    });
    document.getElementById('wa-reload-btn')?.addEventListener('click', () => loadWhatsApp());
    document.getElementById('wa-refresh-logs')?.addEventListener('click', () => loadWhatsApp());

    const tbody = document.getElementById('wa-logs-body');
    const rows = logs.logs || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="wa-empty"><div class="wa-empty-icon">📭</div><p>No WhatsApp activity yet</p><p style="font-size:0.8rem;margin-top:8px">Messages appear here once users chat with Agyenim</p></div></td></tr>`;
    } else {
      tbody.innerHTML = rows
        .map(
          (l) => `<tr>
            <td>${new Date(l.createdAt).toLocaleString()}</td>
            <td><code>${l.phone}</code></td>
            <td>${l.messageType}</td>
            <td>${l.pointsCharged}</td>
            <td><span class="wa-status-pill ${waStatusClass(l.status)}">${l.status}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(l.payloadPreview || '').replace(/</g, '&lt;')}</td>
          </tr>`
        )
        .join('');
    }

    api('/settings')
      .then(({ settings }) => {
        const s = settings || {};
        document.getElementById('wa-base-url').value = s.whatsapp_evolution_base_url?.value || '';
        document.getElementById('wa-instance').value = s.whatsapp_instance_name?.value || '';
        document.getElementById('wa-prompt').value = s.whatsapp_system_prompt?.value || '';
      })
      .catch(() => {});
  } catch (err) {
    el.innerHTML = `
      <div class="wa-page">
        <div class="wa-alert" style="margin-top:0">
          <span class="wa-alert-icon">✕</span>
          <div>
            <strong>${err.message}</strong>
            ${err.detail ? `<p style="margin-top:8px;font-size:0.85rem">${err.detail}</p>` : ''}
            <p style="margin-top:12px;font-size:0.8rem;opacity:0.9">Fix: upload latest admin files, run <code>bash ~/ehealth-ai/cpanel/publish-admin.sh</code>, RESTART Node.js, hard-refresh (Ctrl+Shift+R)</p>
          </div>
        </div>
      </div>`;
  }
}

window.loadWhatsApp = loadWhatsApp;
