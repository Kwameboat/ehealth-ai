import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { useMedTheme } from '../hooks/useMedTheme';

/**
 * Web-friendly attach menu (Alert.alert action sheets are unreliable on react-native-web).
 */
export default function AttachFileModal({ visible, onClose, onPickPhoto, onPickPdf, showCamera }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Attach file</Text>
          <Text style={styles.sub}>Photo or PDF for analysis</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onPickPhoto(false);
              onClose();
            }}
          >
            <MaterialCommunityIcons name="image-outline" size={22} color={med.primary} />
            <Text style={styles.rowText}>Photo</Text>
          </TouchableOpacity>

          {showCamera ? (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onPickPhoto(true);
                onClose();
              }}
            >
              <MaterialCommunityIcons name="camera-outline" size={22} color={med.primary} />
              <Text style={styles.rowText}>Take photo</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onPickPdf();
              onClose();
            }}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={med.primary} />
            <Text style={styles.rowText}>PDF document</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (med) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }
      : {}),
  },
  sheet: {
    backgroundColor: med.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: med.cardBorder,
  },
  title: { fontSize: 18, fontWeight: '700', color: med.text },
  sub: { fontSize: 13, color: med.textMuted, marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: med.cardBorder,
  },
  rowText: { fontSize: 16, color: med.text, fontWeight: '500' },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: med.textMuted, fontWeight: '600' },
});
