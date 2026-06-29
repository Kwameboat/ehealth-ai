import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeaderBar from '../Components/ScreenHeaderBar';
import { useMedTheme } from '../hooks/useMedTheme';

const FEATURES = [
  { id: 'scan', title: 'Medicine Scanner', desc: 'Identify pills & packaging', icon: 'pill', screen: 'MedicineRecognition', color: '#EC4899' },
  { id: 'nhis', title: 'NHIS Assistant', desc: 'Coverage & benefits guidance', icon: 'card-account-details', screen: 'HealthChatFeature', params: { mode: 'nhis' }, color: '#10B981' },
  { id: 'diet', title: 'Ghana Diet Coach', desc: 'Diabetes & hypertension meals', icon: 'food-apple', screen: 'HealthChatFeature', params: { mode: 'diet' }, color: '#F59E0B' },
  { id: 'bp', title: 'BP Tracker', desc: 'Log & track blood pressure', icon: 'heart-pulse', screen: 'BpTracker', color: '#EF4444' },
  { id: 'family', title: 'Family Profiles', desc: 'Manage family health records', icon: 'account-group', screen: 'FamilyProfiles', color: '#8B5CF6' },
  { id: 'reminders', title: 'Medication Reminders', desc: 'Daily dose schedules', icon: 'pill', screen: 'MedicationReminders', color: '#3B82F6' },
  { id: 'facilities', title: 'Find Care Near You', desc: 'Pharmacy, lab, clinic, hospital', icon: 'map-marker-radius', screen: 'FacilityFinder', color: '#06B6D4' },
  { id: 'delivery', title: 'Medicine Delivery', desc: 'MoMo pay & pharmacy delivery', icon: 'truck-delivery', screen: 'MedicineDelivery', color: '#22C55E' },
  { id: 'doctors', title: 'Video Consultation', desc: 'Book a doctor video call', icon: 'video', screen: 'DoctorConsult', color: '#6366F1' },
  { id: 'alerts', title: 'Health Alerts', desc: 'Clinic broadcasts & tips', icon: 'bell-alert', screen: 'HealthAlerts', color: '#F97316' },
  { id: 'points', title: 'Points History', desc: 'Your usage & transactions', icon: 'history', screen: 'PointsHistory', color: '#64748B' },
];

export default function HealthHubScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeaderBar title="Health Services" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>Your full health companion — NHIS, diet, care finder & more</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {FEATURES.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(f.screen, f.params || {})}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${f.color}22` }]}>
              <MaterialCommunityIcons name={f.icon} size={28} color={f.color} />
            </View>
            <Text style={styles.cardTitle}>{f.title}</Text>
            <Text style={styles.cardDesc}>{f.desc}</Text>
            <Ionicons name="chevron-forward" size={18} color={med.textMuted} style={styles.chevron} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (med) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: med.bg },
    subtitle: { paddingHorizontal: 16, paddingBottom: 8, color: med.textMuted, fontSize: 13 },
    grid: { padding: 16, paddingBottom: 32, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: {
      width: '47%',
      backgroundColor: med.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: med.cardBorder,
      minHeight: 130,
    },
    iconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: med.text, marginBottom: 4 },
    cardDesc: { fontSize: 11, color: med.textMuted, lineHeight: 15, paddingRight: 16 },
    chevron: { position: 'absolute', right: 10, top: 14 },
  });
