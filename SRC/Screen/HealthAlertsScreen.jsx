import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { fetchBroadcasts, markBroadcastRead } from '../services/healthApi';

export default function HealthAlertsScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [broadcasts, setBroadcasts] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await fetchBroadcasts();
      setBroadcasts(res.broadcasts || []);
    } catch {
      setBroadcasts([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (item) => {
    if (!item.isRead) await markBroadcastRead(item.id);
    load();
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Health Alerts" subtitle="Broadcasts from your clinic">
      <FlatList
        data={broadcasts}
        keyExtractor={(b) => b.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.isRead && styles.unread]} onPress={() => open(item)}>
            {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No alerts yet — admin broadcasts appear here</Text>}
      />
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    card: { backgroundColor: med.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: med.cardBorder },
    unread: { borderColor: med.primary, borderWidth: 2 },
    title: { fontWeight: '700', color: med.text, marginBottom: 6 },
    message: { color: med.text, lineHeight: 20 },
    date: { color: med.textMuted, fontSize: 11, marginTop: 8 },
    empty: { color: med.textMuted },
  });
