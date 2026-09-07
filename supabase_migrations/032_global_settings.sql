-- 032_global_settings.sql

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to settings
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.app_settings;
CREATE POLICY "Settings are viewable by everyone" ON public.app_settings 
  FOR SELECT USING (true);

-- Allow super admins full access to settings
DROP POLICY IF EXISTS "Super admin can manage settings" ON public.app_settings;
CREATE POLICY "Super admin can manage settings" ON public.app_settings 
  FOR ALL 
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
  );

-- Insert default value for subscriptions_enabled
INSERT INTO public.app_settings (key, value) 
VALUES ('subscriptions_enabled', 'false'::jsonb) 
ON CONFLICT (key) DO NOTHING;
