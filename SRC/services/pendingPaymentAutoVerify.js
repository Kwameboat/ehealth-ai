import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { getPendingPaymentReference, PENDING_REF_KEY, verifyPayment } from './paymentsApi';

const POLL_MS = 3500;
const MAX_WATCH_MS = 5 * 60 * 1000;

let pollTimer = null;
let watchStartedAt = 0;
let verifying = false;
let lastNotifiedRef = null;
const listeners = new Set();
let appStateSub = null;
let visibilityHandler = null;

function notifyListeners(result, reference) {
  if (lastNotifiedRef === reference) return;
  lastNotifiedRef = reference;
  listeners.forEach((fn) => {
    try {
      fn(result);
    } catch (_) {
      /* ignore listener errors */
    }
  });
}

export function subscribePaymentVerified(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function parseWebPaymentReference() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('reference') || params.get('trxref');
}

async function captureWebReturnReference() {
  const ref = parseWebPaymentReference();
  if (!ref) return null;
  await AsyncStorage.setItem(PENDING_REF_KEY, ref);
  const path = window.location.pathname || '/';
  window.history.replaceState({}, '', path);
  return ref;
}

async function attemptVerify() {
  if (verifying) return false;
  const ref = (await captureWebReturnReference()) || (await getPendingPaymentReference());
  if (!ref) {
    stopWatching();
    return false;
  }

  verifying = true;
  try {
    const result = await verifyPayment(ref);
    notifyListeners(result, ref);
    stopWatching();
    return true;
  } catch {
    return false;
  } finally {
    verifying = false;
  }
}

export function startWatching() {
  if (pollTimer) return;
  watchStartedAt = Date.now();
  attemptVerify();

  pollTimer = setInterval(() => {
    if (Date.now() - watchStartedAt > MAX_WATCH_MS) {
      stopWatching();
      return;
    }
    attemptVerify();
  }, POLL_MS);

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attemptVerify();
    });
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined' && !visibilityHandler) {
    visibilityHandler = () => {
      if (!document.hidden) attemptVerify();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
}

export function stopWatching() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function kickVerify() {
  return attemptVerify();
}

export async function resumeWatchingIfPending() {
  const ref = await getPendingPaymentReference();
  if (ref) startWatching();
  return ref;
}
