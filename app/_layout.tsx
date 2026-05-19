import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PwaInstallPrompt from '../SRC/Components/PwaInstallPrompt';
import { AuthProvider } from '../SRC/Context/AuthContext';
import { ThemeProvider } from '../SRC/Context/ThemeContext';
import { loadAppIconFonts } from '../SRC/utils/iconFonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
        <NavigationContainer>
          <ThemeProvider>
            <AuthProvider>
              <Slot />
              <PwaInstallPrompt />
            </AuthProvider>
          </ThemeProvider>
        </NavigationContainer>
      </NavigationIndependentTree>
    </SafeAreaProvider>
  );
}
