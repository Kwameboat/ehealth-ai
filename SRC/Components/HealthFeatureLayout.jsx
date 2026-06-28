import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeaderBar from './ScreenHeaderBar';
import { useMedTheme } from '../hooks/useMedTheme';

export default function HealthFeatureLayout({ navigation, title, subtitle, children }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeaderBar title={title} onBack={() => navigation.goBack()} />
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: med.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },
    subtitle: { paddingHorizontal: 16, paddingBottom: 8, color: med.textMuted, fontSize: 13 },
  });
