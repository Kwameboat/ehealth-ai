import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { unstable_createElement as createElement } from 'react-native-web';
import { MED_THEME } from '../constants/appTheme';
import { isMobileWebUserAgent } from '../utils/deviceUtils';

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
  const fileInputRef = useRef(null);
  const setFileInputRef = (el) => {
    fileInputRef.current = el;
  };

  const handleNativeFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = '';
    if (!file || !onFilePicked) return;
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (file.size > 8 * 1024 * 1024) {
      window.alert('File is too large. Please use a file under 8 MB.');
      return;
    }
    onFilePicked({
      type: isPdf ? 'pdf' : 'image',
      name: file.name || (isPdf ? 'document.pdf' : 'photo.jpg'),
      uri: URL.createObjectURL(file),
      file,
      mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      size: file.size,
    });
  };

  const handleAttachPress = () => {
    if (isLoading) return;
    if (Platform.OS === 'web' && !isMobileWebUserAgent() && fileInputRef.current) {
      fileInputRef.current.click();
      return;
    }
    if (onAttach) onAttach();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={styles.attachWrap}>
          {Platform.OS === 'web' && !isMobileWebUserAgent()
            ? createElement('input', {
                ref: setFileInputRef,
                type: 'file',
                accept:
                  'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
                disabled: isLoading,
                onChange: handleNativeFileChange,
                'aria-label': 'Attach photo or PDF',
                style: {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  zIndex: 2,
                  fontSize: 16,
                },
              })
            : null}
          <TouchableOpacity
            onPress={handleAttachPress}
            style={styles.iconBtn}
            disabled={isLoading}
            accessibilityLabel="Attach photo or PDF"
          >
            <Feather name="plus" size={22} color={MED_THEME.textMuted} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={isListening ? 'Listening…' : placeholder}
          placeholderTextColor={MED_THEME.textDim}
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
              color={isListening ? MED_THEME.danger : MED_THEME.textMuted}
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
  attachWrap: {
    width: 40,
    height: 40,
    position: 'relative',
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
    color: MED_THEME.text,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 10,
    paddingHorizontal: 4,
    outlineStyle: 'none',
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
