-- 016_salons_timezone.sql
-- Adds a timezone column to salons so that "today" calculations use the
-- salon's local business time rather than the server's UTC clock.

-- ============================================================
-- PART 1: ADD timezone COLUMN
-- ============================================================
ALTER TABLE public.salons
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- ============================================================
-- PART 2: VALIDATE timezone COLUMN (IANA names via AT TIME ZONE)
-- ============================================================
-- PostgreSQL can validate IANA timezone names with AT TIME ZONE.
-- We enforce this with a CHECK CONSTRAINT.
ALTER TABLE public.salons
    DROP CONSTRAINT IF EXISTS chk_salons_valid_timezone;

ALTER TABLE public.salons
    ADD CONSTRAINT chk_salons_valid_timezone
    CHECK (
        -- This will throw if the timezone name is invalid
        -- The exception will propagate and reject the INSERT/UPDATE.
        -- We use a simple expression: if the tz name is invalid, the cast fails.
        (NOW() AT TIME ZONE timezone) IS NOT NULL
    );

-- ============================================================
-- PART 3: HELPER — get_business_today_for_salon(salon_id)
-- Returns the current DATE in the salon's local timezone.
-- All queue management and analytics should call this rather than CURRENT_DATE.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_business_today_for_salon(p_salon_id UUID)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tz TEXT;
BEGIN
    SELECT COALESCE(timezone, 'Asia/Kolkata')
    INTO v_tz
    FROM public.salons
    WHERE id = p_salon_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Salon not found: %', p_salon_id;
    END IF;

    RETURN (NOW() AT TIME ZONE v_tz)::DATE;
END;
$$;

-- ============================================================
-- PART 4: UPDATE sync_live_queue to use salon-local date
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_live_queue()
RETURNS trigger AS $$
DECLARE
    v_tz TEXT;
    v_today DATE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- Get the salon's local date
    SELECT COALESCE(timezone, 'Asia/Kolkata')
    INTO v_tz
    FROM public.salons
    WHERE id = NEW.salon_id;

    v_today := (NOW() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::DATE;

    -- Only mirror active tokens for the current business day
    IF NEW.status IN ('waiting', 'called', 'serving') AND NEW.date = v_today THEN
        INSERT INTO public.live_queue (
            id, salon_id, token_number, status, service_id, worker_id,
            date, created_at, called_at, started_at, guest_name
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.token_number, NEW.status, NEW.service_id, NEW.worker_id,
            NEW.date, NEW.created_at, NEW.called_at, NEW.started_at, NEW.guest_name
        )
        ON CONFLICT (id) DO UPDATE SET
            status     = EXCLUDED.status,
            worker_id  = EXCLUDED.worker_id,
            called_at  = EXCLUDED.called_at,
            started_at = EXCLUDED.started_at;
    ELSE
        -- Remove from live queue if status is no longer active or date rolled over
        DELETE FROM public.live_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
