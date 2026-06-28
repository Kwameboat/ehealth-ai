import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMedTheme } from '../hooks/useMedTheme';

const TABS = [
  { id: 'chat', label: 'Chat', icon: 'chatbubbles', lib: 'ion' },
  { id: 'voice', label: 'Voice', icon: 'mic', lib: 'ion' },
  { id: 'records', label: 'Services', icon: 'folder-outline', lib: 'ion' },
];

export default function AppBottomNav({ active = 'chat', onChat, onVoice, onRecords }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const handlers = { chat: onChat, voice: onVoice, records: onRecords };

  return (
    <View style={styles.wrap}>
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={handlers[tab.id]}
            activeOpacity={0.85}
          >
            {tab.id === 'chat' ? (
              <Ionicons name="chatbubbles" size={22} color={isActive ? med.primary : med.textMuted} />
            ) : tab.id === 'voice' ? (
              <Ionicons name="mic" size={22} color={isActive ? med.primary : med.textMuted} />
            ) : (
              <Ionicons name="folder-outline" size={22} color={isActive ? med.primary : med.textMuted} />
            )}
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (med) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: med.bgElevated,
    borderTopWidth: 1,
    borderTopColor: med.cardBorder,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxWidth: 120,
  },
  tabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: med.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: med.primary,
    fontWeight: '600',
  },
});
