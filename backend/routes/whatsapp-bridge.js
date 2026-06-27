const express = require('express');
const { getDb, uuid, now } = require('../db/init');
const { ensureDbReady } = require('../db/ensureDb');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { deductPoints, getUserBalance, PointsError } = require('../services/points');
const { getSetting, setSetting, getGeminiApiKey } = require('../services/settings');

let whatsappModule;
try {
  whatsappModule = require('../whatsapp/dist/index.js');
} catch (err) {
  console.warn('WhatsApp module not built. Run: npm run build:whatsapp');
  whatsappModule = null;
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
  };
}

function createRouters() {
  if (!whatsappModule?.createWhatsAppRouters) {
    const empty = express.Router();
    empty.all('*', (_req, res) => {
      res.status(503).json({
        error: { message: 'WhatsApp module not built. Run npm run build:whatsapp on the server.' },
      });
    });
    return { adminRouter: empty, webhookRouter: empty };
  }
  return whatsappModule.createWhatsAppRouters(buildDeps());
}

const { adminRouter, webhookRouter } = createRouters();

module.exports = { adminRouter, webhookRouter, buildDeps };
