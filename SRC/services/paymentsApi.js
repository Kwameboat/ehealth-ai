import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';

const PENDING_REF_KEY = 'ehealth_pending_payment_ref';

function getApiBase() {
  return getApiUrl();
}

async function request(path, options = {}) {
  const apiBase = getApiBase();
  if (!apiBase) throw new Error('Backend not configured');

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await getApiAuthHeadersAsync()),
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code;
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function fetchPointPackages() {
  return request('/api/payments/packages', { method: 'GET' });
}

export async function initializePayment(packageId) {
  const data = await request('/api/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({ packageId }),
  });
  await AsyncStorage.setItem(PENDING_REF_KEY, data.reference);
  return data;
}

export async function verifyPayment(reference) {
  const ref = reference || (await AsyncStorage.getItem(PENDING_REF_KEY));
  if (!ref) throw new Error('No payment reference found');
  const data = await request(`/api/payments/verify/${encodeURIComponent(ref)}`, { method: 'GET' });
  await AsyncStorage.removeItem(PENDING_REF_KEY);
  return data;
}

export async function getPendingPaymentReference() {
  return AsyncStorage.getItem(PENDING_REF_KEY);
}
