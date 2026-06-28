import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { askDiet, askNhis } from '../services/healthApi';

export default function HealthChatFeatureScreen({ navigation, route }) {
  const mode = route.params?.mode === 'diet' ? 'diet' : 'nhis';
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const title = mode === 'diet' ? 'Ghana Diet Coach' : 'NHIS Assistant';
  const subtitle = mode === 'diet' ? 'Hypertension & diabetes — local foods' : 'National Health Insurance guidance';
  const placeholder =
    mode === 'diet'
      ? 'e.g. Can I eat banku with hypertension?'
      : 'e.g. Does NHIS cover antenatal care?';

  const submit = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setError('');
    try {
      const fn = mode === 'diet' ? askDiet : askNhis;
      const res = await fn(question.trim());
      setAnswer(res.answer || '');
      setQuestion('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HealthFeatureLayout navigation={navigation} title={title} subtitle={subtitle}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={med.textMuted}
        value={question}
        onChangeText={setQuestion}
        multiline
      />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Ask Agyenim</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {answer ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Response</Text>
          <Text style={styles.answerText}>{answer}</Text>
        </View>
      ) : null}
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    input: {
      backgroundColor: med.card,
      borderWidth: 1,
      borderColor: med.cardBorder,
      borderRadius: 12,
      padding: 14,
      minHeight: 90,
      color: med.text,
      textAlignVertical: 'top',
    },
    btn: {
      marginTop: 12,
      backgroundColor: med.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700' },
    error: { color: '#EF4444', marginTop: 10 },
    answerBox: {
      marginTop: 20,
      backgroundColor: med.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: med.cardBorder,
    },
    answerLabel: { fontSize: 12, fontWeight: '700', color: med.primary, marginBottom: 8 },
    answerText: { color: med.text, lineHeight: 22, fontSize: 15 },
  });
