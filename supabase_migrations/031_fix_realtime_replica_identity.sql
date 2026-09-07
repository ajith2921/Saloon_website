-- 031_fix_realtime_replica_identity.sql
-- Fixes realtime UPDATE events being dropped by Supabase filters.
-- When REPLICA IDENTITY is DEFAULT, the UPDATE payload only contains the primary key and the updated columns.
-- If the filter column (e.g., salon_id) is not updated, it's missing from the payload, causing the filter to fail.
-- Setting REPLICA IDENTITY to FULL ensures all columns (including salon_id) are present in the payload.

ALTER TABLE public.tokens REPLICA IDENTITY FULL;
