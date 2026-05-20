import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../Context/ThemeContext';
import ThemeToggleButton from './ThemeToggleButton';

/**
 * Standard back + title + theme toggle for symptom / tool screens.
 */
export default function ScreenHeaderBar({ title, onBack }) {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack || (() => navigation.goBack())}
        style={styles.backButton}
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <ThemeToggleButton compact />
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      paddingTop: 50,
      backgroundColor: theme.colors.header,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: { width: 40 },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginHorizontal: 8,
    },
  });
