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
('Premium (Yearly)', 'Best value for established salons. All premium features, priority support, and complete analytics for a full year (Save ~₹589).', 2999.00, 999, 999, true, 30, '["Unlimited services", "Unlimited Barbers", "Advanced Analytics", "Priority Support"]'::jsonb, 'yearly');
