import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { orderMedicineDelivery } from '../services/healthApi';

export default function MedicineDeliveryScreen({ navigation, route }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [medicationName, setMedicationName] = useState(route.params?.medicationName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const order = async () => {
    if (!medicationName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await orderMedicineDelivery(medicationName.trim());
      if (res.paymentUrl) await Linking.openURL(res.paymentUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Medicine Delivery" subtitle="Pay with MoMo — pharmacy partners deliver">
      <TextInput
        style={styles.input}
        placeholder="Medicine name (e.g. Metformin 500mg)"
        placeholderTextColor={med.textMuted}
        value={medicationName}
        onChangeText={setMedicationName}
      />
      <Text style={styles.hint}>Estimated from ~GHS 45 + delivery. You will be redirected to Paystack.</Text>
      <TouchableOpacity style={styles.btn} onPress={order} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Check & pay with MoMo</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    input: { backgroundColor: med.card, borderWidth: 1, borderColor: med.cardBorder, borderRadius: 12, padding: 14, color: med.text },
    hint: { color: med.textMuted, marginTop: 10, fontSize: 13, lineHeight: 18 },
    btn: { marginTop: 16, backgroundColor: '#22C55E', borderRadius: 12, padding: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    error: { color: '#EF4444', marginTop: 10 },
  });
