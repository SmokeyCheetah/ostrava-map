import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Warning: Supabase credentials are missing. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Client helper for accessing database from both Client and Server Components
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Define Types for our database schema to ensure type safety in our code
export interface Location {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  category: string;
  image_urls: string[];
  created_at: string;
}

export interface Review {
  id: string;
  location_id: string;
  rating: number;
  comment: string | null;
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
}

export interface LocationWithReviews extends Location {
  average_rating: number;
  reviews_count: number;
}
