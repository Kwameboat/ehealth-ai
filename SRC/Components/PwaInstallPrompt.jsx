import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMemo } from 'react';
import { useMedTheme } from '../hooks/useMedTheme';
import { usePwaInstall } from '../hooks/usePwaInstall';

export default function PwaInstallPrompt() {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const {
    isWeb,
    visible,
    mode,
    canInstall,
    isIos,
    install,
    dismiss,
    continueInBrowser,
  } = usePwaInstall();

  if (!isWeb || !visible || Platform.OS !== 'web') {
    return null;
  }

  const isOpenAppMode = mode === 'open-app';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => dismiss(24)}>
      <Pressable style={styles.overlay} onPress={() => dismiss(24)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="medical-bag" size={32} color={med.primary} />
          </View>

          {isOpenAppMode ? (
            <>
              <Text style={styles.title}>Open eHealth AI from your home screen</Text>
              <Text style={styles.body}>
                This app is installed on your device. Launch it from your home screen or app
                drawer for the best experience.
              </Text>
              <View style={styles.hintBox}>
                <Ionicons name="phone-portrait-outline" size={20} color={med.primary} />
                <Text style={styles.hintText}>
                  Look for the eHealth AI icon on your home screen.
                </Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => dismiss(48)}>
                <Text style={styles.primaryBtnText}>Got it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={continueInBrowser}>
                <Text style={styles.secondaryBtnText}>Continue in browser</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Install eHealth AI</Text>
              <Text style={styles.body}>
                Add to your home screen for quick access, full-screen experience, and faster
                launches — just like a native app.
              </Text>

              {isIos && !canInstall && (
                <View style={styles.hintBox}>
                  <Text style={styles.iosSteps}>
                    On iPhone/iPad: tap Share → Add to Home Screen → Add.
                  </Text>
                </View>
              )}

              {canInstall ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={install}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Install app</Text>
                </TouchableOpacity>
              ) : (
                !isIos && (
                  <View style={styles.hintBox}>
                    <Text style={styles.iosSteps}>
                      In Chrome or Edge: open the menu (⋮) → Install eHealth AI, or look for
                      the install icon in the address bar.
                    </Text>
                  </View>
                )
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => dismiss(24)}>
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
            </>
          )}
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
  },
  sheet: {
    backgroundColor: med.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: med.cardBorder,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: med.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: med.textMuted,
    marginBottom: 16,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: med.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: med.cardBorder,
  },
  hintText: {
    flex: 1,
    color: med.text,
    fontSize: 14,
    lineHeight: 20,
  },
  iosSteps: {
    color: med.text,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: med.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: med.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
});
