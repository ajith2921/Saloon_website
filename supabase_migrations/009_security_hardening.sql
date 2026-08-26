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
