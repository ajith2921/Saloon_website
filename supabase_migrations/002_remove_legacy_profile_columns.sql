-- 002_remove_legacy_profile_columns.sql
-- Removes legacy columns from the profiles table that are no longer used by the application
-- and are not present in the canonical supabase_schema.sql.

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS email;

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS salon_id;
