-- Add phone_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Create phone_otp table
CREATE TABLE IF NOT EXISTS public.phone_otp (
    phone TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for phone_otp
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert/update phone_otp (for sending OTP)
CREATE POLICY "Allow public insert to phone_otp"
ON public.phone_otp FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update to phone_otp"
ON public.phone_otp FOR UPDATE TO public USING (true);

-- Allow authenticated users to view their own OTPs (if needed) or let backend bypass via service role
-- Since backend uses service role, no further policies strictly required for reading.
