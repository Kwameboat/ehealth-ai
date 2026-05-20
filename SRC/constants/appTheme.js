/** eHealth AI design tokens — dark (default) and light */

export const MED_THEME_DARK = {
  isDarkMode: true,
  bg: '#0B1220',
  bgElevated: '#111827',
  bgGradientEnd: '#0F172A',
  surface: '#1A2332',
  surfaceHover: '#243044',
  card: 'rgba(26, 35, 50, 0.85)',
  cardBorder: 'rgba(148, 163, 184, 0.12)',
  primary: '#0052D4',
  primaryGlow: 'rgba(0, 82, 212, 0.35)',
  accent: '#00C9A7',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  success: '#22C55E',
  danger: '#EF4444',
  inputBg: 'rgba(15, 23, 42, 0.75)',
  sidebarWidth: 280,
};

export const MED_THEME_LIGHT = {
  isDarkMode: false,
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgGradientEnd: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceHover: '#F1F5F9',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  primary: '#0052D4',
  primaryGlow: 'rgba(0, 82, 212, 0.15)',
  accent: '#059669',
  text: '#0F172A',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  success: '#16A34A',
  danger: '#DC2626',
  inputBg: '#F1F5F9',
  sidebarWidth: 280,
};

/** @param {boolean} [isDarkMode=true] */
export function getMedTheme(isDarkMode = true) {
  return isDarkMode ? MED_THEME_DARK : MED_THEME_LIGHT;
}

/** @deprecated Use getMedTheme(isDarkMode) or useMedTheme() */
export const MED_THEME = MED_THEME_DARK;
