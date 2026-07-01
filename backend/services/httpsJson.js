/**
 * Native Node https JSON POST — safe on CloudLinux/Passenger (no undici fetch).
 */
const https = require('https');

function postJson(url, payload, timeoutMs = 22_000, extraHeaders = {}) {
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
          ...extraHeaders,
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
            reject(new Error('Invalid JSON response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Request timed out');
      err.status = 504;
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

function getJson(url, headers = {}, timeoutMs = 22_000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers,
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
            reject(new Error('Invalid JSON response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Request timed out');
      err.status = 504;
      reject(err);
    });
    req.end();
  });
}

module.exports = { postJson, getJson };
