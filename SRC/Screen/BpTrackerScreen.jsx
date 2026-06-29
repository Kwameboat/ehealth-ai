import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { fetchBpLogs, logBp } from '../services/healthApi';

export default function BpTrackerScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [valueText, setValueText] = useState('');
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchBpLogs();
      setLogs(res.logs || []);
    } catch {
      setLogs([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const submit = async () => {
    setBusy(true);
    try {
      const res = await logBp({ valueText: valueText.trim() });
      setNote(res.note || '');
      setValueText('');
      await load();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="BP Tracker" subtitle="Log readings — e.g. BP: 120/80">
      <TextInput
        style={styles.input}
        placeholder="120/80"
        placeholderTextColor={med.textMuted}
        keyboardType="numbers-and-punctuation"
        value={valueText}
        onChangeText={setValueText}
      />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log reading</Text>}
      </TouchableOpacity>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.section}>Recent readings</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.bp}>{item.valueText}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No readings yet</Text>}
      />
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
      color: med.text,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
    },
    btn: { marginTop: 12, backgroundColor: med.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    note: { marginTop: 12, color: med.text, lineHeight: 20 },
    section: { marginTop: 24, fontWeight: '700', color: med.text, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: med.cardBorder,
    },
    bp: { fontSize: 18, fontWeight: '700', color: med.text },
    date: { color: med.textMuted, fontSize: 12 },
    empty: { color: med.textMuted, marginTop: 8 },
  });
