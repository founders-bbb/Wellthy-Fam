import React from 'react';
import AppCore from './AppCore';

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
  // Prevent unused warning in strict bundlers while keeping registry visible for future migration steps.
  if (!MODULE_REGISTRY) {
    return null;
  }
  return <AppCore />;
}
