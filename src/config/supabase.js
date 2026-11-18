import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getSupabaseConfigStatus = () => Boolean(supabase);

export const getSignedPhotoUrl = async (storagePath, userRole, ownerId) => {
  if (!supabase) {
    return '/placeholder-photo.jpg';
  }

  try {
    const { data, error } = await supabase.storage.from('field-post-photos').createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return '/placeholder-photo.jpg';
    }

    return data.signedUrl;
  } catch {
    return '/placeholder-photo.jpg';
  }
};
