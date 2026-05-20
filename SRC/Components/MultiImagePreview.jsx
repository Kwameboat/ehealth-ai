import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../Context/ThemeContext';

/**
 * Horizontal preview for one or more image URIs.
 */
export default function MultiImagePreview({ uris = [], onClear, imageHeight = 200 }) {
  const theme = useTheme();
  if (!uris.length) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {uris.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={[
              styles.thumb,
              {
                height: imageHeight,
                borderColor: theme.colors.border,
              },
              uris.length === 1 && styles.thumbFull,
            ]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {uris.length > 1 ? (
        <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
          {uris.length} files selected
        </Text>
      ) : null}
      {onClear ? (
        <TouchableOpacity style={styles.clearBtn} onPress={onClear} accessibilityLabel="Clear uploads">
          <Ionicons name="close-circle" size={32} color={theme.colors.danger} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 16 },
  row: { gap: 10, paddingRight: 40 },
  thumb: {
    width: 160,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumbFull: { width: '100%', maxWidth: 400 },
  count: { marginTop: 8, fontSize: 13 },
  clearBtn: { position: 'absolute', top: 4, right: 4 },
});
