import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppBottomNav from '../Components/AppBottomNav';
import ChatInputBar from '../Components/ChatInputBar';
import ResponsiveContainer from '../Components/ResponsiveContainer';
import { MED_THEME } from '../constants/appTheme';
import { useResponsive } from '../hooks/useResponsive';
import { attachmentToBase64, guessImageMimeType } from '../services/fileToBase64';
import { useChatVoiceInput } from '../hooks/useChatVoiceInput';
import { pickChatAttachment } from '../services/chatAttachmentPicker';
import { sendChatMessage } from '../services/geminiChat';
import { takeStashedAttachment } from '../services/attachmentBridge';

const MAX_PDF_BYTES = 8 * 1024 * 1024;

function createMessage(role, text, attachment = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    attachment,
    ts: new Date(),
  };
}

export default function MedicalChatScreen({ navigation, route }) {
  const r = useResponsive();
  const initialMessage = route.params?.initialMessage;
  const [messages, setMessages] = useState([
    createMessage(
      'assistant',
      "Hello — I'm your health assistant. Tell me what's bothering you. I'll ask up to 5 short follow-up questions, then share recommendations. For emergencies, use Emergency or call your local emergency number."
    ),
  ]);
  const [input, setInput] = useState(initialMessage || '');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialSent, setInitialSent] = useState(false);
  const listRef = useRef(null);

  const voice = useChatVoiceInput({
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialMessage && !initialSent) {
      setInitialSent(true);
      const t = setTimeout(() => handleSend(initialMessage), 400);
      return () => clearTimeout(t);
    }
  }, [initialMessage, initialSent]);

  const historyForApi = () =>
    messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, text: m.text }));

  const handleAttachPress = async () => {
    try {
      const picked = await pickChatAttachment();
      if (picked) applyPickedAsset(picked.type, picked);
    } catch (e) {
      Alert.alert('Error', 'Could not attach file. Please try again.');
    }
  };

  const applyPickedAsset = (type, asset) => {
    if (!asset) return;
    if (asset.size && asset.size > MAX_PDF_BYTES) {
      Alert.alert('File too large', 'Please choose a file under 8 MB.');
      return;
    }
    setPendingAttachment({
      type,
      name: asset.name,
      uri: asset.uri,
      file: asset.file,
      mimeType:
        asset.mimeType ||
        (type === 'pdf' ? 'application/pdf' : guessImageMimeType(asset.name)),
    });
  };

  useEffect(() => {
    const stashed = takeStashedAttachment();
    if (stashed) {
      applyPickedAsset(stashed.type, stashed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const handleSend = async (overrideText) => {
    if (voice.isListening) voice.stop();
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!text && !pendingAttachment) {
      Alert.alert('Empty message', 'Type a message or attach a photo/PDF.');
      return;
    }
    if (isLoading) return;

    const attachmentMeta = pendingAttachment
      ? {
          type: pendingAttachment.type,
          name: pendingAttachment.name,
          uri: pendingAttachment.uri,
        }
      : null;

    const userMessage = createMessage(
      'user',
      text || (pendingAttachment?.type === 'pdf' ? 'Please analyze this PDF.' : 'Please analyze this image.'),
      attachmentMeta
    );

    const history = historyForApi();
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const attachmentToSend = pendingAttachment;
    setPendingAttachment(null);
    setIsLoading(true);

    try {
      let apiAttachment = null;
      if (attachmentToSend) {
        const base64 = await attachmentToBase64(attachmentToSend);
        apiAttachment = { mimeType: attachmentToSend.mimeType, base64 };
      }

      const reply = await sendChatMessage({
        history,
        userText: userMessage.text,
        attachment: apiAttachment,
      });
      setMessages((prev) => [...prev, createMessage('assistant', reply)]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', `Sorry, I could not process that. ${e.message || 'Please try again.'}`),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAttachmentPreview = (attachment, compact = false) => {
    if (!attachment) return null;
    if (attachment.type === 'image' && attachment.uri) {
      return (
        <Image
          source={{ uri: attachment.uri }}
          style={compact ? styles.pendingThumb : styles.bubbleImage}
          resizeMode="cover"
        />
      );
    }
    return (
      <View style={styles.pdfChip}>
        <MaterialCommunityIcons name="file-pdf-box" size={20} color={MED_THEME.primary} />
        <Text style={styles.pdfName} numberOfLines={1}>
          {attachment.name}
        </Text>
      </View>
    );
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.rowUser : styles.rowAssistant,
          { maxWidth: r.messageMaxWidth },
        ]}
      >
        {!isUser && (
          <View style={styles.avatarBot}>
            <MaterialCommunityIcons name="robot-happy-outline" size={18} color={MED_THEME.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {renderAttachmentPreview(item.attachment)}
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[MED_THEME.bg, '#0F172A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={MED_THEME.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Health Chat</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineLabel}>Agent online</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MedicalHome')} style={styles.headerBtn}>
            <Ionicons name="home-outline" size={22} color={MED_THEME.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
        >
          <ResponsiveContainer maxWidth={r.contentMaxWidth} style={styles.flex}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[
                styles.list,
                { paddingHorizontal: r.horizontalPadding },
              ]}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />

            {isLoading && (
              <View style={[styles.typing, { paddingHorizontal: r.horizontalPadding }]}>
                <Text style={styles.typingText}>Analyzing your request…</Text>
              </View>
            )}

            {pendingAttachment && (
              <View style={[styles.pendingBar, { marginHorizontal: r.horizontalPadding }]}>
                {renderAttachmentPreview(pendingAttachment, true)}
                <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                  <Ionicons name="close-circle" size={24} color={MED_THEME.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ paddingHorizontal: r.horizontalPadding }}>
              <ChatInputBar
                value={input}
                onChangeText={setInput}
                onSend={() => handleSend()}
                onAttach={handleAttachPress}
                onFilePicked={(attachment) => applyPickedAsset(attachment.type, attachment)}
                onMic={() => voice.toggle()}
                isListening={voice.isListening}
                isLoading={isLoading}
              />
            </View>

            {r.showBottomNav && (
              <AppBottomNav
                active="chat"
                onChat={() => {}}
                onVoice={() => navigation.navigate('MedicalVoiceAgent')}
                onRecords={() => navigation.navigate('MedicalHome')}
              />
            )}
          </ResponsiveContainer>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: MED_THEME.cardBorder,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: MED_THEME.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MED_THEME.success },
  onlineLabel: { fontSize: 11, color: MED_THEME.success },
  list: { paddingVertical: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 14, width: '100%' },
  rowUser: { alignSelf: 'flex-end' },
  rowAssistant: { alignSelf: 'flex-start' },
  avatarBot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MED_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 18,
    padding: 14,
    maxWidth: '100%',
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: MED_THEME.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: MED_THEME.surface,
    borderWidth: 1,
    borderColor: MED_THEME.cardBorder,
    borderBottomLeftRadius: 4,
    flex: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, color: MED_THEME.text },
  bubbleTextUser: { color: '#fff' },
  bubbleImage: { width: 200, height: 130, borderRadius: 10, marginBottom: 8 },
  pdfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 8,
  },
  pdfName: { color: MED_THEME.text, fontSize: 13, flex: 1 },
  typing: { paddingHorizontal: 20, paddingBottom: 6 },
  typingText: { color: MED_THEME.textMuted, fontSize: 13, fontStyle: 'italic' },
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 10,
    backgroundColor: MED_THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MED_THEME.cardBorder,
  },
  pendingThumb: { width: 48, height: 48, borderRadius: 8 },
});
