-- ============================================================
-- WELLTHY FAM — Complete Schema Snapshot
-- ============================================================
-- Project: bvynbvaawbmsucgpmreq (ap-south-1)
-- Generated: 2026-05-15 via Supabase MCP introspection
-- Source-of-truth: live production DB
--
-- This file is a reference artifact, NOT a runnable migration.
-- It captures the current schema state for documentation and
-- diff-tracking purposes. Migrations remain in supabase/migrations/.
--
-- Generation strategy: MCP-side introspection against pg_catalog
-- and information_schema, because the Supabase CLI db-dump path
-- requires SUPABASE_DB_PASSWORD which isn't in the project .env.
-- 99% of content is byte-equivalent to pg_dump output; function
-- bodies and trigger definitions are quoted via the same
-- pg_get_functiondef / pg_get_triggerdef calls pg_dump uses.
--
-- Last schema-affecting migrations:
--   2026-05-08  Cleanup pass (11 migrations)
--   2026-05-09  Prompt 10: recurring_subscriptions
--   2026-05-10  Promises Phase A (skeleton, 4 tables)
--   2026-05-10  Promises Phase B (no schema changes)
--   2026-05-10  Promises Phase C+D (visibility RLS — later relaxed)
--   2026-05-10  promises_visibility_family_default
--   2026-05-10  promise_commitments_add_status
--   2026-05-10  promises_relax_rls_for_beta
--   2026-05-10  backfill_promise_commitments_user_id_from_family_members
--   2026-05-15  drop_unused_promises_visibility_helper
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"         WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm             WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net              WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto            WITH SCHEMA extensions;
-- pg_cron installed in pg_catalog (default), plpgsql in pg_catalog (built-in)
-- supabase_vault in vault schema (managed by Supabase)


-- ============================================================
-- TABLES (CREATE TABLE only — constraints and indexes follow)
-- ============================================================

CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  member_id text NOT NULL,
  member_name text,
  activity_type text NOT NULL,
  duration_minutes integer NOT NULL,
  note text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  activity_type text,
  activity_data jsonb,
  reference_id uuid
);

CREATE TABLE public.custom_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  category_name text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  domain text DEFAULT 'finance'::text,
  icon text
);

CREATE TABLE public.daily_score_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  member_id text NOT NULL,
  date date NOT NULL,
  action_type text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.families (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.family_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  invited_by uuid,
  invite_code text NOT NULL,
  invited_member_name text,
  invited_member_role text DEFAULT 'parent'::text,
  status text DEFAULT 'pending'::text,
  used_by uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + '7 days'::interval),
  used_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  invited_access_role text DEFAULT 'member'::text
);

CREATE TABLE public.family_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  name text,
  role text DEFAULT 'parent'::text,
  access_role text DEFAULT 'member'::text,
  invite_code text,
  invite_expires_at timestamptz,
  joined_at timestamptz,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.family_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  member_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  habit_type text,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  action_type text
);

CREATE TABLE public.food_vessels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dish_name text NOT NULL,
  dish_normalized text NOT NULL,
  default_vessel text NOT NULL,
  vessel_grams numeric(6,2) NOT NULL,
  protein_per_gram numeric(6,4) NOT NULL,
  carbs_per_gram numeric(6,4) NOT NULL,
  fat_per_gram numeric(6,4) NOT NULL,
  calories_per_gram numeric(6,2) NOT NULL,
  restaurant_fat_multiplier numeric(4,2) NOT NULL DEFAULT 1.30,
  category text,
  source text DEFAULT 'icmr'::text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_regional text,
  category text,
  serving_size_g numeric DEFAULT 100,
  serving_description text,
  calories_per_100g numeric DEFAULT 0,
  protein_per_100g numeric DEFAULT 0,
  carbs_per_100g numeric DEFAULT 0,
  fat_per_100g numeric DEFAULT 0,
  fiber_per_100g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  protein_g numeric(8,2),
  calories numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fiber_g numeric(8,2),
  serving_unit text,
  food_group text,
  is_indian boolean DEFAULT true
);

CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  target numeric NOT NULL DEFAULT 0,
  current numeric NOT NULL DEFAULT 0,
  category text DEFAULT 'Savings'::text,
  goal_type text NOT NULL DEFAULT 'personal'::text,
  is_shared boolean DEFAULT false,
  goal_scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  category_other text,
  target_date date
);

CREATE TABLE public.meals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  member_id text,
  member_name text,
  protein numeric DEFAULT 0,
  carbs numeric DEFAULT 0,
  fat numeric DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  meal_time text,
  items text,
  cal numeric DEFAULT 0,
  photo_path text,
  vessel_unit text,
  vessel_quantity numeric(5,2),
  cooking_style text,
  nutrition_source text,
  dish_breakdown jsonb
);

CREATE TABLE public.merchant_categories (
  family_id uuid NOT NULL,
  merchant_normalized text NOT NULL,
  category text NOT NULL,
  is_family_spending boolean NOT NULL DEFAULT true,
  confirmation_count integer NOT NULL DEFAULT 1,
  last_confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  family_id uuid,
  type text,
  message text,
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  nudge_text text,
  domain text DEFAULT 'general'::text,
  nudge_type text
);

CREATE TABLE public.promise_commitments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promise_id uuid NOT NULL,
  member_id uuid,
  user_id uuid,
  commitment_text text NOT NULL,
  commitment_type text NOT NULL DEFAULT 'custom'::text,
  commitment_target jsonb,
  joined_at timestamptz DEFAULT now(),
  manually_marked_done boolean NOT NULL DEFAULT false,
  manually_marked_done_at timestamptz,
  commitment_status text NOT NULL DEFAULT 'pending'::text
);

CREATE TABLE public.promise_progress_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  progress_value numeric,
  progress_target numeric,
  is_on_track boolean,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promise_reflections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promise_id uuid NOT NULL,
  user_id uuid NOT NULL,
  felt text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  visibility text NOT NULL DEFAULT 'family'::text,
  involves_minor boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  token text NOT NULL,
  platform text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.questionnaire_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  spending_regret text,
  financial_goals_1y text,
  financial_goals_5y text,
  spender_type text,
  money_stress text,
  protein_awareness text,
  screen_time_hours text,
  passions text,
  energy_level integer,
  savings_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.questionnaire_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_page integer DEFAULT 1,
  current_screen integer DEFAULT 0,
  answers jsonb,
  is_completed boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.recurring_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  family_id uuid,
  merchant_normalized text NOT NULL,
  display_name text NOT NULL,
  median_amount numeric(12,2) NOT NULL,
  amount_stddev numeric(12,2) NOT NULL DEFAULT 0,
  median_interval_days numeric(6,2) NOT NULL,
  interval_stddev_days numeric(6,2) NOT NULL DEFAULT 0,
  occurrence_count integer NOT NULL,
  first_seen_date date NOT NULL,
  last_seen_date date NOT NULL,
  next_expected_date date,
  category text,
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  user_status text NOT NULL DEFAULT 'auto'::text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recurring_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  transaction_type text DEFAULT 'expense'::text,
  description text NOT NULL,
  category text,
  amount numeric NOT NULL,
  frequency text DEFAULT 'monthly'::text,
  due_day integer DEFAULT 1,
  last_logged_date date,
  last_created_date date,
  next_due_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.shared_goal_contributions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  shared_goal_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  amount numeric NOT NULL,
  note text,
  contributed_at timestamptz DEFAULT now()
);

CREATE TABLE public.shared_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  created_by uuid,
  goal_name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  category text DEFAULT 'Savings'::text,
  description text,
  target_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  category_other text
);

CREATE TABLE public.statement_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  bank_name text,
  account_last4 text,
  period_start date,
  period_end date,
  total_credits numeric(14,2),
  total_debits numeric(14,2),
  source_file_path text,
  delete_after timestamptz NOT NULL DEFAULT (now() + '24:00:00'::interval),
  status text NOT NULL DEFAULT 'parsing'::text,
  parse_method text,
  failure_reason text,
  parsed_transaction_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz
);

CREATE TABLE public.statement_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  statement_import_id uuid NOT NULL,
  raw_narration text NOT NULL,
  parsed_date date,
  amount numeric(14,2) NOT NULL,
  transaction_type text NOT NULL,
  merchant_normalized text,
  category_suggested text,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.5,
  category_confirmed text,
  user_action text NOT NULL DEFAULT 'pending'::text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  member_id text NOT NULL,
  habit_type text NOT NULL,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  last_logged_date date
);

CREATE TABLE public.transaction_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  member_id text,
  member_name text,
  merchant text NOT NULL,
  amount numeric NOT NULL,
  category text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  confirmed boolean DEFAULT true,
  source text DEFAULT 'Manual'::text,
  is_family_spending boolean DEFAULT false,
  recurring_transaction_id uuid,
  photo_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  category_other text,
  note text,
  statement_import_id uuid,
  raw_narration text,
  merchant_normalized text,
  confidence_score numeric(3,2)
);

CREATE TABLE public.user_dish_portions (
  user_id uuid NOT NULL,
  dish_normalized text NOT NULL,
  last_quantity numeric(5,2) NOT NULL DEFAULT 1,
  last_unit text NOT NULL DEFAULT 'katori'::text,
  last_cooking_style text NOT NULL DEFAULT 'home'::text,
  log_count integer NOT NULL DEFAULT 1,
  last_logged_at timestamptz DEFAULT now()
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  auth_user_id uuid,
  user_type text NOT NULL DEFAULT 'primary'::text,
  name text,
  email text,
  phone text,
  dob date,
  gender text,
  height numeric,
  height_unit text DEFAULT 'cm'::text,
  weight numeric,
  weight_unit text DEFAULT 'kg'::text,
  location text,
  occupation text,
  language text DEFAULT 'english'::text,
  family_id uuid,
  questionnaire_completed boolean DEFAULT false,
  questionnaire_data jsonb,
  questionnaire_last_step integer DEFAULT 0,
  questionnaire_pending boolean DEFAULT false,
  notification_enabled boolean DEFAULT true,
  pending_invite_code text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  email_verified boolean DEFAULT false,
  water_tracking_enabled boolean NOT NULL DEFAULT false,
  currency_preference text DEFAULT 'INR'::text,
  date_format text DEFAULT 'DD/MM/YYYY'::text,
  number_format text DEFAULT 'Indian'::text,
  first_day_of_week text DEFAULT 'Monday'::text,
  activity_visibility text DEFAULT 'family'::text,
  pending_family_id uuid,
  pending_member_id uuid,
  water_target_litres numeric(4,2) NOT NULL DEFAULT 2.5,
  theme_preference text NOT NULL DEFAULT 'light'::text,
  screen_target_hours numeric DEFAULT 2,
  silent_hours_enabled boolean NOT NULL DEFAULT true,
  silent_hours_start time without time zone NOT NULL DEFAULT '22:00:00'::time,
  silent_hours_end time without time zone NOT NULL DEFAULT '08:00:00'::time
);

CREATE TABLE public.wellness (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  member_id text,
  member_name text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours numeric,
  weight numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  water numeric DEFAULT 0,
  screen_hrs numeric,
  water_target_met boolean,
  water_target_litres numeric(5,2),
  screen_under_limit boolean
);


-- ============================================================
-- PRIMARY KEYS
-- ============================================================

ALTER TABLE public.activities                  ADD CONSTRAINT activities_pkey                  PRIMARY KEY (id);
ALTER TABLE public.activity_feed               ADD CONSTRAINT activity_feed_pkey               PRIMARY KEY (id);
ALTER TABLE public.custom_categories           ADD CONSTRAINT custom_categories_pkey           PRIMARY KEY (id);
ALTER TABLE public.daily_score_events          ADD CONSTRAINT daily_score_events_pkey          PRIMARY KEY (id);
ALTER TABLE public.families                    ADD CONSTRAINT families_pkey                    PRIMARY KEY (id);
ALTER TABLE public.family_invites              ADD CONSTRAINT family_invites_pkey              PRIMARY KEY (id);
ALTER TABLE public.family_members              ADD CONSTRAINT family_members_pkey              PRIMARY KEY (id);
ALTER TABLE public.family_scores               ADD CONSTRAINT family_scores_pkey               PRIMARY KEY (id);
ALTER TABLE public.food_vessels                ADD CONSTRAINT food_vessels_pkey                PRIMARY KEY (id);
ALTER TABLE public.foods                       ADD CONSTRAINT foods_pkey                       PRIMARY KEY (id);
ALTER TABLE public.goals                       ADD CONSTRAINT goals_pkey                       PRIMARY KEY (id);
ALTER TABLE public.meals                       ADD CONSTRAINT meals_pkey                       PRIMARY KEY (id);
ALTER TABLE public.merchant_categories         ADD CONSTRAINT merchant_categories_pkey         PRIMARY KEY (family_id, merchant_normalized);
ALTER TABLE public.nudges                      ADD CONSTRAINT nudges_pkey                      PRIMARY KEY (id);
ALTER TABLE public.promise_commitments         ADD CONSTRAINT promise_commitments_pkey         PRIMARY KEY (id);
ALTER TABLE public.promise_progress_snapshots  ADD CONSTRAINT promise_progress_snapshots_pkey  PRIMARY KEY (id);
ALTER TABLE public.promise_reflections         ADD CONSTRAINT promise_reflections_pkey         PRIMARY KEY (id);
ALTER TABLE public.promises                    ADD CONSTRAINT promises_pkey                    PRIMARY KEY (id);
ALTER TABLE public.push_tokens                 ADD CONSTRAINT push_tokens_pkey                 PRIMARY KEY (id);
ALTER TABLE public.questionnaire_answers       ADD CONSTRAINT questionnaire_answers_pkey       PRIMARY KEY (id);
ALTER TABLE public.questionnaire_progress      ADD CONSTRAINT questionnaire_progress_pkey      PRIMARY KEY (id);
ALTER TABLE public.recurring_subscriptions     ADD CONSTRAINT recurring_subscriptions_pkey     PRIMARY KEY (id);
ALTER TABLE public.recurring_transactions      ADD CONSTRAINT recurring_transactions_pkey      PRIMARY KEY (id);
ALTER TABLE public.shared_goal_contributions   ADD CONSTRAINT shared_goal_contributions_pkey   PRIMARY KEY (id);
ALTER TABLE public.shared_goals                ADD CONSTRAINT shared_goals_pkey                PRIMARY KEY (id);
ALTER TABLE public.statement_imports           ADD CONSTRAINT statement_imports_pkey           PRIMARY KEY (id);
ALTER TABLE public.statement_transactions      ADD CONSTRAINT statement_transactions_pkey      PRIMARY KEY (id);
ALTER TABLE public.streaks                     ADD CONSTRAINT streaks_pkey                     PRIMARY KEY (id);
ALTER TABLE public.transaction_comments        ADD CONSTRAINT transaction_comments_pkey        PRIMARY KEY (id);
ALTER TABLE public.transactions                ADD CONSTRAINT transactions_pkey                PRIMARY KEY (id);
ALTER TABLE public.user_dish_portions          ADD CONSTRAINT user_dish_portions_pkey          PRIMARY KEY (user_id, dish_normalized);
ALTER TABLE public.users                       ADD CONSTRAINT users_pkey                       PRIMARY KEY (id);
ALTER TABLE public.wellness                    ADD CONSTRAINT wellness_pkey                    PRIMARY KEY (id);


-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

ALTER TABLE public.custom_categories        ADD CONSTRAINT custom_categories_family_id_category_name_key                    UNIQUE (family_id, category_name);
ALTER TABLE public.daily_score_events       ADD CONSTRAINT daily_score_events_family_id_member_id_date_action_type_key     UNIQUE (family_id, member_id, date, action_type);
ALTER TABLE public.family_invites           ADD CONSTRAINT family_invites_invite_code_key                                   UNIQUE (invite_code);
ALTER TABLE public.food_vessels             ADD CONSTRAINT food_vessels_dish_normalized_key                                 UNIQUE (dish_normalized);
ALTER TABLE public.promise_progress_snapshots ADD CONSTRAINT promise_progress_snapshots_commitment_id_snapshot_date_key    UNIQUE (commitment_id, snapshot_date);
ALTER TABLE public.promise_reflections      ADD CONSTRAINT promise_reflections_promise_id_user_id_key                       UNIQUE (promise_id, user_id);
ALTER TABLE public.push_tokens              ADD CONSTRAINT push_tokens_token_key                                            UNIQUE (token);
ALTER TABLE public.questionnaire_answers    ADD CONSTRAINT questionnaire_answers_user_id_key                                UNIQUE (user_id);
ALTER TABLE public.questionnaire_progress   ADD CONSTRAINT questionnaire_progress_user_id_key                               UNIQUE (user_id);
ALTER TABLE public.recurring_subscriptions  ADD CONSTRAINT recurring_subscriptions_user_id_merchant_normalized_key          UNIQUE (user_id, merchant_normalized);
ALTER TABLE public.streaks                  ADD CONSTRAINT streaks_family_id_member_id_habit_type_key                       UNIQUE (family_id, member_id, habit_type);
ALTER TABLE public.users                    ADD CONSTRAINT users_auth_user_id_key                                           UNIQUE (auth_user_id);
ALTER TABLE public.wellness                 ADD CONSTRAINT wellness_family_id_member_id_date_key                            UNIQUE (family_id, member_id, date);


-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE public.activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY['walk','workout','sport','yoga','run','cycle','swim','other']));
ALTER TABLE public.activities ADD CONSTRAINT activities_duration_check
  CHECK (duration_minutes > 0 AND duration_minutes <= 1440);
ALTER TABLE public.activities ADD CONSTRAINT activities_source_check
  CHECK (source = ANY (ARRAY['manual','auto_health_kit','auto_google_fit']));

ALTER TABLE public.family_invites ADD CONSTRAINT family_invites_invited_access_role_check
  CHECK (invited_access_role = ANY (ARRAY['co_admin','member']));

ALTER TABLE public.food_vessels ADD CONSTRAINT food_vessels_default_vessel_check
  CHECK (default_vessel = ANY (ARRAY['katori','plate','piece','glass','spoon']));

ALTER TABLE public.goals ADD CONSTRAINT goals_goal_type_check
  CHECK (goal_type = ANY (ARRAY['personal','shared']));

ALTER TABLE public.meals ADD CONSTRAINT meals_cooking_style_check
  CHECK (cooking_style IS NULL OR cooking_style = ANY (ARRAY['home','restaurant']));
ALTER TABLE public.meals ADD CONSTRAINT meals_nutrition_source_check
  CHECK (nutrition_source IS NULL OR nutrition_source = ANY (ARRAY['curated','ai_estimate']));

ALTER TABLE public.nudges ADD CONSTRAINT nudges_nudge_type_check
  CHECK (nudge_type IS NULL OR nudge_type = ANY (ARRAY['pattern','cross_domain','aspirational']));

ALTER TABLE public.promise_commitments ADD CONSTRAINT chk_commitments_text_len
  CHECK (char_length(commitment_text) BETWEEN 4 AND 240);
ALTER TABLE public.promise_commitments ADD CONSTRAINT promise_commitments_commitment_status_check
  CHECK (commitment_status = ANY (ARRAY['pending','confirmed','declined']));
ALTER TABLE public.promise_commitments ADD CONSTRAINT promise_commitments_commitment_type_check
  CHECK (commitment_type = ANY (ARRAY['meal_log_days','screen_under_target','contribution_amount','family_score_pct','custom']));

ALTER TABLE public.promise_reflections ADD CONSTRAINT chk_reflection_note_len
  CHECK (note IS NULL OR char_length(note) <= 280);
ALTER TABLE public.promise_reflections ADD CONSTRAINT promise_reflections_felt_check
  CHECK (felt = ANY (ARRAY['good','mixed','not_great']));

ALTER TABLE public.promises ADD CONSTRAINT chk_promises_dates
  CHECK (end_date >= start_date);
ALTER TABLE public.promises ADD CONSTRAINT chk_promises_title_len
  CHECK (char_length(title) BETWEEN 1 AND 80);
ALTER TABLE public.promises ADD CONSTRAINT chk_promises_window
  CHECK ((end_date - start_date) <= 90);
ALTER TABLE public.promises ADD CONSTRAINT promises_status_check
  CHECK (status = ANY (ARRAY['active','complete','paused','wound_down','cancelled']));
ALTER TABLE public.promises ADD CONSTRAINT promises_visibility_check
  CHECK (visibility = ANY (ARRAY['participants_only','participants_plus_admin','family']));

ALTER TABLE public.recurring_subscriptions ADD CONSTRAINT recurring_subscriptions_user_status_check
  CHECK (user_status = ANY (ARRAY['auto','confirmed','dismissed']));

ALTER TABLE public.recurring_transactions ADD CONSTRAINT recurring_transactions_frequency_check
  CHECK (frequency = ANY (ARRAY['daily','weekly','biweekly','monthly','yearly']));

ALTER TABLE public.statement_imports ADD CONSTRAINT statement_imports_document_type_check
  CHECK (document_type = ANY (ARRAY['bank_account','credit_card']));
ALTER TABLE public.statement_imports ADD CONSTRAINT statement_imports_status_check
  CHECK (status = ANY (ARRAY['parsing','review','imported','failed','expired']));

ALTER TABLE public.statement_transactions ADD CONSTRAINT statement_transactions_confidence_score_check
  CHECK (confidence_score >= 0 AND confidence_score <= 1);
ALTER TABLE public.statement_transactions ADD CONSTRAINT statement_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY['debit','credit']));
ALTER TABLE public.statement_transactions ADD CONSTRAINT statement_transactions_user_action_check
  CHECK (user_action = ANY (ARRAY['pending','confirmed','discarded','imported']));

ALTER TABLE public.user_dish_portions ADD CONSTRAINT user_dish_portions_last_cooking_style_check
  CHECK (last_cooking_style = ANY (ARRAY['home','restaurant']));

ALTER TABLE public.wellness ADD CONSTRAINT wellness_sleep_hours_check
  CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24));


-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE public.activities                ADD CONSTRAINT activities_family_id_fkey                 FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.activities                ADD CONSTRAINT activities_user_id_fkey                   FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.activity_feed             ADD CONSTRAINT activity_feed_family_id_fkey              FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.activity_feed             ADD CONSTRAINT activity_feed_user_id_fkey                FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.custom_categories         ADD CONSTRAINT custom_categories_created_by_fkey         FOREIGN KEY (created_by)           REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.custom_categories         ADD CONSTRAINT custom_categories_family_id_fkey          FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.daily_score_events        ADD CONSTRAINT daily_score_events_family_id_fkey         FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.families                  ADD CONSTRAINT families_created_by_fkey                  FOREIGN KEY (created_by)           REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.family_invites            ADD CONSTRAINT family_invites_family_id_fkey             FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.family_invites            ADD CONSTRAINT family_invites_invited_by_fkey            FOREIGN KEY (invited_by)           REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.family_invites            ADD CONSTRAINT family_invites_used_by_fkey               FOREIGN KEY (used_by)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.family_members            ADD CONSTRAINT family_members_family_id_fkey             FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.family_members            ADD CONSTRAINT family_members_user_id_fkey               FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.family_scores             ADD CONSTRAINT family_scores_family_id_fkey              FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.goals                     ADD CONSTRAINT goals_family_id_fkey                      FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.goals                     ADD CONSTRAINT goals_user_id_fkey                        FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.meals                     ADD CONSTRAINT meals_family_id_fkey                      FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.meals                     ADD CONSTRAINT meals_user_id_fkey                        FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.merchant_categories       ADD CONSTRAINT merchant_categories_family_id_fkey        FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.nudges                    ADD CONSTRAINT nudges_family_id_fkey                     FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.nudges                    ADD CONSTRAINT nudges_user_id_fkey                       FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.promise_commitments       ADD CONSTRAINT promise_commitments_member_id_fkey        FOREIGN KEY (member_id)            REFERENCES public.family_members(id)            ON DELETE SET NULL;
ALTER TABLE public.promise_commitments       ADD CONSTRAINT promise_commitments_promise_id_fkey       FOREIGN KEY (promise_id)           REFERENCES public.promises(id)                  ON DELETE CASCADE;
ALTER TABLE public.promise_commitments       ADD CONSTRAINT promise_commitments_user_id_fkey          FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.promise_progress_snapshots ADD CONSTRAINT promise_progress_snapshots_commitment_id_fkey FOREIGN KEY (commitment_id)   REFERENCES public.promise_commitments(id)       ON DELETE CASCADE;
ALTER TABLE public.promise_reflections       ADD CONSTRAINT promise_reflections_promise_id_fkey       FOREIGN KEY (promise_id)           REFERENCES public.promises(id)                  ON DELETE CASCADE;
ALTER TABLE public.promise_reflections       ADD CONSTRAINT promise_reflections_user_id_fkey          FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.promises                  ADD CONSTRAINT promises_created_by_fkey                  FOREIGN KEY (created_by)           REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.promises                  ADD CONSTRAINT promises_family_id_fkey                   FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.push_tokens               ADD CONSTRAINT push_tokens_user_id_fkey                  FOREIGN KEY (user_id)              REFERENCES auth.users(id)                       ON DELETE CASCADE;
ALTER TABLE public.questionnaire_answers     ADD CONSTRAINT questionnaire_answers_user_id_fkey        FOREIGN KEY (user_id)              REFERENCES auth.users(id)                       ON DELETE CASCADE;
ALTER TABLE public.questionnaire_progress    ADD CONSTRAINT questionnaire_progress_user_id_fkey       FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.recurring_subscriptions   ADD CONSTRAINT recurring_subscriptions_family_id_fkey    FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.recurring_subscriptions   ADD CONSTRAINT recurring_subscriptions_user_id_fkey      FOREIGN KEY (user_id)              REFERENCES auth.users(id)                       ON DELETE CASCADE;
ALTER TABLE public.recurring_transactions    ADD CONSTRAINT recurring_transactions_family_id_fkey     FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.recurring_transactions    ADD CONSTRAINT recurring_transactions_user_id_fkey       FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.shared_goal_contributions ADD CONSTRAINT shared_goal_contributions_family_id_fkey       FOREIGN KEY (family_id)        REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.shared_goal_contributions ADD CONSTRAINT shared_goal_contributions_shared_goal_id_fkey  FOREIGN KEY (shared_goal_id)   REFERENCES public.shared_goals(id)              ON DELETE CASCADE;
ALTER TABLE public.shared_goal_contributions ADD CONSTRAINT shared_goal_contributions_user_id_fkey         FOREIGN KEY (user_id)          REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.shared_goals              ADD CONSTRAINT shared_goals_created_by_fkey              FOREIGN KEY (created_by)           REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.shared_goals              ADD CONSTRAINT shared_goals_family_id_fkey               FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.statement_imports         ADD CONSTRAINT statement_imports_family_id_fkey          FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.statement_imports         ADD CONSTRAINT statement_imports_user_id_fkey            FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.statement_transactions    ADD CONSTRAINT statement_transactions_statement_import_id_fkey FOREIGN KEY (statement_import_id) REFERENCES public.statement_imports(id)     ON DELETE CASCADE;
ALTER TABLE public.streaks                   ADD CONSTRAINT streaks_family_id_fkey                    FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.transaction_comments      ADD CONSTRAINT transaction_comments_family_id_fkey       FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.transaction_comments      ADD CONSTRAINT transaction_comments_transaction_id_fkey  FOREIGN KEY (transaction_id)       REFERENCES public.transactions(id)              ON DELETE CASCADE;
ALTER TABLE public.transaction_comments      ADD CONSTRAINT transaction_comments_user_id_fkey         FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.transactions              ADD CONSTRAINT transactions_family_id_fkey               FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.transactions              ADD CONSTRAINT transactions_recurring_transaction_id_fkey FOREIGN KEY (recurring_transaction_id) REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;
ALTER TABLE public.transactions              ADD CONSTRAINT transactions_statement_import_id_fkey     FOREIGN KEY (statement_import_id)  REFERENCES public.statement_imports(id)         ON DELETE SET NULL;
ALTER TABLE public.transactions              ADD CONSTRAINT transactions_user_id_fkey                 FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;
ALTER TABLE public.user_dish_portions        ADD CONSTRAINT user_dish_portions_user_id_fkey           FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE CASCADE;
ALTER TABLE public.users                     ADD CONSTRAINT users_id_fkey                             FOREIGN KEY (id)                   REFERENCES auth.users(id)                       ON DELETE CASCADE;
ALTER TABLE public.users                     ADD CONSTRAINT fk_users_family                           FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE SET NULL;
ALTER TABLE public.wellness                  ADD CONSTRAINT wellness_family_id_fkey                   FOREIGN KEY (family_id)            REFERENCES public.families(id)                  ON DELETE CASCADE;
ALTER TABLE public.wellness                  ADD CONSTRAINT wellness_user_id_fkey                     FOREIGN KEY (user_id)              REFERENCES public.users(id)                     ON DELETE SET NULL;


-- ============================================================
-- INDEXES (non-constraint)
-- ============================================================

-- activities
CREATE INDEX activities_family_date_idx           ON public.activities (family_id, date DESC);
CREATE INDEX activities_member_date_idx           ON public.activities (family_id, member_id, date DESC);

-- activity_feed
CREATE INDEX idx_activity_family_date             ON public.activity_feed (family_id, created_at DESC);
CREATE INDEX idx_activity_feed_family_id          ON public.activity_feed (family_id);

-- custom_categories
CREATE INDEX idx_custom_categories_family         ON public.custom_categories (family_id);

-- daily_score_events
CREATE INDEX idx_dse_family_date                  ON public.daily_score_events (family_id, date);
CREATE INDEX idx_dse_member_date                  ON public.daily_score_events (member_id, date);

-- family_invites
CREATE UNIQUE INDEX family_invites_code_unique    ON public.family_invites (invite_code);
CREATE INDEX idx_family_invites_code              ON public.family_invites (invite_code);
CREATE INDEX idx_family_invites_family            ON public.family_invites (family_id);
CREATE INDEX idx_family_invites_status            ON public.family_invites (status);

-- family_members
CREATE INDEX idx_family_members_family_id         ON public.family_members (family_id);
CREATE INDEX idx_family_members_user_id           ON public.family_members (user_id);

-- family_scores
CREATE INDEX idx_family_scores_date               ON public.family_scores (date);
CREATE INDEX idx_family_scores_family_id          ON public.family_scores (family_id);

-- food_vessels
CREATE INDEX idx_food_vessels_category            ON public.food_vessels (category);
CREATE INDEX idx_food_vessels_normalized          ON public.food_vessels (dish_normalized);

-- foods (includes pg_trgm GIN indexes for fuzzy search)
CREATE INDEX foods_category                       ON public.foods (category);
CREATE INDEX foods_name                           ON public.foods (name);
CREATE INDEX foods_name_trgm                      ON public.foods USING gin (name extensions.gin_trgm_ops);
CREATE UNIQUE INDEX foods_name_unique             ON public.foods (lower(name));
CREATE INDEX foods_regional_trgm                  ON public.foods USING gin (name_regional extensions.gin_trgm_ops);
CREATE INDEX idx_foods_category                   ON public.foods (category);
CREATE INDEX idx_foods_name                       ON public.foods (name);
CREATE INDEX idx_foods_protein                    ON public.foods (protein_g DESC);

-- goals
CREATE INDEX idx_goals_family                     ON public.goals (family_id);
CREATE INDEX idx_goals_family_id                  ON public.goals (family_id);

-- meals
CREATE INDEX idx_meals_date                       ON public.meals (date);
CREATE INDEX idx_meals_family_date                ON public.meals (family_id, date DESC);
CREATE INDEX idx_meals_family_id                  ON public.meals (family_id);
CREATE INDEX idx_meals_member                     ON public.meals (family_id, member_id);

-- merchant_categories
CREATE INDEX idx_merchant_categories_family       ON public.merchant_categories (family_id);

-- nudges
CREATE INDEX idx_nudges_user_id                   ON public.nudges (user_id);

-- promise_commitments
CREATE UNIQUE INDEX idx_pc_active_member_per_promise ON public.promise_commitments (promise_id, member_id) WHERE (member_id IS NOT NULL);
CREATE INDEX idx_pc_member                        ON public.promise_commitments (member_id) WHERE (member_id IS NOT NULL);
CREATE INDEX idx_pc_promise                       ON public.promise_commitments (promise_id);
CREATE INDEX idx_pc_user                          ON public.promise_commitments (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_pc_user_pending                  ON public.promise_commitments (user_id, promise_id) WHERE (commitment_status = 'pending'::text AND user_id IS NOT NULL);

-- promise_progress_snapshots
CREATE INDEX idx_pps_commitment_date              ON public.promise_progress_snapshots (commitment_id, snapshot_date DESC);

-- promise_reflections
CREATE INDEX idx_pr_promise                       ON public.promise_reflections (promise_id);

-- promises
CREATE INDEX idx_promises_family_active           ON public.promises (family_id) WHERE (status = 'active'::text);
CREATE INDEX idx_promises_family_status           ON public.promises (family_id, status, end_date DESC);

-- recurring_subscriptions
CREATE INDEX idx_recurring_subs_family            ON public.recurring_subscriptions (family_id) WHERE (family_id IS NOT NULL);
CREATE INDEX idx_recurring_subs_user              ON public.recurring_subscriptions (user_id, user_status);
CREATE INDEX idx_recurring_subs_user_confidence   ON public.recurring_subscriptions (user_id, confidence DESC) WHERE (user_status <> 'dismissed'::text);

-- shared_goal_contributions
CREATE INDEX idx_sgc_family                       ON public.shared_goal_contributions (family_id);
CREATE INDEX idx_sgc_goal                         ON public.shared_goal_contributions (shared_goal_id);

-- shared_goals
CREATE INDEX idx_shared_goals_family_id           ON public.shared_goals (family_id);

-- statement_imports
CREATE INDEX idx_statement_imports_delete_after   ON public.statement_imports (delete_after);
CREATE INDEX idx_statement_imports_status         ON public.statement_imports (status);
CREATE INDEX idx_statement_imports_user           ON public.statement_imports (user_id);

-- statement_transactions
CREATE INDEX idx_st_tx_import                     ON public.statement_transactions (statement_import_id);
CREATE INDEX idx_st_tx_user_action                ON public.statement_transactions (user_action);

-- streaks
CREATE INDEX idx_streaks_family_member            ON public.streaks (family_id, member_id);

-- transaction_comments
CREATE INDEX idx_tx_comments_family               ON public.transaction_comments (family_id);
CREATE INDEX idx_tx_comments_tx_id                ON public.transaction_comments (transaction_id);

-- transactions
CREATE INDEX idx_transactions_date                ON public.transactions (date);
CREATE INDEX idx_transactions_family_date         ON public.transactions (family_id, date DESC);
CREATE INDEX idx_transactions_family_id           ON public.transactions (family_id);
CREATE INDEX idx_transactions_member              ON public.transactions (family_id, member_id);
CREATE INDEX idx_transactions_recurring           ON public.transactions (recurring_transaction_id);
CREATE INDEX idx_transactions_statement_import    ON public.transactions (statement_import_id);
CREATE INDEX idx_transactions_user                ON public.transactions (user_id, date DESC);

-- user_dish_portions
CREATE INDEX idx_user_dish_portions_user          ON public.user_dish_portions (user_id);

-- users
CREATE INDEX idx_users_auth_user_id               ON public.users (auth_user_id);
CREATE INDEX idx_users_email                      ON public.users (email);
CREATE INDEX idx_users_family                     ON public.users (family_id);
CREATE INDEX idx_users_family_id                  ON public.users (family_id);

-- wellness
CREATE INDEX idx_wellness_family_date             ON public.wellness (family_id, date DESC);


-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.activities_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT family_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_top_dishes(p_user_id uuid, p_limit integer DEFAULT 4)
RETURNS TABLE(dish_normalized text, dish_name text, log_count integer, last_quantity numeric, last_unit text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    udp.dish_normalized,
    COALESCE(fv.dish_name, INITCAP(REPLACE(udp.dish_normalized, '_', ' '))) AS dish_name,
    udp.log_count,
    udp.last_quantity,
    udp.last_unit
  FROM public.user_dish_portions udp
  LEFT JOIN public.food_vessels fv ON fv.dish_normalized = udp.dish_normalized
  WHERE udp.user_id = p_user_id
  ORDER BY udp.log_count DESC, udp.last_logged_at DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.handle_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.users
    SET email_verified = TRUE
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_dish_portion(p_user_id uuid, p_dish_normalized text, p_quantity numeric, p_unit text, p_cooking_style text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.user_dish_portions (
    user_id, dish_normalized, last_quantity, last_unit, last_cooking_style,
    last_logged_at, log_count
  )
  VALUES (
    p_user_id, p_dish_normalized, p_quantity, p_unit,
    COALESCE(p_cooking_style, 'home'), now(), 1
  )
  ON CONFLICT (user_id, dish_normalized) DO UPDATE SET
    last_quantity = EXCLUDED.last_quantity,
    last_unit = EXCLUDED.last_unit,
    last_cooking_style = EXCLUDED.last_cooking_style,
    last_logged_at = EXCLUDED.last_logged_at,
    log_count = public.user_dish_portions.log_count + 1;
$$;

-- Note: public.is_promise_visible(uuid) existed briefly during Phase C
-- visibility-RLS attempt on 2026-05-10. Dropped 2026-05-15 in
-- drop_unused_promises_visibility_helper migration. Not included.


-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER activities_updated_at_trigger
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_set_updated_at();

CREATE TRIGGER trg_promises_updated_at
  BEFORE UPDATE ON public.promises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER trg_recurring_subs_updated_at
  BEFORE UPDATE ON public.recurring_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();


-- ============================================================
-- ROW LEVEL SECURITY — enable on all public tables
-- ============================================================

ALTER TABLE public.activities                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_score_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_scores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_vessels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_commitments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_progress_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_reflections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promises                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_goal_contributions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_goals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_imports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dish_portions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness                    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================
-- Most tables follow the "family-scoped" pattern: policies check
-- EXISTS in public.users where auth.uid() matches and family_id
-- matches the row's family_id. Read-public tables (foods,
-- food_vessels) are open to authenticated users.
--
-- A few tables (push_tokens, questionnaire_*, user_dish_portions,
-- statement_imports, statement_transactions, recurring_subscriptions)
-- are user-scoped — auth.uid() = user_id directly.
--
-- Many tables have TWO selects: one via public.users join, one via
-- get_my_family_id() helper. Legacy duplication from older migrations.
-- ============================================================

-- activities
CREATE POLICY activities_select_family ON public.activities FOR SELECT
  USING (family_id IN (SELECT users.family_id FROM users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY activities_insert_family ON public.activities FOR INSERT
  WITH CHECK (family_id IN (SELECT users.family_id FROM users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY activities_update_family ON public.activities FOR UPDATE
  USING (family_id IN (SELECT users.family_id FROM users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY activities_delete_family ON public.activities FOR DELETE
  USING (family_id IN (SELECT users.family_id FROM users WHERE users.auth_user_id = auth.uid()));

-- activity_feed
CREATE POLICY activity_family_select ON public.activity_feed FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = activity_feed.family_id));
CREATE POLICY activity_feed_select ON public.activity_feed FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY activity_feed_insert ON public.activity_feed FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY activity_family_write ON public.activity_feed FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = activity_feed.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = activity_feed.family_id));

-- custom_categories
CREATE POLICY cc_family_select ON public.custom_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = custom_categories.family_id));
CREATE POLICY custom_cat_select ON public.custom_categories FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY custom_cat_insert ON public.custom_categories FOR INSERT
  WITH CHECK (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY custom_cat_delete ON public.custom_categories FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY cc_family_write ON public.custom_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = custom_categories.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = custom_categories.family_id));

-- daily_score_events
CREATE POLICY dse_family_select ON public.daily_score_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = daily_score_events.family_id));
CREATE POLICY dse_family_write ON public.daily_score_events FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = daily_score_events.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = daily_score_events.family_id));

-- families
CREATE POLICY families_select ON public.families FOR SELECT
  USING (created_by = auth.uid() OR id = get_my_family_id() OR id IN (SELECT family_id FROM family_invites WHERE status = 'pending'));
CREATE POLICY families_insert ON public.families FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY families_update ON public.families FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY families_delete ON public.families FOR DELETE
  USING (created_by = auth.uid());

-- family_invites
CREATE POLICY family_invites_authed_select ON public.family_invites FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY family_invites_member_select ON public.family_invites FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = family_invites.family_id));
CREATE POLICY family_invites_pending_lookup ON public.family_invites FOR SELECT
  USING (status = 'pending' AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY family_invites_insert ON public.family_invites FOR INSERT
  WITH CHECK (invited_by = auth.uid());
CREATE POLICY family_invites_update ON public.family_invites FOR UPDATE
  USING (invited_by = auth.uid() OR family_id = get_my_family_id());
CREATE POLICY family_invites_family_write ON public.family_invites FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = family_invites.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = family_invites.family_id));

-- family_members
CREATE POLICY family_members_select ON public.family_members FOR SELECT
  USING (user_id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY family_members_insert ON public.family_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR family_id IN (SELECT id FROM families WHERE created_by = auth.uid()));
CREATE POLICY family_members_update ON public.family_members FOR UPDATE
  USING (user_id = auth.uid() OR family_id IN (SELECT id FROM families WHERE created_by = auth.uid()));
CREATE POLICY family_members_delete ON public.family_members FOR DELETE
  USING (family_id IN (SELECT id FROM families WHERE created_by = auth.uid()));

-- family_scores
CREATE POLICY fscores_select ON public.family_scores FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY fscores_insert ON public.family_scores FOR INSERT
  WITH CHECK (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());

-- food_vessels (read-only for all authenticated users)
CREATE POLICY food_vessels_read_authenticated ON public.food_vessels FOR SELECT
  USING (true);

-- foods (read-only for all authenticated users; two policies — legacy)
CREATE POLICY foods_open_select ON public.foods FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY foods_read_all ON public.foods FOR SELECT
  USING (true);

-- goals
CREATE POLICY goals_select ON public.goals FOR SELECT
  USING (user_id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY goals_family_select ON public.goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = goals.family_id));
CREATE POLICY goals_insert ON public.goals FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY goals_update ON public.goals FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY goals_delete ON public.goals FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY goals_family_write ON public.goals FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = goals.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = goals.family_id));

-- meals
CREATE POLICY meals_family_select ON public.meals FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = meals.family_id));
CREATE POLICY meals_family_write ON public.meals FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = meals.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = meals.family_id));

-- merchant_categories
CREATE POLICY merchant_cat_family_select ON public.merchant_categories FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY merchant_cat_family_insert ON public.merchant_categories FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY merchant_cat_family_update ON public.merchant_categories FOR UPDATE
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- nudges (user-scoped)
CREATE POLICY nudges_select ON public.nudges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY nudges_insert ON public.nudges FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY nudges_update ON public.nudges FOR UPDATE USING (user_id = auth.uid());

-- promise_commitments (family-scoped via parent promise)
CREATE POLICY pc_family_select ON public.promise_commitments FOR SELECT
  USING (EXISTS (SELECT 1 FROM promises p JOIN users u ON u.family_id = p.family_id WHERE p.id = promise_commitments.promise_id AND u.id = auth.uid()));
CREATE POLICY pc_family_write ON public.promise_commitments FOR ALL
  USING (EXISTS (SELECT 1 FROM promises p JOIN users u ON u.family_id = p.family_id WHERE p.id = promise_commitments.promise_id AND u.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM promises p JOIN users u ON u.family_id = p.family_id WHERE p.id = promise_commitments.promise_id AND u.id = auth.uid()));

-- promise_progress_snapshots (family-scoped via 2-table join)
CREATE POLICY pps_family_select ON public.promise_progress_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM promise_commitments pc JOIN promises p ON p.id = pc.promise_id JOIN users u ON u.family_id = p.family_id WHERE pc.id = promise_progress_snapshots.commitment_id AND u.id = auth.uid()));
CREATE POLICY pps_family_insert ON public.promise_progress_snapshots FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM promise_commitments pc JOIN promises p ON p.id = pc.promise_id JOIN users u ON u.family_id = p.family_id WHERE pc.id = promise_progress_snapshots.commitment_id AND u.id = auth.uid()));

-- promise_reflections (read family-scoped; write owner-only)
CREATE POLICY prefl_family_select ON public.promise_reflections FOR SELECT
  USING (EXISTS (SELECT 1 FROM promises p JOIN users u ON u.family_id = p.family_id WHERE p.id = promise_reflections.promise_id AND u.id = auth.uid()));
CREATE POLICY prefl_owner_write ON public.promise_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY prefl_owner_update ON public.promise_reflections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- promises
CREATE POLICY promises_family_select ON public.promises FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = promises.family_id));
CREATE POLICY promises_family_write ON public.promises FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = promises.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = promises.family_id));

-- push_tokens (user-scoped; two policies — legacy)
CREATE POLICY push_self ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY push_tokens_own ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- questionnaire_answers (user-scoped)
CREATE POLICY questionnaire_own ON public.questionnaire_answers FOR ALL
  USING (auth.uid() = user_id);

-- questionnaire_progress (user-scoped, multiple policies — legacy)
CREATE POLICY qp_self ON public.questionnaire_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY qprogress_select ON public.questionnaire_progress FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY qprogress_insert ON public.questionnaire_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY qprogress_update ON public.questionnaire_progress FOR UPDATE
  USING (user_id = auth.uid());

-- recurring_subscriptions (user-scoped)
CREATE POLICY recurring_subs_user_select ON public.recurring_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY recurring_subs_user_update ON public.recurring_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- recurring_transactions
CREATE POLICY recurring_select ON public.recurring_transactions FOR SELECT
  USING (user_id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY recurring_insert ON public.recurring_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recurring_update ON public.recurring_transactions FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY recurring_delete ON public.recurring_transactions FOR DELETE
  USING (user_id = auth.uid());

-- shared_goal_contributions
CREATE POLICY sgc_select ON public.shared_goal_contributions FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY sgc_family_select ON public.shared_goal_contributions FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = shared_goal_contributions.family_id));
CREATE POLICY sgc_insert ON public.shared_goal_contributions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY sgc_family_write ON public.shared_goal_contributions FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = shared_goal_contributions.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = shared_goal_contributions.family_id));

-- shared_goals
CREATE POLICY shared_goals_select ON public.shared_goals FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY shared_goals_insert ON public.shared_goals FOR INSERT
  WITH CHECK (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY shared_goals_update ON public.shared_goals FOR UPDATE
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY shared_goals_delete ON public.shared_goals FOR DELETE
  USING (created_by = auth.uid());

-- statement_imports (user-scoped)
CREATE POLICY statement_imports_self_select ON public.statement_imports FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY statement_imports_self_insert ON public.statement_imports FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY statement_imports_self_update ON public.statement_imports FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY statement_imports_self_delete ON public.statement_imports FOR DELETE
  USING (user_id = auth.uid());

-- statement_transactions (scoped via parent statement_import)
CREATE POLICY st_tx_select_via_parent ON public.statement_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM statement_imports si WHERE si.id = statement_transactions.statement_import_id AND si.user_id = auth.uid()));
CREATE POLICY st_tx_insert_via_parent ON public.statement_transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM statement_imports si WHERE si.id = statement_transactions.statement_import_id AND si.user_id = auth.uid()));
CREATE POLICY st_tx_update_via_parent ON public.statement_transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM statement_imports si WHERE si.id = statement_transactions.statement_import_id AND si.user_id = auth.uid()));
CREATE POLICY st_tx_delete_via_parent ON public.statement_transactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM statement_imports si WHERE si.id = statement_transactions.statement_import_id AND si.user_id = auth.uid()));

-- streaks (family-scoped)
CREATE POLICY streaks_select ON public.streaks FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY streaks_insert ON public.streaks FOR INSERT
  WITH CHECK (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY streaks_update ON public.streaks FOR UPDATE
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());

-- transaction_comments
CREATE POLICY tx_comments_select ON public.transaction_comments FOR SELECT
  USING (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id());
CREATE POLICY txcomm_family_select ON public.transaction_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transaction_comments.family_id));
CREATE POLICY tx_comments_insert ON public.transaction_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY tx_comments_delete ON public.transaction_comments FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY txcomm_family_write ON public.transaction_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transaction_comments.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transaction_comments.family_id));

-- transactions
CREATE POLICY transactions_select ON public.transactions FOR SELECT
  USING (user_id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY transactions_family_select ON public.transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transactions.family_id));
CREATE POLICY transactions_insert ON public.transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY transactions_update ON public.transactions FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY transactions_delete ON public.transactions FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY transactions_family_write ON public.transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transactions.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = transactions.family_id));

-- user_dish_portions (user-scoped)
CREATE POLICY user_dish_portions_self_select ON public.user_dish_portions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY user_dish_portions_self_insert ON public.user_dish_portions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_dish_portions_self_update ON public.user_dish_portions FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY user_dish_portions_self_delete ON public.user_dish_portions FOR DELETE
  USING (user_id = auth.uid());

-- users (multiple legacy policies — should consolidate, leaving as-is for now)
CREATE POLICY users_select_self ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY users_select ON public.users FOR SELECT
  USING (id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY users_select_family ON public.users FOR SELECT
  USING (family_id IN (SELECT fm.family_id FROM family_members fm WHERE fm.user_id = auth.uid()));
CREATE POLICY users_insert ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY users_insert_self ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY users_update ON public.users FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY users_update_self ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- wellness
CREATE POLICY wellness_select ON public.wellness FOR SELECT
  USING (user_id = auth.uid() OR (get_my_family_id() IS NOT NULL AND family_id = get_my_family_id()));
CREATE POLICY wellness_family_select ON public.wellness FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = wellness.family_id));
CREATE POLICY wellness_insert ON public.wellness FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY wellness_update ON public.wellness FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY wellness_delete ON public.wellness FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY wellness_family_write ON public.wellness FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = wellness.family_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.family_id = wellness.family_id));


-- ============================================================
-- END
-- ============================================================
-- 33 tables. 1 SECURITY DEFINER helper (get_my_family_id).
-- 8 functions. 3 triggers. 73 RLS policies across 33 tables.
-- ============================================================
