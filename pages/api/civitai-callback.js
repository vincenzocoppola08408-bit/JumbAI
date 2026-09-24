import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  try {
    const { code, state } = req.query || {};
    const cookieState = req.headers?.cookie?.match(/civitai_state=([^;]+)/)?.[1];
    if (!code || !state || state !== cookieState) {
      return res.redirect('/?error=civitai_state_mismatch');
    }

    const redirectUri = `${process.env.APP_URL || 'https://jumbai.it'}/api/civitai-callback`;

    const tokenRes = await fetch('https://auth.civitai.com/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
        client_id: process.env.CIVITAI_CLIENT_ID || '',
        client_secret: process.env.CIVITAI_CLIENT_SECRET || '',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('CivitAI token exchange failed:', tokenData);
      return res.redirect('/?error=civitai_token_exchange');
    }

    // Leggi profilo Civitai per identificare utente
    const meRes = await fetch('https://civitai.com/api/v1/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json().catch(() => ({}));

    // Salva token in Supabase se l'utente è autenticato
    const authHeader = req.headers.authorization || '';
    const userId = authHeader.replace('Bearer ', '').trim();

    if (userId) {
      const { error: updateErr } = await supabaseAdmin
        .from('profili')
        .update({
          civitai_access_token: tokenData.access_token,
          civitai_refresh_token: tokenData.refresh_token || null,
          civitai_buzz: me?.buzz ?? 0,
        })
        .eq('id', userId);
      if (updateErr) console.error('DB update error:', updateErr);
    }

    res.setHeader('Set-Cookie', 'civitai_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    return res.redirect('/?civitai=ok');
  } catch (e) {
    console.error('CivitAI callback exception:', e);
    return res.redirect('/?error=civitai_exception');
  }
}
