import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_KEY = '@app_theme_preference';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [isUsingSystem, setIsUsingSystem] = useState(true);

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        
        if (savedTheme) {
          setIsDarkMode(savedTheme === 'dark');
          setIsUsingSystem(false);
        } else {
          setIsDarkMode(colorScheme === 'dark');
          setIsUsingSystem(true);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setIsThemeLoaded(true);
      }
    };

    loadThemePreference();
  }, []);

  // Update theme when system preference changes (if using system theme)
  useEffect(() => {
    if (isThemeLoaded && isUsingSystem) {
      setIsDarkMode(colorScheme === 'dark');
    }
  }, [colorScheme, isThemeLoaded, isUsingSystem]);

  // Save theme preference to AsyncStorage
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

  // Toggle theme and save preference
  const toggleTheme = useCallback(() => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    setIsUsingSystem(false);
    saveThemePreference(newMode);
  }, [isDarkMode]);

  // Reset to system theme
  const resetToSystem = useCallback(() => {
    setIsDarkMode(colorScheme === 'dark');
    setIsUsingSystem(true);
    saveThemePreference(null, true);
  }, [colorScheme]);

  // Theme object with colors and metrics
  const theme = {
    isDarkMode,
    isThemeLoaded,
    isUsingSystem,
    toggleTheme,
    resetToSystem,
    colors: {
      background: isDarkMode ? '#0B1220' : '#f8f9fa',
      card: isDarkMode ? '#1A2332' : '#ffffff',
      header: isDarkMode ? '#111827' : '#2a86ff',
      footer: isDarkMode ? '#111827' : '#eef6ff',
      text: isDarkMode ? '#F8FAFC' : '#1e293b',
      textSecondary: isDarkMode ? '#94A3B8' : '#64748b',
      border: isDarkMode ? 'rgba(148,163,184,0.12)' : '#e5e7eb',
      primary: '#3B82F6',
      primaryHover: isDarkMode ? '#60a5fa' : '#2563eb',
      secondary: '#6366F1',
      accent: '#6366F1',
      
      // Status
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      
      // Buttons
      buttonText: isDarkMode ? '#f0f9ff' : '#ffffff',
      buttonPrimaryBg: isDarkMode ? '#1e40af' : '#3b82f6',
    },
    metrics: {
      borderRadius: 12,
      padding: 16,
      margin: 8,
      headerHeight: 60,
      transition: '300ms ease-in-out',
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);