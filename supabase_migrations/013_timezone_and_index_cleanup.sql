-- 013_timezone_and_index_cleanup.sql

-- 1. Remove redundant composite index introduced in 011
DROP INDEX IF EXISTS public.idx_tokens_salon_date;

-- 2. Update the sync_live_queue trigger to remove timezone-dependent CURRENT_DATE
CREATE OR REPLACE FUNCTION public.sync_live_queue() 
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- Only mirror active tokens. We explicitly remove the `NEW.date = CURRENT_DATE` 
    -- check because the business date is already established at token creation,
    -- and a token's active status ('waiting', 'called', 'serving') definitively 
    -- indicates it belongs in the live queue regardless of timezone boundaries.
    IF NEW.status IN ('waiting', 'called', 'serving') THEN
        INSERT INTO public.live_queue (
            id, salon_id, token_number, status, service_id, worker_id, 
            date, created_at, called_at, started_at, completed_at, cancelled_at, guest_name
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.token_number, NEW.status, NEW.service_id, NEW.worker_id,
            NEW.date, NEW.created_at, NEW.called_at, NEW.started_at, NEW.completed_at, NEW.cancelled_at, NEW.guest_name
        )
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            service_id = EXCLUDED.service_id,
            worker_id = EXCLUDED.worker_id,
            called_at = EXCLUDED.called_at,
            started_at = EXCLUDED.started_at;
    ELSE
        -- Remove if it becomes completed, cancelled, or skipped
        DELETE FROM public.live_queue WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
