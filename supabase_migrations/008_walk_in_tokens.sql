-- ==========================================
-- PHASE: WALK-IN TOKENS & QUEUE REFINEMENT
-- ==========================================

-- 1. Add guest_name column to tokens
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- 2. Drop NOT NULL constraint on customer_id if it exists
ALTER TABLE public.tokens 
ALTER COLUMN customer_id DROP NOT NULL;

-- 3. Ensure a token has either a customer_id OR a guest_name
ALTER TABLE public.tokens 
DROP CONSTRAINT IF EXISTS tokens_customer_or_guest_check;

ALTER TABLE public.tokens 
ADD CONSTRAINT tokens_customer_or_guest_check 
CHECK (customer_id IS NOT NULL OR guest_name IS NOT NULL);

-- 4. Update the create_queue_token function to accept p_guest_name
CREATE OR REPLACE FUNCTION public.create_queue_token(
  p_salon_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_worker_id UUID DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS SETOF public.tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon public.salons%ROWTYPE;
  v_next_number INTEGER;
BEGIN
  IF p_customer_id IS NULL AND p_guest_name IS NULL THEN 
    RAISE EXCEPTION 'CUSTOMER_OR_GUEST_REQUIRED'; 
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text || CURRENT_DATE::text));
  
  -- Optimization: Remove FOR UPDATE since advisory lock already handles concurrency
  SELECT * INTO v_salon FROM public.salons WHERE id = p_salon_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'SALON_NOT_FOUND'; END IF;
  IF v_salon.status <> 'active' THEN RAISE EXCEPTION 'SALON_NOT_ACCEPTING_TOKENS'; END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.services
    WHERE id = p_service_id AND salon_id = p_salon_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'SERVICE_UNAVAILABLE'; END IF;
  
  IF p_worker_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workers
    WHERE id = p_worker_id AND salon_id = p_salon_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'WORKER_UNAVAILABLE'; END IF;
  
  -- Only check active token existence for registered customers
  IF p_customer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tokens
      WHERE salon_id = p_salon_id AND customer_id = p_customer_id
        AND date = CURRENT_DATE AND status IN ('waiting', 'called', 'serving')
    ) THEN RAISE EXCEPTION 'ACTIVE_TOKEN_EXISTS'; END IF;
  END IF;
  
  IF (
    SELECT count(*) FROM public.tokens
    WHERE salon_id = p_salon_id AND date = CURRENT_DATE
  ) >= v_salon.max_daily_tokens THEN RAISE EXCEPTION 'DAILY_TOKEN_LIMIT_REACHED'; END IF;

  SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_number
  FROM public.tokens WHERE salon_id = p_salon_id AND date = CURRENT_DATE;

  RETURN QUERY
  INSERT INTO public.tokens (salon_id, customer_id, guest_name, service_id, worker_id, token_number, status, date)
  VALUES (p_salon_id, p_customer_id, p_guest_name, p_service_id, p_worker_id, v_next_number, 'waiting', CURRENT_DATE)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT) TO service_role;
