const express = require('express');
const crypto = require('crypto');
const { requireUserAuth } = require('../middleware/userAuth');
const { getDb } = require('../db/init');
const { initializeTransaction, verifyWebhookSignature, isConfigured } = require('../services/paystack');
const {
  getActivePackages,
  getPackageById,
  createPendingPayment,
  verifyAndComplete,
  getPaymentByReference,
} = require('../services/payments');
const { formatPrice } = require('../services/packages');

const router = express.Router();

function buildCallbackUrl(req) {
  const base = process.env.PAYSTACK_CALLBACK_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/payment/callback.html`;
}

router.get('/packages', requireUserAuth, (req, res) => {
  const packages = getActivePackages().map((p) => ({
    id: p.id,
    name: p.name,
    points: p.points,
    amountMinor: p.amount_kobo,
    priceMajor: p.amount_kobo / 100,
    amountDisplay: formatPrice(p.amount_kobo, p.currency),
    currency: p.currency,
    description: p.description,
  }));
  res.json({ packages, paystackEnabled: isConfigured() });
});

router.post('/initialize', requireUserAuth, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: { message: 'Payments are not configured' } });
    }

    const { packageId } = req.body || {};
    const pkg = getPackageById(packageId);
    if (!pkg) {
      return res.status(400).json({ error: { message: 'Invalid point package' } });
    }

    const user = getDb().prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
    if (!user?.email) {
      return res.status(400).json({ error: { message: 'User email required for payment' } });
    }

    const reference = `EH_${crypto.randomBytes(12).toString('hex')}`;
    createPendingPayment(req.userId, pkg, reference);

    const init = await initializeTransaction({
      email: user.email,
      amountMinor: pkg.amount_kobo,
      currency: pkg.currency || 'GHS',
      reference,
      callbackUrl: buildCallbackUrl(req),
      metadata: {
        user_id: req.userId,
        package_id: pkg.id,
        points: pkg.points,
        custom_fields: [
          { display_name: 'Package', variable_name: 'package', value: pkg.name },
          { display_name: 'Points', variable_name: 'points', value: String(pkg.points) },
        ],
      },
    });

    res.json({
      authorizationUrl: init.authorization_url,
      accessCode: init.access_code,
      reference,
      amountKobo: pkg.amount_kobo,
      points: pkg.points,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

router.get('/verify/:reference', requireUserAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = getPaymentByReference(reference);
    if (!payment) {
      return res.status(404).json({ error: { message: 'Payment not found' } });
    }
    if (payment.user_id !== req.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const result = await verifyAndComplete(reference);
    res.json({
      success: true,
      pointsAdded: result.points,
      balance: result.balance,
      alreadyCompleted: result.alreadyCompleted,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

/** Webhook handler — mount with express.raw() */
function paystackWebhookHandler(req, res) {
  try {
    const signature = req.get('x-paystack-signature');
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).send('Invalid body');
    }
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (reference) {
        const { completePayment } = require('../services/payments');
        completePayment(reference, event.data);
      }
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error('Paystack webhook error:', e);
    res.status(500).send('Error');
  }
}

module.exports = router;
module.exports.paystackWebhookHandler = paystackWebhookHandler;
