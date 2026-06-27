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

async function loadWhatsApp() {
  const el = document.getElementById('page-whatsapp');
  el.innerHTML = '<div class="wa-page"><p class="muted" style="padding:24px">Loading WhatsApp module…</p></div>';

  try {
    const [status, logs, webhookInfo] = await Promise.all([
      api('/whatsapp/status'),
      api('/whatsapp/logs?limit=50'),
      api('/whatsapp/webhook-info').catch(() => null),
    ]);

    const conn = status.connection || {};
    const evo = status.evolution || {};
    const sync = status.sync || {};
    const webhookUrl = `${location.origin}/whatsapp-webhook`;
    const models = status.models || {};
    const costs = status.pointCosts || {};

    const webhookMatched = webhookInfo?.matched;
    const remoteWebhook = webhookInfo?.remote;

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

        ${conn.error ? `<div class="wa-alert"><span class="wa-alert-icon">⚠</span><div><strong>Connection issue</strong><br>${conn.error}</div></div>` : ''}

        <div class="wa-metrics">
          <div class="metric-card">
            <div class="metric-header"><span>Bot status</span><div class="metric-icon green">📱</div></div>
            <div class="metric-value" style="font-size:1.5rem">${status.enabled ? 'Live' : 'Off'}</div>
            <p class="metric-sub">${status.enabled ? 'Accepting WhatsApp messages' : 'Enable below to go live'}</p>
          </div>
          <div class="metric-card">
            <div class="metric-header"><span>Evolution instance</span><div class="metric-icon blue">🔗</div></div>
            <div class="metric-value" style="font-size:1.1rem">${evo.instanceName || '—'}</div>
            <p class="metric-sub">API key: ${evo.apiKeyConfigured ? '✓ configured' : '✗ missing'}</p>
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
                  <input type="url" id="wa-base-url" placeholder="https://your-cloudstation.example.com" />
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
              <li><span>4. Scan QR in CloudStation</span><span>${conn.state === 'open' ? '✓ Connected' : 'Link WhatsApp'}</span></li>
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
            <p style="margin-top:12px;font-size:0.8rem;opacity:0.9">Fix: <code>curl -fsSL https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/cpanel/fix-whatsapp-live.sh | bash</code> then RESTART Node.js</p>
          </div>
        </div>
      </div>`;
  }
}

window.loadWhatsApp = loadWhatsApp;
