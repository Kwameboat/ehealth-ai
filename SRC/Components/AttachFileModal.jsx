import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MED_THEME } from '../constants/appTheme';

/**
 * Web-friendly attach menu (Alert.alert action sheets are unreliable on react-native-web).
 */
export default function AttachFileModal({ visible, onClose, onPickPhoto, onPickPdf, showCamera }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Attach file</Text>
          <Text style={styles.sub}>Photo or PDF for analysis</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose();
              onPickPhoto(false);
            }}
          >
            <MaterialCommunityIcons name="image-outline" size={22} color={MED_THEME.primary} />
            <Text style={styles.rowText}>Photo</Text>
          </TouchableOpacity>

          {showCamera ? (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onClose();
                onPickPhoto(true);
              }}
            >
              <MaterialCommunityIcons name="camera-outline" size={22} color={MED_THEME.primary} />
              <Text style={styles.rowText}>Take photo</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose();
              onPickPdf();
            }}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={MED_THEME.primary} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MED_THEME.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: MED_THEME.cardBorder,
  },
  title: { fontSize: 18, fontWeight: '700', color: MED_THEME.text },
  sub: { fontSize: 13, color: MED_THEME.textMuted, marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: MED_THEME.cardBorder,
  },
  rowText: { fontSize: 16, color: MED_THEME.text, fontWeight: '500' },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: MED_THEME.textMuted, fontWeight: '600' },
});
