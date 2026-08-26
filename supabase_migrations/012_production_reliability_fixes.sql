-- 012_production_reliability_fixes.sql

-- ============================================================
-- 1. SECURE PUBLIC QUEUE REALTIME
-- ============================================================
-- The tokens table restricts public SELECT via RLS to protect customer_id.
-- This breaks Supabase Realtime for the public queue. We create a sanitized
-- live_queue table managed entirely by triggers to restore public Realtime safely.

CREATE TABLE IF NOT EXISTS public.live_queue (
    id UUID PRIMARY KEY,
    salon_id UUID NOT NULL,
    token_number INT NOT NULL,
    status TEXT NOT NULL,
    service_id UUID,
    worker_id UUID,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ,
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    guest_name TEXT
);

ALTER TABLE public.live_queue ENABLE ROW LEVEL SECURITY;

-- Public can view the sanitized live queue
CREATE POLICY "Live queue viewable by everyone" 
    ON public.live_queue FOR SELECT 
    USING (true);

-- Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_queue;

-- Trigger function to keep live_queue synchronized with active tokens
CREATE OR REPLACE FUNCTION public.sync_live_queue() 
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE id = OLD.id;
        RETURN OLD;
    END IF;

    -- Only mirror active tokens for the current day to keep table bounded
    IF NEW.status IN ('waiting', 'called', 'serving') AND NEW.date = CURRENT_DATE THEN
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
        -- Remove if it becomes inactive or isn't for today
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
-- 2. LOYALTY POINTS IDEMPOTENCY
-- ============================================================
-- Ensure loyalty points are strictly awarded once per token, even if
-- status is toggled back and forth.

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
    points INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_reward_per_token UNIQUE (token_id)
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Customers can view their own loyalty history
CREATE POLICY "Users can view own loyalty transactions" 
    ON public.loyalty_transactions FOR SELECT 
    USING (auth.uid() = customer_id);

-- Replace the existing award function to use the idempotency table
CREATE OR REPLACE FUNCTION public.trigger_award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_price numeric;
    v_points int;
BEGIN
    -- Only act if a customer is attached
    IF NEW.customer_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch the price of the completed service
    SELECT price INTO v_price FROM public.services WHERE id = NEW.service_id;
    
    -- Calculate points (1 point per 10 currency units, minimum 1)
    v_points := GREATEST(1, FLOOR(COALESCE(v_price, 0) / 10));

    -- Attempt to insert idempotency record. 
    -- If it already exists for this token, do nothing.
    INSERT INTO public.loyalty_transactions (customer_id, token_id, points)
    VALUES (NEW.customer_id, NEW.id, v_points)
    ON CONFLICT (token_id) DO NOTHING;

    -- If the insert was successful, award the points
    IF FOUND THEN
        UPDATE public.profiles 
        SET loyalty_points = COALESCE(loyalty_points, 0) + v_points
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$;
