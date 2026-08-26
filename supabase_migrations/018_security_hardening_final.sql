-- 018_security_hardening_final.sql
-- Final security hardening migration. Fixes:
--   1. Missing SET search_path on SECURITY DEFINER functions
--   2. Broken protect_profile_sensitive_columns trigger (current_setting('role') unreliable)
--   3. Remaining non-cached auth.uid() RLS policies (performance)
--   4. salon-scoped live_queue Realtime subscription safety

-- ============================================================
-- FIX 1: protect_profile_sensitive_columns — correct role detection
-- ============================================================
-- current_setting('role') returns the PostgreSQL session role name,
-- NOT 'authenticated'. In Supabase:
--   - JWT user connections → role = 'authenticated'
--   - Service role connections → role = 'service_role'
-- We use auth.uid() IS NOT NULL to detect authenticated user context.
-- service_role bypasses RLS and has auth.uid() = NULL.
-- The safer approach: always reset protected fields unless auth.uid() IS NULL
-- (i.e., only service_role can modify protected fields via direct update).

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger AS $$
BEGIN
    -- auth.uid() returns NULL when called outside a user JWT context (e.g. service_role).
    -- We only restrict when running under a user JWT to allow backend to update loyalty_points.
    IF (SELECT auth.uid()) IS NOT NULL THEN
        -- Prevent authenticated users from modifying protected fields
        NEW.role            := OLD.role;
        NEW.loyalty_points  := OLD.loyalty_points;
        NEW.referral_code   := OLD.referral_code;
        NEW.referred_by     := OLD.referred_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Recreate trigger (function signature unchanged, DROP TRIGGER not needed)
DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER tr_protect_profile_sensitive_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- ============================================================
-- FIX 2: Add SET search_path to SECURITY DEFINER functions in 007
-- ============================================================
-- These were created without a safe search_path which allows
-- a malicious schema to shadow system functions.

ALTER FUNCTION public.get_salon_stats(p_salon_id UUID)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.get_salon_customers(p_salon_id UUID)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.get_analytics_summary(p_salon_id UUID)
    SET search_path = public, pg_temp;

-- handle_new_user was already fixed in migration 009 via ALTER FUNCTION
-- but the 003 CREATE OR REPLACE doesn't have it, and 009 ALTER adds it.
-- Confirm it's set:
ALTER FUNCTION public.handle_new_user()
    SET search_path = public, pg_temp;

-- ============================================================
-- FIX 3: Add SET search_path to sync_live_queue in migration 016
-- Migration 016 recreates sync_live_queue WITHOUT SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_live_queue()
RETURNS trigger AS $$
DECLARE
    v_tz   TEXT;
    v_today DATE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- Get the salon's local timezone
    SELECT COALESCE(timezone, 'Asia/Kolkata')
    INTO v_tz
    FROM public.salons
    WHERE id = NEW.salon_id;

    v_today := (NOW() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::DATE;

    -- Only mirror active tokens for the current business day
    IF NEW.status IN ('waiting', 'called', 'serving') AND NEW.date = v_today THEN
        INSERT INTO public.live_queue (
            id, salon_id, token_number, status, service_id, worker_id,
            created_at, called_at, started_at, guest_name
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.token_number, NEW.status, NEW.service_id, NEW.worker_id,
            NEW.created_at, NEW.called_at, NEW.started_at, NEW.guest_name
        )
        ON CONFLICT (id) DO UPDATE SET
            status     = EXCLUDED.status,
            worker_id  = EXCLUDED.worker_id,
            called_at  = EXCLUDED.called_at,
            started_at = EXCLUDED.started_at;
    ELSE
        DELETE FROM public.live_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tokens_sync_live_queue_trigger ON public.tokens;
CREATE TRIGGER tokens_sync_live_queue_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.tokens
    FOR EACH ROW EXECUTE FUNCTION public.sync_live_queue();

-- ============================================================
-- FIX 4: Update loyalty_transactions RLS policy to use cached auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Users can view own loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can view own loyalty transactions"
    ON public.loyalty_transactions FOR SELECT
    USING ((SELECT auth.uid()) = customer_id);

-- ============================================================
-- FIX 5: Add missing index on live_queue.salon_id for Realtime scoping
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_live_queue_salon_id ON public.live_queue(salon_id);
