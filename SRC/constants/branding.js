export const APP_NAME = 'eHealth AI';
export const APP_TAGLINE = 'AI Health Assistance — Not a Doctor';
export const AI_ASSISTANT_NAME = 'Agyenim';

/** First name for dashboard greeting */
export function getUserFirstName(user) {
  const name = user?.fullName?.trim();
  if (name) {
    const first = name.split(/\s+/)[0];
    if (first) return first;
  }
  const email = user?.email?.trim();
  if (email) {
    const local = email.split('@')[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}
