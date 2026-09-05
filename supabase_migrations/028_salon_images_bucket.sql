-- Migration 028: Salon Images Bucket

-- 1. Ensure bucket exists for salon images (logos and covers)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('salon-images', 'salon-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies for salon-images
CREATE POLICY "Public read salon-images" ON storage.objects FOR SELECT 
USING (bucket_id = 'salon-images');

CREATE POLICY "Auth insert salon-images" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'salon-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth update salon-images" ON storage.objects FOR UPDATE
USING (bucket_id = 'salon-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete salon-images" ON storage.objects FOR DELETE 
USING (bucket_id = 'salon-images' AND auth.role() = 'authenticated');
