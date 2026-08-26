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
