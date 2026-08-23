-- ==========================================
-- SUPABASE SCHEMA & SEED FOR QUEUECUT
-- ==========================================

-- Enable PostGIS for geospatial queries later (optional - may not be available on free tier)
-- If this fails, comment it out — it is not required for the core queue system.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS not available, skipping.';
END $$;

-- 1. Create custom enum types
CREATE TYPE user_role AS ENUM ('customer', 'worker', 'salon_owner', 'super_admin');
CREATE TYPE salon_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE worker_status AS ENUM ('active', 'inactive', 'on_break');
CREATE TYPE token_status AS ENUM ('waiting', 'called', 'serving', 'completed', 'skipped', 'cancelled', 'expired');
CREATE TYPE notification_type AS ENUM ('token_generated', 'approaching', 'called', 'cancelled', 'completed', 'rating_reminder');

-- 2. Create tables
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'customer',
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES profiles(id),
    loyalty_points INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES profiles(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    city TEXT,
    latitude FLOAT8,
    longitude FLOAT8,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    opening_time TIME DEFAULT '09:00',
    closing_time TIME DEFAULT '21:00',
    status salon_status DEFAULT 'active',
    max_daily_tokens INT DEFAULT 50,
    avg_service_minutes INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    photo_url TEXT,
    specialization TEXT,
    experience_years INT DEFAULT 0,
    status worker_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id),
    service_id UUID REFERENCES services(id),
    token_number INT NOT NULL,
    status token_status DEFAULT 'waiting',
    estimated_wait_minutes INT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE (salon_id, token_number, date)
);

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE UNIQUE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read everyone (for display), update own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Salons: Anyone can view active salons. Owners can do all.
CREATE POLICY "Salons are viewable by everyone" ON salons FOR SELECT USING (status = 'active' OR auth.uid() = owner_id);
CREATE POLICY "Owners can manage their salons" ON salons FOR ALL USING (auth.uid() = owner_id);

-- Workers: Anyone can view. Owners can manage.
CREATE POLICY "Workers viewable by everyone" ON workers FOR SELECT USING (true);
CREATE POLICY "Owners manage workers" ON workers FOR ALL USING (auth.uid() IN (SELECT owner_id FROM salons WHERE id = salon_id));

-- Services: Anyone can view. Owners can manage.
CREATE POLICY "Services viewable by everyone" ON services FOR SELECT USING (true);
CREATE POLICY "Owners manage services" ON services FOR ALL USING (auth.uid() IN (SELECT owner_id FROM salons WHERE id = salon_id));

-- Tokens: Customers can read own tokens + all tokens for active queue display (public view). 
-- Update/Delete restricted.
CREATE POLICY "Tokens viewable by everyone for queue" ON tokens FOR SELECT USING (true);
CREATE POLICY "Customers can insert own tokens" ON tokens FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can update own tokens" ON tokens FOR UPDATE USING (auth.uid() = customer_id);
CREATE POLICY "Owners and workers can update tokens" ON tokens FOR UPDATE USING (
    auth.uid() IN (SELECT owner_id FROM salons WHERE id = salon_id) OR
    auth.uid() IN (SELECT user_id FROM workers WHERE salon_id = tokens.salon_id)
);

-- Ratings: Viewable by everyone. Customers can insert own.
CREATE POLICY "Ratings viewable by everyone" ON ratings FOR SELECT USING (true);
CREATE POLICY "Customers can insert ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Notifications: Users can only see own.
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- 4. Supabase Trigger for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Views for aggregated data
CREATE OR REPLACE VIEW salon_stats AS
SELECT 
  s.id as salon_id,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'waiting') as queue_count,
  ROUND(AVG(r.rating)::numeric, 1) as avg_rating,
  COUNT(r.id) as review_count
FROM salons s
LEFT JOIN tokens t ON s.id = t.salon_id AND t.date = CURRENT_DATE
LEFT JOIN ratings r ON s.id = r.salon_id
GROUP BY s.id;

-- 6. Enable Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE tokens;

-- ==========================================
-- SEED DATA
-- Note: Replace UUIDs for owner if needed later.
-- For now, they will refer to auth.users you create via UI.
-- ==========================================
-- Run this block after creating an owner account in Supabase.
/*
INSERT INTO salons (id, owner_id, name, description, city, address, avg_service_minutes) 
VALUES ('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'YOUR-OWNER-UUID-HERE', 'Ajith Men''s Salon', 'Premium grooming experience in Nagercoil', 'Nagercoil', '123 Main St', 30);

INSERT INTO services (salon_id, name, price, duration_minutes) VALUES
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Haircut', 150, 30),
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Beard Trim', 80, 15),
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Haircut + Beard', 220, 45),
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Hair Styling', 200, 30);

INSERT INTO workers (salon_id, name, specialization, experience_years) VALUES
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Arun', 'Haircut & Styling', 5),
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Vijay', 'Beard Specialist', 3),
('c15c2d30-b38d-4a1e-8e42-7c3905c317aa', 'Kumar', 'Hair Color', 7);
*/

-- 7. Advertisements Table
CREATE TABLE advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisements viewable by everyone" ON advertisements FOR SELECT USING (status = 'active');
CREATE POLICY "Super admins manage advertisements" ON advertisements FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
);
