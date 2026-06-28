import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import HealthFeatureLayout from '../Components/HealthFeatureLayout';
import { useMedTheme } from '../hooks/useMedTheme';
import { bookConsultation, cancelConsultation, fetchDoctorSlots, fetchDoctors, fetchMyConsultations } from '../services/consultationApi';

export default function DoctorConsultScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [tab, setTab] = useState('doctors');
  const [doctors, setDoctors] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [complaint, setComplaint] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([fetchDoctors(), fetchMyConsultations()]);
      setDoctors(d.doctors || []);
      setConsultations(c.consultations || []);
    } catch {
      setDoctors([]);
      setConsultations([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openBook = async (doctor) => {
    setSelected(doctor);
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetchDoctorSlots(doctor.id, today);
      setSlots(res.slots || []);
      setModalOpen(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBook = async (scheduledAt) => {
    setBusy(true);
    try {
      const res = await bookConsultation({
        doctorId: selected.id,
        scheduledAt,
        chiefComplaint: complaint.trim() || undefined,
      });
      setModalOpen(false);
      setComplaint('');
      Alert.alert('Booked', `Video call scheduled. ${res.points?.charged ? `Points used: ${res.points.charged}` : ''}`);
      load();
    } catch (e) {
      Alert.alert('Booking failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const joinCall = (url) => {
    if (url) Linking.openURL(url);
    else Alert.alert('No video link', 'Contact support if this persists.');
  };

  return (
    <HealthFeatureLayout navigation={navigation} title="Video Consultation" subtitle="Book a doctor video call">
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'doctors' && styles.tabActive]} onPress={() => setTab('doctors')}>
          <Text style={[styles.tabText, tab === 'doctors' && styles.tabTextActive]}>Doctors</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'mine' && styles.tabActive]} onPress={() => setTab('mine')}>
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>My bookings</Text>
        </TouchableOpacity>
      </View>

      {tab === 'doctors' ? (
        <FlatList
          data={doctors}
          keyExtractor={(d) => d.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.specialty}>{item.specialty}</Text>
              {item.hospitalAffiliation ? <Text style={styles.meta}>{item.hospitalAffiliation}</Text> : null}
              {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}
              <Text style={styles.fee}>{item.pointsCost} pts · GHS {(item.consultationFeeKobo / 100).toFixed(0)}</Text>
              <TouchableOpacity style={styles.btn} onPress={() => openBook(item)} disabled={busy}>
                <Text style={styles.btnText}>Book video call</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No doctors available — admin adds doctors in the dashboard</Text>}
        />
      ) : (
        <FlatList
          data={consultations}
          keyExtractor={(c) => c.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.doctorName}</Text>
              <Text style={styles.meta}>{new Date(item.scheduledAt).toLocaleString()} · {item.status}</Text>
              {item.chiefComplaint ? <Text style={styles.bio}>{item.chiefComplaint}</Text> : null}
              <View style={styles.actions}>
                {(item.status === 'confirmed' || item.status === 'pending') && item.videoUrl ? (
                  <TouchableOpacity style={styles.btn} onPress={() => joinCall(item.videoUrl)}>
                    <Text style={styles.btnText}>Join video</Text>
                  </TouchableOpacity>
                ) : null}
                {item.status === 'confirmed' || item.status === 'pending' ? (
                  <TouchableOpacity onPress={() => cancelConsultation(item.id).then(load)}>
                    <Text style={styles.cancel}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No bookings yet</Text>}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book {selected?.fullName}</Text>
            <TextInput
              style={styles.input}
              placeholder="Chief complaint (optional)"
              placeholderTextColor={med.textMuted}
              value={complaint}
              onChangeText={setComplaint}
            />
            <ScrollView style={{ maxHeight: 200 }}>
              {slots.map((s) => (
                <TouchableOpacity key={s.scheduledAt} style={styles.slot} onPress={() => confirmBook(s.scheduledAt)} disabled={busy}>
                  <Text style={styles.slotText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
              {!slots.length ? <Text style={styles.empty}>No slots today — try another day or contact clinic</Text> : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </HealthFeatureLayout>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: med.cardBorder, alignItems: 'center' },
    tabActive: { backgroundColor: med.primary, borderColor: med.primary },
    tabText: { color: med.text },
    tabTextActive: { color: '#fff', fontWeight: '700' },
    card: { backgroundColor: med.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: med.cardBorder },
    name: { fontWeight: '700', fontSize: 16, color: med.text },
    specialty: { color: med.primary, marginTop: 2, fontWeight: '600' },
    meta: { color: med.textMuted, fontSize: 13, marginTop: 4 },
    bio: { color: med.text, marginTop: 8, lineHeight: 18, fontSize: 13 },
    fee: { marginTop: 8, fontWeight: '600', color: med.text },
    btn: { marginTop: 10, backgroundColor: med.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    cancel: { color: '#EF4444', fontWeight: '600' },
    empty: { color: med.textMuted, marginTop: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: med.bgElevated || med.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
    modalTitle: { fontWeight: '700', fontSize: 18, color: med.text, marginBottom: 12 },
    input: { backgroundColor: med.card, borderWidth: 1, borderColor: med.cardBorder, borderRadius: 10, padding: 12, color: med.text, marginBottom: 12 },
    slot: { padding: 14, borderBottomWidth: 1, borderBottomColor: med.cardBorder },
    slotText: { color: med.text, fontWeight: '600' },
    closeBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
    closeText: { color: med.textMuted },
  });
