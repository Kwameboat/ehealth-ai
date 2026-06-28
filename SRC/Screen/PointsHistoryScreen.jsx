import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { fetchPointsTransactions } from '../services/healthApi';

export default function PointsHistoryScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [transactions, setTransactions] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await fetchPointsTransactions();
      setTransactions(res.transactions || []);
    } catch {
      setTransactions([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <HealthFeatureLayout navigation={navigation} title="Points History" subtitle="Usage and top-ups">
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.note}>{item.note || item.featureKey || item.type}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={[styles.amount, item.amount >= 0 ? styles.credit : styles.debit]}>
              {item.amount >= 0 ? '+' : ''}{item.amount}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet</Text>}
      />
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: med.cardBorder },
    note: { color: med.text, fontWeight: '600' },
    date: { color: med.textMuted, fontSize: 11, marginTop: 2 },
    amount: { fontWeight: '700', fontSize: 16 },
    credit: { color: '#22C55E' },
    debit: { color: '#EF4444' },
    empty: { color: med.textMuted, marginTop: 12 },
  });
