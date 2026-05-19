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

const { initDatabase, getDb } = require('./db/init');
let dbBootError = null;
let dbInitPromise = null;

function ensureDbInit() {
  if (dbBootError) dbBootError = null;
  if (!dbInitPromise) {
    dbInitPromise = initDatabase()
      .then(() => {
        dbBootError = null;
      })
      .catch((err) => {
        dbBootError = err;
        dbInitPromise = null;
        throw err;
      });
  }
  return dbInitPromise;
}

ensureDbInit();

const { requireAppAuth } = require('./middleware/appSecret');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const { paystackWebhookHandler } = require('./routes/payments');

const app = express();
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
  })
);

app.get('/api/health', async (req, res) => {
  try {
    await ensureDbInit();
    getDb().prepare('SELECT 1 AS ok').get();
    res.json({
      status: 'ok',
      service: 'eHealth AI API',
      db: true,
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'eHealth AI API',
      db: false,
      error: err.message,
      hint: 'cPanel → Node.js → RESTART; set JWT_SECRET in app env vars',
      time: new Date().toISOString(),
    });
  }
});
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhookHandler
);

app.use(express.json({ limit: '20mb' }));

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/admin/api')) {
    return next();
  }
  if (req.path === '/api/health') return next();
  try {
    await ensureDbInit();
    next();
  } catch (err) {
    res.status(503).json({
      error: { message: 'Database not ready', detail: err.message },
    });
  }
});

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
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

app.use('/api/auth', requireAppAuth, authRoutes);
app.use('/api', requireAppAuth, userRoutes);
app.use('/api', requireAppAuth, aiRoutes);
app.use('/api/payments', requireAppAuth, paymentRoutes);

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
      req.path.startsWith('/assets')
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

function onListen() {
  const listenPort = Number(process.env.PORT) || PORT;
  console.log(`eHealth AI API on ${HOST}:${listenPort}`);
  if (dbBootError) console.error('Running without database:', dbBootError.message);
  if (!process.env.GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY missing');
  if (!process.env.APP_API_SECRET) console.warn('WARNING: APP_API_SECRET missing');
}

module.exports = app;

// cPanel Node.js: must listen on PORT from the panel (also export for Passenger)
const listenPort = Number(process.env.PORT) || PORT;

(async () => {
  try {
    await ensureDbInit();
    console.log('Database ready (sql.js)');
  } catch (err) {
    console.error('Database init failed:', err);
  }
  if (!process.env.PASSENGER_APP_ENV) {
    app.listen(listenPort, '0.0.0.0', onListen);
  } else {
    onListen();
  }
})();
