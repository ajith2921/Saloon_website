-- 021_fix_live_queue_trigger.sql
-- ============================================================
-- ROOT CAUSE FIX: Migration 019 rewrote sync_live_queue() using a
-- column called "token_id" which does NOT exist in the live_queue table.
-- The actual PK column is "id" (= tokens.id), as created in migration 012.
-- Migration 019 also omitted "token_number" from the INSERT, which would
-- break the public live queue display.
--
-- This migration:
--   1. Rewrites sync_live_queue() to correctly use "id" (not "token_id")
--   2. Restores "token_number" in the INSERT
--   3. Keeps "guest_phone" added by migration 019
--   4. Preserves the salon-timezone-aware date logic from migration 018
--   5. Keeps live_queue as an "active tokens only" mirror (removes inactive)
--   6. Recreates the trigger to ensure the new function is used
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_live_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_tz   TEXT;
    v_today DATE;
BEGIN
    -- ── DELETE: token physically removed ─────────────────────────────────
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- ── INSERT / UPDATE: determine salon's local "today" ─────────────────
    SELECT COALESCE(timezone, 'Asia/Kolkata')
    INTO v_tz
    FROM public.salons
    WHERE id = NEW.salon_id;

    v_today := (NOW() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::DATE;

    -- Only mirror active tokens for the current business day.
    -- Completed, cancelled, skipped tokens are removed from live view.
    IF NEW.status IN ('waiting', 'called', 'serving') AND NEW.date = v_today THEN
        INSERT INTO public.live_queue (
            id, salon_id, token_number, status,
            service_id, worker_id,
            created_at, called_at, started_at,
            guest_name, guest_phone
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.token_number, NEW.status,
            NEW.service_id, NEW.worker_id,
            NEW.created_at, NEW.called_at, NEW.started_at,
            NEW.guest_name, NEW.guest_phone
        )
        ON CONFLICT (id) DO UPDATE SET
            status      = EXCLUDED.status,
            worker_id   = EXCLUDED.worker_id,
            called_at   = EXCLUDED.called_at,
            started_at  = EXCLUDED.started_at,
            guest_name  = EXCLUDED.guest_name,
            guest_phone = EXCLUDED.guest_phone;
    ELSE
        -- Token is inactive or from a previous day — remove from live view
        DELETE FROM public.live_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS tokens_sync_live_queue_trigger ON public.tokens;
CREATE TRIGGER tokens_sync_live_queue_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.tokens
    FOR EACH ROW EXECUTE FUNCTION public.sync_live_queue();
