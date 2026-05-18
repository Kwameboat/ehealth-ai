import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { APP_TAGLINE } from '../constants/branding';
import { MED_THEME } from '../constants/appTheme';

const logoSource = require('../../assets/images/ehealth-logo.png');

export default function AppLogo({ size = 'medium', showTagline = false, centered = true, style }) {
  const width = size === 'large' ? 280 : size === 'small' ? 140 : 220;

  return (
    <View style={[styles.wrap, centered && styles.centered, style]}>
      <Image source={logoSource} style={{ width, height: width * 0.55 }} resizeMode="contain" />
      {showTagline && <Text style={styles.tagline}>{APP_TAGLINE}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  centered: { alignItems: 'center' },
  tagline: {
    fontSize: 12,
    color: MED_THEME.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
});
