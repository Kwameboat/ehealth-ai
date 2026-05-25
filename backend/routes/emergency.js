const express = require('express');
const { findNearbyHospitals } = require('../services/nearbyPlaces');

const router = express.Router();

router.get('/nearby-hospitals', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = Math.min(parseInt(req.query.radius || '20000', 10), 50000);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: { message: 'Valid lat and lon required' } });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: { message: 'Invalid coordinates' } });
    }

    const result = await findNearbyHospitals({
      latitude: lat,
      longitude: lon,
      radiusMeters: radius,
    });

    res.json({
      success: true,
      ...result,
      mapsSearchUrl: `https://www.google.com/maps/search/hospitals/@${lat},${lon},14z`,
    });
  } catch (e) {
    console.error('nearby-hospitals:', e.message);
    res.status(502).json({
      error: { message: e.message || 'Could not load nearby hospitals' },
      hospitals: [],
      mapsSearchUrl: req.query.lat
        ? `https://www.google.com/maps/search/hospitals/@${req.query.lat},${req.query.lon},14z`
        : 'https://www.google.com/maps/search/hospitals+near+me',
    });
  }
});

module.exports = router;
