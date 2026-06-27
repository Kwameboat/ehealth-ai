async function loadWhatsApp() {
  const el = document.getElementById('page-whatsapp');
  el.innerHTML = '<p class="muted">Loading WhatsApp module…</p>';

  try {
    const [status, logs] = await Promise.all([
      api('/whatsapp/status'),
      api('/whatsapp/logs?limit=50'),
    ]);

    const conn = status.connection || {};
    const evo = status.evolution || {};
    const sync = status.sync || {};

    el.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h3>Connection</h3>
          <p><strong>Enabled:</strong> ${status.enabled ? 'Yes' : 'No'}</p>
          <p><strong>State:</strong> ${conn.state || '—'} ${conn.ok ? '✓' : '⚠'}</p>
          <p><strong>Instance:</strong> ${evo.instanceName || '—'}</p>
          <p><strong>API key:</strong> ${evo.apiKeyConfigured ? 'Configured' : 'Missing'}</p>
          <p><strong>Registered phones:</strong> ${sync.registeredPhones ?? 0}</p>
          <p><strong>Total logs:</strong> ${sync.totalLogs ?? 0}</p>
          ${conn.error ? `<p class="error-msg">${conn.error}</p>` : ''}
        </div>
        <div class="card">
          <h3>AI models & points</h3>
          <p>Text / audio: <code>${status.models?.text || 'gemini-2.5-flash'}</code> (${status.pointCosts?.text ?? 1} pt)</p>
          <p>Vision: <code>${status.models?.vision || 'gemini-2.5-pro'}</code> (${status.pointCosts?.image ?? 5} pt)</p>
          <p>Voice: ${status.pointCosts?.audio ?? 2} pt</p>
          <p class="muted">Webhook URL: <code>${location.origin}/whatsapp-webhook</code></p>
        </div>
      </div>

      <div class="card" style="margin-top:1rem">
        <h3>Configuration</h3>
        <form id="wa-config-form" class="form-grid">
          <label class="field-label"><input type="checkbox" id="wa-enabled" ${status.enabled ? 'checked' : ''} /> Enable WhatsApp bot</label>
          <label class="field-label">Evolution base URL<input type="url" id="wa-base-url" placeholder="https://your-cloudstation.example.com" /></label>
          <label class="field-label">Instance name<input type="text" id="wa-instance" placeholder="ehealth-ai" /></label>
          <label class="field-label">Evolution API key<input type="password" id="wa-api-key" placeholder="Leave blank to keep current" autocomplete="off" /></label>
          <label class="field-label">Webhook secret<input type="password" id="wa-webhook-secret" placeholder="Leave blank to keep current" autocomplete="off" /></label>
          <label class="field-label">System prompt<textarea id="wa-prompt" rows="4"></textarea></label>
          <button type="submit" class="btn btn-primary">Save configuration</button>
        </form>
      </div>

      <div class="card" style="margin-top:1rem">
        <h3>Broadcast</h3>
        <form id="wa-broadcast-form">
          <label class="field-label">Message to all registered numbers<textarea id="wa-broadcast-msg" rows="3" required placeholder="Health alert or promotion…"></textarea></label>
          <button type="submit" class="btn btn-primary">Send broadcast</button>
        </form>
      </div>

      <div class="card" style="margin-top:1rem">
        <h3>Activity logs</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Phone</th><th>Type</th><th>Points</th><th>Status</th><th>Preview</th></tr></thead>
            <tbody id="wa-logs-body"></tbody>
          </table>
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
        alert('WhatsApp configuration saved');
        loadWhatsApp();
      } catch (err) {
        alert(err.message);
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
        alert(`Broadcast complete: ${result.sent} sent, ${result.failed} failed`);
        loadWhatsApp();
      } catch (err) {
        alert(err.message);
      }
    });

    const tbody = document.getElementById('wa-logs-body');
    const rows = logs.logs || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No WhatsApp activity yet</td></tr>';
    } else {
      tbody.innerHTML = rows
        .map(
          (l) => `<tr>
            <td>${new Date(l.createdAt).toLocaleString()}</td>
            <td>${l.phone}</td>
            <td>${l.messageType}</td>
            <td>${l.pointsCharged}</td>
            <td>${l.status}</td>
            <td>${(l.payloadPreview || '').slice(0, 60)}</td>
          </tr>`
        )
        .join('');
    }

    api('/settings')
      .then(({ settings }) => {
        const s = settings || {};
        const url = s.whatsapp_evolution_base_url?.value || '';
        const inst = s.whatsapp_instance_name?.value || '';
        const prompt = s.whatsapp_system_prompt?.value || '';
        document.getElementById('wa-base-url').value = url;
        document.getElementById('wa-instance').value = inst;
        document.getElementById('wa-prompt').value = prompt;
      })
      .catch(() => {});
  } catch (err) {
    el.innerHTML = `<div class="card"><p class="error-msg">${err.message}</p></div>`;
  }
}

window.loadWhatsApp = loadWhatsApp;
