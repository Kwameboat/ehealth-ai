const express = require('express');
const { requireUserAuth } = require('../middleware/userAuth');
const { deductPoints, PointsError } = require('../services/points');
const {
  callGemini,
  chatCompletion,
  resolveChatFeatureKey,
  resolveGenerationConfig,
} = require('../services/gemini');
const {
  formatSymptomGeminiResponse,
  isSymptomFeature,
} = require('../services/clinicalResponseFormat');
const { SYMPTOM_SYSTEM_INSTRUCTION } = require('../services/symptomClinicalPrompt');
const { logUsage } = require('../services/points');

const router = express.Router();
const { getGeminiModel } = require('../services/settings');

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
    const {
      history = [],
      userText = '',
      attachment = null,
      attachments = null,
      featureKey: overrideKey,
    } = req.body || {};
    featureKey = overrideKey || resolveChatFeatureKey(attachment, attachments);

    const deduction = deductPoints(req.userId, featureKey);
    const reply = await chatCompletion(history, userText, attachment, attachments);
    res.json({
      reply,
      points: { charged: deduction.charged, balance: deduction.balance, featureKey },
    });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, featureKey);
    if (handled) return handled;
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

module.exports = router;
