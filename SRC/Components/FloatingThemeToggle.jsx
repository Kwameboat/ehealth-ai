import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemeToggleButton from './ThemeToggleButton';

const HIDDEN_ROUTES = new Set(['Onboarding', 'Auth', 'MedicalHome', 'MedicalChat']);

/**
 * Global theme switch — visible on main app screens (not onboarding/login).
 */
export default function FloatingThemeToggle() {
  const insets = useSafeAreaInsets();
  const routeName = useNavigationState((state) => {
    if (!state?.routes?.length) return null;
    return state.routes[state.index]?.name ?? null;
  });

  if (!routeName || HIDDEN_ROUTES.has(routeName)) return null;

  return (
    <View
      style={[styles.wrap, { top: insets.top + 6, right: Math.max(insets.right, 12) }]}
      pointerEvents="box-none"
    >
      <ThemeToggleButton compact />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 10,
  },
});
