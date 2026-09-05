-- Migration 027: Major Features (Payments, Maps, Photo Reviews, Gallery)

-- 1. Tokens: Add payment tracking for booking fees
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'not_required',
ADD CONSTRAINT valid_payment_status CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded'));

-- 2. Salons: Add location and booking fee settings
ALTER TABLE public.salons 
ADD COLUMN IF NOT EXISTS booking_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
ADD COLUMN IF NOT EXISTS longitude numeric(11, 8);

-- 3. Ratings: Add photo support
ALTER TABLE public.ratings 
ADD COLUMN IF NOT EXISTS photo_url text;

-- 4. Gallery: Create salon_gallery table
CREATE TABLE IF NOT EXISTS public.salon_gallery (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for salon_gallery
ALTER TABLE public.salon_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery viewable by everyone" 
ON public.salon_gallery FOR SELECT 
USING (true);

CREATE POLICY "Owners and workers can manage their salon gallery" 
ON public.salon_gallery FOR ALL 
USING (
    auth.uid() IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR auth.uid() IN (SELECT user_id FROM public.workers WHERE salon_id = salon_gallery.salon_id)
)
WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM public.salons WHERE id = salon_id)
    OR auth.uid() IN (SELECT user_id FROM public.workers WHERE salon_id = salon_gallery.salon_id)
);

-- 5. Storage: Ensure buckets exist for uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('review_photos', 'review_photos', true),
  ('salon_galleries', 'salon_galleries', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for review_photos (Public read, authenticated insert)
CREATE POLICY "Public read review_photos" ON storage.objects FOR SELECT 
USING (bucket_id = 'review_photos');

CREATE POLICY "Auth insert review_photos" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'review_photos' AND auth.role() = 'authenticated');

-- Storage RLS policies for salon_galleries (Public read, owner insert/delete)
CREATE POLICY "Public read salon_galleries" ON storage.objects FOR SELECT 
USING (bucket_id = 'salon_galleries');

CREATE POLICY "Auth insert salon_galleries" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'salon_galleries' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete salon_galleries" ON storage.objects FOR DELETE 
USING (bucket_id = 'salon_galleries' AND auth.role() = 'authenticated');
