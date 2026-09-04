-- 025_push_subscriptions.sql
-- ============================================================
-- Feature: Web Push Notifications
-- Stores push subscriptions linked to user profiles.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quickly finding a user's subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_customer_id ON public.push_subscriptions(customer_id);

-- Enforce Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Customers can insert, view, and delete their own subscriptions
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
    ON public.push_subscriptions FOR ALL
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

-- Service role bypasses RLS inherently to send notifications
