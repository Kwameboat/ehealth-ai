const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./userAuth');

const ADMIN_JWT_EXPIRES = process.env.ADMIN_JWT_EXPIRES || '8h';

function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, type: 'admin' }, JWT_SECRET, {
    expiresIn: ADMIN_JWT_EXPIRES,
  });
}

function requireAdminAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: { message: 'Admin login required' } });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'admin') throw new Error('Invalid token type');
    req.adminId = payload.sub;
    req.adminUsername = payload.username;
    next();
  } catch {
    res.status(401).json({ error: { message: 'Invalid or expired admin session' } });
  }
}

module.exports = { signAdminToken, requireAdminAuth };
