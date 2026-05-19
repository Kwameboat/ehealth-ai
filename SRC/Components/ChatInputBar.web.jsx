import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { unstable_createElement as createElement } from 'react-native-web';
import { MED_THEME } from '../constants/appTheme';

const MAX_BYTES = 8 * 1024 * 1024;

function fileToAttachment(file) {
  if (!file) return null;
  if (file.size > MAX_BYTES) {
    return { error: 'File is too large. Please use a file under 8 MB.' };
  }
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  return {
    type: isPdf ? 'pdf' : 'image',
    name: file.name || (isPdf ? 'document.pdf' : 'photo.jpg'),
    uri: URL.createObjectURL(file),
    file,
    mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
    size: file.size,
  };
}

export default function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onAttach,
  onFilePicked,
  onMic,
  placeholder = 'Describe symptoms or ask about medication…',
  isLoading = false,
  showDisclaimer = true,
}) {
  const handleFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = '';
    if (!file) return;
    const attachment = fileToAttachment(file);
    if (attachment?.error) {
      window.alert(attachment.error);
      return;
    }
    if (onFilePicked) {
      onFilePicked(attachment);
    } else if (onAttach) {
      onAttach();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={styles.attachWrap}>
          {createElement('input', {
            type: 'file',
            accept:
              'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
            disabled: isLoading,
            onChange: handleFileChange,
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
              fontSize: 0,
            },
          })}
          <View style={styles.iconBtnInner} pointerEvents="none">
            <Feather name="plus" size={22} color={MED_THEME.textMuted} />
          </View>
        </View>

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
  attachWrap: {
    width: 40,
    height: 40,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
  },
  iconBtnInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
