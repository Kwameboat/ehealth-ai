import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { Slot } from 'expo-router';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PwaInstallPrompt from '../SRC/Components/PwaInstallPrompt';
import { AuthProvider } from '../SRC/Context/AuthContext';
import { ThemeProvider } from '../SRC/Context/ThemeContext';

export default function RootLayout() {
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
