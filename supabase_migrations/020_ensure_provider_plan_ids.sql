-- =====================================================
-- MIGRATION 020: Ensure provider_plan_id is populated
-- Run this in Supabase SQL Editor if checkout gives
-- "Plan is not mapped to the payment provider" errors.
-- =====================================================

-- Safely re-apply provider_plan_id for each plan.
-- The UUIDs match the seeded plans in 005_subscription_foundation.sql

UPDATE subscription_plans 
SET provider_plan_id = 'plan_TTIpSGHiKyQJSl'
WHERE id = 'ecae2ad8-8472-4569-a7b7-83912f01eee3'
  AND (provider_plan_id IS NULL OR provider_plan_id = '');

UPDATE subscription_plans 
SET provider_plan_id = 'plan_TTHZTDS4hXSLg3'
WHERE id = '81cbc565-4c5a-4e3f-b032-a23d17449098'
  AND (provider_plan_id IS NULL OR provider_plan_id = '');

UPDATE subscription_plans 
SET provider_plan_id = 'plan_TTHadpOacwfqn9'
WHERE id = 'fe0781a8-e496-4406-9821-a4da4d65f776'
  AND (provider_plan_id IS NULL OR provider_plan_id = '');

-- Verify the result
SELECT id, name, provider_plan_id FROM subscription_plans ORDER BY sort_order;
