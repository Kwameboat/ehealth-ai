export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, options, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, options);
      const retryStatus = res.status === 503 || res.status === 502 || res.status === 504;
      if (retryStatus && i < attempts - 1) {
        await sleep(900 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(900 * (i + 1));
    }
  }
  throw lastErr || new Error('Network error');
}
