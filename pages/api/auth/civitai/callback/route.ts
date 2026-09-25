// ============================================================
// pages/api/auth/civitai/callback/route.ts
// Callback Civitai: scambio codice -> token, cifratura, persistenza
// ============================================================
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, refreshAccessToken, saveEncryptedTokens } from '@/lib/civitai-oauth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Codice o stato mancante' },
        { status: 400 }
      );
    }

    // Recupera codeVerifier dalla sessione (in produzione: database o Redis)
    // Per ora otteniamo clientId/secret dalle env
    const clientId = process.env.CIVITAI_CLIENT_ID;
    const clientSecret = process.env.CIVITAI_CLIENT_SECRET;

    if (!clientId) {
      return NextResponse.json(
        { error: 'CIVITAI_CLIENT_ID non configurato' },
        { status: 500 }
      );
    }

    // Scambia il codice per access_token + refresh_token
    const tokenData = await exchangeCodeForTokens(
      code,
      state, // In produzione state contiene il verifier salvato lato server
      clientId,
      clientSecret,
      process.env.CIVITAI_REDIRECT_URI
    );

    // Salva i token cifrati
    const encryptedTokens = saveEncryptedTokens(
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in
    );

    return NextResponse.json({
      success: true,
      tokenData: {
        ...tokenData,
        ...encryptedTokens,
      },
      message: 'Civitai account connesso con successo',
    });
  } catch (error: any) {
    console.error('Civitai callback error:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore callback Civitai' },
      { status: 500 }
    );
  }
}