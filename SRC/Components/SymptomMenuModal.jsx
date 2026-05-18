import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MED_THEME } from '../constants/appTheme';

export default function SymptomMenuModal({ visible, onClose, categories, onSelect }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Symptom Categories</Text>
          <Text style={styles.sub}>Select a condition for guided analysis</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => {
                  onSelect(item.screen);
                  onClose();
                }}
              >
                <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.rowText}>{item.name}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={MED_THEME.textDim} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MED_THEME.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: MED_THEME.textDim,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: MED_THEME.text,
    paddingHorizontal: 20,
  },
  sub: {
    fontSize: 13,
    color: MED_THEME.textMuted,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  scroll: { paddingHorizontal: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
    color: MED_THEME.text,
    fontSize: 15,
    fontWeight: '500',
  },
  closeBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: MED_THEME.surface,
  },
  closeText: { color: MED_THEME.primary, fontWeight: '600', fontSize: 16 },
});
