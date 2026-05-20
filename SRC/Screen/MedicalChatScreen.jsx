import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ScrollView,
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
import ThemeToggleButton from '../Components/ThemeToggleButton';
import { AI_ASSISTANT_NAME } from '../constants/branding';
import { useMedTheme } from '../hooks/useMedTheme';
import { useResponsive } from '../hooks/useResponsive';
import { attachmentToBase64, guessImageMimeType } from '../services/fileToBase64';
import { useChatVoiceInput } from '../hooks/useChatVoiceInput';
import { pickChatAttachments } from '../services/chatAttachmentPicker';
import { sendChatMessage } from '../services/geminiChat';
import { takeStashedAttachments } from '../services/attachmentBridge';

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
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const r = useResponsive();
  const initialMessage = route.params?.initialMessage;
  const [messages, setMessages] = useState([
    createMessage(
      'assistant',
      `Hello — I'm ${AI_ASSISTANT_NAME}, your health assistant at eHealth AI. Tell me what's bothering you. I'll ask up to 5 short follow-up questions, then share recommendations. For emergencies, use Emergency or call your local emergency number.`
    ),
  ]);
  const [input, setInput] = useState(initialMessage || '');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialSent, setInitialSent] = useState(false);
  const listRef = useRef(null);

  const voice = useChatVoiceInput({
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

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
      const picked = await pickChatAttachments();
      if (picked?.length) applyPickedAssets(picked);
    } catch (e) {
      Alert.alert('Error', 'Could not attach files. Please try again.');
    }
  };

  const applyPickedAssets = (assets) => {
    const next = [];
    for (const asset of assets) {
      if (!asset) continue;
      if (asset.size && asset.size > MAX_PDF_BYTES) {
        Alert.alert('File too large', `${asset.name || 'File'} is over 8 MB.`);
        continue;
      }
      next.push({
        type: asset.type,
        name: asset.name,
        uri: asset.uri,
        file: asset.file,
        mimeType:
          asset.mimeType ||
          (asset.type === 'pdf'
            ? 'application/pdf'
            : guessImageMimeType(asset.uri || asset.name)),
      });
    }
    if (next.length) setPendingAttachments((prev) => [...prev, ...next].slice(0, 6));
  };

  useEffect(() => {
    const stashed = takeStashedAttachments();
    if (stashed.length) applyPickedAssets(stashed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const handleSend = async (overrideText) => {
    if (voice.isListening) voice.stop();
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!text && !pendingAttachments.length) {
      Alert.alert('Empty message', 'Type a message or attach photos/PDFs.');
      return;
    }
    if (isLoading) return;

    const attachmentMeta =
      pendingAttachments.length === 1
        ? {
            type: pendingAttachments[0].type,
            name: pendingAttachments[0].name,
            uri: pendingAttachments[0].uri,
          }
        : pendingAttachments.length > 1
          ? {
              type: 'multi',
              name: `${pendingAttachments.length} files`,
              uris: pendingAttachments.map((a) => a.uri).filter(Boolean),
            }
          : null;

    const hasPdf = pendingAttachments.some((a) => a.type === 'pdf');
    const defaultPrompt = hasPdf
      ? 'Please analyze these PDFs and images.'
      : pendingAttachments.length > 1
        ? 'Please analyze these images.'
        : pendingAttachments[0]?.type === 'pdf'
          ? 'Please analyze this PDF.'
          : 'Please analyze this image.';

    const userMessage = createMessage('user', text || defaultPrompt, attachmentMeta);

    const history = historyForApi();
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const attachmentsToSend = pendingAttachments;
    setPendingAttachments([]);
    setIsLoading(true);

    try {
      const apiAttachments = [];
      for (const att of attachmentsToSend) {
        const base64 = await attachmentToBase64(att);
        apiAttachments.push({ mimeType: att.mimeType, base64 });
      }

      const reply = await sendChatMessage({
        history,
        userText: userMessage.text,
        attachments: apiAttachments.length ? apiAttachments : null,
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
    if (attachment.type === 'multi' && attachment.uris?.length) {
      return (
        <View style={compact ? styles.pendingMulti : styles.multiBubble}>
          {attachment.uris.slice(0, 3).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={compact ? styles.pendingThumbSmall : styles.bubbleThumbSmall}
              resizeMode="cover"
            />
          ))}
          {attachment.uris.length > 3 ? (
            <Text style={styles.multiCount}>+{attachment.uris.length - 3}</Text>
          ) : null}
        </View>
      );
    }
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
        <MaterialCommunityIcons name="file-pdf-box" size={20} color={med.primary} />
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
            <MaterialCommunityIcons name="robot-happy-outline" size={18} color={med.primary} />
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
      <LinearGradient colors={[med.bg, med.bgGradientEnd]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={med.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Chat with {AI_ASSISTANT_NAME}</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineLabel}>{AI_ASSISTANT_NAME} online</Text>
            </View>
          </View>
          <ThemeToggleButton compact style={{ marginRight: 4 }} />
          <TouchableOpacity onPress={() => navigation.navigate('MedicalHome')} style={styles.headerBtn}>
            <Ionicons name="home-outline" size={22} color={med.textMuted} />
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

            {pendingAttachments.length > 0 && (
              <View style={[styles.pendingBar, { marginHorizontal: r.horizontalPadding }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingScroll}>
                  {pendingAttachments.map((att, idx) => (
                    <View key={`${att.uri}-${idx}`} style={styles.pendingItem}>
                      {renderAttachmentPreview(att, true)}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setPendingAttachments([])}>
                  <Ionicons name="close-circle" size={24} color={med.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ paddingHorizontal: r.horizontalPadding }}>
              <ChatInputBar
                value={input}
                onChangeText={setInput}
                onSend={() => handleSend()}
                onAttach={handleAttachPress}
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

const createStyles = (med) =>
  StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: med.cardBorder,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: med.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: med.success },
  onlineLabel: { fontSize: 11, color: med.success },
  list: { paddingVertical: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 14, width: '100%' },
  rowUser: { alignSelf: 'flex-end' },
  rowAssistant: { alignSelf: 'flex-start' },
  avatarBot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: med.surface,
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
    backgroundColor: med.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: med.surface,
    borderWidth: 1,
    borderColor: med.cardBorder,
    borderBottomLeftRadius: 4,
    flex: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, color: med.text },
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
  pdfName: { color: med.text, fontSize: 13, flex: 1 },
  typing: { paddingHorizontal: 20, paddingBottom: 6 },
  typingText: { color: med.textMuted, fontSize: 13, fontStyle: 'italic' },
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 10,
    backgroundColor: med.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: med.cardBorder,
  },
  pendingThumb: { width: 48, height: 48, borderRadius: 8 },
  pendingScroll: { flex: 1, marginRight: 8 },
  pendingItem: { marginRight: 8 },
  pendingThumbSmall: { width: 44, height: 44, borderRadius: 8 },
  bubbleThumbSmall: { width: 56, height: 56, borderRadius: 8, marginBottom: 6, marginRight: 6 },
  pendingMulti: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  multiBubble: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  multiCount: { color: med.textMuted, fontSize: 12, alignSelf: 'center' },
});
