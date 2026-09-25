// ============================================================
// pages/api/auth/civitai/authorize/route.ts
// Inizio flusso OAuth Civitai PKCE
// ============================================================
import { NextResponse } from 'next/server';
import { generatePKCE, getCivitaiAuthUrl } from '@/lib/civitai-oauth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || process.env.CIVITAI_CLIENT_ID;
    const redirectUri = searchParams.get('redirectUri') || process.env.CIVITAI_REDIRECT_URI;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId mancante' },
        { status: 400 }
      );
    }

    // Genera PKCE challenge
    const { challenge, state } = generatePKCE();

    // Costruisce l'URL di autorizzazione Civitai
    const authUrl = getCivitaiAuthUrl(clientId, redirectUri || '/api/auth/civitai/callback', state);

    return NextResponse.json({
      authUrl,
      state,
    });
  } catch (error: any) {
    console.error('Civitai authorize error:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore autorizzazione Civitai' },
      { status: 500 }
    );
  }
}