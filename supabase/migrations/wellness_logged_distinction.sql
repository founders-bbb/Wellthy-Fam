-- =====================================================================================
-- FAMILY APP — Wellness logged-vs-zero distinction (Part B + C)
-- Date: 2026-05-07
--
-- Flips screen_hrs and sleep_hours defaults to NULL so the bar component can
-- distinguish "user explicitly logged 0" from "row exists but this metric was
-- never touched". Backfills sleep_hours=0 → NULL because no app code has ever
-- written sleep_hours, so every existing 0 came from the column default —
-- safe to clear. Does NOT backfill screen_hrs=0 because those values are
-- semantically ambiguous (could be explicit zero or pre-cleanup cross-fill).
--
-- The cross-fill in LogWaterModal/LogScreenTimeModal payloads is being
-- dropped in the same build, so from this point forward every 0 in either
-- column means an explicit user log.
-- =====================================================================================

-- 1. Defaults → NULL (no implicit zero on insert).
ALTER TABLE public.wellness
  ALTER COLUMN screen_hrs  DROP DEFAULT,
  ALTER COLUMN sleep_hours DROP DEFAULT;

ALTER TABLE public.wellness
  ALTER COLUMN screen_hrs  SET DEFAULT NULL,
  ALTER COLUMN sleep_hours SET DEFAULT NULL;

-- 2. CHECK constraint on sleep_hours (0–24 or NULL). Idempotent via DO block —
-- vanilla Postgres has no `ADD CONSTRAINT IF NOT EXISTS` for CHECK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wellness_sleep_hours_check'
      AND conrelid = 'public.wellness'::regclass
  ) THEN
    ALTER TABLE public.wellness
      ADD CONSTRAINT wellness_sleep_hours_check
      CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24));
  END IF;
END $$;

-- 3. One-time backfill: sleep_hours=0 → NULL. Safe because no app code has
-- ever written this column; every existing 0 is the default.
UPDATE public.wellness
   SET sleep_hours = NULL
 WHERE sleep_hours = 0;

COMMENT ON COLUMN public.wellness.screen_hrs  IS 'Hours on screens for this member-day. NULL = not logged. 0 = explicitly logged zero.';
COMMENT ON COLUMN public.wellness.sleep_hours IS 'Hours asleep last night for this member-day. NULL = not logged. 0 = explicitly logged zero.';
