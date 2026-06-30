/**
 * Isolated Gemini HTTP worker — if outbound HTTPS crashes on CloudLinux/Passenger,
 * only this child exits; the main app returns a JSON fallback instead of HTML 503.
 */
const https = require('https');

function postJson(url, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const req = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
        agent: false,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : {};
            resolve({ status: res.statusCode || 500, data });
          } catch {
            reject(new Error('Invalid response from Gemini API'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const e = new Error('AI response timed out — please try again in a moment.');
      e.status = 504;
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

process.on('message', async (msg) => {
  if (!msg || msg.type !== 'call') {
    process.exit(2);
    return;
  }
  try {
    const { url, payload, timeoutMs } = msg;
    const { status, data } = await postJson(url, payload, timeoutMs || 22_000);
    if (status < 200 || status >= 300) {
      const errMsg = data?.error?.message || `Gemini request failed (${status})`;
      process.send({ ok: false, error: { message: errMsg, status } });
    } else {
      process.send({ ok: true, data });
    }
  } catch (err) {
    process.send({
      ok: false,
      error: { message: err.message || 'Gemini worker error', status: err.status || 500 },
    });
  }
  process.exit(0);
});
