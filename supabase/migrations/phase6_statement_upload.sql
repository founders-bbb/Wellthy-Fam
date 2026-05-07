-- =====================================================================================
-- Phase 6 — Bank/credit-card statement upload
-- File: supabase/migrations/phase6_statement_upload.sql
--
-- Wedge feature: user uploads a PDF statement → Claude vision parses it → user reviews
-- and confirms → confirmed transactions land in public.transactions.
--
-- This migration adds:
--   * statement_imports          — one row per upload-and-parse session
--   * statement_transactions     — staging table for parsed rows awaiting review
--   * merchant_categories        — per-family memory of merchant→category overrides
--   * 4 new nullable columns on transactions to track statement origin
--   * RLS for the three new tables (own-row patterns)
--   * bank-statements storage bucket (private, 10 MB, application/pdf only)
--   * RLS on storage.objects scoping bank-statements/{user_id}/* to that user
--
-- ── COLUMN-LEVEL CONVENTIONS THIS MIGRATION ASSUMES (READ BEFORE EDITING) ────────
--
-- 1. transactions.merchant is NOT NULL with no default. The finalize-statement-import
--    edge function fills it via priority chain:
--        merchant = merchant_normalized || raw_narration || 'Statement entry'
--    so the constraint is never tripped even when Claude returns ambiguous narrations.
--
-- 2. transactions.user_id population: statement-imported rows WILL have user_id set
--    (the import flow has an authenticated user). Manually-entered rows from
--    AddTxModal and QuickLogSheet still don't set user_id (existing app behavior;
--    not changing in this migration). Net effect: post-migration, two row populations
--    exist — imports with user_id, manual entries without. A backfill of manual
--    entries (deriving user_id from member_id → family_members.user_id) can happen
--    in a future cleanup migration, not now.
--
-- 3. Income detection convention: existing app code reads income from category='Income'
--    (the transactions.type column exists but is unused). Statement imports follow
--    the same convention:
--      - Bank account credits (deposits, salary, refunds)         → category='Income'
--      - Credit-card "payment to card" (user paying their bill)   → category='Income'
--      - Everything else                                          → categorized normally
--    transaction_type ('debit'/'credit') is preserved on statement_transactions for
--    audit/UI purposes but transactions.type is left unused.
--
-- ── TODO ────────────────────────────────────────────────────────────────────────
-- After this migration is APPLIED to prod, regenerate familyapp_complete_schema.sql
-- to capture the new tables/columns/policies/storage bucket in the source-of-truth doc.
-- (We skipped pre-apply regen so the doc reflects real state, not pre-application
-- state.)
-- =====================================================================================

-- ── 1. statement_imports — tracks each upload-and-parse session ─────────────────
create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  document_type text not null check (document_type in ('bank_account','credit_card')),
  bank_name text,
  account_last4 text,
  period_start date,
  period_end date,
  total_credits numeric(14,2),
  total_debits numeric(14,2),
  source_file_path text,
  delete_after timestamptz not null default (now() + interval '24 hours'),
  status text not null default 'parsing' check (status in ('parsing','review','imported','failed','expired')),
  parse_method text,
  failure_reason text,
  parsed_transaction_count int,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

create index if not exists idx_statement_imports_user on public.statement_imports(user_id);
create index if not exists idx_statement_imports_status on public.statement_imports(status);
create index if not exists idx_statement_imports_delete_after on public.statement_imports(delete_after);

-- ── 2. statement_transactions — staging for parsed rows awaiting review ─────────
create table if not exists public.statement_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null references public.statement_imports(id) on delete cascade,
  raw_narration text not null,
  parsed_date date,
  amount numeric(14,2) not null,
  transaction_type text not null check (transaction_type in ('debit','credit')),
  merchant_normalized text,
  category_suggested text,
  confidence_score numeric(3,2) not null default 0.5 check (confidence_score >= 0 and confidence_score <= 1),
  category_confirmed text,
  user_action text not null default 'pending' check (user_action in ('pending','confirmed','discarded','imported')),
  created_at timestamptz not null default now()
);

create index if not exists idx_st_tx_import on public.statement_transactions(statement_import_id);
create index if not exists idx_st_tx_user_action on public.statement_transactions(user_action);

-- ── 3. merchant_categories — per-family memory of merchant→category overrides ───
--    Auto-applies on next import. Single confirmation is enough.
create table if not exists public.merchant_categories (
  family_id uuid not null references public.families(id) on delete cascade,
  merchant_normalized text not null,
  category text not null,
  is_family_spending bool not null default true,
  confirmation_count int not null default 1,
  last_confirmed_at timestamptz not null default now(),
  primary key (family_id, merchant_normalized)
);

create index if not exists idx_merchant_categories_family on public.merchant_categories(family_id);

-- ── 4. Extend transactions to track statement origin (all nullable) ─────────────
alter table public.transactions
  add column if not exists statement_import_id uuid references public.statement_imports(id) on delete set null,
  add column if not exists raw_narration text,
  add column if not exists merchant_normalized text,
  add column if not exists confidence_score numeric(3,2);

create index if not exists idx_transactions_statement_import on public.transactions(statement_import_id);

-- ── 5. RLS for the three new tables ─────────────────────────────────────────────
alter table public.statement_imports enable row level security;
alter table public.statement_transactions enable row level security;
alter table public.merchant_categories enable row level security;

-- statement_imports: each user reads/writes their own
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_imports' and policyname='statement_imports_self_select') then
    create policy "statement_imports_self_select" on public.statement_imports for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_imports' and policyname='statement_imports_self_insert') then
    create policy "statement_imports_self_insert" on public.statement_imports for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_imports' and policyname='statement_imports_self_update') then
    create policy "statement_imports_self_update" on public.statement_imports for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_imports' and policyname='statement_imports_self_delete') then
    create policy "statement_imports_self_delete" on public.statement_imports for delete using (user_id = auth.uid());
  end if;
end $$;

-- statement_transactions: read/write tied to parent statement_import's owner
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_transactions' and policyname='st_tx_select_via_parent') then
    create policy "st_tx_select_via_parent" on public.statement_transactions for select using (
      exists (select 1 from public.statement_imports si where si.id = statement_import_id and si.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_transactions' and policyname='st_tx_insert_via_parent') then
    create policy "st_tx_insert_via_parent" on public.statement_transactions for insert with check (
      exists (select 1 from public.statement_imports si where si.id = statement_import_id and si.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_transactions' and policyname='st_tx_update_via_parent') then
    create policy "st_tx_update_via_parent" on public.statement_transactions for update using (
      exists (select 1 from public.statement_imports si where si.id = statement_import_id and si.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='statement_transactions' and policyname='st_tx_delete_via_parent') then
    create policy "st_tx_delete_via_parent" on public.statement_transactions for delete using (
      exists (select 1 from public.statement_imports si where si.id = statement_import_id and si.user_id = auth.uid())
    );
  end if;
end $$;

-- merchant_categories: scoped to family membership
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchant_categories' and policyname='merchant_cat_family_select') then
    create policy "merchant_cat_family_select" on public.merchant_categories for select using (
      family_id in (select family_id from public.family_members where user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchant_categories' and policyname='merchant_cat_family_insert') then
    create policy "merchant_cat_family_insert" on public.merchant_categories for insert with check (
      family_id in (select family_id from public.family_members where user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchant_categories' and policyname='merchant_cat_family_update') then
    create policy "merchant_cat_family_update" on public.merchant_categories for update using (
      family_id in (select family_id from public.family_members where user_id = auth.uid())
    );
  end if;
end $$;

-- ── 6. Storage bucket: bank-statements (private, 10 MB, PDF only) ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-statements',
  'bank-statements',
  false,
  10485760,                                -- 10 MB
  array['application/pdf']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- ── 7. Storage RLS — scope bank-statements/{user_id}/* to that user ─────────────
--    Modern Supabase storage RLS lives on storage.objects via pg_policies. The
--    older storage.policies table doesn't exist on this instance.
--    Path convention: {user_id}/{statement_import_id}.pdf — folder prefix gates access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='bank_statements_user_select'
  ) then
    create policy "bank_statements_user_select" on storage.objects
      for select to authenticated
      using (bucket_id = 'bank-statements' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='bank_statements_user_insert'
  ) then
    create policy "bank_statements_user_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'bank-statements' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='bank_statements_user_delete'
  ) then
    create policy "bank_statements_user_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'bank-statements' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
