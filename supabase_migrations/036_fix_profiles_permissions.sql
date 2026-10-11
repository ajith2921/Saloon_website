-- ====================================================================
-- MIGRATION 036: Ensure profiles table grants and RLS for salon staff
-- ====================================================================

-- 1. Ensure basic schema and table permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- 2. Allow salon staff (owners & workers) to read customer profiles who hold tokens in their salon
DROP POLICY IF EXISTS "Salon staff can view customer profiles" ON public.profiles;
CREATE POLICY "Salon staff can view customer profiles"
  ON public.profiles FOR SELECT
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
