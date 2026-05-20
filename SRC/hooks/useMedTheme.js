import { useTheme } from '../Context/ThemeContext';

/** Medical app shell tokens (home, chat, nav) — follows light/dark preference. */
export function useMedTheme() {
  const { med } = useTheme();
  return med;
}
