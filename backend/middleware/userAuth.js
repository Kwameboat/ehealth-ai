const jwt = require('jsonwebtoken');

function pickSecret(...values) {
  for (const v of values) {
    const s = v != null ? String(v).trim() : '';
    if (s) return s;
  }
  return 'change-me-in-production';
}

const JWT_SECRET = pickSecret(process.env.JWT_SECRET, process.env.APP_API_SECRET);
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';

function signUserToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function requireUserAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: { message: 'Login required', code: 'AUTH_REQUIRED' } });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'user') throw new Error('Invalid token type');
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: { message: 'Invalid or expired session', code: 'INVALID_TOKEN' } });
  }
}

module.exports = { signUserToken, requireUserAuth, JWT_SECRET };
