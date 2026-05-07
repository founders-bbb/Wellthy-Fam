-- =====================================================================================
-- FAMILY APP — Silent Hours (build #10)
-- Adds three columns to public.users for the calm-Home-screen feature.
--
-- Default 22:00–08:00 IST. Existing rows get the same defaults via ALTER ... DEFAULT,
-- so backfill is a no-op (every existing user is opted in by default — matches the
-- product spec that silent mode is brand-defining and on by default).
-- =====================================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS silent_hours_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS silent_hours_start time NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS silent_hours_end   time NOT NULL DEFAULT '08:00';

COMMENT ON COLUMN public.users.silent_hours_enabled IS 'Wellthy Fam Silent Hours: when true, HomeScreen renders the calm moon screen between start and end. Default ON.';
COMMENT ON COLUMN public.users.silent_hours_start   IS 'Local-time HH:MM:SS at which Silent Hours begin. Default 22:00.';
COMMENT ON COLUMN public.users.silent_hours_end     IS 'Local-time HH:MM:SS at which Silent Hours end. Default 08:00.';
