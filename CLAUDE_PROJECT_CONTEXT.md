# CLAUDE_PROJECT_CONTEXT.md
**Project:** FamilyApp
**Repository:** https://github.com/tspchinnu-jpg/familyapp
**Primary branch:** `main`
**Last updated:** 2026-05-01
**Purpose:** Master handoff context for continuing development in a new Claude project. Synthesized from all previous project conversations and documents.

---

## 1) PROJECT OVERVIEW

### App name
**FamilyApp** (internal project name)

### Purpose
FamilyApp is a family-first mobile app for Indian middle-class households to track:
- Daily finances (transactions, goals, recurring items)
- Daily wellness (meals, water, screen-time)
- Family collaboration (shared goals, comments, activity feed)
- Behavioral consistency (checklists, scorecard, nudges)

### Target audience
- Indian middle-class families (2+ members)
- Users who want practical daily tracking instead of complex financial/wellness tools

### Vision and goals
- Make family money + health habits visible, simple, and collaborative
- Use data + AI nudges to improve consistency over time
- Keep UX practical for non-technical users
- Prepare product for beta-to-APK path

---

## 2) CURRENT STATUS (as of Phase 5 — 2026-04-27)

### Phase delivery summary
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Real-time sync, onboarding, validation, error handling | ✅ Complete |
| Phase 2 | Questionnaire redesign, Insights tab, Calendar, Scorecard | ✅ Complete |
| Phase 3 | Smart reminders, Finance search/filter, Family roles, Recurring transactions | ✅ Complete |
| Phase 4 | Collaboration (comments, shared goals, activity feed), Profile, Analytics, Dropdowns | ✅ Complete |
| Phase 4 Hotfixes | Role display, unified goal flow, date restrictions, accumulation bugs, creator admin | ✅ Complete |
| Phase 5 | Questionnaire hardening, invite+signup integration, water unit normalization, recurring auto-create, category standardization | ✅ Complete |

### What is currently working
- Auth + onboarding + family creation/join
- Home / Finance / Wellness / Insights / Family tabs
- 7-page / 38-question onboarding questionnaire (cannot be skipped)
- Invite code embedded in Sign Up flow
- Recurring transactions with auto-create on bootstrap + pending confirmation section
- Transaction categories standardized: Daily Essentials, House Bills, Travel, Health, Lifestyle, Savings
- Custom categories removed from UI (single-source category set)
- Water logs stored as litres (0.25L/glass), displayed as glasses
- Shared goals + contributions
- Transaction comments
- Activity feed with date filtering
- Insights calendar with day drilldown
- Profile management (gender dropdown, DOB, language_preference)
- Role enforcement: creator = admin, invited = member; `repairCreatorRoles()` auto-runs on session
- `cleanup_all_data.sql` for fresh-start testing

### Build validation (Phase 5)
- `npx expo-doctor` → 17/17 checks passed
- `CI=1 npx expo export -p web` → passed

---

## 3) ENVIRONMENT & CREDENTIALS

| Item | Value |
|------|-------|
| Repo | `tspchinnu-jpg/familyapp` |
| Windows path | `C:\Users\cthiv\familyapp` |
| Linux/Abacus path | `/home/ubuntu/familyapp` |
| Supabase URL | `https://bvynbvaawbmsucgpmreq.supabase.co` |
| Auth method | Supabase email/password |
| AI API | Anthropic Claude API (`claude-sonnet-4-20250514`) via Edge Functions |

> ⚠️ **Security note:** Service role key should not remain in client-facing `.env` before public release.

---

## 4) TECH STACK

### Frontend
- React Native `0.81.5`
- Expo SDK `~54.0.33`
- React `19.1.0`
- Single-file primary architecture: `App.js` (monolithic; modular extraction planned)

### Backend
- Supabase (Postgres + Auth + RLS)
- Supabase Edge Functions (Deno):
  - `generate-nudge/index.ts`
  - `parse-meal-log/index.ts`

### AI
- Anthropic Claude API used in edge functions for nudge generation and free-text meal parsing

### Key libraries
- `@supabase/supabase-js` ^2.103.2
- `expo-notifications` ~0.32.16
- `expo-image-picker` ~17.0.8
- `@react-native-community/datetimepicker` 8.4.4
- `react-native-chart-kit` ^6.12.0
- `react-native-svg` 15.12.1
- `@react-navigation/bottom-tabs` ^7.15.9
- `@react-navigation/native` ^7.2.2
- `@react-native-async-storage/async-storage` 2.2.0
- `react-native-gesture-handler` ~2.28.0
- `react-native-reanimated` ~4.1.1
- `firebase` ^12.11.0 *(legacy dependency — current backend is Supabase)*

---

## 5) PROJECT STRUCTURE

```
C:\Users\cthiv\familyapp\          (or /home/ubuntu/familyapp/)
├── App.js                          # Main app logic (primary file — auth, tabs, modals, CRUD)
├── AppCore.js                      # Runtime orchestrator
├── index.js                        # Entry point
├── app.json                        # Expo config/plugins
├── package.json                    # Dependencies/scripts
├── tsconfig.json
├── .env                            # Runtime environment variables
├── CHANGES.md                      # Full release/fix history
├── CLAUDE_PROJECT_CONTEXT.md       # This handoff document
├── phase_4_migration.sql           # Phase 4 DB migration
├── phase_5_migration.sql           # Phase 5 DB migration (latest)
├── cleanup_all_data.sql            # Wipes all app data, preserves schema
├── FRESH_START_GUIDE.txt           # Clean-data + retest instructions
├── PHASE_5_TESTING_GUIDE.txt       # Latest test checklist
├── INSTALLATION_INSTRUCTIONS.txt   # Phase 5 install steps (Windows)
├── Onboarding_Questionnaire.md     # All 38 questions with formats/conditionals
├── Intelligence layers/
│   ├── intelligence_migration.sql  # foods, meal_logs, nudges, push_tokens, questionnaire_data
│   ├── phase_2_3_migration.sql     # questionnaire_progress, recurring_transactions, access_role
│   ├── foods_seed.sql
│   ├── generate-nudge.ts
│   └── parse-meal-log.ts
└── supabase/
    └── functions/
        ├── generate-nudge/index.ts
        └── parse-meal-log/index.ts
```

### Key app components/features in `App.js`
- Questionnaire components: `TransitionCard`, `ProgressIndicator`, `QuestionText`, `ChipSelector`, `SliderInput`, `ConditionalInput`, `NavigationButtons`
- Core screens/tabs: Home, Finance, Wellness, Insights, Family, Settings
- Modals: AddTxModal, AddMealModal, AddGoalModal (unified personal+shared), DayDetailModal, UnifiedCalendarModal, comments, profile, recurring, shared-goal contributions
- Data refresh helpers and optimistic update patterns
- Role repair logic (`repairCreatorRoles()`) — runs on bootstrap + SIGNED_IN + family load
- Reusable `SelectField` dropdown component

---

## 6) DATABASE SCHEMA

### Core tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `families` | Family group | `id`, `name`, `invite_code` |
| `users` | User profiles | `id`, `family_id`, `name`, `email`, `dob`, `gender`, `language`, `questionnaire_completed`, `questionnaire_data`, `currency_preference`, `date_format`, `number_format`, `first_day_of_week`, `activity_visibility`, `pending_family_id`, `pending_member_id`, `pending_invite_code` |
| `family_members` | Membership + roles | `family_id`, `user_id`, `access_role` ('admin'/'member'), `name`, `role` (lifestyle label) |
| `transactions` | Finance entries | `family_id`, `user_id`, `amount`, `type`, `category`, `merchant`, `date`, `is_family_spending` |
| `meals` | Meal logs | `family_id`, `user_id`, `meal_type`, `food_items`, `date` |
| `wellness` | Water + screen-time | `family_id`, `user_id`, `date`, `water_ml`, `screen_time_minutes` |
| `goals` | Personal goals | `family_id`, `user_id`, `name`, `target_amount`, `current_amount`, `target_date`, `goal_type`, `is_shared`, `goal_scope` |
| `recurring_transactions` | Recurring reminders | `family_id`, `description`, `amount`, `frequency`, `next_due_date`, `is_active`, `last_created_date` |
| `nudges` | Generated nudge history | `user_id`, `domain`, `nudge_text`, `sent_at` |
| `push_tokens` | Expo push tokens | `user_id`, `token`, `platform` |
| `foods` | Nutrition reference | food + macro columns |
| `custom_categories` | Family-defined categories | `family_id`, `category_name`, `is_system`, `created_by` |
| `transaction_comments` | Collaboration comments | `family_id`, `transaction_id`, `user_id`, `comment_text` |
| `shared_goals` | Family shared goals | `family_id`, `goal_name`, `target_amount`, `current_amount`, `target_date`, `created_by` |
| `shared_goal_contributions` | Contribution ledger | `family_id`, `shared_goal_id`, `user_id`, `amount`, `note` |
| `activity_feed` | Family action timeline | `family_id`, `user_id`, `activity_type`, `activity_data`, `reference_id` |
| `questionnaire_progress` | Save/resume state | `user_id`, `current_page`, `answers_json` |

### Critical schema truths (users table)
- Column is `dob` (not `date_of_birth`)
- Column is `language` (not `language_preference` — note: profile save uses `language_preference` as variable but persists to `language`)
- Column is `questionnaire_completed` (not `onboarding_complete`)
- Column is `questionnaire_data` (not `questionnaire_answers`)

### RLS pattern
- Family-scoped tables: rows allowed where `auth.uid()` user belongs to same `family_id`
- User-scoped tables: `auth.uid() = user_id`
- `foods`: open SELECT for all authenticated users

### Key relationships
- `users.family_id → families.id`
- `family_members.family_id → families.id`
- `family_members.user_id → users.id` (nullable for pending invites)
- `transactions.family_id → families.id`
- `transaction_comments.transaction_id → transactions.id`
- `shared_goal_contributions.shared_goal_id → shared_goals.id`

---

## 7) KEY APP FLOWS

### Primary user flow
1. Sign up with email/password (optional invite code on signup form)
2. Complete 38-question questionnaire (7 pages, cannot skip)
3. If invite code used → family/member linking finalized after questionnaire
4. If no invite → Family setup screen (create family, add members, generate invite codes)
5. Land on Home tab → main app

### Invited member flow
1. Receive invite code from family admin
2. Open app → Sign Up → enter invite code
3. Code validity checked before account creation
4. Metadata stored: `pending_family_id`, `pending_member_id`, `pending_invite_code` on users
5. Complete questionnaire → family linked → land on Home

### Session
- Persistent until explicit logout
- `repairCreatorRoles()` runs silently on every session start

---

## 8) TRANSACTION CATEGORIES (Standardized in Phase 5)
- Daily Essentials
- House Bills
- Travel
- Health
- Lifestyle
- Savings

> Old/custom categories are auto-mapped via fallback in normalized transaction reads.
> Custom category creation is removed from UI — single-source set only.

---

## 9) QUESTIONNAIRE STRUCTURE (38 questions, 7 pages)

| Page | Title | Questions |
|------|-------|-----------|
| 1 | Who You Are | Q1–Q7 |
| 2 | Money Reality Part 1 | Q8–Q12 |
| 3 | Money Reality Part 2 | Q13–Q17 |
| 4 | Your Body Part 1 | Q18–Q22 |
| 5 | Your Body Part 2 | Q23–Q27 |
| 6 | Your Mind | Q28–Q34 |
| 7 | Your Commitment | Q35–Q38 |

Key conditional logic:
- Q6 `Kids` selected → child count required
- Q11 `Yes` loans → loan types required
- Q17 wording: "What's stopping you from achieving the goal? (optional)"
- Q21 `Yes` exercise → exercise types required
- Q26 `Yes` health conditions → condition list required
- Q35, Q36 updated in final rollout

On completion: age + BMI computed silently; fields written to `users` table; `questionnaire_data` updated; `questionnaire_progress` cleared; `questionnaire_completed = true`.

---

## 10) ROLE SYSTEM

| Role | `access_role` value | Display label |
|------|---------------------|---------------|
| Family creator | `'admin'` | Family Admin · [lifestyle role] |
| Invited member | `'member'` | Member · [lifestyle role] |

- Admin badge: 👑 Admin shown in Family cards and Settings member list
- `repairCreatorRoles()` auto-repairs any bad role data silently on session
- Invite flow explicitly sets `access_role = 'member'` to prevent accidental admin

---

## 11) KNOWN ISSUES & WATCH ITEMS

- `AppCore.js` is still large — progressive extraction recommended
- Service role key in `.env` needs hardening before public release
- Dependency audit warnings from npm ecosystem (non-blocking)
- Expo Go LAN testing from remote VM may fail — use local machine or tunnel
- Firebase dependency still present in `package.json` (legacy, not in active use)

---

## 12) NEXT STEPS / FUTURE ENHANCEMENTS

- APK generation via EAS build pipeline
  1. Freeze tested branch + tag release candidate
  2. Run full checklist + smoke tests
  3. Verify Supabase migration state in production project
  4. Build APK via EAS/local pipeline
  5. Closed beta with 2+ family scenarios
- Subscription/paywall implementation
- Deeper analytics and nudge evolution logic
- Offline/retry resilience + richer error UX
- Modular refactor of `AppCore.js` (extract tab/screen logic incrementally)
- SMS auto-capture for transactions
- Indian food database for nutrition lookup
- Dark mode

---

## 13) DEVELOPMENT WORKFLOW

### How changes are delivered
- SQL fixes → standalone `.sql` files
- Code changes → individual files (e.g., `App.js`)
- Full packages → zip only when explicitly requested

### Validation commands (run before any release)
```bash
npx expo-doctor          # Should pass 17/17
CI=1 npx expo export -p web   # Should export successfully
```

### Git workflow
```bash
git pull origin main
# make changes
git add .
git commit -m "Phase X: description"
git push origin main
```

### Fresh-start test procedure
1. Run `cleanup_all_data.sql` in Supabase SQL Editor
2. Delete all users in Supabase Auth UI (manual)
3. Restart app: `npm start`
4. Register fresh user
5. Complete onboarding and family setup
6. Run through `PHASE_5_TESTING_GUIDE.txt`

### Areas to always verify after changes
- Onboarding: no skip path, progress sticky, resume works
- Role correctness (Family Admin vs Member)
- Water/screen accumulation (per day/member, not overwrite)
- Date restrictions on daily logs (no future dates)
- Shared goal + contribution flows
- Activity feed population
- Category dropdowns
- Build smoke checks

---

## 14) MIGRATION HISTORY

| File | Phase | What it adds |
|------|-------|-------------|
| `intelligence_migration.sql` | Intelligence layer | `foods`, `meal_logs`, `nudges`, `push_tokens`, `questionnaire_data` |
| `phase_2_3_migration.sql` | Phase 2+3 | `questionnaire_progress`, `recurring_transactions`, `family_members.access_role`, user notification/questionnaire flags |
| `phase_4_migration.sql` | Phase 4 | `custom_categories`, `transaction_comments`, `shared_goals`, `shared_goal_contributions`, `activity_feed`, users profile/preference columns |
| `phase_5_migration.sql` | Phase 5 | pending invite columns on `users`, `is_family_spending` + recurring columns on `transactions`, `last_created_date` on `recurring_transactions`, goal typing columns on `goals`, category remap updates |
| `cleanup_all_data.sql` | Utility | Wipes all app data tables, preserves schema |

---

*This document consolidates all context from Phases 1–5 and all hotfixes. Add this file to the new project's knowledge base and link your local folder for seamless continuation.*
