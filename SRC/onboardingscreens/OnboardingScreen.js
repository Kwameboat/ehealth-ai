import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLogo from '../Components/AppLogo';
import ThemeToggleButton from '../Components/ThemeToggleButton';
import { APP_TAGLINE } from '../constants/branding';
import { useMemo } from 'react';
import { useMedTheme } from '../hooks/useMedTheme';
import { useResponsive } from '../hooks/useResponsive';
import { resetToRoute } from '../utils/navigationHelpers';
import {
  ChatIllustration,
  ConditionsIllustration,
  LabIllustration,
} from './OnboardingIllustrations';

const SLIDES = [
  {
    id: '1',
    title: 'AI Health Chat',
    subtitle:
      'Chat with eHealth AI about your symptoms, medications, and health concerns anytime.',
    Illustration: ChatIllustration,
  },
  {
    id: '2',
    title: 'Predefined Conditions',
    subtitle:
      'Get trusted information and guidance on common health conditions and wellness topics.',
    Illustration: ConditionsIllustration,
  },
  {
    id: '3',
    title: 'Lab Results Explained',
    subtitle:
      'Upload and understand your lab results with AI-powered insights and easy explanations.',
    Illustration: LabIllustration,
  },
];

function TaglineRow({ styles }) {
  return (
    <View style={styles.taglineRow}>
      <View style={styles.taglineLine} />
      <Text style={styles.taglineText}>{APP_TAGLINE}</Text>
      <View style={styles.taglineLine} />
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const med = useMedTheme();
  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isPhone, isTablet, isDesktop, isSmallPhone, horizontalPadding } = useResponsive();

  const slideWidth = width;
  const contentMaxWidth = isDesktop ? 520 : isTablet ? 480 : width;
  const illuScale = isSmallPhone ? 0.82 : isPhone ? 0.92 : isTablet ? 1 : 1.05;
  const tileSize = isSmallPhone ? 64 : isPhone ? 72 : isTablet ? 80 : 84;
  const titleSize = isSmallPhone ? 22 : isPhone ? 24 : isTablet ? 26 : 28;
  const subtitleSize = isSmallPhone ? 14 : 15;

  const finishOnboarding = useCallback(async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    const { isBackendConfigured } = await import('../services/authApi');
    resetToRoute(navigation, isBackendConfigured() ? 'Auth' : 'MedicalHome');
  }, [navigation]);

  const goToSlide = useCallback(
    (index) => {
      const safe = Math.max(0, Math.min(index, SLIDES.length - 1));
      setCurrentIndex(safe);
      flatListRef.current?.scrollToOffset({ offset: safe * slideWidth, animated: true });
    },
    [slideWidth]
  );

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      await finishOnboarding();
    }
  };

  const renderItem = ({ item }) => {
    const { Illustration } = item;
    return (
      <View style={[styles.slide, { width: slideWidth }]}>
        <View style={[styles.slideInner, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.illuBox}>
            {item.id === '2' ? (
              <Illustration scale={illuScale} tileSize={tileSize} />
            ) : (
              <Illustration scale={illuScale} />
            )}
          </View>
          <Text style={[styles.title, { fontSize: titleSize }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { fontSize: subtitleSize, lineHeight: subtitleSize * 1.55 }]}>
            {item.subtitle}
          </Text>
        </View>
      </View>
    );
  };

  const isLast = currentIndex === SLIDES.length - 1;
  const footerBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 24 : 16);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={med.isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={med.bg} />

      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerSpacer} />
          <AppLogo size={isSmallPhone ? 'small' : 'medium'} centered style={styles.headerLogo} />
          <ThemeToggleButton compact />
        </View>
        <TaglineRow styles={styles} />
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.list}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
          setCurrentIndex(index);
        }}
        renderItem={renderItem}
      />

      <View style={[styles.footer, { paddingBottom: footerBottom, paddingHorizontal: horizontalPadding }]}>
        <Pressable
          onPress={finishOnboarding}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, currentIndex === i ? styles.dotActive : styles.dotInactive]}
              accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (med) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: med.bg,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 2,
    width: '100%',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  headerSpacer: { width: 40 },
  headerLogo: { flex: 1 },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
    maxWidth: 340,
    width: '100%',
    justifyContent: 'center',
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    maxWidth: 48,
  },
  taglineText: {
    color: med.textMuted,
    fontSize: 11,
    textAlign: 'center',
    flexShrink: 1,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideInner: {
    width: '100%',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  illuBox: {
    width: '100%',
    minHeight: 200,
    maxHeight: '48%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    color: med.text,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  subtitle: {
    color: med.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
    maxWidth: 400,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: med.cardBorder,
    backgroundColor: med.bg,
  },
  skipBtn: {
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  skipText: {
    color: med.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#3B82F6',
  },
  dotInactive: {
    width: 8,
    backgroundColor: med.surface,
  },
  nextBtn: {
    backgroundColor: med.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: med.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
