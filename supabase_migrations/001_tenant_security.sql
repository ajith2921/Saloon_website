-- QueueCut tenant/security migration
-- Apply this in the Supabase SQL editor after backing up the project.
-- It is safe to run against the schema supplied with this repository.

-- A worker account can belong to one salon. The API resolves salon membership
-- from this relationship instead of relying on profiles.salon_id.
CREATE UNIQUE INDEX IF NOT EXISTS workers_user_id_unique
  ON public.workers (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tokens_queue_lookup_idx
  ON public.tokens (salon_id, date, status, token_number);

CREATE INDEX IF NOT EXISTS tokens_customer_history_idx
  ON public.tokens (customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tokens_one_active_per_customer_idx
  ON public.tokens (salon_id, customer_id, date)
  WHERE status IN ('waiting', 'called', 'serving');

-- Allocate a token inside one transaction. The advisory lock serializes
-- requests for the same salon/day, so token numbers and capacity checks remain
-- correct under double-clicks and concurrent customers.
CREATE OR REPLACE FUNCTION public.create_queue_token(
  p_salon_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_worker_id UUID DEFAULT NULL
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
  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text || CURRENT_DATE::text));
  SELECT * INTO v_salon FROM public.salons WHERE id = p_salon_id FOR UPDATE;

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
  IF EXISTS (
    SELECT 1 FROM public.tokens
    WHERE salon_id = p_salon_id AND customer_id = p_customer_id
      AND date = CURRENT_DATE AND status IN ('waiting', 'called', 'serving')
  ) THEN RAISE EXCEPTION 'ACTIVE_TOKEN_EXISTS'; END IF;
  IF (
    SELECT count(*) FROM public.tokens
    WHERE salon_id = p_salon_id AND date = CURRENT_DATE
  ) >= v_salon.max_daily_tokens THEN RAISE EXCEPTION 'DAILY_TOKEN_LIMIT_REACHED'; END IF;

  SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_number
  FROM public.tokens WHERE salon_id = p_salon_id AND date = CURRENT_DATE;

  RETURN QUERY
  INSERT INTO public.tokens (salon_id, customer_id, service_id, worker_id, token_number, status, date)
  VALUES (p_salon_id, p_customer_id, p_service_id, p_worker_id, v_next_number, 'waiting', CURRENT_DATE)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_queue_token(UUID, UUID, UUID, UUID) TO service_role;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_salon_id_required CHECK (salon_id IS NOT NULL) NOT VALID;

ALTER TABLE public.services
  ADD CONSTRAINT services_salon_id_required CHECK (salon_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT services_price_positive CHECK (price > 0) NOT VALID,
  ADD CONSTRAINT services_duration_positive CHECK (duration_minutes > 0) NOT VALID;

ALTER TABLE public.salons
  ADD CONSTRAINT salons_daily_limit_positive CHECK (max_daily_tokens > 0) NOT VALID,
  ADD CONSTRAINT salons_service_minutes_positive CHECK (avg_service_minutes > 0) NOT VALID;

-- The browser now reads sanitized queue data through FastAPI. Remove broad
-- direct reads that expose customer ids, phone numbers, and internal fields.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Tokens viewable by everyone for queue" ON public.tokens;
DROP POLICY IF EXISTS "Customers can insert own tokens" ON public.tokens;
DROP POLICY IF EXISTS "Customers can update own tokens" ON public.tokens;
DROP POLICY IF EXISTS "Owners and workers can update tokens" ON public.tokens;

CREATE POLICY "Customers can view own tokens"
  ON public.tokens FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Salon owners and workers can view tenant tokens"
  ON public.tokens FOR SELECT
  USING (
    auth.uid() IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR auth.uid() IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  );

CREATE POLICY "Customers can create own tokens"
  ON public.tokens FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can cancel own active tokens"
  ON public.tokens FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Owners and workers can update tenant tokens"
  ON public.tokens FOR UPDATE
  USING (
    auth.uid() IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR auth.uid() IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  )
  WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR auth.uid() IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  );
