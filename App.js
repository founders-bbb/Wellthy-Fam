import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import {
  useFonts,
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_400Regular_Italic,
} from '@expo-google-fonts/dm-sans';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';

import AppCore from './AppCore';
import { supabase } from './utils/supabaseClient';

// Modular entry imports (V3 structure)
import AuthScreen from './screens/AuthScreen';
import QuestionnaireScreen from './screens/QuestionnaireScreen';
import FamilySetupScreen from './screens/FamilySetupScreen';
import InviteJoinScreen from './screens/InviteJoinScreen';
import HomeTab from './tabs/HomeTab';
import FinanceTab from './tabs/FinanceTab';
import WellnessTab from './tabs/WellnessTab';
import FamilyTab from './tabs/FamilyTab';
import InsightsTab from './tabs/InsightsTab';

// Registry keeps the module boundaries explicit and discoverable.
// AppCore currently orchestrates runtime routing/state while features are now split by folder.
const MODULE_REGISTRY = {
  screens: {
    AuthScreen,
    QuestionnaireScreen,
    FamilySetupScreen,
    InviteJoinScreen,
  },
  tabs: {
    HomeTab,
    FinanceTab,
    WellnessTab,
    FamilyTab,
    InsightsTab,
  },
};

export default function App() {
  // Load DM Sans + DM Serif Display per the Design Guide.
  const [fontsLoaded] = useFonts({
    'DMSans-Light':         DMSans_300Light,
    'DMSans-Regular':       DMSans_400Regular,
    'DMSans-Medium':        DMSans_500Medium,
    'DMSans-SemiBold':      DMSans_600SemiBold,
    'DMSans-Bold':          DMSans_700Bold,
    'DMSans-Italic':        DMSans_400Regular_Italic,
    'DMSerif-Regular':      DMSerifDisplay_400Regular,
    'DMSerif-Italic':       DMSerifDisplay_400Regular_Italic,
  });

  // Email-auth STEP 3: deep-link handler for Supabase PKCE auth callbacks.
  // Listens for wellthyfam://auth-callback?code=... (signup confirm)
  // AND wellthyfam://reset-password?code=...&type=recovery (recovery — STEP 5 will branch).
  // exchangeCodeForSession() triggers onAuthStateChange in AppCore (L6691),
  // which re-runs checkAuthState and routes the user into main_app.
  const lastHandledUrl = useRef(null);
  useEffect(function () {
    async function handleDeepLink(url) {
      if (!url) return; // normal cold-boot has no URL — explicit no-op
      if (url === lastHandledUrl.current) return; // de-dupe: getInitialURL + 'url' event can both fire on cold start
      lastHandledUrl.current = url;
      try {
        var parsed = Linking.parse(url);
        var query = (parsed && parsed.queryParams) || {};
        var code = query.code;
        var type = query.type; // 'signup' | 'recovery' | etc.

        if (!code) {
          // URL didn't carry an auth code — silent no-op (could be a non-auth deep link)
          console.log('[DEEP LINK] no auth code in URL, ignoring:', url);
          return;
        }

        if (type === 'recovery') {
          // STEP 5 will branch UI to a "Set new password" screen here.
          console.log('[DEEP LINK] recovery code received — STEP 5 routing pending');
        }

        var exchRes = await supabase.auth.exchangeCodeForSession(code);
        if (exchRes && exchRes.error) {
          console.log('[DEEP LINK exchangeCodeForSession ERROR]', exchRes.error);
        } else {
          console.log('[DEEP LINK] session exchanged from PKCE code, type:', type || 'unknown');
        }
      } catch (e) {
        console.log('[DEEP LINK HANDLER ERROR]', e);
      }
    }

    // Cold-start: app launched FROM a deep link (user tapped email link from closed app)
    Linking.getInitialURL()
      .then(function (url) { handleDeepLink(url); })
      .catch(function (err) { console.log('[DEEP LINK getInitialURL ERROR]', err); });

    // Warm-state: app already running, user tapped link
    var sub = Linking.addEventListener('url', function (event) {
      handleDeepLink(event && event.url);
    });

    return function () {
      if (sub && sub.remove) sub.remove();
    };
  }, []);

  if (!fontsLoaded) {
    // Quiet splash — same warm-cream background as the rest of the app
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F3EA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#4A5A2C" />
      </View>
    );
  }

  if (!MODULE_REGISTRY) {
    return null;
  }
  return <AppCore />;
}
