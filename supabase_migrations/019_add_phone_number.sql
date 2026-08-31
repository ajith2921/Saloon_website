-- ==========================================
-- PHASE: SMS NOTIFICATIONS & PHONE NUMBERS
-- ==========================================

-- 1. Add guest_phone to tokens (for walk-ins)
ALTER TABLE public.tokens
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 3. Add guest_phone to live_queue
ALTER TABLE public.live_queue
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 4. Update the sync trigger to carry over guest_phone
CREATE OR REPLACE FUNCTION public.sync_live_queue()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.live_queue (
            token_id, salon_id, service_id, worker_id, status, 
            created_at, called_at, started_at, completed_at, cancelled_at, 
            guest_name, guest_phone
        ) VALUES (
            NEW.id, NEW.salon_id, NEW.service_id, NEW.worker_id, NEW.status, 
            NEW.created_at, NEW.called_at, NEW.started_at, NEW.completed_at, NEW.cancelled_at, 
            NEW.guest_name, NEW.guest_phone
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.live_queue SET
            status = NEW.status,
            worker_id = NEW.worker_id,
            called_at = NEW.called_at,
            started_at = NEW.started_at,
            completed_at = NEW.completed_at,
            cancelled_at = NEW.cancelled_at,
            guest_name = NEW.guest_name,
            guest_phone = NEW.guest_phone
        WHERE token_id = NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.live_queue WHERE token_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Drop the old create_queue_token function
DROP FUNCTION IF EXISTS public.create_queue_token(UUID, UUID, UUID, UUID, TEXT);

-- 6. Recreate the function with the p_guest_phone parameter
CREATE OR REPLACE FUNCTION public.create_queue_token(
  p_salon_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_worker_id UUID DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL
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
  INSERT INTO public.tokens (salon_id, customer_id, guest_name, guest_phone, service_id, worker_id, token_number, status, date)
  VALUES (p_salon_id, p_customer_id, p_guest_name, p_guest_phone, p_service_id, p_worker_id, v_next_number, 'waiting', CURRENT_DATE)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT, TEXT) TO service_role;
