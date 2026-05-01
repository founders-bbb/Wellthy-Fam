/**
 * FloatingTabBar.js — Custom floating pill bottom tab bar for FamilyOS
 * Drop into: src/components/FloatingTabBar.js
 *
 * Usage in MainTabs (AppCore.js):
 *
 *   import FloatingTabBar from './components/FloatingTabBar';
 *
 *   function MainTabs() {
 *     return (
 *       <Tab.Navigator
 *         tabBar={props => <FloatingTabBar {...props} />}
 *         screenOptions={{ headerShown: false }}
 *       >
 *         <Tab.Screen name="Home"     component={HomeScreen} />
 *         <Tab.Screen name="Finance"  component={FinanceScreen} />
 *         <Tab.Screen name="Family"   component={FamilyScreen} />   ← center
 *         <Tab.Screen name="Wellness" component={WellnessScreen} />
 *         <Tab.Screen name="Insights" component={InsightsScreen} />
 *       </Tab.Navigator>
 *     );
 *   }
 *
 * IMPORTANT: Tab order must be Home | Finance | Family | Wellness | Insights
 * so Family lands at index 2 (center).
 *
 * Also add to every main screen's root ScrollView / View:
 *   contentContainerStyle={{ paddingBottom: 110 }}
 * so content isn't hidden behind the floating bar.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../utils/ThemeContext';

// ── Inline SVG-style icons using RN paths (via react-native-svg if available,
//    otherwise fall back to emoji text labels) ──────────────────────────────
// If you have react-native-svg installed, replace these with proper <Svg> icons.
const TAB_ICONS = {
  Home:     { emoji: '⌂',  label: 'Home'     },
  Finance:  { emoji: '₹',  label: 'Finance'  },
  Family:   { emoji: '♥',  label: 'Family'   },
  Wellness: { emoji: '✦',  label: 'Wellness' },
  Insights: { emoji: '◎',  label: 'Insights' },
};

const CENTER_TAB = 'Family';
const CENTER_LIFT = 22;       // px the center button rises above the pill
const BAR_BORDER_RADIUS = 28;
const BAR_PADDING_H = 14;

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingHorizontal: BAR_PADDING_H,
          paddingBottom: Math.max(insets.bottom, 8) + 6,
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.surface,
            shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.15)',
            borderColor: theme.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isCenter = route.name === CENTER_TAB;
          const icon = TAB_ICONS[route.name] || { emoji: '●', label: route.name };

          function onPress() {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          if (isCenter) {
            return (
              <View key={route.key} style={styles.centerWrapper}>
                <TouchableOpacity
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityLabel={options.tabBarAccessibilityLabel || icon.label}
                  style={[
                    styles.centerBtn,
                    {
                      backgroundColor: theme.primary,
                      shadowColor: theme.primary,
                      marginTop: -CENTER_LIFT,
                    },
                  ]}
                >
                  <Text style={styles.centerIcon}>{icon.emoji}</Text>
                  <Text style={styles.centerLabel}>{icon.label}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={options.tabBarAccessibilityLabel || icon.label}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.tabInner,
                  isFocused && { backgroundColor: theme.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.tabIcon,
                    { color: isFocused ? theme.primary : theme.muted },
                  ]}
                >
                  {icon.emoji}
                </Text>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? theme.primary : theme.muted,
                      fontWeight: isFocused ? '600' : '400',
                    },
                  ]}
                >
                  {icon.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Transparent so screen content shows through the gradient fade
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BAR_BORDER_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    // Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    gap: 3,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tabIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  tabLabel: {
    fontSize: 9,
    letterSpacing: 0.1,
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    // Shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 8,
  },
  centerIcon: {
    fontSize: 19,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  centerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.2,
  },
});
