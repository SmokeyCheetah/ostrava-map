-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    category TEXT NOT NULL DEFAULT 'Jiné',
    image_urls TEXT[] DEFAULT '{}'::TEXT[] NOT NULL, -- Array of image URLs (up to 5)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create some indexes for performance
CREATE INDEX IF NOT EXISTS reviews_location_id_idx ON public.reviews (location_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing anyone to read, and anyone to insert for this simple demo app)
-- Note: In a production app, you might want to restrict insert/update/delete to authenticated users.
CREATE POLICY "Allow public read access on locations" ON public.locations
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on locations" ON public.locations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on locations" ON public.locations
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on locations" ON public.locations
    FOR DELETE USING (true);

CREATE POLICY "Allow public read access on reviews" ON public.reviews
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on reviews" ON public.reviews
    FOR INSERT WITH CHECK (true);
