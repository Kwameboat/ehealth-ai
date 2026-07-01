export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, options = {}, attempts = 3, timeoutMs = 55_000) {
  let lastErr;
  const isChat = String(url).includes('/api/chat');
  const maxAttempts = isChat ? Math.min(attempts, 2) : attempts;
  const waitMs = isChat ? 600 : 900;
  for (let i = 0; i < maxAttempts; i += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      const retryStatus = res.status === 503 || res.status === 502 || res.status === 504;
      if (retryStatus && i < maxAttempts - 1) {
        await sleep(waitMs * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e.name === 'AbortError' ? new Error('Request timed out — server may be busy, try again') : e;
      if (i < maxAttempts - 1) await sleep(waitMs * (i + 1));
    }
  }
  throw lastErr || new Error('Network error');
}
