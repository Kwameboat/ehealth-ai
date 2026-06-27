"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = void 0;
exports.promptFacilityType = promptFacilityType;
exports.parseFacilityRowId = parseFacilityRowId;
exports.savePendingFacilityType = savePendingFacilityType;
exports.getPendingFacilityType = getPendingFacilityType;
exports.handleLocationShare = handleLocationShare;
const interactive_1 = require("../interactive");
const evolution_1 = require("../evolution");
const sessionStore_1 = require("../sessionStore");
Object.defineProperty(exports, "getSession", { enumerable: true, get: function () { return sessionStore_1.getSession; } });
async function promptFacilityType(config, phone) {
    await (0, interactive_1.sendListMessage)(config, phone, {
        title: '📍 Find care near you',
        description: 'Share your location on WhatsApp, or pick a facility type:',
        buttonText: 'Choose type',
        rows: [
            { id: 'facility_pharmacy', title: 'Pharmacy', description: 'Nearest pharmacy' },
            { id: 'facility_lab', title: 'Laboratory', description: 'Lab / diagnostics' },
            { id: 'facility_clinic', title: 'Clinic', description: 'General clinic' },
            { id: 'facility_hospital', title: 'Hospital', description: 'Hospital care' },
        ],
    });
}
function parseFacilityRowId(rowId) {
    const map = {
        facility_pharmacy: 'pharmacy',
        facility_lab: 'lab',
        facility_clinic: 'clinic',
        facility_hospital: 'hospital',
    };
    return map[rowId] || null;
}
async function savePendingFacilityType(deps, config, userId, phone, type) {
    (0, sessionStore_1.saveSession)(deps, {
        userId,
        phone,
        sessionType: 'pending_facility',
        payload: { facilityType: type },
        ttlMinutes: 30,
    });
    await (0, evolution_1.sendTextMessage)(config, phone, `Now tap *Share location* 📍 in WhatsApp and I'll find the nearest ${type}.`);
}
function getPendingFacilityType(deps, phone) {
    const rows = deps
        .getDb()
        .prepare(`SELECT payload FROM wa_sessions WHERE phone = ? AND session_type = 'pending_facility' AND expires_at > ? ORDER BY created_at DESC LIMIT 1`)
        .all(phone, deps.now());
    if (!rows.length)
        return 'pharmacy';
    try {
        const p = JSON.parse(rows[0].payload);
        return p.facilityType || 'pharmacy';
    }
    catch {
        return 'pharmacy';
    }
}
async function handleLocationShare(deps, config, phone, userId, lat, lon, facilityType) {
    if (!deps.findNearbyFacilities) {
        return 'Facility finder is not available. Try again later or call 112 for emergencies.';
    }
    const type = facilityType || getPendingFacilityType(deps, phone);
    const result = await deps.findNearbyFacilities({
        latitude: lat,
        longitude: lon,
        type,
        radiusMeters: 15000,
        limit: 5,
    });
    if (!result.places?.length) {
        return `No ${result.label || type} found within 15 km. Try a wider area or different facility type.`;
    }
    const lines = (result.places || []).map((raw, i) => {
        const p = raw;
        const maps = `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
        return `${i + 1}. *${p.name}* — ${p.distance}\n   ${p.address}${p.phone ? `\n   📞 ${p.phone}` : ''}\n   ${maps}`;
    });
    (0, sessionStore_1.saveSession)(deps, {
        userId,
        phone,
        sessionType: 'last_location',
        payload: { lat, lon, facilityType: type },
        ttlMinutes: 1440,
    });
    return `📍 *Nearest ${result.label}*\n\n${lines.join('\n\n')}\n\n_Emergency? Call 112, 193, or 999._`;
}
