# FamilyApp

A React Native (Expo) family management app with Finance, Wellness, Family, and Insights tabs — backed by Supabase.

---

## 📁 Folder Structure

```
FamilyApp/
├── App.js                  # Entry point — module registry
├── AppCore.js              # All app logic, screens, tabs (monolith)
├── index.js                # Expo root component registration
├── app.json                # Expo config
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── .env                    # Supabase keys (do not commit)
├── .gitignore
├── utils/
│   ├── supabaseClient.js   # Supabase init + edge function URLs
│   └── constants.js        # DB column name constants
├── screens/                # Placeholder imports (rendering in AppCore)
│   ├── AuthScreen.js
│   ├── QuestionnaireScreen.js
│   ├── FamilySetupScreen.js
│   └── InviteJoinScreen.js
├── tabs/                   # Placeholder imports (rendering in AppCore)
│   ├── HomeTab.js
│   ├── FinanceTab.js
│   ├── WellnessTab.js
│   ├── FamilyTab.js
│   └── InsightsTab.js
├── assets/                 # App icons and splash (add your own)
└── sql/
    ├── phase_5_migration.sql
    └── cleanup_all_data.sql
```

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ installed
- Expo CLI installed globally

### Steps

```bash
# 1. Navigate into the folder
cd FamilyApp

# 2. Install dependencies
npm install

# 3. Start the app
npx expo start
```

Then press:
- `a` — open on Android emulator / device
- `i` — open on iOS simulator (Mac only)
- `w` — open in browser

---

## 📱 Running on your phone (Expo Go)

1. Install **Expo Go** from the App Store or Play Store
2. Run `npx expo start`
3. Scan the QR code with Expo Go (Android) or Camera app (iOS)

---

## 🔑 Environment Variables

The `.env` file is pre-configured with your Supabase project keys.
**Never commit this file to Git** — it's already in `.gitignore`.

---

## 🗄️ Database

Your Supabase project: `https://bvynbvaawbmsucgpmreq.supabase.co`

SQL files are in the root folder:
- `phase_5_migration.sql` — latest schema migration
- `cleanup_all_data.sql` — wipe all data (use with caution)
