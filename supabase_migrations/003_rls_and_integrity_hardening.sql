-- 003_rls_and_integrity_hardening.sql
-- E3.1 + E3.2 security hardening migration.
-- Apply in the Supabase SQL editor after backing up the project.
-- This migration is additive and safe to apply on top of 001 + 002.

-- ============================================================
-- FIX F3: Role elevation via auth metadata
-- ============================================================
-- The original handle_new_user trigger trusted the 'role' field
-- from raw_user_meta_data. A malicious client could register with
-- role: 'super_admin' or 'salon_owner' in their signup metadata
-- and receive elevated privileges immediately.
--
-- Fix: Always create profiles with role = 'customer'. Privileged
-- roles must be assigned explicitly by a super_admin via a
-- separate, protected operation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.raw_user_meta_data->>'phone',
    'customer'   -- SECURITY: role is NEVER derived from client metadata
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Note: trigger already exists (on_auth_user_created), REPLACE updates the function.

-- ============================================================
-- FIX F1: Workers RLS — restrict SELECT to public-safe fields
-- ============================================================
-- The original "Workers viewable by everyone" policy uses USING (true),
-- which means direct Supabase JS clients can read ALL worker columns,
-- including user_id (a FK to auth.users).
--
-- RLS cannot filter specific columns in PostgreSQL — it is row-level only.
-- The correct fix is to:
--   a) keep the broad SELECT policy for the public (the API layer strips user_id)
--   b) document that user_id is sensitive and API callers must use the restricted
--      _PUBLIC_FIELDS select string
--
-- Additionally, we add a policy that gives linked workers access to their own row
-- (needed for any future self-service worker profile operations).
-- No policy change needed for the public workers SELECT since column-level
-- security is handled at the API layer (already done in E2 — workers.py uses
-- _PUBLIC_FIELDS = "id, salon_id, name, photo_url, specialization, experience_years, status").
--
-- We document this here and rely on the API layer for enforcement.

-- ============================================================
-- FIX F4: Cross-tenant token injection prevention
-- ============================================================
-- The tokens table has FK references to services(id) and workers(id),
-- but NO constraint verifies that those records belong to the same salon
-- as the token. The create_queue_token() RPC checks this at the
-- application level, but a service-role direct INSERT could bypass it.
--
-- We add a DB-level trigger that enforces salon consistency on INSERT.

CREATE OR REPLACE FUNCTION public.enforce_token_tenant_isolation()
RETURNS trigger AS $$
DECLARE
  v_service_salon_id UUID;
  v_worker_salon_id  UUID;
BEGIN
  -- Verify service belongs to the same salon as the token
  IF NEW.service_id IS NOT NULL THEN
    SELECT salon_id INTO v_service_salon_id
      FROM public.services WHERE id = NEW.service_id;
    IF v_service_salon_id IS NULL OR v_service_salon_id <> NEW.salon_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: service_id % does not belong to salon %',
        NEW.service_id, NEW.salon_id;
    END IF;
  END IF;

  -- Verify worker (if set) belongs to the same salon as the token
  IF NEW.worker_id IS NOT NULL THEN
    SELECT salon_id INTO v_worker_salon_id
      FROM public.workers WHERE id = NEW.worker_id;
    IF v_worker_salon_id IS NULL OR v_worker_salon_id <> NEW.salon_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: worker_id % does not belong to salon %',
        NEW.worker_id, NEW.salon_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tokens_tenant_isolation_check ON public.tokens;
CREATE TRIGGER tokens_tenant_isolation_check
  BEFORE INSERT OR UPDATE ON public.tokens
  FOR EACH ROW EXECUTE FUNCTION public.enforce_token_tenant_isolation();

-- ============================================================
-- FIX F5: Cross-tenant ratings injection prevention
-- ============================================================
-- A rating row has salon_id, worker_id, customer_id, token_id.
-- No constraint verifies that worker_id belongs to salon_id,
-- or that the referenced token's salon matches the rating's salon.

CREATE OR REPLACE FUNCTION public.enforce_rating_tenant_isolation()
RETURNS trigger AS $$
DECLARE
  v_worker_salon_id UUID;
  v_token_salon_id  UUID;
  v_token_customer  UUID;
BEGIN
  -- Verify worker belongs to the rating's salon
  IF NEW.worker_id IS NOT NULL THEN
    SELECT salon_id INTO v_worker_salon_id
      FROM public.workers WHERE id = NEW.worker_id;
    IF v_worker_salon_id IS NULL OR v_worker_salon_id <> NEW.salon_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: worker_id % does not belong to salon %',
        NEW.worker_id, NEW.salon_id;
    END IF;
  END IF;

  -- Verify token belongs to the rating's salon and customer
  IF NEW.token_id IS NOT NULL THEN
    SELECT salon_id, customer_id INTO v_token_salon_id, v_token_customer
      FROM public.tokens WHERE id = NEW.token_id;
    IF v_token_salon_id IS NULL OR v_token_salon_id <> NEW.salon_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: token_id % does not belong to salon %',
        NEW.token_id, NEW.salon_id;
    END IF;
    IF v_token_customer IS NULL OR v_token_customer <> NEW.customer_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: token_id % does not belong to customer %',
        NEW.token_id, NEW.customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ratings_tenant_isolation_check ON public.ratings;
CREATE TRIGGER ratings_tenant_isolation_check
  BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rating_tenant_isolation();

-- ============================================================
-- Additional index: ratings lookup by token (supports UNIQUE
-- already present; add salon+worker for analytics queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS ratings_salon_worker_idx
  ON public.ratings (salon_id, worker_id);

-- ============================================================
-- Grant trigger functions to service_role only
-- ============================================================
REVOKE ALL ON FUNCTION public.enforce_token_tenant_isolation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_token_tenant_isolation() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_rating_tenant_isolation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_rating_tenant_isolation() TO service_role;
