-- 022_add_booking_support.sql
-- ============================================================
-- Feature: Book Appointment
-- Adds support for 'is_booking' and 'scheduled_for' fields in create_queue_token
-- Merges the guest_phone addition from migration 019 with booking logic.
-- ============================================================

-- Drop the old 6-parameter function from migration 019
DROP FUNCTION IF EXISTS public.create_queue_token(UUID, UUID, UUID, UUID, TEXT, TEXT);

-- Create the new 8-parameter function
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
BEGIN
  IF p_customer_id IS NULL AND p_guest_name IS NULL THEN 
    RAISE EXCEPTION 'CUSTOMER_OR_GUEST_REQUIRED'; 
  END IF;

  IF p_is_booking AND p_scheduled_for IS NULL THEN
    RAISE EXCEPTION 'SCHEDULED_TIME_REQUIRED_FOR_BOOKING';
  END IF;

  -- Lock the salon date if it's a live queue token. For bookings, we lock the scheduled date.
  IF p_is_booking THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text || (p_scheduled_for AT TIME ZONE 'UTC')::date::text));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text || CURRENT_DATE::text));
  END IF;
  
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
  
  IF p_customer_id IS NOT NULL AND NOT p_is_booking THEN
    -- Only prevent multiple active tokens for live queue. Users can have multiple future bookings.
    IF EXISTS (
      SELECT 1 FROM public.tokens
      WHERE salon_id = p_salon_id AND customer_id = p_customer_id
        AND date = CURRENT_DATE AND status IN ('waiting', 'called', 'serving')
    ) THEN RAISE EXCEPTION 'ACTIVE_TOKEN_EXISTS'; END IF;
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
  AND date = COALESCE((p_scheduled_for AT TIME ZONE 'UTC')::date, CURRENT_DATE);

  RETURN QUERY
  INSERT INTO public.tokens (
    salon_id, customer_id, guest_name, guest_phone, service_id, worker_id, 
    token_number, status, date, is_booking, scheduled_for
  )
  VALUES (
    p_salon_id, p_customer_id, p_guest_name, p_guest_phone, p_service_id, p_worker_id, 
    v_next_number, 
    CASE WHEN p_is_booking THEN 'scheduled'::token_status ELSE 'waiting'::token_status END, 
    COALESCE((p_scheduled_for AT TIME ZONE 'UTC')::date, CURRENT_DATE),
    p_is_booking, p_scheduled_for
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT, TEXT, BOOLEAN, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID, TEXT, TEXT, BOOLEAN, TIMESTAMP WITH TIME ZONE) TO service_role;
