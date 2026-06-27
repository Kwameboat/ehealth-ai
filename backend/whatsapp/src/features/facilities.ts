import type { WhatsAppConfig } from '../config';
import type { WhatsAppDeps } from '../deps';
import { sendListMessage } from '../interactive';
import { sendTextMessage } from '../evolution';
import { saveSession, getSession } from '../sessionStore';

export type FacilityType = 'pharmacy' | 'lab' | 'clinic' | 'hospital';

export async function promptFacilityType(config: WhatsAppConfig, phone: string): Promise<void> {
  await sendListMessage(config, phone, {
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

export function parseFacilityRowId(rowId: string): FacilityType | null {
  const map: Record<string, FacilityType> = {
    facility_pharmacy: 'pharmacy',
    facility_lab: 'lab',
    facility_clinic: 'clinic',
    facility_hospital: 'hospital',
  };
  return map[rowId] || null;
}

export async function savePendingFacilityType(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  userId: string,
  phone: string,
  type: FacilityType
): Promise<void> {
  saveSession(deps, {
    userId,
    phone,
    sessionType: 'pending_facility',
    payload: { facilityType: type },
    ttlMinutes: 30,
  });
  await sendTextMessage(
    config,
    phone,
    `Now tap *Share location* 📍 in WhatsApp and I'll find the nearest ${type}.`
  );
}

export function getPendingFacilityType(deps: WhatsAppDeps, phone: string): FacilityType {
  const rows = deps
    .getDb()
    .prepare(`SELECT payload FROM wa_sessions WHERE phone = ? AND session_type = 'pending_facility' AND expires_at > ? ORDER BY created_at DESC LIMIT 1`)
    .all(phone, deps.now()) as Array<{ payload: string }>;
  if (!rows.length) return 'pharmacy';
  try {
    const p = JSON.parse(rows[0].payload);
    return (p.facilityType as FacilityType) || 'pharmacy';
  } catch {
    return 'pharmacy';
  }
}

export async function handleLocationShare(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  lat: number,
  lon: number,
  facilityType?: FacilityType
): Promise<string> {
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
    const p = raw as { name: string; distance: string; address: string; phone?: string | null; latitude: number; longitude: number };
    const maps = `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
    return `${i + 1}. *${p.name}* — ${p.distance}\n   ${p.address}${p.phone ? `\n   📞 ${p.phone}` : ''}\n   ${maps}`;
  });

  saveSession(deps, {
    userId,
    phone,
    sessionType: 'last_location',
    payload: { lat, lon, facilityType: type },
    ttlMinutes: 1440,
  });

  return `📍 *Nearest ${result.label}*\n\n${lines.join('\n\n')}\n\n_Emergency? Call 112, 193, or 999._`;
}

export { getSession };
