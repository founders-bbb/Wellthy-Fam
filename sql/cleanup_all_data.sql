-- ===================================
-- FAMILYAPP DATA CLEANUP SCRIPT
-- Deletes ALL user/application data for fresh start
-- Does NOT delete table structure, schema, policies, or migrations
-- ===================================

-- NOTE:
-- 1) Run this in Supabase SQL Editor.
-- 2) auth.users is managed by Supabase Auth and is NOT deleted here.
-- 3) Delete auth users manually from Supabase Dashboard after running this.

BEGIN;

-- Collaboration + activity
DELETE FROM activity_feed;
DELETE FROM transaction_comments;
DELETE FROM shared_goal_contributions;
DELETE FROM shared_goals;

-- Core logs
DELETE FROM recurring_transactions;
DELETE FROM goals;
DELETE FROM wellness;
DELETE FROM meals;
DELETE FROM transactions;

-- Supporting metadata
DELETE FROM custom_categories;
DELETE FROM questionnaire_progress;
-- Optional intelligence-layer table (if present)
DO $$ BEGIN
  IF to_regclass('public.questionnaire_data') IS NOT NULL THEN
    DELETE FROM questionnaire_data;
  END IF;
END $$;
-- questionnaire answers now live in users.questionnaire_data (column), not a separate table.
DELETE FROM nudges;
DELETE FROM push_tokens;
DELETE FROM family_scores;
DELETE FROM streaks;

-- Family graph
DELETE FROM family_members;
DELETE FROM families;

-- App user profiles (public.users table)
DELETE FROM users;

COMMIT;

-- Success message
SELECT 'All FamilyApp data deleted successfully. Delete users from Authentication > Users for a true fresh start.' AS message;
