const { getDb, uuid, now } = require('../db/init');

/** Convert major units (GHC 20) to minor units (2000 pesewas) */
function majorToMinor(amount, currency = 'GHS') {
  const n = parseFloat(amount);
  if (Number.isNaN(n) || n < 0) throw new Error('Invalid amount');
  return Math.round(n * 100);
}

function minorToMajor(amountMinor) {
  return amountMinor / 100;
}

function listAllPackages() {
  return getDb().prepare('SELECT * FROM point_packages ORDER BY sort_order ASC, created_at ASC').all();
}

function getPackageById(id) {
  return getDb().prepare('SELECT * FROM point_packages WHERE id = ?').get(id);
}

function createPackage({ name, points, priceMajor, currency, description, sortOrder, isActive }) {
  const id = uuid();
  const ts = now();
  const amountMinor = majorToMinor(priceMajor, currency);
  getDb()
    .prepare(
      `INSERT INTO point_packages (id, name, points, amount_kobo, currency, description, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      name,
      parseInt(points, 10),
      amountMinor,
      currency || 'GHS',
      description || '',
      isActive !== false ? 1 : 0,
      parseInt(sortOrder, 10) || 0,
      ts,
      ts
    );
  return getPackageById(id);
}

function updatePackage(id, updates) {
  const existing = getPackageById(id);
  if (!existing) return null;

  const name = updates.name !== undefined ? updates.name : existing.name;
  const points = updates.points !== undefined ? parseInt(updates.points, 10) : existing.points;
  const currency = updates.currency !== undefined ? updates.currency : existing.currency;
  const description = updates.description !== undefined ? updates.description : existing.description;
  const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : existing.is_active;
  const sortOrder = updates.sortOrder !== undefined ? parseInt(updates.sortOrder, 10) : existing.sort_order;

  let amountMinor = existing.amount_kobo;
  if (updates.priceMajor !== undefined) {
    amountMinor = majorToMinor(updates.priceMajor, currency);
  } else if (updates.amountMinor !== undefined) {
    amountMinor = parseInt(updates.amountMinor, 10);
  }

  getDb()
    .prepare(
      `UPDATE point_packages SET name = ?, points = ?, amount_kobo = ?, currency = ?,
       description = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ?`
    )
    .run(name, points, amountMinor, currency, description, isActive, sortOrder, now(), id);

  return getPackageById(id);
}

function deletePackage(id) {
  const r = getDb().prepare('DELETE FROM point_packages WHERE id = ?').run(id);
  return r.changes > 0;
}

function formatPackage(p) {
  return {
    id: p.id,
    name: p.name,
    points: p.points,
    amountMinor: p.amount_kobo,
    priceMajor: minorToMajor(p.amount_kobo),
    priceDisplay: formatPrice(p.amount_kobo, p.currency),
    currency: p.currency,
    description: p.description,
    isActive: !!p.is_active,
    sortOrder: p.sort_order,
    updatedAt: p.updated_at,
  };
}

function formatPrice(amountMinor, currency) {
  const major = minorToMajor(amountMinor);
  if (currency === 'GHS') return `GHC ${major.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (currency === 'NGN') return `₦${major.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return `${currency} ${major.toFixed(2)}`;
}

module.exports = {
  listAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  formatPackage,
  majorToMinor,
  minorToMajor,
  formatPrice,
};
