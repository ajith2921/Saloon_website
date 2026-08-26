-- 015_super_admin_hardening.sql
-- Implements:
--   1. super_admin_audit_logs  — immutable record of every privileged action
--   2. super_admin_invitations — single-use, expiring tokens for secure onboarding

-- ============================================================
-- PART 1: AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action      TEXT NOT NULL,           -- e.g. APPROVE_SALON, SUSPEND_SALON, CHANGE_ROLE
    target_id   TEXT,                    -- UUID or other identifier of the affected entity
    target_type TEXT,                    -- e.g. 'salon', 'user', 'subscription'
    metadata    JSONB DEFAULT '{}',
    success     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: super_admins read only; nobody can INSERT/UPDATE/DELETE from client
ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read audit logs"
    ON public.super_admin_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
        )
    );

-- No client INSERT/UPDATE/DELETE policy — only service_role (backend) can write
-- This ensures logs are append-only from untrusted clients.

-- ============================================================
-- PART 2: INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.super_admin_invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'super_admin',
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.super_admin_invitations ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view invitations they created
CREATE POLICY "Super admins can view own invitations"
    ON public.super_admin_invitations FOR SELECT
    USING (
        invited_by = (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
        )
    );

-- No client INSERT — invitation generation is backend-only (service_role)
-- This prevents users from self-generating invitations.

-- ============================================================
-- PART 3: HELPER FUNCTION — consume invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_invitation(p_token TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row public.super_admin_invitations%ROWTYPE;
BEGIN
    -- Lock and fetch the row
    SELECT * INTO v_row
    FROM public.super_admin_invitations
    WHERE token = p_token
      AND used_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN FALSE;  -- invalid, expired, or already used
    END IF;

    -- Mark as consumed
    UPDATE public.super_admin_invitations
    SET used_at = NOW()
    WHERE id = v_row.id;

    -- Elevate the user's role
    UPDATE public.profiles
    SET role = v_row.role
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;
