import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMedTheme } from '../hooks/useMedTheme';

export default function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onAttach,
  onFilePicked,
  onMic,
  isListening = false,
  placeholder = 'Describe symptoms or ask about medication…',
  isLoading = false,
  showDisclaimer = true,
}) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);

  const handleAttachPress = () => {
    if (isLoading) return;
    if (onAttach) onAttach();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={handleAttachPress}
          style={styles.iconBtn}
          disabled={isLoading}
          accessibilityLabel="Attach photo or PDF"
        >
          <Feather name="plus" size={22} color={med.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={isListening ? 'Listening…' : placeholder}
          placeholderTextColor={med.textDim}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={2000}
          editable={!isLoading && !isListening}
        />
        {onMic && (
          <TouchableOpacity
            onPress={onMic}
            style={[styles.iconBtn, isListening && styles.micActive]}
            disabled={isLoading}
            accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={22}
              color={isListening ? med.danger : med.textMuted}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onSend}
          disabled={isLoading || isListening}
          style={[styles.sendBtn, (isLoading || isListening) && styles.sendDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      {showDisclaimer && (
        <Text style={styles.disclaimer}>
          AI CAN MAKE MISTAKES. CONSULT A MEDICAL PROFESSIONAL FOR SERIOUS CONDITIONS.
        </Text>
      )}
    </View>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: 'transparent',
      width: '100%',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: med.inputBg,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: med.cardBorder,
      paddingHorizontal: 6,
      paddingVertical: 6,
      gap: 4,
    },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micActive: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderRadius: 20,
    },
    input: {
      flex: 1,
      color: med.text,
      fontSize: 15,
      maxHeight: 100,
      paddingVertical: 10,
      paddingHorizontal: 4,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: med.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.65 },
    disclaimer: {
      fontSize: 9,
      letterSpacing: 0.4,
      textAlign: 'center',
      color: med.textDim,
      marginTop: 10,
      lineHeight: 13,
    },
  });
