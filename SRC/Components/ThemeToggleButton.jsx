import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../Context/ThemeContext';
import { useMedTheme } from '../hooks/useMedTheme';

/**
 * Sun / moon control — toggles light (white) vs dark (black) app background.
 */
export default function ThemeToggleButton({ compact = false, style }) {
  const { isDarkMode, toggleTheme, isThemeLoaded } = useTheme();
  const med = useMedTheme();

  if (!isThemeLoaded) return null;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        compact && styles.btnCompact,
        {
          backgroundColor: med.surface,
          borderColor: med.cardBorder,
        },
        style,
      ]}
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDarkMode }}
      accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={isDarkMode ? 'sunny' : 'moon'}
        size={compact ? 20 : 22}
        color={isDarkMode ? '#FBBF24' : med.primary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
