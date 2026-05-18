import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MED_THEME } from '../constants/appTheme';

const TABS = [
  { id: 'chat', label: 'Chat', icon: 'chatbubbles', lib: 'ion' },
  { id: 'voice', label: 'Voice', icon: 'mic', lib: 'ion' },
  { id: 'records', label: 'Records', icon: 'folder-outline', lib: 'ion' },
];

export default function AppBottomNav({ active = 'chat', onChat, onVoice, onRecords }) {
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
              <Ionicons name="chatbubbles" size={22} color={isActive ? MED_THEME.primary : MED_THEME.textMuted} />
            ) : tab.id === 'voice' ? (
              <Ionicons name="mic" size={22} color={isActive ? MED_THEME.primary : MED_THEME.textMuted} />
            ) : (
              <Ionicons name="folder-outline" size={22} color={isActive ? MED_THEME.primary : MED_THEME.textMuted} />
            )}
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: MED_THEME.bgElevated,
    borderTopWidth: 1,
    borderTopColor: MED_THEME.cardBorder,
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
    color: MED_THEME.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: MED_THEME.primary,
    fontWeight: '600',
  },
});
