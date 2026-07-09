import { supabase, Location, Review, LocationWithReviews } from './supabase';

// Preset categories for Ostrava map
export const CATEGORIES = [
  'Památky',
  'Příroda',
  'Vyhlídky',
  'Kultura',
  'Relax',
  'Kavárny',
  'Jídlo',
  'Urbex',
  'Jiné'
];

// Helper to check if Supabase has been properly configured in the environment variables
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    !!key &&
    !url.includes('your-supabase-project') &&
    !key.includes('your-supabase-anon-key')
  );
}

// Production-ready API functions strictly using Supabase (no local storage mock fallback)
export async function getLocations(): Promise<LocationWithReviews[]> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Return empty locations.');
    return [];
  }

  try {
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: reviews, error: revError } = await supabase
      .from('reviews')
      .select('*');

    if (locError) throw locError;
    if (revError) throw revError;

    const locList = locations || [];
    const revList = reviews || [];

    // Calculate rating metrics in-memory
    return locList.map((loc: Location) => {
      const locReviews = revList.filter((r: Review) => r.location_id === loc.id);
      const count = locReviews.length;
      const avg = count > 0 
        ? parseFloat((locReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
        : 0;

      return {
        ...loc,
        average_rating: avg,
        reviews_count: count,
      };
    });
  } catch (error) {
    console.error('Error fetching locations from Supabase:', error);
    throw error;
  }
}

export async function getReviews(locationId: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching reviews for location ${locationId}:`, error);
    throw error;
  }
}

export async function addLocation(location: Omit<Location, 'id' | 'created_at'>): Promise<Location | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase database is not configured. Cannot add location.');
  }

  try {
    const { data, error } = await supabase
      .from('locations')
      .insert([location])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error inserting location into Supabase:', error);
    throw error;
  }
}

export async function addReview(review: Omit<Review, 'id' | 'created_at'>): Promise<Review | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase database is not configured. Cannot add review.');
  }

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert([review])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error inserting review into Supabase:', error);
    throw error;
  }
}

export async function deleteLocation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error deleting location ${id} from Supabase:`, error);
    throw error;
  }
}

export async function deleteReview(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error(`Error deleting review ${id} from Supabase:`, error?.message || error);
    throw error;
  }
}

export async function addAdminReply(reviewId: string, reply: string | null): Promise<Review | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .update({
        admin_reply: reply,
        admin_reply_at: reply ? new Date().toISOString() : null,
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error(`Error adding admin reply to review ${reviewId}:`, error?.message || error?.details || error);
    throw error;
  }
}

export async function updateLocation(id: string, location: Omit<Location, 'id' | 'created_at'>): Promise<Location | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase database is not configured. Cannot update location.');
  }

  try {
    const { data, error } = await supabase
      .from('locations')
      .update(location)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error updating location ${id} in Supabase:`, error);
    throw error;
  }
}
