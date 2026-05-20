import {
  NavigationContainer,
  NavigationIndependentTree,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FloatingThemeToggle from '../SRC/Components/FloatingThemeToggle';
import PwaInstallPrompt from '../SRC/Components/PwaInstallPrompt';
import { AuthProvider } from '../SRC/Context/AuthContext';
import { ThemeProvider } from '../SRC/Context/ThemeContext';
import { loadAppIconFonts } from '../SRC/utils/iconFonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationShell({ children }: { children: React.ReactNode }) {
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState<string | null>(null);

  const syncRouteName = useCallback(() => {
    const name = navigationRef.getCurrentRoute()?.name ?? null;
    setRouteName(name);
  }, [navigationRef]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={syncRouteName}
      onStateChange={syncRouteName}
    >
      <ThemeProvider>
        <AuthProvider>
          {children}
          <FloatingThemeToggle routeName={routeName} />
          <PwaInstallPrompt />
        </AuthProvider>
      </ThemeProvider>
    </NavigationContainer>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    loadAppIconFonts()
      .catch((err) => console.warn('Icon font preload:', err))
      .finally(() => {
        setFontsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationIndependentTree>
        <NavigationShell>
          <Slot />
        </NavigationShell>
      </NavigationIndependentTree>
    </SafeAreaProvider>
  );
}
