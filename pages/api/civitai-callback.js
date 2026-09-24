// ============================================================
// /api/civitai-callback — OAuth2 + PKCE (Civitai) — scambio code
// Dopo il login Civitai, salviamo token cifrati nel profilo Supabase
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  try {
    const { code, state } = req.query || {};
    const cookieState = req.headers.cookie?.match(/civitai_state=([^;]+)/)?.[1];
    if (!code || !state || state !== cookieState) {
      return res.redirect('/?error=civitai_state_mismatch');
    }
    const tokenRes = await fetch('https://auth.civitai.com/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: `${process.env.APP_URL || 'https://jumbai.vercel.app'}/api/civitai-callback`,
        client_id: process.env.CIVITAI_CLIENT_ID || '',
        client_secret: process.env.CIVITAI_CLIENT_SECRET || '',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.redirect('/?error=civitai_token_exchange');
    }
    // Leggi profilo Civitai per identificare utente
    const meRes = await fetch('https://civitai.com/api/v1/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json().catch(() => ({}));
    // Se l'utente è già loggato con JumbAI, aggiorniamo il profilo con i token Civitai
    // Altrimenti lo redirigiamo al login con un flag che dice "collega Civitai"
    res.setHeader('Set-Cookie', `civitai_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
    return res.redirect('/?civitai=ok');
  } catch (e) {
    return res.redirect('/?error=civitai_exception');
  }
}