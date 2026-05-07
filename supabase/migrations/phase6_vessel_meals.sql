-- =====================================================================================
-- Phase 6 — Vessel-based meal logging
-- File: supabase/migrations/phase6_vessel_meals.sql
--
-- Splits meal accuracy at its root: free-text + AI guess → vessel-based + AI parse +
-- per-user portion memory. Adds curated nutrition lookup (food_vessels), per-user
-- portion memory (user_dish_portions), extends meals with vessel-tracking columns,
-- and exposes get_user_top_dishes() for the quick-pick chip UI.
--
-- Idempotent: re-running this migration is a no-op (uses `if not exists` and
-- `add column if not exists` everywhere; the meal_logs drop is guarded by an
-- existence check + a "must be empty" assertion).
--
-- See also: supabase/functions/parse-meal-log (rewritten in this same change),
-- supabase/functions/update-portion-memory (new), supabase/functions/generate-nudge
-- (migrated from meal_logs to meals).
-- =====================================================================================

-- ── 1. Drop meal_logs (was empty in prod; only the old parse-meal-log wrote to it,
--      and only generate-nudge read from it). Generate-nudge has been migrated to
--      read from `meals` directly. The DO block aborts if rows have appeared since
--      the audit — protects us if state changed between analysis and apply.
do $$
begin
  if to_regclass('public.meal_logs') is not null
     and exists (select 1 from public.meal_logs limit 1) then
    raise exception 'meal_logs has rows — abort drop, investigate first';
  end if;
end $$;

drop table if exists public.meal_logs cascade;

-- ── 2. food_vessels — curated dish-to-nutrition mappings (ICMR/curated/ai-estimate).
--      Reference data: read by all authenticated users, no user writes (no INSERT/UPDATE/
--      DELETE policy means no API access; only admin/migrations can populate).
create table if not exists public.food_vessels (
  id uuid primary key default gen_random_uuid(),
  dish_name text not null,
  dish_normalized text not null unique,
  default_vessel text not null check (default_vessel in ('katori','plate','piece','glass','spoon')),
  vessel_grams numeric(6,2) not null,
  protein_per_gram numeric(6,4) not null,
  carbs_per_gram numeric(6,4) not null,
  fat_per_gram numeric(6,4) not null,             -- HOME-COOKED baseline
  calories_per_gram numeric(6,2) not null,
  restaurant_fat_multiplier numeric(4,2) not null default 1.30,
  category text,                                   -- curry/rice/bread/snack/sweet/drink/dal/sabzi/dairy/fruit/other
  source text default 'icmr',                      -- icmr/curated/ai_estimate
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_food_vessels_normalized on public.food_vessels(dish_normalized);
create index if not exists idx_food_vessels_category on public.food_vessels(category);

alter table public.food_vessels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='food_vessels' and policyname='food_vessels_read_authenticated'
  ) then
    create policy "food_vessels_read_authenticated" on public.food_vessels
      for select to authenticated using (true);
  end if;
end $$;

-- ── 3. user_dish_portions — per-user portion memory. What THIS user typically eats
--      of THIS dish. Updated post-meal-save by update-portion-memory edge function.
create table if not exists public.user_dish_portions (
  user_id uuid not null references public.users(id) on delete cascade,
  dish_normalized text not null,
  last_quantity numeric(5,2) not null default 1,
  last_unit text not null default 'katori',
  last_cooking_style text not null default 'home' check (last_cooking_style in ('home','restaurant')),
  log_count int not null default 1,
  last_logged_at timestamptz default now(),
  primary key (user_id, dish_normalized)
);

create index if not exists idx_user_dish_portions_user on public.user_dish_portions(user_id);

alter table public.user_dish_portions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dish_portions' and policyname='user_dish_portions_self_select') then
    create policy "user_dish_portions_self_select" on public.user_dish_portions for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dish_portions' and policyname='user_dish_portions_self_insert') then
    create policy "user_dish_portions_self_insert" on public.user_dish_portions for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dish_portions' and policyname='user_dish_portions_self_update') then
    create policy "user_dish_portions_self_update" on public.user_dish_portions for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dish_portions' and policyname='user_dish_portions_self_delete') then
    create policy "user_dish_portions_self_delete" on public.user_dish_portions for delete using (user_id = auth.uid());
  end if;
end $$;

-- ── 4. Extend meals with vessel-tracking columns. The new parse-meal-log + UI
--      (Prompt 4b) populate these. photo_path already exists in prod — the
--      `add column if not exists` makes that idempotent (no-op if present).
alter table public.meals
  add column if not exists vessel_unit text,
  add column if not exists vessel_quantity numeric(5,2),
  add column if not exists cooking_style text,
  add column if not exists nutrition_source text,
  add column if not exists dish_breakdown jsonb,
  add column if not exists photo_path text;

-- Add CHECK constraints separately so they're idempotent. `if not exists` isn't
-- supported on add constraint, so guard with a catalog lookup.
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema='public' and constraint_name='meals_cooking_style_check'
  ) then
    alter table public.meals
      add constraint meals_cooking_style_check
      check (cooking_style is null or cooking_style in ('home','restaurant'));
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema='public' and constraint_name='meals_nutrition_source_check'
  ) then
    alter table public.meals
      add constraint meals_nutrition_source_check
      check (nutrition_source is null or nutrition_source in ('curated','ai_estimate'));
  end if;
end $$;

-- ── 5a. upsert_user_dish_portion — atomic "save or bump" used by update-portion-memory.
--       supabase-js doesn't expose EXCLUDED.column for ON CONFLICT DO UPDATE, so we
--       wrap the spec'd insert-or-bump SQL in an RPC. One round trip per dish, no
--       read-then-write race. security definer so the function bypasses RLS — the
--       caller (edge function with service role) owns trust enforcement.
create or replace function public.upsert_user_dish_portion(
  p_user_id uuid,
  p_dish_normalized text,
  p_quantity numeric,
  p_unit text,
  p_cooking_style text
)
returns void
language sql
security definer
as $$
  insert into public.user_dish_portions (
    user_id, dish_normalized, last_quantity, last_unit, last_cooking_style,
    last_logged_at, log_count
  )
  values (
    p_user_id, p_dish_normalized, p_quantity, p_unit,
    coalesce(p_cooking_style, 'home'), now(), 1
  )
  on conflict (user_id, dish_normalized) do update set
    last_quantity = excluded.last_quantity,
    last_unit = excluded.last_unit,
    last_cooking_style = excluded.last_cooking_style,
    last_logged_at = excluded.last_logged_at,
    log_count = public.user_dish_portions.log_count + 1;
$$;

-- ── 5b. get_user_top_dishes — top N most-logged dishes for the quick-pick chips.
--      Used by the meal-log UI (Prompt 4b) to surface the user's repeated dishes.
--      security definer so it bypasses user_dish_portions RLS (the function itself
--      filters by p_user_id, which is the authenticated user passed by the client).
create or replace function public.get_user_top_dishes(p_user_id uuid, p_limit int default 4)
returns table(dish_normalized text, dish_name text, log_count int, last_quantity numeric, last_unit text)
language sql
security definer
as $$
  select
    udp.dish_normalized,
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
