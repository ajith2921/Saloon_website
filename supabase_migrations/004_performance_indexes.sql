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
