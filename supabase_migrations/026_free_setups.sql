-- 026_free_setups.sql
-- Table to track free setups granted by super admins to specific emails

CREATE TABLE IF NOT EXISTS public.free_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    granted_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    salon_id UUID REFERENCES public.salons(id)
);

-- RLS Policies
ALTER TABLE public.free_setups ENABLE ROW LEVEL SECURITY;

-- Super admins can view all
CREATE POLICY "Super admins can view free setups"
    ON public.free_setups FOR SELECT
    USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    );

-- Super admins can insert
CREATE POLICY "Super admins can insert free setups"
    ON public.free_setups FOR INSERT
    WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    );

-- Super admins can update
CREATE POLICY "Super admins can update free setups"
    ON public.free_setups FOR UPDATE
    USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    )
    WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
    );

-- Any authenticated user can read their own free setup (email match requires checking auth.users, but we'll do this via the API layer with service_role to avoid complex RLS on auth.users).
-- So we won't add a direct RLS for users, but rather handle the "check free setup" via an RPC or backend endpoint using service_role.

-- Service role bypasses RLS anyway.
