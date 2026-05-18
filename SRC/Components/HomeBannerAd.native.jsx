import React from 'react';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const realAdUnitId = 'ca-app-pub-8991036550543596/5607079076';
const adUnitId = __DEV__ ? TestIds.BANNER : realAdUnitId;

export default function HomeBannerAd() {
  return <BannerAd unitId={adUnitId} size={BannerAdSize.BANNER} />;
}
