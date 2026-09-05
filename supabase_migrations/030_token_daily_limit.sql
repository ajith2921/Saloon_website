-- 030_token_daily_limit.sql
-- ============================================================
-- Feature: Global Token Limit
-- Restricts users to 1 non-cancelled token per day across the entire app.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_queue_token(
  p_salon_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_worker_id UUID DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_is_booking BOOLEAN DEFAULT false,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS SETOF public.tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon public.salons%ROWTYPE;
  v_next_number INTEGER;
  v_target_date DATE;
BEGIN
  IF p_customer_id IS NULL AND p_guest_name IS NULL THEN 
    RAISE EXCEPTION 'CUSTOMER_OR_GUEST_REQUIRED'; 
  END IF;

  IF p_is_booking AND p_scheduled_for IS NULL THEN
    RAISE EXCEPTION 'SCHEDULED_TIME_REQUIRED_FOR_BOOKING';
  END IF;

  v_target_date := COALESCE((p_scheduled_for AT TIME ZONE 'UTC')::date, CURRENT_DATE);

  -- Lock the salon date if it's a live queue token. For bookings, we lock the scheduled date.
  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text || v_target_date::text));
  
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
  
  IF p_customer_id IS NOT NULL THEN
    -- Enforce 1 token per day across the entire app (unless cancelled)
    IF EXISTS (
      SELECT 1 FROM public.tokens
      WHERE customer_id = p_customer_id
        AND date = v_target_date 
        AND status != 'cancelled'
    ) THEN RAISE EXCEPTION 'DAILY_TOKEN_LIMIT_PER_USER_REACHED'; END IF;
  END IF;
  
  IF NOT p_is_booking THEN
    IF (
      SELECT count(*) FROM public.tokens
      WHERE salon_id = p_salon_id AND date = CURRENT_DATE
    ) >= v_salon.max_daily_tokens THEN RAISE EXCEPTION 'DAILY_TOKEN_LIMIT_REACHED'; END IF;
  END IF;

  -- Get next token number for the specific date
  SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_number
  FROM public.tokens 
  WHERE salon_id = p_salon_id 
  AND date = v_target_date;

  RETURN QUERY
  INSERT INTO public.tokens (
    salon_id, customer_id, guest_name, guest_phone, service_id, worker_id, 
    token_number, status, date, is_booking, scheduled_for
  )
  VALUES (
    p_salon_id, p_customer_id, p_guest_name, p_guest_phone, p_service_id, p_worker_id, 
    v_next_number, 
    CASE WHEN p_is_booking THEN 'scheduled'::token_status ELSE 'waiting'::token_status END, 
    v_target_date,
    p_is_booking, p_scheduled_for
  )
  RETURNING *;
END;
$$;
