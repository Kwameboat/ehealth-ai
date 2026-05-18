import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MED_THEME } from '../constants/appTheme';

const CARD = '#1A2744';
const CARD_BORDER = 'rgba(148, 163, 184, 0.15)';

export function ChatIllustration({ scale = 1 }) {
  const s = (n) => n * scale;
  return (
    <View style={[illu.wrap, { minHeight: s(200) }]}>
      <View style={[illu.person, { width: s(72), height: s(100) }]}>
        <View style={[illu.personHead, { width: s(28), height: s(28), borderRadius: s(14) }]} />
        <View style={[illu.personBody, { width: s(56), height: s(52), borderRadius: s(12), marginTop: s(6) }]} />
        <View style={[illu.personPhone, { width: s(22), height: s(34), borderRadius: s(4), marginTop: s(-8) }]} />
      </View>
      <View style={[illu.phoneMock, { width: s(140), height: s(220), borderRadius: s(16), padding: s(8) }]}>
        <View style={illu.phoneHeader}>
          <View style={illu.phoneHeaderDot} />
          <Text style={[illu.phoneHeaderText, { fontSize: s(9) }]}>eHealth AI</Text>
        </View>
        <View style={[illu.bubbleAi, { padding: s(8), borderRadius: s(10), marginTop: s(6) }]}>
          <Text style={[illu.bubbleAiText, { fontSize: s(8), lineHeight: s(11) }]}>
            Hello! 👋 How can I help you today?
          </Text>
        </View>
        <View style={[illu.bubbleUser, { padding: s(8), borderRadius: s(10), marginTop: s(6), alignSelf: 'flex-end' }]}>
          <Text style={[illu.bubbleUserText, { fontSize: s(8), lineHeight: s(11) }]}>
            I have headache and fever since yesterday.
          </Text>
        </View>
        <View style={[illu.typingRow, { marginTop: s(8), gap: s(4) }]}>
          <View style={[illu.typingDot, { width: s(5), height: s(5), borderRadius: s(3) }]} />
          <View style={[illu.typingDot, { width: s(5), height: s(5), borderRadius: s(3) }]} />
          <View style={[illu.typingDot, { width: s(5), height: s(5), borderRadius: s(3) }]} />
        </View>
      </View>
      <View style={[illu.floatBadge, { right: s(8), top: s(20), width: s(28), height: s(28), borderRadius: s(14) }]}>
        <Ionicons name="chatbubble-ellipses" size={s(14)} color={MED_THEME.accent} />
      </View>
    </View>
  );
}

const CONDITIONS = [
  { label: 'Headache', icon: 'head-flash-outline', color: '#F87171' },
  { label: 'Fever', icon: 'thermometer-high', color: '#FB923C' },
  { label: 'Stomach', icon: 'stomach', color: '#F472B6' },
  { label: 'Cough', icon: 'lungs', color: '#60A5FA' },
  { label: 'BP', icon: 'heart-pulse', color: '#EF4444' },
  { label: 'Diabetes', icon: 'water', color: '#38BDF8' },
];

export function ConditionsIllustration({ scale = 1, tileSize = 72 }) {
  const s = (n) => n * scale;
  const tile = s(tileSize);
  const gap = s(10);
  const gridWidth = tile * 2 + gap;
  return (
    <View style={[illu.gridWrap, { width: gridWidth, gap }]}>
      {CONDITIONS.map((c) => (
        <View
          key={c.label}
          style={[
            illu.conditionTile,
            { width: tile, height: tile, borderRadius: s(14), padding: s(8) },
          ]}
        >
          <MaterialCommunityIcons name={c.icon} size={s(28)} color={c.color} />
          <Text style={[illu.conditionLabel, { fontSize: s(9), marginTop: s(4) }]} numberOfLines={1}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LabIllustration({ scale = 1 }) {
  const s = (n) => n * scale;
  const rows = [
    { name: 'Hemoglobin (Hb)', value: '13.2 g/dL', ok: true },
    { name: 'WBC', value: '7.4 ×10⁹/L', ok: true },
    { name: 'Platelets', value: '250 ×10⁹/L', ok: true },
    { name: 'Blood Sugar (FBS)', value: '95 mg/dL', ok: true },
  ];
  return (
    <View style={[illu.labWrap, { minHeight: s(200) }]}>
      <View style={[illu.labDecor, { left: s(0), top: s(10) }]}>
        <MaterialCommunityIcons name="microscope" size={s(36)} color="#94A3B8" />
      </View>
      <View style={[illu.labDecor, { right: s(0), top: s(0) }]}>
        <Ionicons name="shield-checkmark" size={s(32)} color={MED_THEME.primary} />
      </View>
      <View style={[illu.labCard, { width: s(240), borderRadius: s(14), padding: s(12) }]}>
        <Text style={[illu.labCardTitle, { fontSize: s(11), marginBottom: s(8) }]}>
          Lab Result Interpretation
        </Text>
        {rows.map((r) => (
          <View key={r.name} style={[illu.labRow, { marginBottom: s(6) }]}>
            <Text style={[illu.labRowName, { fontSize: s(8), flex: 1 }]} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={[illu.labRowVal, { fontSize: s(8) }]}>{r.value}</Text>
            <Text style={[illu.labOk, { fontSize: s(8), marginLeft: s(4) }]}>Normal</Text>
          </View>
        ))}
        <View style={[illu.labAiBox, { marginTop: s(8), padding: s(8), borderRadius: s(10) }]}>
          <Ionicons name="checkmark-circle" size={s(16)} color={MED_THEME.success} />
          <Text style={[illu.labAiText, { fontSize: s(8), lineHeight: s(12), flex: 1, marginLeft: s(6) }]}>
            Your results are within the normal range. Maintain a healthy lifestyle.
          </Text>
        </View>
      </View>
    </View>
  );
}

const illu = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  person: { alignItems: 'center' },
  personHead: { backgroundColor: '#FCD9B6' },
  personBody: { backgroundColor: '#22C55E' },
  personPhone: { backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155' },
  phoneMock: {
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#334155',
  },
  phoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneHeaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MED_THEME.accent },
  phoneHeaderText: { color: MED_THEME.text, fontWeight: '700' },
  bubbleAi: { backgroundColor: MED_THEME.primary, maxWidth: '95%' },
  bubbleAiText: { color: '#fff', fontWeight: '500' },
  bubbleUser: { backgroundColor: CARD, maxWidth: '90%', borderWidth: 1, borderColor: CARD_BORDER },
  bubbleUserText: { color: MED_THEME.textMuted },
  typingRow: { flexDirection: 'row', alignItems: 'center' },
  typingDot: { backgroundColor: MED_THEME.textDim },
  floatBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 201, 167, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  conditionTile: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionLabel: { color: MED_THEME.textMuted, fontWeight: '600' },
  labWrap: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  labDecor: { position: 'absolute', opacity: 0.85 },
  labCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    zIndex: 1,
  },
  labCardTitle: { color: MED_THEME.text, fontWeight: '700', textAlign: 'center' },
  labRow: { flexDirection: 'row', alignItems: 'center' },
  labRowName: { color: MED_THEME.textMuted },
  labRowVal: { color: MED_THEME.text, fontWeight: '600' },
  labOk: { color: MED_THEME.success, fontWeight: '700' },
  labAiBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  labAiText: { color: MED_THEME.textMuted },
});
