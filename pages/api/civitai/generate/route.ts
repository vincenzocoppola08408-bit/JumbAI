// ============================================================
// pages/api/civitai/generate/route.ts
// Endpoint di generazione Civitai con filtri atomici e gestione crediti
// ============================================================
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encryptAES256GCM, decryptAES256GCM } from '@/lib/cipher';
import { generateImage, refreshAccessToken, saveEncryptedTokens, getWorkflowStatus } from '@/lib/civitai-oauth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, prompt, width, height, model, seed, negativePrompt } = body;

    if (!userId || !prompt) {
      return NextResponse.json(
        { error: 'userId e prompt sono obbligatori' },
        { status: 400 }
      );
    }

    // 1. Recupera l'utente dal database
    const { data: user, error: userError } = await supabaseAdmin
      .from('profili')
      .select('crediti, piano, civitai_connected, civitai_access_token_enc, civitai_access_iv, civitai_access_auth_tag, civitai_refresh_token_enc, civitai_refresh_iv, civitai_refresh_auth_tag, civitai_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // 2. FILTRO 1: Verifica capienza economica interna (solo per piano free)
    if (user.piano !== 'premium' && user.crediti <= 0) {
      return NextResponse.json(
        { error: 'JUMBAI_CREDITS_EXHAUSTED', code: 403 },
        { status: 403 }
      );
    }

    // 3. FILTRO 2: Verifica stato di connessione Civitai
    if (!user.civitai_connected) {
      return NextResponse.json(
        { error: 'CIVITAI_NOT_CONNECTED', code: 401 },
        { status: 401 }
      );
    }

    // 4. FILTRO 3: Verifica scadenza token e refresh automatico se necessario
    let accessToken = null;
    if (user.civitai_access_token_enc && user.civitai_access_iv && user.civitai_access_auth_tag) {
      try {
        accessToken = decryptAES256GCM(
          user.civitai_access_token_enc,
          user.civitai_access_iv,
          user.civitai_access_auth_tag
        );
      } catch (decryptErr) {
        console.error('Token decryption failed:', decryptErr);
        return NextResponse.json(
          { error: 'Token decryption failed', code: 500 },
          { status: 500 }
        );
      }

      // Controlla se il token è scaduto
      const tokenExpiry = new Date(user.civitai_expires_at || 0);
      if (tokenExpiry < new Date()) {
        // Token scaduto, tenta il refresh
        if (user.civitai_refresh_token_enc && user.civitai_refresh_iv && user.civitai_refresh_auth_tag) {
          try {
            const refreshToken = decryptAES256GCM(
              user.civitai_refresh_token_enc,
              user.civitai_refresh_iv,
              user.civitai_refresh_auth_tag
            );

            const refreshed = await refreshAccessToken(refreshToken, process.env.CIVITAI_CLIENT_ID!, process.env.CIVITAI_CLIENT_SECRET!);
            accessToken = refreshed.access_token;

            // Aggiorna i token cifrati nel database
            const encryptedTokens = saveEncryptedTokens(
              refreshed.access_token,
              refreshed.refresh_token,
              refreshed.expires_in
            );

            await supabaseAdmin
              .from('profili')
              .update({
                civitai_access_token_enc: encryptedTokens.encrypted_access_token,
                civitai_access_iv: encryptedTokens.access_iv,
                civitai_access_auth_tag: encryptedTokens.access_auth_tag,
                civitai_refresh_token_enc: encryptedTokens.encrypted_refresh_token,
                civitai_refresh_iv: encryptedTokens.refresh_iv,
                civitai_refresh_auth_tag: encryptedTokens.refresh_auth_tag,
                civitai_expires_at: encryptedTokens.expires_at,
                civitai_last_refreshed_at: encryptedTokens.last_refreshed_at
              })
              .eq('id', userId);
          } catch (refreshErr) {
            console.error('Token refresh failed:', refreshErr);
            return NextResponse.json(
              { error: 'Token refresh failed', code: 401 },
              { status: 401 }
            );
          }
        } else {
          return NextResponse.json(
            { error: 'No refresh token available', code: 401 },
            { status: 401 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Civitai tokens not found', code: 401 },
        { status: 401 }
      );
    }

    // 5. Operazione atomica: decremento crediti solo per utenti free
    if (user.piano !== 'premium') {
      const { error: debitError } = await supabaseAdmin
        .from('profili')
        .update({ crediti: user.crediti - 1 })
        .eq('id', userId)
        .eq('crediti', user.crediti); // Condizione di race condition

      if (debitError) {
        // Qualcun altro ha consumato l'ultimo credito contemporaneamente
        return NextResponse.json(
          { error: 'JUMBAI_CREDITS_EXHAUSTED_RACE', code: 403 },
          { status: 403 }
        );
      }
    }

    // 6. Chiama l'API di orchestrazione di Civitai per generare l'immagine
    const generationResponse = await generateImage(
      accessToken,
      prompt,
      {
        width: width || 1024,
        height: height || 1024,
        model: model || 'flux',
        seed: seed || null,
        negativePrompt: negativePrompt || '',
        callbacks: [
          {
            url: `${process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || 'https://jumbai.vercel.app'}/api/webhooks/civitai`,
            type: ['workflow:succeeded', 'workflow:failed'],
            detailed: true
          }
        ]
      }
    );

    // 7. Crea un record nella tabella immagini_generate con lo stato 'generazione'
    const { data: newImage, error: insertError } = await supabaseAdmin
      .from('immagini_generate')
      .insert({
        user_id: userId,
        prompt: prompt,
        prompt_negativo: negativePrompt || '',
        seed: seed || null,
        modello: model || 'flux',
        categoria: 'generale',
        size: `${width || 1024}*${height || 1024}`,
        stato: 'generazione',
        provider: 'civitai',
        request_id: generationResponse.id, // Il workflow ID da Civitai
        completato_il: null
      })
      .select('id')
      .single();

    if (insertError) {
      // Se l'inserimento fallisce, effettuiamo il rollback dei crediti (se li abbiamo detratti)
      if (user.piano !== 'premium') {
        await supabaseAdmin
          .from('profili')
          .update({ crediti: user.crediti })
          .eq('id', userId);
      }
      return NextResponse.json(
        { error: 'Failed to create generation record', code: 500 },
        { status: 500 }
      );
    }

    // 8. Restituisce la risposta al frontend
    return NextResponse.json({
      status: 'PENDING',
      message: 'Generazione avviata',
      workflow_id: generationResponse.id,
      image_id: newImage.id,
      crediti_rimasti: user.piano !== 'premium' ? user.crediti - 1 : user.crediti
    });

  } catch (error: any) {
    console.error('Civitai generation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore interno nella generazione' },
      { status: 500 }
    );
  }
}