-- =====================================================================================
-- Wellthy Fam — Complete production schema
-- Regenerated from live database on 2026-05-07 (post-phase-6 migration)
-- Project: bvynbvaawbmsucgpmreq
-- Source of truth: live Postgres at db.bvynbvaawbmsucgpmreq.supabase.co
--
-- This document represents the POST-MIGRATION state:
--   * meal_logs has been DROPPED (replaced by columns on meals + food_vessels lookups)
--   * food_vessels and user_dish_portions tables ADDED (vessel-pipeline)
--   * Additional vessel/cooking/source columns ADDED inline on meals
--   * get_user_top_dishes() helper function ADDED
--
-- Section 1: Extensions
-- Section 2: Tables (CREATE TABLE statements, idempotent with `if not exists`)
-- Section 3: Indexes
-- Section 4: Row Level Security (enable + policies)
-- Section 5: Functions
-- Section 6: Triggers
-- =====================================================================================


-- =====================================================================================
-- Section 1: Extensions
-- =====================================================================================

create extension if not exists "uuid-ossp"     with schema extensions;
create extension if not exists "pgcrypto"      with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "pg_trgm"       with schema public;


-- =====================================================================================
-- Section 2: Tables
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- activities: per-member exercise / movement entries (manual or HealthKit/Google Fit)
-- -------------------------------------------------------------------------------------
create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  user_id          uuid references public.users(id) on delete set null,
  member_id        text not null,
  member_name      text,
  activity_type    text not null check (activity_type = any (array['walk','workout','sport','yoga','run','cycle','swim','other'])),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  note             text,
  date             date not null default current_date,
  source           text not null default 'manual' check (source = any (array['manual','auto_health_kit','auto_google_fit'])),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- activity_feed: family-wide event stream (logs, completions, score changes, etc.)
-- -------------------------------------------------------------------------------------
create table if not exists public.activity_feed (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  created_at    timestamptz default now(),
  activity_type text,
  activity_data jsonb,
  reference_id  uuid
);

-- -------------------------------------------------------------------------------------
-- custom_categories: family-defined finance / domain categories
-- -------------------------------------------------------------------------------------
create table if not exists public.custom_categories (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  category_name text not null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz default now(),
  user_id       uuid,
  name          text,
  domain        text default 'finance',
  icon          text
);

-- -------------------------------------------------------------------------------------
-- daily_logs: legacy device-keyed daily journal / contracts
-- -------------------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  date        text not null,
  state       text,
  core_body   text,
  core_mind   text,
  core_spirit text,
  contracts   jsonb default '{}'::jsonb,
  protein     integer default 0,
  journal     text default ''::text,
  finalized   boolean default false,
  delta       integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- daily_score_events: idempotent points ledger (one row per family/member/date/action)
-- -------------------------------------------------------------------------------------
create table if not exists public.daily_score_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  member_id   text not null,
  date        date not null,
  action_type text not null,
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- families: family / household root
-- -------------------------------------------------------------------------------------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  family_name text not null,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- family_invites: 6-digit invite codes for joining families
-- -------------------------------------------------------------------------------------
create table if not exists public.family_invites (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  invited_by           uuid references public.users(id) on delete set null,
  invite_code          text not null unique,
  invited_member_name  text,
  invited_member_role  text default 'parent',
  status               text default 'pending',
  used_by              uuid references public.users(id) on delete set null,
  created_at           timestamptz default now(),
  expires_at           timestamptz default (now() + interval '7 days'),
  used_at              timestamptz,
  updated_at           timestamptz default now(),
  invited_access_role  text default 'member' check (invited_access_role = any (array['co_admin','member']))
);

-- -------------------------------------------------------------------------------------
-- family_members: join table — who is in which family with what role
-- -------------------------------------------------------------------------------------
create table if not exists public.family_members (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  user_id           uuid references public.users(id) on delete set null,
  name              text,
  role              text default 'parent',
  access_role       text default 'member',
  invite_code       text,
  invite_expires_at timestamptz,
  joined_at         timestamptz,
  sort_order        integer default 0,
  created_at        timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- family_scores: per-member habit-score events (legacy alongside daily_score_events)
-- -------------------------------------------------------------------------------------
create table if not exists public.family_scores (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  member_id     text not null,
  date          date not null default current_date,
  habit_type    text,
  points_earned integer default 0,
  created_at    timestamptz default now(),
  action_type   text
);

-- -------------------------------------------------------------------------------------
-- foods: ICMR / curated food nutrition reference table (read-only library)
-- -------------------------------------------------------------------------------------
create table if not exists public.foods (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  name_regional        text,
  category             text,
  serving_size_g       numeric default 100,
  serving_description  text,
  calories_per_100g    numeric default 0,
  protein_per_100g     numeric default 0,
  carbs_per_100g       numeric default 0,
  fat_per_100g         numeric default 0,
  fiber_per_100g       numeric default 0,
  created_at           timestamptz default now(),
  protein_g            numeric(8,2),
  calories             numeric(8,2),
  carbs_g              numeric(8,2),
  fat_g                numeric(8,2),
  fiber_g              numeric(8,2),
  serving_unit         text,
  food_group           text,
  is_indian            boolean default true
);

-- -------------------------------------------------------------------------------------
-- goals: personal + shared finance/wellness goals
-- -------------------------------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  user_id        uuid references public.users(id) on delete set null,
  name           text not null,
  target         numeric not null default 0,
  current        numeric not null default 0,
  category       text default 'Savings',
  goal_type      text not null default 'personal' check (goal_type = any (array['personal','shared'])),
  is_shared      boolean default false,
  goal_scope     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  category_other text,
  target_date    date
);

-- -------------------------------------------------------------------------------------
-- meals: per-member meal entries with computed macros + vessel-pipeline metadata
-- (vessel_unit/vessel_quantity/cooking_style/nutrition_source/dish_breakdown added
--  by the phase-6 vessel-pipeline migration)
-- -------------------------------------------------------------------------------------
create table if not exists public.meals (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  user_id           uuid references public.users(id) on delete set null,
  member_id         text,
  member_name       text,
  protein           numeric default 0,
  carbs             numeric default 0,
  fat               numeric default 0,
  date              date not null default current_date,
  created_at        timestamptz default now(),
  meal_time         text,
  items             text,
  cal               numeric default 0,
  photo_path        text,
  vessel_unit       text,
  vessel_quantity   numeric(5,2),
  cooking_style     text check (cooking_style in ('home','restaurant')),
  nutrition_source  text check (nutrition_source in ('curated','ai_estimate')),
  dish_breakdown    jsonb
);

-- -------------------------------------------------------------------------------------
-- food_vessels: curated dish-to-nutrition mapping (NEW phase-6)
-- -------------------------------------------------------------------------------------
create table if not exists public.food_vessels (
  id                         uuid primary key default gen_random_uuid(),
  dish_name                  text not null,
  dish_normalized            text not null unique,
  default_vessel             text not null check (default_vessel in ('katori','plate','piece','glass','spoon')),
  vessel_grams               numeric(6,2) not null,
  protein_per_gram           numeric(6,4) not null,
  carbs_per_gram             numeric(6,4) not null,
  fat_per_gram               numeric(6,4) not null,
  calories_per_gram          numeric(6,2) not null,
  restaurant_fat_multiplier  numeric(4,2) not null default 1.30,
  category                   text,
  source                     text default 'icmr',
  notes                      text,
  created_at                 timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- user_dish_portions: per-user portion memory for quick-pick chips (NEW phase-6)
-- -------------------------------------------------------------------------------------
create table if not exists public.user_dish_portions (
  user_id            uuid not null references public.users(id) on delete cascade,
  dish_normalized    text not null,
  last_quantity      numeric(5,2) not null default 1,
  last_unit          text not null default 'katori',
  last_cooking_style text not null default 'home' check (last_cooking_style in ('home','restaurant')),
  log_count          int not null default 1,
  last_logged_at     timestamptz default now(),
  primary key (user_id, dish_normalized)
);

-- -------------------------------------------------------------------------------------
-- nudges: per-user behavioural nudges / coaching messages
-- -------------------------------------------------------------------------------------
create table if not exists public.nudges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  family_id    uuid references public.families(id) on delete cascade,
  type         text,
  message      text,
  is_dismissed boolean default false,
  dismissed_at timestamptz,
  sent_at      timestamptz default now(),
  created_at   timestamptz default now(),
  nudge_text   text,
  domain       text default 'general'
);

-- -------------------------------------------------------------------------------------
-- push_tokens: Expo push notification tokens
-- -------------------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  token      text not null unique,
  platform   text,
  updated_at timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- questionnaire_answers: structured answers for onboarding questions
-- -------------------------------------------------------------------------------------
create table if not exists public.questionnaire_answers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique,
  spending_regret     text,
  financial_goals_1y  text,
  financial_goals_5y  text,
  spender_type        text,
  money_stress        text,
  protein_awareness   text,
  screen_time_hours   text,
  passions            text,
  energy_level        integer,
  savings_status      text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- questionnaire_progress: in-progress onboarding step tracker
-- -------------------------------------------------------------------------------------
create table if not exists public.questionnaire_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.users(id) on delete cascade,
  current_page   integer default 1,
  current_screen integer default 0,
  answers        jsonb,
  is_completed   boolean default false,
  updated_at     timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- quests: legacy device-keyed quest progress
-- -------------------------------------------------------------------------------------
create table if not exists public.quests (
  id             uuid primary key default gen_random_uuid(),
  device_id      text not null,
  quest_id       text not null,
  status         text default 'Active',
  date_completed text,
  updated_at     timestamptz default now(),
  unique (device_id, quest_id)
);

-- -------------------------------------------------------------------------------------
-- recurring_transactions: monthly bills / subscriptions templates
-- -------------------------------------------------------------------------------------
create table if not exists public.recurring_transactions (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  user_id           uuid references public.users(id) on delete set null,
  transaction_type  text default 'expense',
  description       text not null,
  category          text,
  amount            numeric not null,
  frequency         text default 'monthly' check (frequency = any (array['daily','weekly','biweekly','monthly','yearly'])),
  due_day           integer default 1,
  last_logged_date  date,
  last_created_date date,
  next_due_date     date,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  type              text
);

-- -------------------------------------------------------------------------------------
-- self_trust: legacy device-keyed self-trust score history
-- -------------------------------------------------------------------------------------
create table if not exists public.self_trust (
  id         uuid primary key default gen_random_uuid(),
  device_id  text not null unique,
  score      integer default 0,
  history    jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- session_logs: legacy device-keyed per-domain session log
-- -------------------------------------------------------------------------------------
create table if not exists public.session_logs (
  id         uuid primary key default gen_random_uuid(),
  device_id  text not null,
  date       text not null,
  domain     text not null,
  notes      text,
  details    jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- shared_goals: family-wide collaborative goals
-- -------------------------------------------------------------------------------------
create table if not exists public.shared_goals (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  created_by     uuid references public.users(id) on delete set null,
  goal_name      text not null,
  target_amount  numeric not null default 0,
  current_amount numeric not null default 0,
  category       text default 'Savings',
  description    text,
  target_date    date,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  category_other text
);

-- -------------------------------------------------------------------------------------
-- shared_goal_contributions: per-member contributions toward shared goals
-- -------------------------------------------------------------------------------------
create table if not exists public.shared_goal_contributions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  shared_goal_id  uuid not null references public.shared_goals(id) on delete cascade,
  user_id         uuid references public.users(id) on delete set null,
  user_name       text,
  amount          numeric not null,
  note            text,
  contributed_at  timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- skill_nodes: legacy device-keyed skill-tree state
-- -------------------------------------------------------------------------------------
create table if not exists public.skill_nodes (
  id            uuid primary key default gen_random_uuid(),
  device_id     text not null,
  node_id       text not null,
  status        text default 'Locked',
  date_unlocked text,
  updated_at    timestamptz default now(),
  unique (device_id, node_id)
);

-- -------------------------------------------------------------------------------------
-- streaks: per-member habit streak counters
-- -------------------------------------------------------------------------------------
create table if not exists public.streaks (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  member_id        text not null,
  habit_type       text not null,
  current_streak   integer default 0,
  longest_streak   integer default 0,
  updated_at       timestamptz default now(),
  last_logged_date date,
  unique (family_id, member_id, habit_type)
);

-- -------------------------------------------------------------------------------------
-- transactions: per-family finance entries
-- -------------------------------------------------------------------------------------
create table if not exists public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  family_id                uuid not null references public.families(id) on delete cascade,
  user_id                  uuid references public.users(id) on delete set null,
  member_id                text,
  member_name              text,
  merchant                 text not null,
  amount                   numeric not null,
  category                 text,
  date                     date not null default current_date,
  confirmed                boolean default true,
  source                   text default 'Manual',
  is_family_spending       boolean default false,
  recurring_transaction_id uuid references public.recurring_transactions(id) on delete set null,
  photo_path               text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  type                     text,
  category_other           text,
  note                     text
);

-- -------------------------------------------------------------------------------------
-- transaction_comments: family chat thread per transaction
-- -------------------------------------------------------------------------------------
create table if not exists public.transaction_comments (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id        uuid references public.users(id) on delete set null,
  user_name      text,
  comment        text not null,
  created_at     timestamptz default now()
);

-- -------------------------------------------------------------------------------------
-- users: app-level user profile (mirrors auth.users, joined by id = auth.uid())
-- Note: users.id intentionally has NO FK to auth.users (managed in app code)
-- -------------------------------------------------------------------------------------
create table if not exists public.users (
  id                       uuid primary key,
  auth_user_id             uuid unique,
  user_type                text not null default 'primary',
  name                     text,
  email                    text,
  phone                    text,
  dob                      date,
  gender                   text,
  height                   numeric,
  height_unit              text default 'cm',
  weight                   numeric,
  weight_unit              text default 'kg',
  location                 text,
  occupation               text,
  language                 text default 'english',
  family_id                uuid references public.families(id) on delete set null,
  questionnaire_completed  boolean default false,
  questionnaire_data       jsonb,
  questionnaire_last_step  integer default 0,
  questionnaire_pending    boolean default false,
  notification_enabled     boolean default true,
  pending_invite_code      text,
  created_at               timestamptz default now(),
  last_active_at           timestamptz default now(),
  email_verified           boolean default false,
  water_tracking_enabled   boolean not null default false,
  weight_kg                numeric(5,2),
  height_cm                numeric(5,2),
  currency_preference      text default 'INR',
  date_format              text default 'DD/MM/YYYY',
  number_format            text default 'Indian',
  first_day_of_week        text default 'Monday',
  activity_visibility      text default 'family',
  pending_family_id        uuid,
  pending_member_id        uuid,
  water_target_litres      numeric(4,2) not null default 2.5,
  theme_preference         text not null default 'light',
  screen_target_hours      numeric default 2
);

-- -------------------------------------------------------------------------------------
-- wellness: per-member daily wellness rollup (sleep, water, screen time, weight)
-- -------------------------------------------------------------------------------------
create table if not exists public.wellness (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  user_id             uuid references public.users(id) on delete set null,
  member_id           text,
  member_name         text,
  date                date not null default current_date,
  sleep_hours         numeric default 0,
  weight              numeric,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  water               numeric default 0,
  screen_hrs          numeric default 0,
  water_target_met    boolean,
  water_target_litres numeric(5,2),
  screen_under_limit  boolean,
  unique (family_id, member_id, date)
);


-- =====================================================================================
-- Section 3: Indexes (non-PK)
-- =====================================================================================

create index if not exists activities_family_date_idx       on public.activities(family_id, date desc);
create index if not exists activities_member_date_idx       on public.activities(family_id, member_id, date desc);

create index if not exists idx_activity_family_date         on public.activity_feed(family_id, created_at desc);
create index if not exists idx_activity_feed_family_id      on public.activity_feed(family_id);

create unique index if not exists custom_categories_family_id_category_name_key on public.custom_categories(family_id, category_name);
create unique index if not exists custom_categories_family_name_unique          on public.custom_categories(family_id, lower(name), domain);
create index if not exists idx_custom_categories_family     on public.custom_categories(family_id);

create unique index if not exists daily_logs_device_id_date_key on public.daily_logs(device_id, date);

create unique index if not exists daily_score_events_family_id_member_id_date_action_type_key on public.daily_score_events(family_id, member_id, date, action_type);
create index if not exists idx_dse_family_date             on public.daily_score_events(family_id, date);
create index if not exists idx_dse_member_date             on public.daily_score_events(member_id, date);

create unique index if not exists family_invites_invite_code_key on public.family_invites(invite_code);
create index if not exists idx_family_invites_code         on public.family_invites(invite_code);
create index if not exists idx_family_invites_family       on public.family_invites(family_id);
create index if not exists idx_family_invites_status       on public.family_invites(status);

create index if not exists idx_family_members_family_id    on public.family_members(family_id);
create index if not exists idx_family_members_user_id      on public.family_members(user_id);

create index if not exists idx_family_scores_date          on public.family_scores(date);
create index if not exists idx_family_scores_family_id     on public.family_scores(family_id);

create index if not exists foods_category                  on public.foods(category);
create index if not exists foods_name                      on public.foods(name);
create index if not exists foods_name_trgm                 on public.foods using gin (name gin_trgm_ops);
create unique index if not exists foods_name_unique        on public.foods(lower(name));
create index if not exists foods_regional_trgm             on public.foods using gin (name_regional gin_trgm_ops);
create index if not exists idx_foods_category              on public.foods(category);
create index if not exists idx_foods_name                  on public.foods(name);
create index if not exists idx_foods_protein               on public.foods(protein_g desc);

create index if not exists idx_goals_family                on public.goals(family_id);
create index if not exists idx_goals_family_id             on public.goals(family_id);

create index if not exists idx_meals_date                  on public.meals(date);
create index if not exists idx_meals_family_date           on public.meals(family_id, date desc);
create index if not exists idx_meals_family_id             on public.meals(family_id);
create index if not exists idx_meals_member                on public.meals(family_id, member_id);

-- food_vessels (NEW phase-6)
create index if not exists idx_food_vessels_normalized     on public.food_vessels(dish_normalized);
create index if not exists idx_food_vessels_category       on public.food_vessels(category);

-- user_dish_portions (NEW phase-6)
create index if not exists idx_user_dish_portions_user     on public.user_dish_portions(user_id);

create index if not exists idx_nudges_user_id              on public.nudges(user_id);

create unique index if not exists push_tokens_token_key    on public.push_tokens(token);

create unique index if not exists questionnaire_answers_user_id_key  on public.questionnaire_answers(user_id);
create unique index if not exists questionnaire_progress_user_id_key on public.questionnaire_progress(user_id);

create unique index if not exists quests_device_id_quest_id_key on public.quests(device_id, quest_id);

create unique index if not exists self_trust_device_id_key on public.self_trust(device_id);

create index if not exists session_logs_device_date        on public.session_logs(device_id, date);

create index if not exists idx_sgc_family                  on public.shared_goal_contributions(family_id);
create index if not exists idx_sgc_goal                    on public.shared_goal_contributions(shared_goal_id);

create index if not exists idx_shared_goals_family_id      on public.shared_goals(family_id);

create unique index if not exists skill_nodes_device_id_node_id_key on public.skill_nodes(device_id, node_id);

create index if not exists idx_streaks_family_member       on public.streaks(family_id, member_id);
create unique index if not exists streaks_family_id_member_id_habit_type_key on public.streaks(family_id, member_id, habit_type);

create index if not exists idx_tx_comments_family          on public.transaction_comments(family_id);
create index if not exists idx_tx_comments_tx_id           on public.transaction_comments(transaction_id);
create index if not exists idx_txcomm_tx                   on public.transaction_comments(transaction_id);

create index if not exists idx_transactions_date           on public.transactions(date);
create index if not exists idx_transactions_family_date    on public.transactions(family_id, date desc);
create index if not exists idx_transactions_family_id      on public.transactions(family_id);
create index if not exists idx_transactions_member         on public.transactions(family_id, member_id);
create index if not exists idx_transactions_recurring      on public.transactions(recurring_transaction_id);
create index if not exists idx_transactions_user           on public.transactions(user_id, date desc);

create index if not exists idx_users_auth_user_id          on public.users(auth_user_id);
create index if not exists idx_users_email                 on public.users(email);
create index if not exists idx_users_family                on public.users(family_id);
create index if not exists idx_users_family_id             on public.users(family_id);
create unique index if not exists users_auth_user_id_key   on public.users(auth_user_id);

create index if not exists idx_wellness_family_date        on public.wellness(family_id, date desc);
create index if not exists idx_wellness_family_id          on public.wellness(family_id);
create unique index if not exists wellness_family_id_member_id_date_key on public.wellness(family_id, member_id, date);
create unique index if not exists wellness_family_member_date_unique    on public.wellness(family_id, member_id, date) where (member_id is not null);


-- =====================================================================================
-- Section 4: Row Level Security (enable + policies)
-- All public.* tables have RLS enabled in production.
-- =====================================================================================

alter table public.activities                  enable row level security;
alter table public.activity_feed               enable row level security;
alter table public.custom_categories           enable row level security;
alter table public.daily_logs                  enable row level security;
alter table public.daily_score_events          enable row level security;
alter table public.families                    enable row level security;
alter table public.family_invites              enable row level security;
alter table public.family_members              enable row level security;
alter table public.family_scores               enable row level security;
alter table public.foods                       enable row level security;
alter table public.goals                       enable row level security;
alter table public.meals                       enable row level security;
alter table public.food_vessels                enable row level security;
alter table public.user_dish_portions          enable row level security;
alter table public.nudges                      enable row level security;
alter table public.push_tokens                 enable row level security;
alter table public.questionnaire_answers       enable row level security;
alter table public.questionnaire_progress      enable row level security;
alter table public.quests                      enable row level security;
alter table public.recurring_transactions      enable row level security;
alter table public.self_trust                  enable row level security;
alter table public.session_logs                enable row level security;
alter table public.shared_goal_contributions   enable row level security;
alter table public.shared_goals                enable row level security;
alter table public.skill_nodes                 enable row level security;
alter table public.streaks                     enable row level security;
alter table public.transaction_comments        enable row level security;
alter table public.transactions                enable row level security;
alter table public.users                       enable row level security;
alter table public.wellness                    enable row level security;

-- ----- activities -----
drop policy if exists activities_select_family on public.activities;
create policy activities_select_family on public.activities for select using (
  family_id in (select users.family_id from public.users where users.auth_user_id = auth.uid())
);
drop policy if exists activities_insert_family on public.activities;
create policy activities_insert_family on public.activities for insert with check (
  family_id in (select users.family_id from public.users where users.auth_user_id = auth.uid())
);
drop policy if exists activities_update_family on public.activities;
create policy activities_update_family on public.activities for update using (
  family_id in (select users.family_id from public.users where users.auth_user_id = auth.uid())
);
drop policy if exists activities_delete_family on public.activities;
create policy activities_delete_family on public.activities for delete using (
  family_id in (select users.family_id from public.users where users.auth_user_id = auth.uid())
);

-- ----- activity_feed -----
drop policy if exists activity_family_select on public.activity_feed;
create policy activity_family_select on public.activity_feed for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id)
);
drop policy if exists activity_family_write on public.activity_feed;
create policy activity_family_write on public.activity_feed for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id));
drop policy if exists activity_feed_select on public.activity_feed;
create policy activity_feed_select on public.activity_feed for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists activity_feed_insert on public.activity_feed;
create policy activity_feed_insert on public.activity_feed for insert with check (user_id = auth.uid());

-- ----- custom_categories -----
drop policy if exists cc_family_select on public.custom_categories;
create policy cc_family_select on public.custom_categories for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id)
);
drop policy if exists cc_family_write on public.custom_categories;
create policy cc_family_write on public.custom_categories for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id));
drop policy if exists custom_cat_select on public.custom_categories;
create policy custom_cat_select on public.custom_categories for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists custom_cat_insert on public.custom_categories;
create policy custom_cat_insert on public.custom_categories for insert with check (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists custom_cat_delete on public.custom_categories;
create policy custom_cat_delete on public.custom_categories for delete using (created_by = auth.uid());

-- ----- daily_logs (legacy: open) -----
drop policy if exists "allow all daily_logs" on public.daily_logs;
create policy "allow all daily_logs" on public.daily_logs for all using (true) with check (true);

-- ----- daily_score_events -----
drop policy if exists dse_family_select on public.daily_score_events;
create policy dse_family_select on public.daily_score_events for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = daily_score_events.family_id)
);
drop policy if exists dse_family_write on public.daily_score_events;
create policy dse_family_write on public.daily_score_events for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = daily_score_events.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = daily_score_events.family_id));

-- ----- families -----
drop policy if exists families_select on public.families;
create policy families_select on public.families for select using (
  created_by = auth.uid()
  or id = get_my_family_id()
  or id in (select family_id from public.family_invites where status = 'pending')
);
drop policy if exists families_insert on public.families;
create policy families_insert on public.families for insert with check (created_by = auth.uid());
drop policy if exists families_update on public.families;
create policy families_update on public.families for update using (created_by = auth.uid());
drop policy if exists families_delete on public.families;
create policy families_delete on public.families for delete using (created_by = auth.uid());

-- ----- family_invites -----
drop policy if exists family_invites_authed_select on public.family_invites;
create policy family_invites_authed_select on public.family_invites for select using (auth.role() = 'authenticated');
drop policy if exists family_invites_select on public.family_invites;
create policy family_invites_select on public.family_invites for select using (true);
drop policy if exists family_invites_insert on public.family_invites;
create policy family_invites_insert on public.family_invites for insert with check (invited_by = auth.uid());
drop policy if exists family_invites_update on public.family_invites;
create policy family_invites_update on public.family_invites for update using (
  invited_by = auth.uid() or family_id = get_my_family_id()
);
drop policy if exists family_invites_family_write on public.family_invites;
create policy family_invites_family_write on public.family_invites for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = family_invites.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = family_invites.family_id));

-- ----- family_members -----
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members for insert with check (
  user_id = auth.uid()
  or family_id in (select id from public.families where created_by = auth.uid())
);
drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members for update using (
  user_id = auth.uid()
  or family_id in (select id from public.families where created_by = auth.uid())
);
drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members for delete using (
  family_id in (select id from public.families where created_by = auth.uid())
);

-- ----- family_scores -----
drop policy if exists fscores_select on public.family_scores;
create policy fscores_select on public.family_scores for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists fscores_insert on public.family_scores;
create policy fscores_insert on public.family_scores for insert with check (
  get_my_family_id() is not null and family_id = get_my_family_id()
);

-- ----- foods (read-only library, open to authenticated) -----
drop policy if exists foods_open_select on public.foods;
create policy foods_open_select on public.foods for select using (auth.role() = 'authenticated');
drop policy if exists foods_read_all on public.foods;
create policy foods_read_all on public.foods for select using (true);

-- ----- goals -----
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists goals_family_select on public.goals;
create policy goals_family_select on public.goals for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id)
);
drop policy if exists goals_insert on public.goals;
create policy goals_insert on public.goals for insert with check (user_id = auth.uid());
drop policy if exists goals_update on public.goals;
create policy goals_update on public.goals for update using (user_id = auth.uid());
drop policy if exists goals_delete on public.goals;
create policy goals_delete on public.goals for delete using (user_id = auth.uid());
drop policy if exists goals_family_write on public.goals;
create policy goals_family_write on public.goals for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id));

-- ----- meals -----
drop policy if exists meals_select on public.meals;
create policy meals_select on public.meals for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists meals_family_select on public.meals;
create policy meals_family_select on public.meals for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id)
);
drop policy if exists meals_insert on public.meals;
create policy meals_insert on public.meals for insert with check (user_id = auth.uid());
drop policy if exists meals_update on public.meals;
create policy meals_update on public.meals for update using (user_id = auth.uid());
drop policy if exists meals_delete on public.meals;
create policy meals_delete on public.meals for delete using (user_id = auth.uid());
drop policy if exists meals_family_write on public.meals;
create policy meals_family_write on public.meals for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id));

-- ----- food_vessels (NEW phase-6, read-only for authenticated) -----
drop policy if exists food_vessels_read_authenticated on public.food_vessels;
create policy food_vessels_read_authenticated on public.food_vessels for select to authenticated using (true);

-- ----- user_dish_portions (NEW phase-6, self-only) -----
drop policy if exists user_dish_portions_self_select on public.user_dish_portions;
create policy user_dish_portions_self_select on public.user_dish_portions for select using (user_id = auth.uid());
drop policy if exists user_dish_portions_self_insert on public.user_dish_portions;
create policy user_dish_portions_self_insert on public.user_dish_portions for insert with check (user_id = auth.uid());
drop policy if exists user_dish_portions_self_update on public.user_dish_portions;
create policy user_dish_portions_self_update on public.user_dish_portions for update using (user_id = auth.uid());
drop policy if exists user_dish_portions_self_delete on public.user_dish_portions;
create policy user_dish_portions_self_delete on public.user_dish_portions for delete using (user_id = auth.uid());

-- ----- nudges -----
drop policy if exists nudges_select on public.nudges;
create policy nudges_select on public.nudges for select using (user_id = auth.uid());
drop policy if exists nudges_insert on public.nudges;
create policy nudges_insert on public.nudges for insert with check (user_id = auth.uid());
drop policy if exists nudges_update on public.nudges;
create policy nudges_update on public.nudges for update using (user_id = auth.uid());

-- ----- push_tokens -----
drop policy if exists push_self on public.push_tokens;
create policy push_self on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for all using (auth.uid() = user_id);

-- ----- questionnaire_answers -----
drop policy if exists questionnaire_own on public.questionnaire_answers;
create policy questionnaire_own on public.questionnaire_answers for all using (auth.uid() = user_id);

-- ----- questionnaire_progress -----
drop policy if exists qp_self on public.questionnaire_progress;
create policy qp_self on public.questionnaire_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists qprogress_select on public.questionnaire_progress;
create policy qprogress_select on public.questionnaire_progress for select using (user_id = auth.uid());
drop policy if exists qprogress_insert on public.questionnaire_progress;
create policy qprogress_insert on public.questionnaire_progress for insert with check (user_id = auth.uid());
drop policy if exists qprogress_update on public.questionnaire_progress;
create policy qprogress_update on public.questionnaire_progress for update using (user_id = auth.uid());

-- ----- quests (legacy: open) -----
drop policy if exists "allow all quests" on public.quests;
create policy "allow all quests" on public.quests for all using (true) with check (true);

-- ----- recurring_transactions -----
drop policy if exists recurring_select on public.recurring_transactions;
create policy recurring_select on public.recurring_transactions for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists recurring_insert on public.recurring_transactions;
create policy recurring_insert on public.recurring_transactions for insert with check (user_id = auth.uid());
drop policy if exists recurring_update on public.recurring_transactions;
create policy recurring_update on public.recurring_transactions for update using (user_id = auth.uid());
drop policy if exists recurring_delete on public.recurring_transactions;
create policy recurring_delete on public.recurring_transactions for delete using (user_id = auth.uid());

-- ----- self_trust (legacy: open) -----
drop policy if exists "allow all self_trust" on public.self_trust;
create policy "allow all self_trust" on public.self_trust for all using (true) with check (true);

-- ----- session_logs (legacy: open) -----
drop policy if exists "allow all session_logs" on public.session_logs;
create policy "allow all session_logs" on public.session_logs for all using (true) with check (true);

-- ----- shared_goals -----
drop policy if exists shared_goals_select on public.shared_goals;
create policy shared_goals_select on public.shared_goals for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists shared_goals_insert on public.shared_goals;
create policy shared_goals_insert on public.shared_goals for insert with check (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists shared_goals_update on public.shared_goals;
create policy shared_goals_update on public.shared_goals for update using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists shared_goals_delete on public.shared_goals;
create policy shared_goals_delete on public.shared_goals for delete using (created_by = auth.uid());

-- ----- shared_goal_contributions -----
drop policy if exists sgc_select on public.shared_goal_contributions;
create policy sgc_select on public.shared_goal_contributions for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists sgc_family_select on public.shared_goal_contributions;
create policy sgc_family_select on public.shared_goal_contributions for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id)
);
drop policy if exists sgc_insert on public.shared_goal_contributions;
create policy sgc_insert on public.shared_goal_contributions for insert with check (user_id = auth.uid());
drop policy if exists sgc_family_write on public.shared_goal_contributions;
create policy sgc_family_write on public.shared_goal_contributions for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id));

-- ----- skill_nodes (legacy: open) -----
drop policy if exists "allow all skill_nodes" on public.skill_nodes;
create policy "allow all skill_nodes" on public.skill_nodes for all using (true) with check (true);

-- ----- streaks -----
drop policy if exists streaks_select on public.streaks;
create policy streaks_select on public.streaks for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists streaks_insert on public.streaks;
create policy streaks_insert on public.streaks for insert with check (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists streaks_update on public.streaks;
create policy streaks_update on public.streaks for update using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);

-- ----- transaction_comments -----
drop policy if exists tx_comments_select on public.transaction_comments;
create policy tx_comments_select on public.transaction_comments for select using (
  get_my_family_id() is not null and family_id = get_my_family_id()
);
drop policy if exists txcomm_family_select on public.transaction_comments;
create policy txcomm_family_select on public.transaction_comments for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id)
);
drop policy if exists tx_comments_insert on public.transaction_comments;
create policy tx_comments_insert on public.transaction_comments for insert with check (user_id = auth.uid());
drop policy if exists tx_comments_delete on public.transaction_comments;
create policy tx_comments_delete on public.transaction_comments for delete using (user_id = auth.uid());
drop policy if exists txcomm_family_write on public.transaction_comments;
create policy txcomm_family_write on public.transaction_comments for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id));

-- ----- transactions -----
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists transactions_family_select on public.transactions;
create policy transactions_family_select on public.transactions for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id)
);
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert with check (user_id = auth.uid());
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update using (user_id = auth.uid());
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions for delete using (user_id = auth.uid());
drop policy if exists transactions_family_write on public.transactions;
create policy transactions_family_write on public.transactions for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id));

-- ----- users -----
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (
  id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select using (auth.uid() = id);
drop policy if exists users_select_family on public.users;
create policy users_select_family on public.users for select using (
  family_id in (select fm.family_id from public.family_members fm where fm.user_id = auth.uid())
);
drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert with check (id = auth.uid());
drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users for insert with check (auth.uid() = id);
drop policy if exists users_update on public.users;
create policy users_update on public.users for update using (id = auth.uid());
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----- wellness -----
drop policy if exists wellness_select on public.wellness;
create policy wellness_select on public.wellness for select using (
  user_id = auth.uid()
  or (get_my_family_id() is not null and family_id = get_my_family_id())
);
drop policy if exists wellness_family_select on public.wellness;
create policy wellness_family_select on public.wellness for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id)
);
drop policy if exists wellness_insert on public.wellness;
create policy wellness_insert on public.wellness for insert with check (user_id = auth.uid());
drop policy if exists wellness_update on public.wellness;
create policy wellness_update on public.wellness for update using (user_id = auth.uid());
drop policy if exists wellness_delete on public.wellness;
create policy wellness_delete on public.wellness for delete using (user_id = auth.uid());
drop policy if exists wellness_family_write on public.wellness;
create policy wellness_family_write on public.wellness for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id));


-- =====================================================================================
-- Section 5: Functions
-- (pg_trgm extension functions in public schema are auto-installed with the extension
--  and intentionally omitted here.)
-- =====================================================================================

-- ----- get_my_family_id: helper used by most RLS policies -----
create or replace function public.get_my_family_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select family_id from public.users where id = auth.uid() limit 1;
$$;

-- ----- generate_invite_code: returns a 6-digit zero-padded random code -----
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  code := lpad(floor(random() * 1000000)::text, 6, '0');
  return code;
end;
$$;

-- ----- update_updated_at: shared trigger fn for legacy device-scoped tables -----
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----- set_updated_at_timestamp: same shape, separate symbol kept for legacy callers -----
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----- activities_set_updated_at: dedicated trigger fn for activities table -----
create or replace function public.activities_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----- handle_email_verified: SECURITY DEFINER fn fired from auth.users trigger -----
create or replace function public.handle_email_verified()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users
       set email_verified = true
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ----- get_user_top_dishes (NEW phase-6): top N most-logged dishes per user -----
create or replace function public.get_user_top_dishes(p_user_id uuid, p_limit int default 4)
returns table(
  dish_normalized text,
  dish_name       text,
  log_count       int,
  last_quantity   numeric,
  last_unit       text
)
language sql
security definer
as $$
  select udp.dish_normalized,
         coalesce(fv.dish_name, initcap(replace(udp.dish_normalized, '_', ' '))) as dish_name,
         udp.log_count,
         udp.last_quantity,
         udp.last_unit
    from public.user_dish_portions udp
    left join public.food_vessels fv on fv.dish_normalized = udp.dish_normalized
   where udp.user_id = p_user_id
   order by udp.log_count desc, udp.last_logged_at desc
   limit p_limit;
$$;


-- =====================================================================================
-- Section 6: Triggers
-- =====================================================================================

drop trigger if exists activities_updated_at_trigger on public.activities;
create trigger activities_updated_at_trigger
  before update on public.activities
  for each row execute function public.activities_set_updated_at();

drop trigger if exists daily_logs_updated_at on public.daily_logs;
create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.update_updated_at();

drop trigger if exists quests_updated_at on public.quests;
create trigger quests_updated_at
  before update on public.quests
  for each row execute function public.update_updated_at();

drop trigger if exists self_trust_updated_at on public.self_trust;
create trigger self_trust_updated_at
  before update on public.self_trust
  for each row execute function public.update_updated_at();

drop trigger if exists skill_nodes_updated_at on public.skill_nodes;
create trigger skill_nodes_updated_at
  before update on public.skill_nodes
  for each row execute function public.update_updated_at();

-- =====================================================================================
-- End of schema
-- =====================================================================================
