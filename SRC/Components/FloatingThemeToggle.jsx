import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemeToggleButton from './ThemeToggleButton';

const HIDDEN_ROUTES = new Set(['Onboarding', 'Auth', 'MedicalHome', 'MedicalChat']);

/**
 * Global theme switch on secondary screens.
 * Receives routeName from NavigationContainer (do not use navigation hooks here).
 */
export default function FloatingThemeToggle({ routeName = null }) {
  const insets = useSafeAreaInsets();

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
