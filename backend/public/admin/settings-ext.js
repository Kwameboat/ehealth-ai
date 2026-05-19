/** Extends admin settings with Paystack + Gemini key management */
loadSettings = async function () {
  const el = document.getElementById('page-settings');
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading…</p>';
  try {
  const settingsRes = await api('/settings');
  const settings = settingsRes.settings || settingsRes;
  let integrations;
  try {
    integrations = await api('/integrations');
  } catch {
    integrations = { paystackConfigured: false, geminiConfigured: false, geminiModel: 'gemini-2.5-flash', paymentCurrency: 'GHS' };
  }
  const pointsOn = settings.points_enabled?.value === 'true';
  const bonus = settings.signup_bonus_points?.value || '100';
  const appName = settings.app_name?.value || 'eHealth AI';

  el.innerHTML = `
    <div class="page-intro"><div><h2>Settings & API Keys</h2>
    <p>Paystack: ${integrations.paystackConfigured ? '<span class="pill pill-stable">CONNECTED</span>' : '<span class="pill pill-critical">NOT CONFIGURED</span>'}
    · Gemini: ${integrations.geminiConfigured ? '<span class="pill pill-stable">CONNECTED</span>' : '<span class="pill pill-critical">NOT CONFIGURED</span>'}</p></div></div>
    <div class="dashboard-mid">
      <div class="panel"><h3>Paystack</h3>
        <p class="muted" style="font-size:0.8rem;margin-bottom:10px">From dashboard.paystack.com → Settings → API Keys</p>
        <div class="form-row"><label>Secret key</label><input type="password" id="paystack-secret" placeholder="sk_test_… or sk_live_…" autocomplete="new-password" /></div>
        <div class="form-row"><label>Public key</label><input type="text" id="paystack-public" placeholder="pk_test_…" /></div>
      </div>
      <div class="panel"><h3>Google Gemini</h3>
        <p class="muted" style="font-size:0.8rem;margin-bottom:10px">From aistudio.google.com/apikey</p>
        <div class="form-row"><label>API key</label><input type="password" id="gemini-key" placeholder="AIza…" autocomplete="new-password" /></div>
        <div class="form-row"><label>Model</label><input type="text" id="gemini-model" value="${escapeHtml(integrations.geminiModel || 'gemini-2.5-flash')}" /></div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>Points economy</h3>
      <div class="form-row toggle"><input type="checkbox" id="set-points-enabled" ${pointsOn ? 'checked' : ''} /><label>Enable point deductions</label></div>
      <div class="form-row"><label>Signup bonus points</label><input type="number" id="set-signup-bonus" value="${bonus}" /></div>
      <div class="form-row"><label>Default currency</label>
        <select id="payment-currency" style="width:100%;padding:8px;background:var(--bg-card);color:var(--text);border:1px solid var(--border)">
          <option value="GHS" ${(settings.payment_currency?.value || 'GHS') === 'GHS' ? 'selected' : ''}>GHS (Ghana Cedis)</option>
          <option value="NGN" ${settings.payment_currency?.value === 'NGN' ? 'selected' : ''}>NGN</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="save-integrations">Save API keys</button>
        <button type="button" class="btn btn-ghost" id="save-settings">Save economy</button>
        <button type="button" class="btn btn-ghost" id="goto-packages">Manage point prices →</button>
      </div>
    </div>`;

  document.getElementById('save-integrations').onclick = async () => {
    const body = {
      geminiModel: document.getElementById('gemini-model').value.trim(),
      paymentCurrency: document.getElementById('payment-currency').value,
    };
    const gk = document.getElementById('gemini-key').value.trim();
    const sk = document.getElementById('paystack-secret').value.trim();
    const pk = document.getElementById('paystack-public').value.trim();
    if (gk) body.geminiApiKey = gk;
    if (sk) body.paystackSecretKey = sk;
    if (pk) body.paystackPublicKey = pk;
    const r = await api('/integrations', { method: 'PUT', body: JSON.stringify(body) });
    alert(`Saved.\nGemini: ${r.geminiConfigured ? 'Connected' : 'Not configured'}\nPaystack: ${r.paystackConfigured ? 'Connected' : 'Not configured'}`);
    loadSettings();
  };

  document.getElementById('save-settings').onclick = async () => {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          points_enabled: document.getElementById('set-points-enabled').checked ? 'true' : 'false',
          signup_bonus_points: document.getElementById('set-signup-bonus').value,
          app_name: appName,
          payment_currency: document.getElementById('payment-currency').value,
        },
      }),
    });
    alert('Economy settings saved');
    loadSettings();
  };

  document.getElementById('goto-packages').onclick = () => showPage('packages');
  } catch (err) {
    el.innerHTML = `<div class="panel"><p class="error-msg">${escapeHtml(err.message)}</p><button type="button" class="btn btn-primary btn-sm" id="retry-settings">Retry</button></div>`;
    document.getElementById('retry-settings').onclick = () => loadSettings();
  }
};
