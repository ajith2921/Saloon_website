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
