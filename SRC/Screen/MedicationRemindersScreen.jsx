import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { createReminder, deleteReminder, fetchReminders, markReminderTaken, snoozeReminder } from '../services/healthApi';

export default function MedicationRemindersScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [reminders, setReminders] = useState([]);
  const [medicationName, setMedicationName] = useState('');
  const [dosageText, setDosageText] = useState('');
  const [times, setTimes] = useState('08:00, 20:00');

  const load = useCallback(async () => {
    try {
      const res = await fetchReminders();
      setReminders(res.reminders || []);
    } catch {
      setReminders([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!medicationName.trim()) return;
    try {
      await createReminder({
        medicationName: medicationName.trim(),
        dosageText: dosageText.trim() || 'As prescribed',
        scheduleTimes: times.split(',').map((t) => t.trim()).filter(Boolean),
        durationDays: 7,
      });
      setMedicationName('');
      setDosageText('');
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Medication Reminders" subtitle="Daily dose schedules">
      <TextInput style={styles.input} placeholder="Medicine name" placeholderTextColor={med.textMuted} value={medicationName} onChangeText={setMedicationName} />
      <TextInput style={styles.input} placeholder="Dosage instructions" placeholderTextColor={med.textMuted} value={dosageText} onChangeText={setDosageText} />
      <TextInput style={styles.input} placeholder="Times e.g. 08:00, 20:00" placeholderTextColor={med.textMuted} value={times} onChangeText={setTimes} />
      <TouchableOpacity style={styles.btn} onPress={add}>
        <Text style={styles.btnText}>Add reminder</Text>
      </TouchableOpacity>
      <FlatList
        data={reminders}
        keyExtractor={(r) => r.id}
        scrollEnabled={false}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.medicationName}</Text>
            <Text style={styles.meta}>{item.dosageText}</Text>
            <Text style={styles.meta}>Times: {(item.scheduleTimes || []).join(', ')}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.smallBtn} onPress={() => markReminderTaken(item.id).then(load)}>
                <Text style={styles.smallBtnText}>Taken ✓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallBtnGhost} onPress={() => snoozeReminder(item.id).then(load)}>
                <Text style={styles.smallBtnGhostText}>Snooze 30m</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteReminder(item.id).then(load)}>
                <Text style={styles.remove}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No reminders yet</Text>}
      />
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    input: { backgroundColor: med.card, borderWidth: 1, borderColor: med.cardBorder, borderRadius: 10, padding: 12, color: med.text, marginBottom: 8 },
    btn: { backgroundColor: med.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    card: { backgroundColor: med.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: med.cardBorder },
    title: { fontWeight: '700', color: med.text, fontSize: 16 },
    meta: { color: med.textMuted, marginTop: 4, fontSize: 13 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    smallBtn: { backgroundColor: med.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    smallBtnGhost: { borderWidth: 1, borderColor: med.cardBorder, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    smallBtnGhostText: { color: med.text, fontSize: 12 },
    remove: { color: '#EF4444', fontWeight: '600', fontSize: 12 },
    empty: { color: med.textMuted, marginTop: 12 },
  });
