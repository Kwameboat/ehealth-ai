const express = require('express');
const { requireUserAuth } = require('../middleware/userAuth');
const { deductPoints, PointsError } = require('../services/points');
const { ensureRouteDatabase } = require('../middleware/requestDb');
const { getGeminiApiKey } = require('../services/settings');
const {
  callGemini,
  resolveChatFeatureKey,
  resolveGenerationConfig,
} = require('../services/gemini');
const {
  formatSymptomGeminiResponse,
  isSymptomFeature,
} = require('../services/clinicalResponseFormat');
const { SYMPTOM_SYSTEM_INSTRUCTION } = require('../services/symptomClinicalPrompt');
const { logUsage } = require('../services/points');
const { smartChat } = require('../services/smartAssistant');

const router = express.Router();
const { getGeminiModel } = require('../services/settings');

router.use((req, res, next) => ensureRouteDatabase(req, res, next, 15_000));
router.use(requireUserAuth);

function handlePointsError(res, e, userId, featureKey) {
  if (e instanceof PointsError) {
    if (userId && featureKey) logUsage(userId, featureKey, 0, 'insufficient_points');
    return res.status(e.status).json({
      error: { message: e.message, code: e.code, pointsBalance: e.balance },
    });
  }
  return null;
}

router.post('/gemini/generateContent', async (req, res) => {
  const featureKey = req.body?.featureKey || 'symptom_text';
  try {
    const { contents, model } = req.body || {};
    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: { message: 'Invalid request' } });
    }

    const deduction = deductPoints(req.userId, featureKey);
    const generationConfig = resolveGenerationConfig(featureKey);
    const symptom = isSymptomFeature(featureKey);
    const data = await callGemini(contents, model || getGeminiModel(), {
      ...(generationConfig ? { generationConfig } : {}),
      ...(symptom ? { systemInstruction: SYMPTOM_SYSTEM_INSTRUCTION } : {}),
    });
    const formatted = symptom ? formatSymptomGeminiResponse(data, contents) : data;
    res.json({
      ...formatted,
      points: { charged: deduction.charged, balance: deduction.balance },
    });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, featureKey);
    if (handled) return handled;
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

router.post('/chat', async (req, res) => {
  let featureKey = 'chat_text';

  try {
    if (!getGeminiApiKey()) {
      return res.status(503).json({
        error: {
          message: 'AI is not configured yet',
          detail: 'Add GEMINI_API_KEY in cPanel → Node.js → Environment Variables, then RESTART.',
        },
      });
    }

    const {
      history = [],
      userText = '',
      attachment = null,
      attachments = null,
      featureKey: overrideKey,
    } = req.body || {};
    const smart = await smartChat(req.userId, history, userText, attachment, attachments);
    featureKey = overrideKey || smart.featureKey || resolveChatFeatureKey(attachment, attachments);

    if (!smart?.reply) {
      return res.status(500).json({ error: { message: 'No response from the assistant' } });
    }

    const deduction = deductPoints(req.userId, featureKey);
    if (res.headersSent) return;
    res.json({
      reply: smart.reply,
      meta: smart.meta,
      actions: smart.actions || [],
      points: { charged: deduction.charged, balance: deduction.balance, featureKey },
    });
  } catch (e) {
    if (res.headersSent) return;
    const handled = handlePointsError(res, e, req.userId, featureKey);
    if (handled) return handled;
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

module.exports = router;
