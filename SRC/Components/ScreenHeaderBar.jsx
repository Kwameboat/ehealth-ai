import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../Context/ThemeContext';
import ThemeToggleButton from './ThemeToggleButton';

const HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 };

/**
 * Standard back + title + optional right slot for symptom / tool screens.
 * Uses safe-area insets so the back control is always tappable below the notch.
 */
export default function ScreenHeaderBar({ title, onBack, rightAdornment, showThemeToggle = true }) {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const handleBack = onBack || (() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MedicalHome');
    }
  });

  const topPad = Math.max(insets.top, Platform.OS === 'web' ? 12 : 8);

  return (
    <View style={[styles.wrapper, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.rightSlot}>
          {rightAdornment}
          {showThemeToggle ? <ThemeToggleButton compact /> : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: theme.colors.header,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      zIndex: 10,
      elevation: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 12,
      minHeight: 52,
    },
    backButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: theme.colors.card || 'rgba(255,255,255,0.06)',
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    rightSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 48,
      gap: 4,
    },
  });
