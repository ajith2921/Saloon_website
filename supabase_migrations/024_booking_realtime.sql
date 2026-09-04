-- 024_booking_realtime.sql
-- ============================================================
-- Feature: Real-time Booking Mode
-- Adds is_booking and scheduled_for to live_queue, enabling 
-- real-time websocket tracking of upcoming scheduled appointments.
-- ============================================================

ALTER TABLE public.live_queue
  ADD COLUMN IF NOT EXISTS is_booking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NULL;

-- Trigger function to keep live_queue synchronized with active tokens
CREATE OR REPLACE FUNCTION public.sync_live_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_tz   TEXT;
    v_today DATE;
BEGIN
    -- ❌ DELETE: token physically removed ❌
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- 🕒 INSERT / UPDATE: determine salon's local "today" 🕒
    SELECT COALESCE(timezone, 'Asia/Kolkata')
    INTO v_tz
    FROM public.salons
    WHERE id = NEW.salon_id;

    v_today := (NOW() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::DATE;

    -- Only mirror active tokens for the current business day.
    -- Completed, cancelled, skipped tokens are removed from live view.
    IF NEW.status IN ('waiting', 'called', 'serving', 'scheduled') AND NEW.date = v_today THEN
        INSERT INTO public.live_queue (
            id, salon_id, token_number, status,
            service_id, worker_id,
            created_at, called_at, started_at,
            guest_name, guest_phone,
            is_booking, scheduled_for
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.token_number, NEW.status,
            NEW.service_id, NEW.worker_id,
            NEW.created_at, NEW.called_at, NEW.started_at,
            NEW.guest_name, NEW.guest_phone,
            NEW.is_booking, NEW.scheduled_for
        )
        ON CONFLICT (id) DO UPDATE SET
            status        = EXCLUDED.status,
            worker_id     = EXCLUDED.worker_id,
            called_at     = EXCLUDED.called_at,
            started_at    = EXCLUDED.started_at,
            guest_name    = EXCLUDED.guest_name,
            guest_phone   = EXCLUDED.guest_phone,
            is_booking    = EXCLUDED.is_booking,
            scheduled_for = EXCLUDED.scheduled_for;
    ELSE
        -- Token is inactive or from a previous day - remove from live view
        DELETE FROM public.live_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
