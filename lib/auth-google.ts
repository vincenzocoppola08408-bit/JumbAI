import { supabase } from './supabase-client';

/** OAuth Google con redirect esplicito al sito (Vercel o origin corrente). */
export async function signInWithGoogle() {
  const redirectTo =
    (typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/`
      : 'https://jumbai.vercel.app/');

  // Usa signInWithOAuth diretto invece di signInWithOAuth che causa error 400
  // Se fallisce, prova il metodo classico
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          // Aggiungi scope esplicito per evitare 400
          scope: 'openid email profile',
        },
        // Importante: non skipBrowserRedirect=false per default
      },
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('Google OAuth error:', err);
    throw new Error(
      'Impossibile connettersi a Google. Verifica che OAuth sia configurato in Supabase Dashboard (Authentication → Providers → Google). ' +
        (err?.message || 'Errore sconosciuto')
    );
  }
}