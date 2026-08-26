-- 014_profile_update_policy.sql
-- Fix: Users getting 403 when trying to update their own profiles
-- and secure against privilege escalation.

-- 1. Create a trigger function to protect sensitive columns on UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger AS $$
BEGIN
    -- Prevent users from elevating their role or changing loyalty points
    -- If the operation is done via service_role, current_setting('role') is 'service_role'.
    -- If done by a normal authenticated user, it is 'authenticated'.
    IF current_setting('role') = 'authenticated' THEN
        NEW.role = OLD.role;
        NEW.loyalty_points = OLD.loyalty_points;
        NEW.referral_code = OLD.referral_code;
        NEW.referred_by = OLD.referred_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to profiles
DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER tr_protect_profile_sensitive_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 3. Add the UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);
