const { getDb, uuid, now } = require('../db/init');
const { creditPoints } = require('./points');
const { verifyTransaction } = require('./paystack');

function getActivePackages() {
  return getDb()
    .prepare(
      `SELECT id, name, points, amount_kobo, currency, description
       FROM point_packages WHERE is_active = 1 ORDER BY sort_order ASC, amount_kobo ASC`
    )
    .all();
}

function getPackageById(id) {
  return getDb()
    .prepare('SELECT * FROM point_packages WHERE id = ? AND is_active = 1')
    .get(id);
}

function createPendingPayment(userId, pkg, reference) {
  const id = uuid();
  getDb()
    .prepare(
      `INSERT INTO payments (id, user_id, package_id, paystack_reference, amount_kobo, currency, points_to_credit, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(id, userId, pkg.id, reference, pkg.amount_kobo, pkg.currency || 'NGN', pkg.points, now());
  return id;
}

function getPaymentByReference(reference) {
  return getDb().prepare('SELECT * FROM payments WHERE paystack_reference = ?').get(reference);
}

function isPaystackSuccess(paystackData) {
  const status = String(paystackData?.status || '').toLowerCase();
  return status === 'success' || status === 'successful';
}

function paystackPaidAmount(paystackData) {
  const amount = Number(paystackData?.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function completePayment(reference, paystackData) {
  const payment = getPaymentByReference(reference);
  if (!payment) {
    const err = new Error('Payment record not found');
    err.status = 404;
    throw err;
  }

  if (payment.status === 'success') {
    const user = getDb().prepare('SELECT points_balance FROM users WHERE id = ?').get(payment.user_id);
    return { alreadyCompleted: true, balance: user?.points_balance ?? 0, points: payment.points_to_credit };
  }

  if (!isPaystackSuccess(paystackData)) {
    getDb()
      .prepare(`UPDATE payments SET status = 'failed', paystack_response = ?, completed_at = ? WHERE paystack_reference = ?`)
      .run(JSON.stringify(paystackData), now(), reference);
    const err = new Error('Payment was not successful');
    err.status = 400;
    throw err;
  }

  const paidAmount = paystackPaidAmount(paystackData);
  if (paidAmount > 0 && paidAmount < payment.amount_kobo) {
    const err = new Error('Paid amount does not match package');
    err.status = 400;
    throw err;
  }

  const result = creditPoints(
    payment.user_id,
    payment.points_to_credit,
    'purchase',
    `Paystack purchase: ${reference}`
  );

  getDb()
    .prepare(
      `UPDATE payments SET status = 'success', paystack_response = ?, completed_at = ? WHERE paystack_reference = ?`
    )
    .run(JSON.stringify(paystackData), now(), reference);

  return {
    alreadyCompleted: false,
    balance: result.balance,
    points: payment.points_to_credit,
  };
}

async function verifyAndComplete(reference) {
  const paystackData = await verifyTransaction(reference);
  return completePayment(reference, paystackData);
}

module.exports = {
  getActivePackages,
  getPackageById,
  createPendingPayment,
  getPaymentByReference,
  completePayment,
  verifyAndComplete,
};
