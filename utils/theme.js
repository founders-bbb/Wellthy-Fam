/**
 * theme.js — FamilyOS Design Tokens
 * Drop into: src/utils/theme.js
 *
 * Usage:
 *   import { LIGHT, DARK, getTheme } from './utils/theme';
 *   const colors = getTheme('dark');
 */

export const LIGHT = {
  // Backgrounds
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F3EFE9',

  // Brand
  primary: '#1C6B50',
  primaryLight: '#E4F2EC',
  accent: '#C4773B',
  accentLight: '#FDF0E4',

  // Text
  text: '#1A1208',
  textSecondary: '#6B5E52',
  muted: '#A89D95',

  // UI
  border: '#EDE8E2',
  overlay: 'rgba(0,0,0,0.4)',

  // Semantic
  success: '#1C6B50',
  danger: '#C94040',
  dangerLight: '#FBEAEA',
  warning: '#C4773B',

  // Category pills
  categories: {
    'Daily Essentials': { bg: '#E4F2EC', text: '#085041' },
    'House Bills':      { bg: '#E4EDFB', text: '#1A4A8A' },
    'Travel':           { bg: '#FDF0E4', text: '#7A4A10' },
    'Health':           { bg: '#FBE4EE', text: '#7A1A3A' },
    'Lifestyle & Entertainment': { bg: '#EDECFB', text: '#3A2A8A' },
    'Savings':          { bg: '#E4F2EC', text: '#085041' },
    'Income':           { bg: '#E4F2EC', text: '#085041' },
    'Uncat':            { bg: '#F2F2EE', text: '#555555' },
  },

  // Member card slot colors (in order)
  memberSlots: ['#1C6B50', '#7A4A10', '#3A2A8A', '#7A1A3A', '#085041'],

  // Tab bar
  tabBar: {
    background: '#FFFFFF',
    shadow: 'rgba(0,0,0,0.12)',
  },
};

export const DARK = {
  // Backgrounds
  background: '#18140F',
  surface: '#221D17',
  surfaceElevated: '#2A2520',

  // Brand
  primary: '#5DCFAA',
  primaryLight: 'rgba(93,207,170,0.14)',
  accent: '#E8A87C',
  accentLight: 'rgba(232,168,124,0.14)',

  // Text
  text: '#F2EDE4',
  textSecondary: '#B2A898',
  muted: '#706560',

  // UI
  border: '#352E26',
  overlay: 'rgba(0,0,0,0.6)',

  // Semantic
  success: '#5DCFAA',
  danger: '#E07070',
  dangerLight: 'rgba(224,112,112,0.12)',
  warning: '#E8A87C',

  // Category pills (dark-mode adapted)
  categories: {
    'Daily Essentials': { bg: 'rgba(93,207,170,0.14)',  text: '#5DCFAA' },
    'House Bills':      { bg: 'rgba(100,140,220,0.14)', text: '#88A8E8' },
    'Travel':           { bg: 'rgba(232,168,124,0.14)', text: '#E8A87C' },
    'Health':           { bg: 'rgba(220,100,120,0.14)', text: '#E88898' },
    'Lifestyle & Entertainment': { bg: 'rgba(150,130,220,0.14)', text: '#B8A8E8' },
    'Savings':          { bg: 'rgba(93,207,170,0.14)',  text: '#5DCFAA' },
    'Income':           { bg: 'rgba(93,207,170,0.14)',  text: '#5DCFAA' },
    'Uncat':            { bg: 'rgba(255,255,255,0.08)', text: '#888888' },
  },

  // Member card slot colors (slightly lighter for dark bg)
  memberSlots: ['#2A8A6A', '#9A6430', '#4A3AAA', '#9A2A4A', '#1A7A60'],

  // Tab bar
  tabBar: {
    background: '#221D17',
    shadow: 'rgba(0,0,0,0.3)',
  },
};

/** Get theme by key */
export function getTheme(mode) {
  return mode === 'dark' ? DARK : LIGHT;
}

/** Font family string for React Native */
export const FONT_FAMILY = {
  regular: undefined,   // system default — swap to 'DMSans-Regular' once font loaded
  medium:  undefined,
  semibold: undefined,
  bold:    undefined,
};

/** Spacing scale */
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28,
};

/** Border radius scale */
export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 9999,
};

/** Typography scale */
export const TYPE = {
  heroNumber: { fontSize: 38, fontWeight: '700', letterSpacing: -1.5 },
  h1:         { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },
  h2:         { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  h3:         { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  body:       { fontSize: 14, fontWeight: '400' },
  bodyMed:    { fontSize: 14, fontWeight: '500' },
  caption:    { fontSize: 11, fontWeight: '400' },
  captionBold:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  label:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
};
