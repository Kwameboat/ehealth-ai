import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Centers content on tablet/desktop with a max readable width */
export default function ResponsiveContainer({ children, maxWidth, style }) {
  return (
    <View style={[styles.outer, style]}>
      <View style={[styles.inner, maxWidth ? { maxWidth, width: '100%' } : styles.full]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  full: {
    flex: 1,
    width: '100%',
  },
});
