import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Web stub — AdMob is native-only. */
export default function HomeBannerAd() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.text}>Ad banner (mobile only)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 12,
    color: '#888',
  },
});
