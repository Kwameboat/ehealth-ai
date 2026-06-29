import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMedTheme } from '../hooks/useMedTheme';
import { askDiet, askNhis } from '../services/healthApi';

function createMsg(role, text) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, role, text };
}

export default function HealthChatFeatureScreen({ navigation, route }) {
  const mode = route.params?.mode === 'diet' ? 'diet' : 'nhis';
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const listRef = useRef(null);

  const title = mode === 'diet' ? 'Ghana Diet Coach' : 'NHIS Assistant';
  const welcome =
    mode === 'diet'
      ? 'Hi! Ask about Ghanaian foods for hypertension or diabetes — e.g. "Can I eat banku?"'
      : 'Hi! Ask about NHIS coverage in Ghana — e.g. "Does NHIS cover antenatal care?"';

  const [messages, setMessages] = useState([createMsg('assistant', welcome)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typingLabel, setTypingLabel] = useState('');

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, busy]);

  const historyForApi = () =>
    messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setMessages((prev) => [...prev, createMsg('user', question)]);
    setInput('');
    setBusy(true);
    setTypingLabel(mode === 'diet' ? 'Checking nutrition guidance…' : 'Checking NHIS coverage…');
    const history = [
      ...messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', text: question },
    ]
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));
    try {
      const fn = mode === 'diet' ? askDiet : askNhis;
      const res = await fn(question, history);
      setMessages((prev) => [...prev, createMsg('assistant', res.answer || 'No answer received.')]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        createMsg('assistant', `Sorry — ${e.message || 'please try again.'}`),
      ]);
    } finally {
      setBusy(false);
      setTypingLabel('');
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        {!isUser && (
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot-happy-outline" size={16} color={med.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={med.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>Ask follow-up questions here</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        {busy ? (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={med.primary} />
            <Text style={styles.typingText}>{typingLabel}</Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type your question…"
            placeholderTextColor={med.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={busy || !input.trim()}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: med.bg },
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
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: med.text },
    headerSub: { fontSize: 11, color: med.textMuted, marginTop: 2 },
    list: { padding: 16, paddingBottom: 8 },
    row: { flexDirection: 'row', marginBottom: 12, maxWidth: '92%' },
    rowUser: { alignSelf: 'flex-end' },
    rowBot: { alignSelf: 'flex-start' },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: med.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginTop: 4,
    },
    bubble: { borderRadius: 16, padding: 12, flexShrink: 1 },
    bubbleUser: { backgroundColor: med.primary, borderBottomRightRadius: 4 },
    bubbleBot: {
      backgroundColor: med.surface,
      borderWidth: 1,
      borderColor: med.cardBorder,
      borderBottomLeftRadius: 4,
      flex: 1,
    },
    bubbleText: { fontSize: 15, lineHeight: 22, color: med.text },
    bubbleTextUser: { color: '#fff' },
    typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
    typingText: { color: med.textMuted, fontSize: 13, fontStyle: 'italic' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: med.cardBorder,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      backgroundColor: med.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: med.text,
      borderWidth: 1,
      borderColor: med.cardBorder,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: med.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
