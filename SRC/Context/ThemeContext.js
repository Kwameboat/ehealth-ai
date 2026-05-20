import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getMedTheme } from '../constants/appTheme';

const THEME_KEY = '@app_theme_preference';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [isUsingSystem, setIsUsingSystem] = useState(false);

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setIsDarkMode(savedTheme === 'dark');
          setIsUsingSystem(false);
        } else {
          setIsDarkMode(colorScheme !== 'light');
          setIsUsingSystem(true);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setIsThemeLoaded(true);
      }
    };

    loadThemePreference();
  }, [colorScheme]);

  useEffect(() => {
    if (isThemeLoaded && isUsingSystem) {
      setIsDarkMode(colorScheme !== 'light');
    }
  }, [colorScheme, isThemeLoaded, isUsingSystem]);

  const saveThemePreference = async (darkMode, usingSystem = false) => {
    try {
      if (usingSystem) {
        await AsyncStorage.removeItem(THEME_KEY);
      } else {
        await AsyncStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const setThemeMode = useCallback((dark) => {
    setIsDarkMode(dark);
    setIsUsingSystem(false);
    saveThemePreference(dark);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setIsUsingSystem(false);
      saveThemePreference(next);
      return next;
    });
  }, []);

  const resetToSystem = useCallback(() => {
    const systemDark = colorScheme !== 'light';
    setIsDarkMode(systemDark);
    setIsUsingSystem(true);
    saveThemePreference(null, true);
  }, [colorScheme]);

  const theme = useMemo(() => {
    const med = getMedTheme(isDarkMode);
    return {
      isDarkMode,
      isThemeLoaded,
      isUsingSystem,
      toggleTheme,
      setThemeMode,
      resetToSystem,
      med,
      colors: {
        background: med.bg,
        card: med.surface,
        header: isDarkMode ? med.bgElevated : '#FFFFFF',
        footer: isDarkMode ? med.bgElevated : '#EEF6FF',
        text: med.text,
        textSecondary: med.textMuted,
        border: med.cardBorder,
        primary: med.primary,
        primaryHover: isDarkMode ? '#60A5FA' : '#2563EB',
        secondary: '#6366F1',
        accent: med.accent,
        success: med.success,
        warning: '#F59E0B',
        danger: med.danger,
        buttonText: '#FFFFFF',
        buttonPrimaryBg: med.primary,
      },
      metrics: {
        borderRadius: 12,
        padding: 16,
        margin: 8,
        headerHeight: 60,
        transition: '300ms ease-in-out',
      },
    };
  }, [isDarkMode, isThemeLoaded, isUsingSystem, toggleTheme, setThemeMode, resetToSystem]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const med = getMedTheme(true);
    return {
      isDarkMode: true,
      isThemeLoaded: true,
      isUsingSystem: false,
      toggleTheme: () => {},
      setThemeMode: () => {},
      resetToSystem: () => {},
      med,
      colors: {
        background: med.bg,
        card: med.surface,
        header: med.bgElevated,
        footer: med.bgElevated,
        text: med.text,
        textSecondary: med.textMuted,
        border: med.cardBorder,
        primary: med.primary,
        primaryHover: '#60A5FA',
        secondary: '#6366F1',
        accent: med.accent,
        success: med.success,
        warning: '#F59E0B',
        danger: med.danger,
        buttonText: '#FFFFFF',
        buttonPrimaryBg: med.primary,
      },
      metrics: {
        borderRadius: 12,
        padding: 16,
        margin: 8,
        headerHeight: 60,
        transition: '300ms ease-in-out',
      },
    };
  }
  return ctx;
};
