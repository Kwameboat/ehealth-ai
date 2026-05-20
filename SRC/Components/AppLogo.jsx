import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { APP_TAGLINE } from '../constants/branding';
import { useMemo } from 'react';
import { useMedTheme } from '../hooks/useMedTheme';

const logoSource = require('../../assets/images/ehealth-logo.png');

export default function AppLogo({ size = 'medium', showTagline = false, centered = true, style }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const width = size === 'large' ? 280 : size === 'small' ? 140 : 220;

  return (
    <View style={[styles.wrap, centered && styles.centered, style]}>
      <Image source={logoSource} style={{ width, height: width * 0.55 }} resizeMode="contain" />
      {showTagline && <Text style={styles.tagline}>{APP_TAGLINE}</Text>}
    </View>
  );
}

const createStyles = (med) => StyleSheet.create({
  wrap: { gap: 10 },
  centered: { alignItems: 'center' },
  tagline: {
    fontSize: 12,
    color: med.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
});
