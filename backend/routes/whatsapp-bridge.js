const express = require('express');
const { getDb, uuid, now } = require('../db/init');
const { ensureDbReady } = require('../db/ensureDb');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { deductPoints, getUserBalance, PointsError } = require('../services/points');
const { getSetting, setSetting, getGeminiApiKey } = require('../services/settings');
const { findNearbyFacilities } = require('../services/nearbyPlaces');
const { initializeTransaction } = require('../services/paystack');

let whatsappModule = null;
let whatsappLoadError = null;
let routersCache = null;

function getUserEmail(userId) {
  const row = getDb().prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return row?.email || null;
}

function buildDeps() {
  return {
    getDb,
    uuid,
    now,
    getSetting,
    setSetting,
    getGeminiApiKey,
    deductPoints,
    getUserBalance,
    requireAdminAuth,
    PointsError,
    ensureDbReady,
    findNearbyFacilities,
    getUserEmail,
    initializePaystack: async (opts) => {
      const callbackUrl =
        process.env.PAYSTACK_CALLBACK_URL ||
        process.env.PUBLIC_APP_URL ||
        'https://www.ehealthaigh.com';
      return initializeTransaction({
        email: opts.email,
        amountMinor: opts.amountMinor,
        currency: opts.currency,
        reference: opts.reference,
        callbackUrl: `${String(callbackUrl).replace(/\/$/, '')}/payment/callback.html`,
        metadata: opts.metadata,
      });
    },
  };
}

function loadWhatsAppModule() {
  if (whatsappModule !== null) return whatsappModule;
  try {
    whatsappModule = require('../whatsapp/dist/index.js');
    whatsappLoadError = null;
  } catch (err) {
    whatsappLoadError = err;
    console.error('WhatsApp module load failed:', err.message);
    whatsappModule = false;
  }
  return whatsappModule;
}

function createRouters() {
  const mod = loadWhatsAppModule();
  if (!mod?.createWhatsAppRouters) {
    const empty = express.Router();
    const detail = whatsappLoadError?.message || 'dist/index.js missing';
    empty.all('*', (_req, res) => {
      res.status(503).json({
        error: {
          message: 'WhatsApp module not available on server.',
          detail,
          fix: 'Run deploy workflow or bash ~/ehealth-ai/cpanel/sync-whatsapp.sh then RESTART Node.js app',
        },
      });
    });
    return { adminRouter: empty, webhookRouter: empty };
  }
  return mod.createWhatsAppRouters(buildDeps());
}

function getRouters() {
  if (!routersCache) routersCache = createRouters();
  return routersCache;
}

function lazyRouter(getInner) {
  const router = express.Router();
  router.use((req, res, next) => {
    try {
      return getInner()(req, res, next);
    } catch (err) {
      console.error('[whatsapp] route error:', err.message);
      if (!res.headersSent) {
        res.status(503).json({ error: { message: 'WhatsApp route failed', detail: err.message } });
      }
    }
  });
  return router;
}

const adminRouter = lazyRouter(() => getRouters().adminRouter);
const webhookRouter = lazyRouter(() => getRouters().webhookRouter);

module.exports = { adminRouter, webhookRouter, buildDeps, getRouters };
