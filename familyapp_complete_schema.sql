-- ============================================================
-- FAMILYAPP — COMPLETE CONSOLIDATED SCHEMA & MIGRATIONS
-- ============================================================
-- This file contains the full database schema and all phase
-- migrations in execution order. Safe to run on a fresh
-- Supabase Postgres 15+ project.
--
-- Execution order:
--   1) Base extensions
--   2) Intelligence layer (foods, nudges, push_tokens, questionnaire_data)
--   3) Phase 2+3 (questionnaire_progress, recurring_transactions, access_role)
--   4) Phase 4 (collaboration, activity feed, categories, profile prefs)
--   5) Phase 5 (invite flow, recurring link, goal typing, category remap)
--
-- Run this entire file in Supabase SQL Editor on a fresh project.
-- For an EXISTING project that already has some migrations applied,
-- run only the sections you are missing (each section is idempotent).
-- ============================================================


-- ============================================================
-- SECTION 0: EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- SECTION 1: BASE TABLES (Core schema — families, users, etc.)
-- ============================================================
-- NOTE: If your Supabase project was set up using the app's
-- initial flow, these tables already exist. This section is
-- included for reference and fresh-project setup only.
-- All statements use "if not exists" so they are safe to re-run.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  name text,
  email text,
  questionnaire_completed boolean not null default false,
  questionnaire_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  name text,
  role text,
  invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  category text,
  merchant text,
  note text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  meal_type text,
  food_items jsonb,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wellness (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  date date not null default current_date,
  water_ml numeric(8,2) default 0,
  screen_time_minutes integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  name text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) not null default 0,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Base indexes
create index if not exists idx_users_family on public.users(family_id);
create index if not exists idx_family_members_family on public.family_members(family_id);
create index if not exists idx_transactions_family_date on public.transactions(family_id, date desc);
create index if not exists idx_transactions_user on public.transactions(user_id, date desc);
create index if not exists idx_meals_family_date on public.meals(family_id, date desc);
create index if not exists idx_wellness_family_date on public.wellness(family_id, date desc);
create index if not exists idx_goals_family on public.goals(family_id);

-- Base RLS
alter table public.families enable row level security;
alter table public.users enable row level security;
alter table public.family_members enable row level security;
alter table public.transactions enable row level security;
alter table public.meals enable row level security;
alter table public.wellness enable row level security;
alter table public.goals enable row level security;

-- users: own row access
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_select') then
    create policy users_own_select on public.users for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_insert') then
    create policy users_own_insert on public.users for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_update') then
    create policy users_own_update on public.users for update using (auth.uid() = id);
  end if;
end $$;

-- family_members: family-scoped
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='family_members' and policyname='family_members_family_select') then
    create policy family_members_family_select on public.family_members
      for select using (
        exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = family_members.family_id)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='family_members' and policyname='family_members_family_write') then
    create policy family_members_family_write on public.family_members
      for all using (
        exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = family_members.family_id)
      ) with check (
        exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = family_members.family_id)
      );
  end if;
end $$;

-- transactions, meals, wellness, goals: family-scoped (same pattern)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_family_select') then
    create policy transactions_family_select on public.transactions
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_family_write') then
    create policy transactions_family_write on public.transactions
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transactions.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meals' and policyname='meals_family_select') then
    create policy meals_family_select on public.meals
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meals' and policyname='meals_family_write') then
    create policy meals_family_write on public.meals
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = meals.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wellness' and policyname='wellness_family_select') then
    create policy wellness_family_select on public.wellness
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wellness' and policyname='wellness_family_write') then
    create policy wellness_family_write on public.wellness
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = wellness.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='goals' and policyname='goals_family_select') then
    create policy goals_family_select on public.goals
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='goals' and policyname='goals_family_write') then
    create policy goals_family_write on public.goals
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = goals.family_id));
  end if;
end $$;


-- ============================================================
-- SECTION 2: INTELLIGENCE LAYER MIGRATION
-- (intelligence_migration.sql)
-- Creates: foods, nudges, push_tokens, questionnaire_data table
-- ============================================================

-- Foods (nutrition reference — open read)
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calories numeric(8,2),
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fiber_g numeric(8,2),
  serving_size_g numeric(8,2),
  serving_unit text,
  food_group text,
  created_at timestamptz not null default now()
);

create index if not exists idx_foods_name on public.foods(name);

alter table public.foods enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='foods' and policyname='foods_open_select') then
    create policy foods_open_select on public.foods for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Nudges (generated nudge history per user)
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  domain text,
  nudge_text text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_nudges_user_sent on public.nudges(user_id, sent_at desc);

alter table public.nudges enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nudges' and policyname='nudges_own_select') then
    create policy nudges_own_select on public.nudges for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nudges' and policyname='nudges_own_write') then
    create policy nudges_own_write on public.nudges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Push tokens (Expo push notification tokens)
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_tokens' and policyname='push_tokens_own') then
    create policy push_tokens_own on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- questionnaire_data (intelligence-layer side table — user scoped)
-- NOTE: The primary questionnaire storage is users.questionnaire_data (jsonb column).
-- This table is an optional edge-function side table for nudge context. Defensive.
create table if not exists public.questionnaire_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.questionnaire_data enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='questionnaire_data' and policyname='questionnaire_data_own') then
    create policy questionnaire_data_own on public.questionnaire_data
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;


-- ============================================================
-- SECTION 3: PHASE 2+3 MIGRATION
-- (phase_2_3_migration.sql)
-- Creates: questionnaire_progress, recurring_transactions
-- Alters: family_members (access_role), users (notification + questionnaire flags)
-- ============================================================

-- Users: questionnaire progress + notification preference flags
alter table if exists public.users
  add column if not exists notification_enabled boolean default true,
  add column if not exists questionnaire_last_step integer default 0,
  add column if not exists questionnaire_pending boolean default false;

-- family_members: role column
alter table if exists public.family_members
  add column if not exists access_role text not null default 'member'
    check (access_role in ('admin','member'));

-- Questionnaire progress (save/resume per user)
create table if not exists public.questionnaire_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  current_page integer not null default 1,
  answers_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_questionnaire_progress_user on public.questionnaire_progress(user_id);

alter table public.questionnaire_progress enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='questionnaire_progress' and policyname='questionnaire_progress_own') then
    create policy questionnaire_progress_own on public.questionnaire_progress
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Recurring transactions
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  category text,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_transactions_family on public.recurring_transactions(family_id, next_due_date);
create index if not exists idx_recurring_transactions_active on public.recurring_transactions(family_id, is_active, next_due_date);

alter table public.recurring_transactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recurring_transactions' and policyname='recurring_transactions_family_select') then
    create policy recurring_transactions_family_select on public.recurring_transactions
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = recurring_transactions.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recurring_transactions' and policyname='recurring_transactions_family_write') then
    create policy recurring_transactions_family_write on public.recurring_transactions
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = recurring_transactions.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = recurring_transactions.family_id));
  end if;
end $$;


-- ============================================================
-- SECTION 4: PHASE 4 MIGRATION
-- Collaboration, activity feed, custom categories, profile prefs
-- ============================================================

-- Users: profile + preferences + privacy fields
alter table if exists public.users
  add column if not exists phone text,
  add column if not exists dob date,
  add column if not exists gender text,
  add column if not exists avatar_url text,
  add column if not exists currency_preference text default 'INR',
  add column if not exists date_format text default 'DD/MM/YYYY',
  add column if not exists number_format text default 'Indian',
  add column if not exists first_day_of_week text default 'Monday',
  add column if not exists activity_visibility boolean default true;

-- Custom Categories
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category_name text not null,
  is_system boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, category_name)
);

create index if not exists idx_custom_categories_family on public.custom_categories(family_id);
create index if not exists idx_custom_categories_name on public.custom_categories(family_id, category_name);

-- Transaction Comments
create table if not exists public.transaction_comments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_transaction_comments_text_len check (char_length(comment_text) between 1 and 1000)
);

create index if not exists idx_transaction_comments_family on public.transaction_comments(family_id);
create index if not exists idx_transaction_comments_tx on public.transaction_comments(transaction_id, created_at desc);
create index if not exists idx_transaction_comments_user on public.transaction_comments(user_id, created_at desc);

-- Shared Goals
create table if not exists public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  goal_name text not null,
  description text,
  category text,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) not null default 0,
  target_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_shared_goals_target check (target_amount > 0),
  constraint chk_shared_goals_current check (current_amount >= 0)
);

-- Shared Goal Contributions
create table if not exists public.shared_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  shared_goal_id uuid not null references public.shared_goals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  amount numeric(12,2) not null,
  note text,
  contributed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint chk_shared_goal_contribution_amount check (amount > 0)
);

create index if not exists idx_shared_goals_family on public.shared_goals(family_id, created_at desc);
create index if not exists idx_shared_goal_contrib_family on public.shared_goal_contributions(family_id, contributed_at desc);
create index if not exists idx_shared_goal_contrib_goal on public.shared_goal_contributions(shared_goal_id, contributed_at desc);

-- Activity Feed
create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  activity_type text not null,
  activity_data jsonb not null default '{}'::jsonb,
  reference_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activity_feed_family_created on public.activity_feed(family_id, created_at desc);
create index if not exists idx_activity_feed_type on public.activity_feed(family_id, activity_type, created_at desc);

-- Phase 4 RLS
alter table public.custom_categories enable row level security;
alter table public.transaction_comments enable row level security;
alter table public.shared_goals enable row level security;
alter table public.shared_goal_contributions enable row level security;
alter table public.activity_feed enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='custom_categories' and policyname='custom_categories_family_select') then
    create policy custom_categories_family_select on public.custom_categories
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='custom_categories' and policyname='custom_categories_family_write') then
    create policy custom_categories_family_write on public.custom_categories
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = custom_categories.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transaction_comments' and policyname='transaction_comments_family_select') then
    create policy transaction_comments_family_select on public.transaction_comments
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transaction_comments' and policyname='transaction_comments_family_write') then
    create policy transaction_comments_family_write on public.transaction_comments
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = transaction_comments.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shared_goals' and policyname='shared_goals_family_select') then
    create policy shared_goals_family_select on public.shared_goals
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goals.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shared_goals' and policyname='shared_goals_family_write') then
    create policy shared_goals_family_write on public.shared_goals
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goals.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goals.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shared_goal_contributions' and policyname='shared_goal_contributions_family_select') then
    create policy shared_goal_contributions_family_select on public.shared_goal_contributions
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shared_goal_contributions' and policyname='shared_goal_contributions_family_write') then
    create policy shared_goal_contributions_family_write on public.shared_goal_contributions
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = shared_goal_contributions.family_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_feed' and policyname='activity_feed_family_select') then
    create policy activity_feed_family_select on public.activity_feed
      for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_feed' and policyname='activity_feed_family_write') then
    create policy activity_feed_family_write on public.activity_feed
      for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and u.family_id = activity_feed.family_id));
  end if;
end $$;

-- Shared updated_at trigger function + triggers
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_custom_categories_updated_at') then
    create trigger trg_custom_categories_updated_at before update on public.custom_categories
      for each row execute function public.set_updated_at_timestamp();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_transaction_comments_updated_at') then
    create trigger trg_transaction_comments_updated_at before update on public.transaction_comments
      for each row execute function public.set_updated_at_timestamp();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_shared_goals_updated_at') then
    create trigger trg_shared_goals_updated_at before update on public.shared_goals
      for each row execute function public.set_updated_at_timestamp();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_activity_feed_updated_at') then
    create trigger trg_activity_feed_updated_at before update on public.activity_feed
      for each row execute function public.set_updated_at_timestamp();
  end if;
end $$;


-- ============================================================
-- SECTION 5: PHASE 5 MIGRATION
-- Invite flow, recurring link, goal typing, category remap
-- ============================================================

begin;

-- 1) Users: invite-code signup columns (pending state before questionnaire completion)
alter table public.users add column if not exists pending_family_id uuid;
alter table public.users add column if not exists pending_member_id uuid;
alter table public.users add column if not exists pending_invite_code text;

-- 2) Transactions: recurring link + family spending flag
alter table public.transactions add column if not exists recurring_transaction_id uuid;
alter table public.transactions add column if not exists is_family_spending boolean not null default false;

create index if not exists idx_transactions_recurring_transaction_id on public.transactions(recurring_transaction_id);
create index if not exists idx_transactions_is_family_spending on public.transactions(is_family_spending);

-- Optional FK: recurring_transaction_id -> recurring_transactions.id
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='recurring_transactions'
  ) and not exists (
    select 1 from pg_constraint
    where conname='transactions_recurring_transaction_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_recurring_transaction_id_fkey
      foreign key (recurring_transaction_id)
      references public.recurring_transactions(id)
      on delete set null;
  end if;
end $$;

-- 3) Recurring transactions: last auto-create date for idempotency
alter table public.recurring_transactions add column if not exists last_created_date date;

-- 4) Goals: personal/shared typing metadata
alter table public.goals add column if not exists goal_type text not null default 'personal';
alter table public.goals add column if not exists is_shared boolean not null default false;
alter table public.goals add column if not exists goal_scope text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='goals_goal_type_check'
  ) then
    alter table public.goals
      add constraint goals_goal_type_check
      check (goal_type in ('personal','shared'));
  end if;
end $$;

-- Backfill goal_type/is_shared
update public.goals set is_shared = coalesce(is_shared, false);
update public.goals set goal_type = case when coalesce(is_shared,false) then 'shared' else coalesce(goal_type,'personal') end;

-- 5) Category standardization: remap old names to new standard set
-- Standard set: Daily Essentials, House Bills, Travel, Health, Lifestyle, Savings
update public.transactions set category='Daily Essentials' where category='Sustenance';
update public.transactions set category='House Bills'      where category='Home';
update public.transactions set category='Travel'           where category='Travel & Dreams';

update public.recurring_transactions set category='Daily Essentials' where category='Sustenance';
update public.recurring_transactions set category='House Bills'      where category='Home';
update public.recurring_transactions set category='Travel'           where category='Travel & Dreams';

commit;


-- ============================================================
-- SECTION 6: DATA CLEANUP UTILITY
-- Run separately when you need a fresh-start test environment.
-- DO NOT run this as part of initial setup.
-- ============================================================

-- To use: paste into Supabase SQL Editor separately and run.
-- Then manually delete auth users from Supabase Dashboard.

/*

BEGIN;

DELETE FROM activity_feed;
DELETE FROM transaction_comments;
DELETE FROM shared_goal_contributions;
DELETE FROM shared_goals;
DELETE FROM recurring_transactions;
DELETE FROM goals;
DELETE FROM wellness;
DELETE FROM meals;
DELETE FROM transactions;
DELETE FROM custom_categories;
DELETE FROM questionnaire_progress;
DO $$ BEGIN
  IF to_regclass('public.questionnaire_data') IS NOT NULL THEN
    DELETE FROM questionnaire_data;
  END IF;
END $$;
DELETE FROM nudges;
DELETE FROM push_tokens;

DELETE FROM family_members;
DELETE FROM families;
DELETE FROM users;

COMMIT;

SELECT 'All FamilyApp data deleted. Now delete users from Supabase Auth dashboard.' AS message;

*/


-- ============================================================
-- END OF CONSOLIDATED SCHEMA
-- ============================================================
-- Tables created (in dependency order):
--   families
--   users
--   family_members
--   transactions
--   meals
--   wellness
--   goals
--   foods
--   nudges
--   push_tokens
--   questionnaire_data (intelligence side table)
--   questionnaire_progress
--   recurring_transactions
--   custom_categories
--   transaction_comments
--   shared_goals
--   shared_goal_contributions
--   activity_feed
-- ============================================================
