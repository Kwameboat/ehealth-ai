const path = require('path');
const Module = require('module');

// cPanel sets NODE_PATH to nodevenv/lib/node_modules (prebuilt for newer glibc → GLIBC_2.29 errors)
delete process.env.NODE_PATH;

// cPanel may install node_modules in ehealth-ai/ instead of ehealth-ai/backend/
for (const dir of [path.join(__dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules')]) {
  if (!Module.globalPaths.includes(dir)) Module.globalPaths.unshift(dir);
}

require('dotenv').config({ path: path.join(__dirname, '.env') });

const cors = require('cors');
const express = require('express');
const fs = require('fs');

const { getDb } = require('./db/init');
const {
  ensureDbReadyWithRecovery,
  startupDatabase,
  recoverDatabase,
  getDbStatus,
  clearDbArtifacts,
  startDbMaintenance,
} = require('./db/ensureDb');
const { gateDatabase } = require('./middleware/dbGate');

// Clear stale lock files before any worker tries to open the DB (Passenger multi-worker fix)
clearDbArtifacts({ aggressive: true });

/** Shared startup — middleware waits on this so early requests never hit a cold DB. */
const dbStartupPromise = startupDatabase(30_000).catch((err) => {
  console.error('[db] startupDatabase failed (middleware will keep retrying):', err.message);
  return { ok: false, error: err.message };
});

function waitForStartup(maxMs = 15_000) {
  return Promise.race([
    dbStartupPromise,
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, timedOut: true }), maxMs)),
  ]);
}

const { requireAppAuth } = require('./middleware/appSecret');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const healthRoutes = require('./routes/health');
const consultationRoutes = require('./routes/consultations');
const emergencyRoutes = require('./routes/emergency');
const { paystackWebhookHandler } = require('./routes/payments');
const { adminRouter: whatsappAdminRouter, webhookRouter: whatsappWebhookRouter } = require('./routes/whatsapp-bridge');
const { requireAdminAuth } = require('./middleware/adminAuth');

const app = express();
app.set('trust proxy', 1);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProd && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-MedAssistant-Key', 'x-medassistant-key'],
  })
);

/** PWA reads APP_API_SECRET at runtime (no rebuild when cPanel secret changes). */
app.get('/app-config.js', (req, res) => {
  const secret = process.env.APP_API_SECRET || '';
  const host = req.get('host') || '';
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const proto =
    forwardedProto === 'https' || req.secure
      ? 'https'
      : isProd
        ? 'https'
        : forwardedProto || 'http';
  const apiUrl =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (host ? `${proto}://${host}` : '');
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    `window.__EHEALTH_CONFIG__=${JSON.stringify({
      appApiSecret: secret,
      apiUrl: apiUrl.replace(/\/$/, ''),
    })};`
  );
});

app.get('/api/health', async (req, res) => {
  const forceRecover = req.query.recover === '1' || req.query.recover === 'true';
  const timeoutMs = forceRecover ? 25_000 : 18_000;

  try {
    if (forceRecover) {
      await recoverDatabase('health-check');
    }

    await waitForStartup(timeoutMs);

    const result = await Promise.race([
      ensureDbReadyWithRecovery(forceRecover ? 4 : 3),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database init timeout')), timeoutMs)
      ),
    ]);
    if (!result.ok) throw new Error(result.error || 'Database not ready');
    probeOk();
    const diag = getDbStatus();
    return res.json({
      status: 'ok',
      service: 'eHealth AI API',
      db: true,
      recovered: !!result.recovered || forceRecover,
      dbPath: diag.dbPath,
      time: new Date().toISOString(),
    });
  } catch (err) {
    const diag = getDbStatus();
    res.status(503).json({
      status: 'error',
      service: 'eHealth AI API',
      db: false,
      error: err.message,
      wasm: diag.wasmPath,
      dbPath: diag.dbPath,
      dbExists: diag.dbExists,
      dbWritable: diag.dbWritable,
      hint: 'Run: bash ~/ehealth-ai/cpanel/fix-db-permanent.sh then RESTART Node.js',
      recoverUrl: '/api/health?recover=1',
      time: new Date().toISOString(),
    });
  }
});

function probeOk() {
  getDb().prepare('SELECT 1 AS ok').get();
}
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhookHandler
);

app.use(express.json({ limit: '20mb' }));

app.use(async (req, res, next) => {
  if (
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/admin/api') &&
    req.path !== '/whatsapp-webhook'
  ) {
    return next();
  }
  if (req.path === '/api/health') return next();
  const isAdminLogin = req.method === 'POST' && req.path === '/admin/api/login';
  const gateMs = isAdminLogin ? 8000 : 4000;
  const gate = await gateDatabase(gateMs);
  if (!gate.ok) {
    const diag = gate.status || getDbStatus();
    return res.status(503).json({
      error: {
        message: 'Database not ready',
        detail: gate.error,
        wasm: diag.wasmPath,
        dbPath: diag.dbPath,
        hint: 'Retry in a few seconds — auto-recovery is running',
        recoverUrl: '/api/health?recover=1',
      },
    });
  }
  next();
});

app.use('/whatsapp-webhook', whatsappWebhookRouter);

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
  setHeaders(res, filePath) {
    if (/\.(js|css|html)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));
app.use('/payment', express.static(path.join(__dirname, 'public', 'payment')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const webDistPath = process.env.WEB_DIST_PATH
  ? path.resolve(process.env.WEB_DIST_PATH)
  : isProd
    ? path.join(__dirname, '..', 'dist')
    : null;

if (webDistPath && fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  console.log(`Serving PWA from ${webDistPath}`);
}

app.use('/admin/api', adminRoutes);
app.use('/api/admin/whatsapp', requireAdminAuth, whatsappAdminRouter);

app.use('/api/auth', requireAppAuth, authRoutes);
app.use('/api', requireAppAuth, userRoutes);
app.use('/api', requireAppAuth, aiRoutes);
app.use('/api/payments', requireAppAuth, paymentRoutes);
app.use('/api/emergency', requireAppAuth, emergencyRoutes);
app.use('/api', requireAppAuth, healthRoutes);
app.use('/api', requireAppAuth, consultationRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

if (webDistPath && fs.existsSync(webDistPath)) {
  const indexHtml = path.join(webDistPath, 'index.html');
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/payment') ||
      req.path.startsWith('/assets') ||
      req.path === '/whatsapp-webhook'
    ) {
      return next();
    }
    if (req.method !== 'GET') return next();
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') return next();
    res.sendFile(indexHtml, (err) => (err ? next() : undefined));
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled error:', req.method, req.path, err);
  res.status(500).json({
    error: { message: 'Server error', detail: isProd ? undefined : err.message },
  });
});

app.use((req, res) => {
  res.status(404).end();
});

function flushDbSync() {
  try {
    const db = getDb();
    if (typeof db.flush === 'function') db.flush();
  } catch {
    /* ignore */
  }
}

function onListen() {
  const listenPort = Number(process.env.PORT) || PORT;
  console.log(`eHealth AI API on ${HOST}:${listenPort}`);
  startDbMaintenance();
  if (!process.env.GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY missing');
  if (!process.env.APP_API_SECRET) console.warn('WARNING: APP_API_SECRET missing');
}

for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => {
    flushDbSync();
    clearDbArtifacts();
  });
}
process.on('beforeExit', flushDbSync);

module.exports = app;

// cPanel Node.js: must listen on PORT from the panel (also export for Passenger)
const listenPort = Number(process.env.PORT) || PORT;

(async () => {
  await dbStartupPromise;
  try {
    const { getDashboardData } = require('./services/dashboardCache');
    getDashboardData(getDb());
    console.log('[cache] Dashboard stats warmed');
  } catch (e) {
    console.warn('[cache] Dashboard warm skipped:', e.message);
  }
  if (!process.env.PASSENGER_APP_ENV) {
    app.listen(listenPort, '0.0.0.0', onListen);
  } else {
    onListen();
  }
})();
