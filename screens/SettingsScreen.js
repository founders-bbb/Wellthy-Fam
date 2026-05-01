/**
 * SettingsScreen.js — FamilyOS Settings with Light / Dark theme toggle
 * Drop into: src/screens/SettingsScreen.js
 *
 * Replace the existing SettingsScreen function in AppCore.js with this import,
 * or keep AppCore's modal wrapper and render <SettingsScreenContent> inside it.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';
import { useApp } from '../AppCore'; // adjust path if needed
import { RADIUS, SPACING, TYPE } from '../utils/theme';

// ─── Section / Row primitives ─────────────────────────────────────────────────

function SectionHeader({ title }) {
  const { theme } = useTheme();
  return (
    <Text style={[ss.sectionHeader, { color: theme.muted }]}>{title.toUpperCase()}</Text>
  );
}

function SettingsRow({ label, icon, value, onPress, danger = false, last = false, right }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        ss.row,
        { borderBottomColor: theme.border },
        last && ss.rowLast,
      ]}
    >
      {icon && (
        <View style={[ss.rowIcon, { backgroundColor: danger ? theme.dangerLight : theme.primaryLight }]}>
          {icon}
        </View>
      )}
      <Text style={[ss.rowLabel, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
      <View style={ss.rowRight}>
        {value ? <Text style={[ss.rowValue, { color: theme.muted }]}>{value}</Text> : null}
        {right || (
          <Text style={[ss.chevron, { color: theme.muted }]}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Card({ children }) {
  const { theme } = useTheme();
  return (
    <View style={[ss.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

// ─── Theme Picker ─────────────────────────────────────────────────────────────

function ThemePicker() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const options = [
    { key: 'light',  label: 'Light',  previewBg: '#FAF8F5', previewAccent: '#1C6B50' },
    { key: 'dark',   label: 'Dark',   previewBg: '#18140F', previewAccent: '#5DCFAA' },
    { key: 'system', label: 'System', previewBg: null },
  ];

  return (
    <View style={[ss.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[ss.row, { borderBottomColor: theme.border }]}>
        <View style={[ss.rowIcon, { backgroundColor: theme.primaryLight }]}>
          <Text style={{ fontSize: 16 }}>☀️</Text>
        </View>
        <Text style={[ss.rowLabel, { color: theme.text }]}>App Theme</Text>
      </View>
      <View style={ss.themePickerRow}>
        {options.map(opt => {
          const isActive = themeMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setThemeMode(opt.key)}
              style={[
                ss.themeOption,
                {
                  backgroundColor: isActive ? theme.primary : theme.surfaceElevated,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
            >
              {/* Preview swatch */}
              <View style={ss.themeSwatch}>
                {opt.previewBg ? (
                  <>
                    <View style={[ss.swatchHalf, { backgroundColor: opt.previewBg }]} />
                    <View style={[ss.swatchAccent, { backgroundColor: opt.previewAccent }]} />
                  </>
                ) : (
                  // System: half light, half dark
                  <>
                    <View style={[ss.swatchHalf, { backgroundColor: '#FAF8F5', flex: 1 }]} />
                    <View style={[ss.swatchHalf, { backgroundColor: '#18140F', flex: 1 }]} />
                  </>
                )}
              </View>
              <Text style={[
                ss.themeLabel,
                { color: isActive ? '#FFFFFF' : theme.muted, fontWeight: isActive ? '700' : '400' },
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen({ onClose }) {
  const { theme, isDark } = useTheme();
  const { currentUserName, familyName, members, isAdmin, notificationEnabled, setNotificationEnabled } = useApp();
  const insets = useSafeAreaInsets();

  const initials = (currentUserName || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  function confirmSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => { /* call supabase.auth.signOut() */ } },
      ]
    );
  }

  return (
    <View style={[ss.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[ss.header, { borderBottomColor: theme.border }]}>
        <Text style={[ss.headerTitle, { color: theme.text }]}>Settings</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={ss.closeBtn}>
            <Text style={[ss.closeTx, { color: theme.primary }]}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <TouchableOpacity style={[ss.profileCard, { backgroundColor: theme.primary }]}>
          <View style={ss.profileAvatar}>
            <Text style={ss.profileInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.profileName}>{currentUserName || 'Your Name'}</Text>
            <Text style={ss.profileSub}>{isAdmin ? 'Family Admin' : 'Member'} · {familyName || 'Family'}</Text>
          </View>
          <Text style={ss.profileChevron}>›</Text>
        </TouchableOpacity>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <ThemePicker />

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <Card>
          <SettingsRow
            label="Push Notifications"
            icon={<Text style={{ fontSize: 16 }}>🔔</Text>}
            right={
              <Switch
                value={notificationEnabled}
                onValueChange={setNotificationEnabled}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingsRow
            label="Evening Check-in Reminder"
            icon={<Text style={{ fontSize: 16 }}>⏰</Text>}
            value="8:00 PM"
            last
          />
        </Card>

        {/* Family */}
        <SectionHeader title="Family" />
        <Card>
          <SettingsRow
            label="Manage Members"
            icon={<Text style={{ fontSize: 16 }}>👨‍👩‍👧</Text>}
            value={`${members?.length || 0} members`}
          />
          <SettingsRow
            label="Share Invite Link"
            icon={<Text style={{ fontSize: 16 }}>🔗</Text>}
            last
          />
        </Card>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <Card>
          <SettingsRow label="Currency"      icon={<Text style={{ fontSize: 16 }}>₹</Text>} value="INR" />
          <SettingsRow label="Date Format"   icon={<Text style={{ fontSize: 16 }}>📅</Text>} value="DD/MM/YYYY" />
          <SettingsRow label="Number Format" icon={<Text style={{ fontSize: 16 }}>🔢</Text>} value="Indian" />
          <SettingsRow label="Language"      icon={<Text style={{ fontSize: 16 }}>🌐</Text>} value="English" last />
        </Card>

        {/* Account */}
        <SectionHeader title="Account" />
        <Card>
          <SettingsRow label="Edit Profile"        icon={<Text style={{ fontSize: 16 }}>✏️</Text>} />
          <SettingsRow label="Update Questionnaire" icon={<Text style={{ fontSize: 16 }}>📋</Text>} />
          <SettingsRow label="Privacy & Data"      icon={<Text style={{ fontSize: 16 }}>🔒</Text>} />
          <SettingsRow label="Help & Support"      icon={<Text style={{ fontSize: 16 }}>💬</Text>} last />
        </Card>

        {/* Sign out */}
        <Card>
          <SettingsRow
            label="Sign Out"
            icon={<Text style={{ fontSize: 16 }}>🚪</Text>}
            danger
            onPress={confirmSignOut}
            last
          />
        </Card>

        <Text style={[ss.version, { color: theme.muted }]}>FamilyOS v2.0</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  closeBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  closeTx: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16 },

  // Profile
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.xl, padding: 18, marginBottom: 24,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitials: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  profileSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  profileChevron: { fontSize: 24, color: 'rgba(255,255,255,0.5)' },

  // Section header
  sectionHeader: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    marginBottom: 6, marginTop: 4, paddingLeft: 4,
  },

  // Card + rows
  card: {
    borderRadius: RADIUS.lg, borderWidth: 0.5,
    overflow: 'hidden', marginBottom: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 14 },
  chevron: { fontSize: 20, lineHeight: 22 },

  // Theme picker
  themePickerRow: {
    flexDirection: 'row', gap: 8, padding: 14, paddingTop: 0,
  },
  themeOption: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, alignItems: 'center', gap: 6,
  },
  themeSwatch: {
    width: 40, height: 24, borderRadius: 6,
    overflow: 'hidden', flexDirection: 'row',
  },
  swatchHalf: { flex: 1 },
  swatchAccent: { position: 'absolute', bottom: 4, right: 4, width: 10, height: 10, borderRadius: 5 },
  themeLabel: { fontSize: 11 },

  version: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
