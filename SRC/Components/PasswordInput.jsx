import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

/**
 * Password field with show/hide toggle (eye icon).
 */
export default function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Password',
  placeholderTextColor = '#94A3B8',
  style,
  inputStyle,
  med,
  autoCapitalize = 'none',
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  const styles = useMemo(() => createStyles(med), [med?.isDarkMode]);

  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        {...rest}
      />
      <TouchableOpacity
        style={styles.eyeBtn}
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={med?.textMuted || placeholderTextColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    wrap: {
      position: 'relative',
      marginBottom: 12,
    },
    input: {
      backgroundColor: med?.inputBg || 'rgba(15, 23, 42, 0.75)',
      borderWidth: 1,
      borderColor: med?.cardBorder || '#e5e7eb',
      borderRadius: 12,
      padding: 14,
      paddingRight: 48,
      color: med?.text || '#0F172A',
      fontSize: 16,
    },
    eyeBtn: {
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
  });
