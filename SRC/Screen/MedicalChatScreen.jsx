import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { AI_ASSISTANT_NAME, getUserFirstName } from '../constants/branding';
import { SMART_WELCOME, SUGGESTION_CHIPS } from '../constants/smartAssistant';
import { useAuth } from '../Context/AuthContext';
import { useMedTheme } from '../hooks/useMedTheme';
import { useResponsive } from '../hooks/useResponsive';
import { attachmentToBase64, guessImageMimeType } from '../services/fileToBase64';
import { useChatVoiceInput } from '../hooks/useChatVoiceInput';
import { pickChatAttachments } from '../services/chatAttachmentPicker';
import { getTypingLabel, sendChatMessage } from '../services/geminiChat';
import { saveRecentChatTopic } from '../services/chatStorage';
import { takeStashedAttachments } from '../services/attachmentBridge';

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const CHAT_STORAGE_KEY = '@ehealth_smart_chat_v2';

function createMessage(role, text, attachment = null, status = 'sent', actions = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    attachment,
    ts: new Date(),
    status,
    actions: actions || null,
  };
}

function welcomeMessage(firstName) {
  return createMessage('assistant', SMART_WELCOME(firstName));
}

export default function MedicalChatScreen({ navigation, route }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const r = useResponsive();
  const { user } = useAuth();
  const firstName = getUserFirstName(user);
  const initialMessage = route.params?.initialMessage;
  const [messages, setMessages] = useState([welcomeMessage(firstName)]);
  const [input, setInput] = useState(initialMessage || '');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typingLabel, setTypingLabel] = useState('');
  const [initialSent, setInitialSent] = useState(false);
  const [failedPayload, setFailedPayload] = useState(null);
  const listRef = useRef(null);

  const voice = useChatVoiceInput({
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 1) {
          setMessages(parsed.map((m) => ({ ...m, ts: m.ts ? new Date(m.ts) : new Date() })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    AsyncStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(messages.slice(-40).map((m) => ({ ...m, ts: m.ts?.toISOString?.() || m.ts })))
    ).catch(() => {});
  }, [messages]);

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

  const handleSend = async (overrideText, retryPayload = null) => {
    if (voice.isListening) voice.stop();
    const payload = retryPayload || {
      text: (typeof overrideText === 'string' ? overrideText : input).trim(),
      attachments: pendingAttachments,
    };
    const text = payload.text?.trim() || '';
    const attachmentsToSend = payload.attachments || [];
    if (!text && !attachmentsToSend.length) {
      Alert.alert('Empty message', 'Type a message or attach photos/PDFs.');
      return;
    }
    if (isLoading) return;

    const attachmentMeta =
      attachmentsToSend.length === 1
        ? {
            type: attachmentsToSend[0].type,
            name: attachmentsToSend[0].name,
            uri: attachmentsToSend[0].uri,
          }
        : attachmentsToSend.length > 1
          ? {
              type: 'multi',
              name: `${attachmentsToSend.length} files`,
              uris: attachmentsToSend.map((a) => a.uri).filter(Boolean),
            }
          : null;

    const hasPdf = attachmentsToSend.some((a) => a.type === 'pdf');
    const defaultPrompt = hasPdf
      ? 'Please analyze these PDFs and images.'
      : attachmentsToSend.length > 1
        ? 'Please analyze these images.'
        : attachmentsToSend[0]?.type === 'pdf'
          ? 'Please analyze this PDF.'
          : 'Please analyze this image.';

    const userMessage = retryPayload?.messageId
      ? { id: retryPayload.messageId, text: text || defaultPrompt, role: 'user' }
      : createMessage('user', text || defaultPrompt, attachmentMeta, 'sending');
    const history = historyForApi();

    if (retryPayload?.messageId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryPayload.messageId ? { ...m, status: 'sending' } : m))
      );
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setPendingAttachments([]);
    }

    setIsLoading(true);
    const guessedIntent = /^(menu|help)$/i.test(text) ? 'menu' : null;
    setTypingLabel(getTypingLabel(history, attachmentsToSend.length > 0, guessedIntent));
    setFailedPayload(null);

    try {
      const apiAttachments = [];
      for (const att of attachmentsToSend) {
        const base64 = await attachmentToBase64(att);
        apiAttachments.push({ mimeType: att.mimeType, base64 });
      }

      if (text && text.length > 4) saveRecentChatTopic(text);

      const { reply, meta, actions } = await sendChatMessage({
        history,
        userText: userMessage.text,
        attachments: apiAttachments.length ? apiAttachments : null,
      });

      const msgId = retryPayload?.messageId || userMessage.id;
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m));
        return [...updated, createMessage('assistant', reply, null, 'sent', actions?.length ? actions : null)];
      });
      if (meta?.intent) {
        setTypingLabel(getTypingLabel(history, false, meta.intent));
      }
    } catch (e) {
      const msgId = retryPayload?.messageId || userMessage.id;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, status: 'failed' }
            : m
        )
      );
      setFailedPayload({
        messageId: msgId,
        text: userMessage.text,
        attachments: attachmentsToSend,
      });
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          `I couldn't deliver that reply (${e.message || 'network error'}). Tap Retry on your message to try again.`
        ),
      ]);
    } finally {
      setIsLoading(false);
      setTypingLabel('');
    }
  };

  const clearChat = () => {
    Alert.alert('New conversation', 'Clear this chat and start fresh?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMessages([welcomeMessage(firstName)]);
          setFailedPayload(null);
          AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
        },
      },
    ]);
  };

  const runChip = (chip) => {
    if (chip.screen) {
      navigation.navigate(chip.screen, chip.params || {});
      return;
    }
    if (chip.prompt) handleSend(chip.prompt);
  };

  const runAction = (action) => {
    if (!action?.screen) return;
    navigation.navigate(action.screen, action.params || {});
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
          {!isUser && item.actions?.length > 0 ? (
            <View style={styles.actionRow}>
              {item.actions.map((action) => (
                <TouchableOpacity
                  key={action.id || action.label}
                  style={styles.actionChip}
                  onPress={() => runAction(action)}
                >
                  <Text style={styles.actionChipText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {isUser && item.status === 'failed' ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() =>
                failedPayload &&
                handleSend(null, {
                  messageId: item.id,
                  text: item.text,
                  attachments: failedPayload.attachments,
                })
              }
            >
              <Text style={styles.retryText}>Retry send</Text>
            </TouchableOpacity>
          ) : null}
          {isUser && item.status === 'sending' ? (
            <Text style={styles.statusText}>Sending…</Text>
          ) : null}
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
            <Text style={styles.headerTitle}>Smart Health Chat</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineLabel}>{AI_ASSISTANT_NAME} · NHIS · diet · care finder</Text>
            </View>
          </View>
          <ThemeToggleButton compact style={{ marginRight: 4 }} />
          <TouchableOpacity onPress={clearChat} style={styles.headerBtn}>
            <Ionicons name="refresh-outline" size={22} color={med.textMuted} />
          </TouchableOpacity>
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
                <View style={styles.typingRow}>
                  <View style={styles.typingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                  <Text style={styles.typingText}>{typingLabel || 'Agyenim is thinking…'}</Text>
                </View>
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.chipsScroll, { marginHorizontal: r.horizontalPadding }]}
              contentContainerStyle={styles.chipsContent}
            >
              {SUGGESTION_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip.id}
                  style={styles.chip}
                  onPress={() => runChip(chip)}
                  disabled={isLoading}
                >
                  <Text style={styles.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: med.primary, opacity: 0.5 },
  dot1: { opacity: 1 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 0.4 },
  typingText: { color: med.textMuted, fontSize: 13, fontStyle: 'italic', flex: 1 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  statusText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  chipsScroll: { maxHeight: 44, marginBottom: 6 },
  chipsContent: { gap: 8, paddingVertical: 4 },
  chip: {
    backgroundColor: med.surface,
    borderWidth: 1,
    borderColor: med.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipText: { color: med.primary, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionChip: {
    backgroundColor: med.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
