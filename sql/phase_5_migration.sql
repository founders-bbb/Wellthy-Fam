-- FamilyApp Phase 5 Migration
-- Safe to run multiple times.

begin;

-- 1) Users: support invite-code signup before questionnaire completion
alter table public.users add column if not exists pending_family_id uuid;
alter table public.users add column if not exists pending_member_id uuid;
alter table public.users add column if not exists pending_invite_code text;

-- 2) Transactions: recurring-link + family spending flag
alter table public.transactions add column if not exists recurring_transaction_id uuid;
alter table public.transactions add column if not exists is_family_spending boolean not null default false;

create index if not exists idx_transactions_recurring_transaction_id on public.transactions(recurring_transaction_id);
create index if not exists idx_transactions_is_family_spending on public.transactions(is_family_spending);

-- Optional FK if table exists and FK is not already present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='recurring_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='transactions_recurring_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_recurring_transaction_id_fkey
      FOREIGN KEY (recurring_transaction_id)
      REFERENCES public.recurring_transactions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Recurring transactions: last auto-create date for idempotency and audit
alter table public.recurring_transactions add column if not exists last_created_date date;

-- 4) Goals: personal/shared typing metadata
alter table public.goals add column if not exists goal_type text not null default 'personal';
alter table public.goals add column if not exists is_shared boolean not null default false;
alter table public.goals add column if not exists goal_scope text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='goals_goal_type_check'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_goal_type_check
      CHECK (goal_type in ('personal','shared'));
  END IF;
END $$;

-- Backfill goal_type/is_shared from any existing data patterns
update public.goals
set is_shared = coalesce(is_shared,false);

update public.goals
set goal_type = case when coalesce(is_shared,false) then 'shared' else coalesce(goal_type,'personal') end;

-- 5) Standardize categories (old -> new)
update public.transactions set category='Daily Essentials' where category='Sustenance';
update public.transactions set category='House Bills' where category='Home';
update public.transactions set category='Travel' where category='Travel & Dreams';

update public.recurring_transactions set category='Daily Essentials' where category='Sustenance';
update public.recurring_transactions set category='House Bills' where category='Home';
update public.recurring_transactions set category='Travel' where category='Travel & Dreams';

commit;
