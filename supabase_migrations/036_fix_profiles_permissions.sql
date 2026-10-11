-- ====================================================================
-- MIGRATION 036: Ensure profiles table grants, preferences & RLS
-- ====================================================================

-- 1. Ensure columns exist for notification preferences
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT TRUE;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email_receipts BOOLEAN DEFAULT FALSE;

-- 2. Ensure basic schema and table permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- 3. Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 4. Ensure users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- 5. Allow salon staff (owners & workers) to read customer profiles who hold tokens in their salon
DROP POLICY IF EXISTS "Salon staff can view customer profiles" ON public.profiles;
CREATE POLICY "Salon staff can view customer profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tokens t
      JOIN public.salons s ON s.id = t.salon_id
      WHERE t.customer_id = public.profiles.id
        AND (
          s.owner_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.workers w
            WHERE w.salon_id = s.id AND w.user_id = (SELECT auth.uid())
          )
        )
    )
  );
