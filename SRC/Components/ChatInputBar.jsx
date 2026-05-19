import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MED_THEME } from '../constants/appTheme';

export default function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onAttach,
  onMic,
  placeholder = 'Describe symptoms or ask about medication…',
  isLoading = false,
  showDisclaimer = true,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={onAttach}
          style={styles.iconBtn}
          disabled={isLoading}
          accessibilityLabel="Attach photo or PDF"
          {...(Platform.OS === 'web' ? { onClick: (e) => e?.stopPropagation?.() } : {})}
        >
          <Feather name="plus" size={22} color={MED_THEME.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={MED_THEME.textDim}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={2000}
          editable={!isLoading}
        />
        {onMic && (
          <TouchableOpacity onPress={onMic} style={styles.iconBtn} disabled={isLoading}>
            <Ionicons name="mic-outline" size={22} color={MED_THEME.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onSend}
          disabled={isLoading}
          style={[styles.sendBtn, isLoading && styles.sendDisabled]}
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

const styles = StyleSheet.create({
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
    backgroundColor: MED_THEME.inputBg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: MED_THEME.cardBorder,
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
  input: {
    flex: 1,
    color: MED_THEME.text,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MED_THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.65 },
  disclaimer: {
    fontSize: 9,
    letterSpacing: 0.4,
    textAlign: 'center',
    color: MED_THEME.textDim,
    marginTop: 10,
    lineHeight: 13,
  },
});
