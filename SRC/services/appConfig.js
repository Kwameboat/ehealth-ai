/**
 * Runtime config from /app-config.js (cPanel) or Expo env at build time.
 */
export function getRuntimeConfig() {
  if (typeof window !== 'undefined' && window.__EHEALTH_CONFIG__) {
    return window.__EHEALTH_CONFIG__;
  }
  return {};
}

export function getAppApiSecret() {
  const cfg = getRuntimeConfig();
  return cfg.appApiSecret || process.env.EXPO_PUBLIC_APP_API_SECRET || '';
}

export function getApiUrl() {
  const cfg = getRuntimeConfig();
  const fromCfg = cfg.apiUrl?.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    const pageOrigin = window.location.origin.replace(/\/$/, '');
    if (!fromCfg) return pageOrigin;
    try {
      const cfgHost = new URL(fromCfg).hostname.replace(/^www\./, '');
      const pageHost = new URL(pageOrigin).hostname.replace(/^www\./, '');
      if (cfgHost === pageHost) return pageOrigin;
    } catch {
      /* ignore */
    }
  }
  if (fromCfg) return fromCfg;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return null;
}
