// utils/supabaseClient.js
//
// Central Supabase client + edge function URLs + key exports.
//
// PHASE 6 FIX: explicit AsyncStorage adapter wrapper instead of passing the
// AsyncStorage object directly. supabase-js calls .getItem / .setItem / .removeItem
// — we wrap them so we get clear error logs if something goes wrong, and so
// React Native's AsyncStorage method bindings are guaranteed correct.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ─── Environment variables ───────────────────────────────────────────────
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_PROJECT_URL ||
  process.env.SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] Missing SUPABASE_URL or SUPABASE_ANON_KEY in env. ' +
      'Check your .env file has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY set.'
  );
}

// ─── Storage adapter ─────────────────────────────────────────────────────
// Wrap AsyncStorage so binding is correct and errors are visible.
const SupabaseStorage = {
  getItem: async (key) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (e) {
      console.log('[supabaseClient.storage.getItem error]', key, e);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.log('[supabaseClient.storage.setItem error]', key, e);
    }
  },
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.log('[supabaseClient.storage.removeItem error]', key, e);
    }
  },
};

// ─── The client ──────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SupabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// ─── Edge Function URLs ──────────────────────────────────────────────────
const FUNCTIONS_BASE = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`
  : '';

// EDGE_MEAL was historically pointed at slug `meal-nutrient` which never existed
// in production — the actual deployed slug is `parse-meal-log`. The old AddMealModal
// silently fell back to a foods-table client-side lookup because of this. Phase 6
// (Prompt 4b) repoints EDGE_MEAL at the real slug so the vessel pipeline can work.
export const EDGE_MEAL = `${FUNCTIONS_BASE}/parse-meal-log`;
export const EDGE_NUDGE = `${FUNCTIONS_BASE}/generate-nudge`;
export const EDGE_UPDATE_PORTION = `${FUNCTIONS_BASE}/update-portion-memory`;
// Phase 6 statement upload (Phase B wires these into the UI):
export const EDGE_PARSE_STATEMENT = `${FUNCTIONS_BASE}/parse-statement`;
export const EDGE_FINALIZE_STATEMENT = `${FUNCTIONS_BASE}/finalize-statement-import`;
export const EDGE_CLEANUP_STATEMENTS = `${FUNCTIONS_BASE}/cleanup-expired-statements`;

// ─── Re-exports ──────────────────────────────────────────────────────────
export { SUPABASE_URL, SUPABASE_ANON_KEY };
