const APP_API_SECRET = process.env.APP_API_SECRET;

function requireAppAuth(req, res, next) {
  if (!APP_API_SECRET) {
    res.status(503).json({ error: { message: 'API not configured', code: 'API_NOT_CONFIGURED' } });
    return;
  }
  const key = req.get('x-medassistant-key');
  if (!key || key !== APP_API_SECRET) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
    return;
  }
  next();
}

module.exports = { requireAppAuth };
