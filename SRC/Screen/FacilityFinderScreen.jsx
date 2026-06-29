import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { fetchNearbyFacilities } from '../services/healthApi';

const TYPES = [
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'lab', label: 'Laboratory' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'hospital', label: 'Hospital' },
];

export default function FacilityFinderScreen({ navigation, route }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [type, setType] = useState(route.params?.type || 'pharmacy');
  const [places, setPlaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    setBusy(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission required');
      const loc = await Location.getCurrentPositionAsync({});
      const res = await fetchNearbyFacilities(loc.coords.latitude, loc.coords.longitude, type);
      setPlaces(res.places || []);
    } catch (e) {
      setError(e.message);
      setPlaces([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Find Care Near You" subtitle="Pharmacy, lab, clinic, hospital">
      <View style={styles.tabs}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, type === t.id && styles.tabActive]} onPress={() => setType(t.id)}>
            <Text style={[styles.tabText, type === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.btn} onPress={search} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Use my location</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.distance} · {item.address}</Text>
            {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!busy && !error ? <Text style={styles.empty}>Search to see nearby places</Text> : null}
      />
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: med.cardBorder },
    tabActive: { backgroundColor: med.primary, borderColor: med.primary },
    tabText: { color: med.text, fontSize: 13 },
    tabTextActive: { color: '#fff', fontWeight: '600' },
    btn: { backgroundColor: med.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    error: { color: '#EF4444', marginTop: 10 },
    card: { backgroundColor: med.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: med.cardBorder },
    name: { fontWeight: '700', color: med.text },
    meta: { color: med.textMuted, marginTop: 4, fontSize: 13 },
    phone: { color: med.primary, marginTop: 4, fontSize: 13 },
    empty: { color: med.textMuted, marginTop: 12 },
  });
