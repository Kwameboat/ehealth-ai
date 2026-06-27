const express = require('express');
const { getDb, uuid, now } = require('../db/init');
const { ensureDbReady } = require('../db/ensureDb');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { deductPoints, getUserBalance, PointsError } = require('../services/points');
const { getSetting, setSetting, getGeminiApiKey } = require('../services/settings');
const { findNearbyFacilities } = require('../services/nearbyPlaces');
const { initializeTransaction } = require('../services/paystack');

let whatsappModule;
let whatsappLoadError = null;
try {
  whatsappModule = require('../whatsapp/dist/index.js');
} catch (err) {
  whatsappLoadError = err;
  console.error('WhatsApp module load failed:', err.message);
  whatsappModule = null;
}

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

function createRouters() {
  if (!whatsappModule?.createWhatsAppRouters) {
    const empty = express.Router();
    const detail = whatsappLoadError?.message || 'dist/index.js missing';
    empty.all('*', (_req, res) => {
      res.status(503).json({
        error: {
          message: 'WhatsApp module not available on server.',
          detail,
          fix: 'Run in cPanel Terminal: bash ~/ehealth-ai/cpanel/sync-whatsapp.sh then RESTART Node.js app',
        },
      });
    });
    return { adminRouter: empty, webhookRouter: empty };
  }
  return whatsappModule.createWhatsAppRouters(buildDeps());
}

const { adminRouter, webhookRouter } = createRouters();

module.exports = { adminRouter, webhookRouter, buildDeps };
