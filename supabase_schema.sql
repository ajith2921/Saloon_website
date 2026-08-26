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
-- 002_remove_legacy_profile_columns.sql
-- Removes legacy columns from the profiles table that are no longer used by the application
-- and are not present in the canonical supabase_schema.sql.

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS email;

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS salon_id;
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
-- FIX F1: Workers RLS â€” restrict SELECT to public-safe fields
-- ============================================================
-- The original "Workers viewable by everyone" policy uses USING (true),
-- which means direct Supabase JS clients can read ALL worker columns,
-- including user_id (a FK to auth.users).
--
-- RLS cannot filter specific columns in PostgreSQL â€” it is row-level only.
-- The correct fix is to:
--   a) keep the broad SELECT policy for the public (the API layer strips user_id)
--   b) document that user_id is sensitive and API callers must use the restricted
--      _PUBLIC_FIELDS select string
--
-- Additionally, we add a policy that gives linked workers access to their own row
-- (needed for any future self-service worker profile operations).
-- No policy change needed for the public workers SELECT since column-level
-- security is handled at the API layer (already done in E2 â€” workers.py uses
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
-- 004_performance_indexes.sql
-- G1 performance and DB hardening migration.
-- Applies non-destructive indexes on frequently queried foreign keys.
-- 
-- PostgreSQL does not index foreign keys by default, so we add them here
-- to prevent full table scans as the tables grow.

-- 1. Tokens table: customer_id + date (used in get_my_active_token)
CREATE INDEX IF NOT EXISTS tokens_customer_date_idx 
    ON public.tokens (customer_id, date);

-- 2. Salons table: owner_id (used in get_my_salon, and RLS policies)
CREATE INDEX IF NOT EXISTS salons_owner_id_idx 
    ON public.salons (owner_id);

-- 3. Workers table: salon_id (used in get_workers)
CREATE INDEX IF NOT EXISTS workers_salon_id_idx 
    ON public.workers (salon_id);

-- 4. Services table: salon_id (used in get_services)
CREATE INDEX IF NOT EXISTS services_salon_id_idx 
    ON public.services (salon_id);

-- 5. Notifications table: user_id + created_at (used in get_notifications)
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx 
    ON public.notifications (user_id, created_at DESC);
-- ==========================================
-- PHASE K3.2: SUBSCRIPTION & ENTITLEMENT FOUNDATION
-- ==========================================

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'trialing', 
        'active', 
        'past_due', 
        'cancelled', 
        'expired', 
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE billing_interval_type AS ENUM (
        'monthly', 
        'yearly', 
        'lifetime'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create subscription_plans table
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    billing_interval billing_interval_type NOT NULL DEFAULT 'monthly',
    trial_days INT DEFAULT 0,
    max_workers INT,
    max_services INT,
    max_monthly_tokens INT,
    max_advertisements INT,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'trialing',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Active Subscription Constraint
-- Ensure a salon can only have ONE subscription in an "active" state at a time.
-- We consider trialing, active, and past_due as states representing a currently functioning subscription.
CREATE UNIQUE INDEX one_active_sub_per_salon 
ON subscriptions(salon_id) 
WHERE status IN ('trialing', 'active', 'past_due');

-- 5. Standard Indexes for performance
CREATE INDEX idx_subscriptions_salon_id ON subscriptions(salon_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscription_plans_active_sort ON subscription_plans(is_active, sort_order);

-- 6. Row Level Security (RLS)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans RLS
-- Anyone can read active plans. Super admins can manage all plans.
CREATE POLICY "Active plans viewable by everyone" ON subscription_plans 
    FOR SELECT USING (is_active = true OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "Super admins manage plans" ON subscription_plans 
    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- Subscriptions RLS
-- Salon owners can view their own salon's subscriptions.
CREATE POLICY "Salon owners can view their own subscriptions" ON subscriptions 
    FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM salons WHERE salons.id = subscriptions.salon_id));

-- Super admins can view and manage all subscriptions.
CREATE POLICY "Super admins manage all subscriptions" ON subscriptions 
    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- 7. Insert Seed Plans
INSERT INTO subscription_plans (name, description, price, max_workers, max_services, is_active, sort_order, features, billing_interval) VALUES
('Free Tier', 'Basic queue management for single barbers', 0.00, 1, 5, true, 10, '["Up to 5 services", "1 Barber", "Standard Queue"]'::jsonb, 'monthly'),
('Premium (Monthly)', 'Perfect for growing salons. Manage up to 10 barbers, track live queues, and access daily revenue insights.', 299.00, 10, 20, true, 20, '["Up to 20 services", "Up to 10 Barbers", "Analytics Dashboard", "Live Queue Management"]'::jsonb, 'monthly'),
('Premium (Yearly)', 'Best value for established salons. All premium features, priority support, and complete analytics for a full year (Save ~â‚¹589).', 2999.00, 999, 999, true, 30, '["Unlimited services", "Unlimited Barbers", "Advanced Analytics", "Priority Support"]'::jsonb, 'yearly');
-- ==========================================
-- PHASE K3.3.2: RAZORPAY BILLING PROVIDER FOUNDATION
-- ==========================================

-- 1. Modify subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS provider_plan_id TEXT UNIQUE;

-- 2. Modify subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON subscriptions(provider_subscription_id);

-- 3. Create billing_customers
CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    provider_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_customer_per_salon UNIQUE (salon_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_salon_id ON billing_customers(salon_id);

-- 4. Create payment_transactions (Ledger for webhooks)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    provider_payment_id TEXT,
    provider_invoice_id TEXT,
    provider_event_id TEXT NOT NULL UNIQUE, -- strict idempotency
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL,
    event_type TEXT NOT NULL,
    raw_event_reference JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_salon_id ON payment_transactions(salon_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_event_id ON payment_transactions(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_invoice_id ON payment_transactions(provider_invoice_id);

-- 5. Row Level Security (RLS)
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Billing Customers RLS
DROP POLICY IF EXISTS "Salon owners can view their own billing customers" ON billing_customers;
-- Salon owners can view their own billing customer mapping.
CREATE POLICY "Salon owners can view their own billing customers" ON billing_customers 
    FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM salons WHERE salons.id = billing_customers.salon_id));

DROP POLICY IF EXISTS "Super admins view all billing customers" ON billing_customers;
-- Super admins can view all billing customers.
CREATE POLICY "Super admins view all billing customers" ON billing_customers 
    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- Payment Transactions RLS
DROP POLICY IF EXISTS "Salon owners can view their own payment transactions" ON payment_transactions;
-- Salon owners can view their own payment transactions.
CREATE POLICY "Salon owners can view their own payment transactions" ON payment_transactions 
    FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM salons WHERE salons.id = payment_transactions.salon_id));

DROP POLICY IF EXISTS "Super admins view all payment transactions" ON payment_transactions;
-- Super admins can view all payment transactions.
CREATE POLICY "Super admins view all payment transactions" ON payment_transactions 
    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));
-- migration: 007_rpc_optimizations.sql

-- 1. Enable Realtime on the tokens table
-- Supabase requires adding the table to the `supabase_realtime` publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE tokens;

-- 2. RPC: get_salon_stats
-- Calculates the current day's token statistics and the overall average rating.
CREATE OR REPLACE FUNCTION public.get_salon_stats(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_waiting int := 0;
    v_serving int := 0;
    v_completed int := 0;
    v_total int := 0;
    v_avg_rating numeric := 0.0;
    v_review_count int := 0;
    v_result jsonb;
BEGIN
    -- Aggregate today's tokens
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'waiting'),
        COUNT(*) FILTER (WHERE status IN ('called', 'serving')),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_waiting, v_serving, v_completed
    FROM public.tokens
    WHERE salon_id = p_salon_id AND date = v_today;

    -- Aggregate ratings
    SELECT 
        COUNT(*),
        COALESCE(ROUND(AVG(rating), 1), 0.0)
    INTO v_review_count, v_avg_rating
    FROM public.ratings
    WHERE salon_id = p_salon_id;

    v_result := jsonb_build_object(
        'waiting', v_waiting,
        'serving', v_serving,
        'completed_today', v_completed,
        'total_today', v_total,
        'avg_rating', v_avg_rating,
        'review_count', v_review_count
    );

    RETURN v_result;
END;
$$;


-- 3. RPC: get_salon_customers
-- Returns a distinct list of customers for a salon, ordered by their most recent visit.
CREATE OR REPLACE FUNCTION public.get_salon_customers(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(cust)
    INTO v_result
    FROM (
        SELECT DISTINCT ON (t.customer_id)
            t.customer_id as id,
            p.full_name as full_name,
            p.phone as phone,
            p.avatar_url as avatar_url,
            t.date as last_visit,
            t.status as last_token_status
        FROM public.tokens t
        LEFT JOIN public.profiles p ON p.id = t.customer_id
        WHERE t.salon_id = p_salon_id
        ORDER BY t.customer_id, t.created_at DESC
    ) cust;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- 4. RPC: get_analytics_summary
-- Calculates the last 7 days of wait times and completions, plus today's totals.
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_active_barbers int := 0;
    v_chart_data jsonb := '[]'::jsonb;
    v_today_stats jsonb;
    v_result jsonb;
BEGIN
    -- Active Barbers
    SELECT COUNT(*) INTO v_active_barbers
    FROM public.workers
    WHERE salon_id = p_salon_id AND status = 'active';

    -- Chart Data (Last 7 Days)
    SELECT jsonb_agg(day_stat) INTO v_chart_data
    FROM (
        SELECT 
            TO_CHAR(d.day_date, 'Dy') as name,
            COUNT(t.id) as customers,
            COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed,
            -- Rough average wait time using joined service duration
            COALESCE(ROUND(AVG(s.duration_minutes) FILTER (WHERE t.status = 'completed')), 0) as wait_time
        FROM (
            SELECT generate_series(v_today - interval '6 days', v_today, interval '1 day')::date AS day_date
        ) d
        LEFT JOIN public.tokens t ON t.date = d.day_date AND t.salon_id = p_salon_id
        LEFT JOIN public.services s ON s.id = t.service_id
        GROUP BY d.day_date
        ORDER BY d.day_date ASC
    ) day_stat;

    -- Today Stats
    SELECT jsonb_build_object(
        'total_customers_today', customers,
        'completion_rate', CASE WHEN customers > 0 THEN ROUND((completed::numeric / customers::numeric) * 100) ELSE 0 END,
        'avg_wait_time', wait_time
    ) INTO v_today_stats
    FROM (
        SELECT 
            COUNT(t.id) as customers,
            COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed,
            COALESCE(ROUND(AVG(s.duration_minutes) FILTER (WHERE t.status = 'completed')), 0) as wait_time
        FROM public.tokens t
        LEFT JOIN public.services s ON s.id = t.service_id
        WHERE t.salon_id = p_salon_id AND t.date = v_today
    ) ts;

    v_result := jsonb_build_object(
        'chart_data', COALESCE(v_chart_data, '[]'::jsonb),
        'active_barbers', v_active_barbers,
        'total_customers_today', (v_today_stats->>'total_customers_today')::int,
        'completion_rate', (v_today_stats->>'completion_rate')::int,
        'avg_wait_time', (v_today_stats->>'avg_wait_time')::int
    );

    RETURN v_result;
END;
$$;
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



-- 009_security_hardening.sql
-- Fix: Function Search Path Mutable warnings
-- Attach a secure search_path to explicitly resolve objects to the public schema,
-- preventing malicious shadowing of operators or tables.

ALTER FUNCTION public.handle_new_user() 
    SET search_path = public, pg_temp;

ALTER FUNCTION public.get_salon_stats(p_salon_id UUID) 
    SET search_path = public, pg_temp;

ALTER FUNCTION public.get_salon_customers(p_salon_id UUID) 
    SET search_path = public, pg_temp;

ALTER FUNCTION public.get_analytics_summary(p_salon_id UUID) 
    SET search_path = public, pg_temp;


-- 010_performance_optimization.sql
-- Fix: Performance Advisor Warnings (RLS Caching & Unindexed Foreign Keys)

-- ==============================================================================
-- PART 1: RLS OPTIMIZATION
-- Replaces auth.uid() with (select auth.uid()) in row-level expressions.
-- This allows Postgres to cache the function result for the entire statement
-- instead of re-evaluating it for every row, drastically reducing CPU load.
-- ==============================================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

-- Tokens
DROP POLICY IF EXISTS "Customers can view own tokens" ON public.tokens;
CREATE POLICY "Customers can view own tokens"
  ON public.tokens FOR SELECT
  USING ((select auth.uid()) = customer_id);

DROP POLICY IF EXISTS "Salon owners and workers can view tenant tokens" ON public.tokens;
CREATE POLICY "Salon owners and workers can view tenant tokens"
  ON public.tokens FOR SELECT
  USING (
    (select auth.uid()) IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR (select auth.uid()) IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  );

DROP POLICY IF EXISTS "Customers can create own tokens" ON public.tokens;
CREATE POLICY "Customers can create own tokens"
  ON public.tokens FOR INSERT
  WITH CHECK ((select auth.uid()) = customer_id);

DROP POLICY IF EXISTS "Customers can cancel own active tokens" ON public.tokens;
CREATE POLICY "Customers can cancel own active tokens"
  ON public.tokens FOR UPDATE
  USING ((select auth.uid()) = customer_id)
  WITH CHECK ((select auth.uid()) = customer_id);

DROP POLICY IF EXISTS "Owners and workers can update tenant tokens" ON public.tokens;
CREATE POLICY "Owners and workers can update tenant tokens"
  ON public.tokens FOR UPDATE
  USING (
    (select auth.uid()) IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR (select auth.uid()) IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  )
  WITH CHECK (
    (select auth.uid()) IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR (select auth.uid()) IN (SELECT user_id FROM public.workers WHERE salon_id = tokens.salon_id)
  );

-- Subscription Plans
DROP POLICY IF EXISTS "Active plans viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Active plans viewable by everyone" ON public.subscription_plans 
    FOR SELECT USING (is_active = true OR (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'super_admin'));

DROP POLICY IF EXISTS "Super admins manage plans" ON public.subscription_plans;
CREATE POLICY "Super admins manage plans" ON public.subscription_plans 
    FOR ALL USING ((select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- Subscriptions
DROP POLICY IF EXISTS "Salon owners can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Salon owners can view their own subscriptions" ON public.subscriptions 
    FOR SELECT USING ((select auth.uid()) IN (SELECT owner_id FROM salons WHERE salons.id = subscriptions.salon_id));

DROP POLICY IF EXISTS "Super admins manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins manage all subscriptions" ON public.subscriptions 
    FOR ALL USING ((select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- Billing Customers
DROP POLICY IF EXISTS "Salon owners can view their own billing customers" ON public.billing_customers;
CREATE POLICY "Salon owners can view their own billing customers" ON public.billing_customers 
    FOR SELECT USING ((select auth.uid()) IN (SELECT owner_id FROM salons WHERE salons.id = billing_customers.salon_id));

DROP POLICY IF EXISTS "Super admins view all billing customers" ON public.billing_customers;
CREATE POLICY "Super admins view all billing customers" ON public.billing_customers 
    FOR ALL USING ((select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- Payment Transactions
DROP POLICY IF EXISTS "Salon owners can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Salon owners can view their own payment transactions" ON public.payment_transactions 
    FOR SELECT USING ((select auth.uid()) IN (SELECT owner_id FROM salons WHERE salons.id = payment_transactions.salon_id));

DROP POLICY IF EXISTS "Super admins view all payment transactions" ON public.payment_transactions;
CREATE POLICY "Super admins view all payment transactions" ON public.payment_transactions 
    FOR ALL USING ((select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'super_admin'));


-- ==============================================================================
-- PART 2: UNINDEXED FOREIGN KEYS
-- Adds missing indexes for foreign keys to prevent full table scans on cascading
-- deletes or joined reads. Does NOT create duplicate indexes for Primary Keys
-- (e.g. profiles.id) or where existing composites cover the left-most prefix.
-- ==============================================================================

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Ratings
CREATE INDEX IF NOT EXISTS idx_ratings_customer_id ON public.ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_token_id ON public.ratings(token_id);
-- (salon_id is already covered by the ratings_salon_worker_idx composite index)

-- Tokens
CREATE INDEX IF NOT EXISTS idx_tokens_worker_id ON public.tokens(worker_id);
CREATE INDEX IF NOT EXISTS idx_tokens_service_id ON public.tokens(service_id);
-- (customer_id is already covered by tokens_customer_date_idx)

-- Salons (In case migration 004 wasn't applied on production yet)
CREATE INDEX IF NOT EXISTS idx_salons_owner_id ON public.salons(owner_id);


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
