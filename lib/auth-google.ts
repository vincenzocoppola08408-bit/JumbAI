import { supabase } from './supabase-client';

/** OAuth Google con redirect esplicito al sito (Vercel o origin corrente). */
export async function signInWithGoogle() {
  const redirectTo =
    (typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/`
      : 'https://jumbai.vercel.app/') ;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error) throw error;
  return data;
}
