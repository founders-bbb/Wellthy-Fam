/**
 * ThemeContext.js — Light/Dark theme provider for FamilyOS
 * Drop into: src/utils/ThemeContext.js
 *
 * Wraps AppCore's <AppContext.Provider>. Theme preference is
 * persisted to AsyncStorage and restored on boot.
 *
 * Usage:
 *   // 1. Wrap your root:
 *   <ThemeProvider><AppCore /></ThemeProvider>
 *
 *   // 2. Consume anywhere:
 *   const { theme, themeMode, setThemeMode } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT, DARK, getTheme } from './theme';

const STORAGE_KEY = 'familyos_theme_mode';

const ThemeContext = createContext({
  theme: LIGHT,
  themeMode: 'light',      // 'light' | 'dark' | 'system'
  setThemeMode: () => {},
  isDark: false,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();                 // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('system');

  // Restore saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { if (saved) setThemeModeState(saved); })
      .catch(() => {});
  }, []);

  // Persist on change
  async function setThemeMode(mode) {
    setThemeModeState(mode);
    try { await AsyncStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }

  // Resolve effective scheme
  const effectiveScheme =
    themeMode === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : themeMode;

  const theme = getTheme(effectiveScheme);
  const isDark = effectiveScheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook — use inside any component wrapped by ThemeProvider */
export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Backward-compat shim — replaces the old getThemeColors() call pattern.
 * Swap every `getThemeColors()` call in AppCore.js with `useThemeColors()`,
 * and every `useThemeColors()` (which already exists in AppCore) will now
 * read from the context instead of the hard-coded constant.
 *
 * In AppCore.js, update the existing useThemeColors function to:
 *
 *   function useThemeColors() {
 *     return useTheme().theme;
 *   }
 *
 * That single change wires the whole app to the theme context.
 */
export { LIGHT, DARK };
