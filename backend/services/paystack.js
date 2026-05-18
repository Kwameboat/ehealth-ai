const crypto = require('crypto');
const { getPaystackSecretKey } = require('./settings');

const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackRequest(path, options = {}) {
  const secret = getPaystackSecretKey();
  if (!secret) {
    const err = new Error('Paystack is not configured. Add keys in Admin → Settings & Keys.');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.status) {
    const err = new Error(data.message || 'Paystack request failed');
    err.status = 400;
    throw err;
  }
  return data;
}

async function initializeTransaction({ email, amountMinor, currency, reference, callbackUrl, metadata }) {
  const body = {
    email,
    amount: amountMinor,
    reference,
    callback_url: callbackUrl,
    metadata,
  };
  if (currency && currency !== 'NGN') {
    body.currency = currency;
  }
  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.data;
}

async function verifyTransaction(reference) {
  const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data;
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = getPaystackSecretKey();
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return hash === signature;
}

function isConfigured() {
  return !!getPaystackSecretKey();
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  isConfigured,
};
