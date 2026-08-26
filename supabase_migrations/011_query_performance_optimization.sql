-- 011_query_performance_optimization.sql
-- Fix: Query Performance Audit Findings

-- 1. Missing Composite Index for Analytics
-- Supports get_analytics_summary RPC which joins tokens on salon_id and date.
CREATE INDEX IF NOT EXISTS idx_tokens_salon_date 
ON public.tokens(salon_id, date);

-- 2. Missing Index on Public Salon Discovery
-- Supports public /api/salons discovery where status='active'
CREATE INDEX IF NOT EXISTS idx_salons_active 
ON public.salons(status) 
WHERE status = 'active';

-- 3. Expensive Sort on Customer History
-- Supports /api/tokens/history which filters by customer_id and orders by created_at
CREATE INDEX IF NOT EXISTS idx_tokens_customer_created 
ON public.tokens(customer_id, created_at DESC);


-- 4. N+1 Query on Token Completion (Loyalty Points)
-- Move loyalty point calculation from Python REST loop to a Postgres Trigger.
CREATE OR REPLACE FUNCTION public.trigger_award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Atomically update the user's loyalty points
    UPDATE public.profiles 
    SET loyalty_points = COALESCE(loyalty_points, 0) + v_points
    WHERE id = NEW.customer_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tokens_award_loyalty_trigger ON public.tokens;

CREATE TRIGGER tokens_award_loyalty_trigger
AFTER UPDATE OF status ON public.tokens
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status <> 'completed')
EXECUTE FUNCTION public.trigger_award_loyalty_points();
