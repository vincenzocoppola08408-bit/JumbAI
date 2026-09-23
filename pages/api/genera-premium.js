// ============================================================
// /api/genera-premium — Generazione Video Premium
// Asincrono: scala crediti, invia a Fal.ai con webhook, risponde subito
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const {
    userId,
    prompt,
    modello = 'hunyuan-video',
    durata_secondi = 4,
    risoluzione = '720p',
    aspect_ratio = null,
    genera_audio = false,
    ottimizza_prompt = false,
    prompt_negativo = '',
    seed = null,
    tipo_input = 'testo',
    immagine_base64 = null,
  } = req.body || {};

  // Validazione
  if (!userId || !prompt) {
    return res.status(400).json({ error: 'Parametri mancanti (userId, prompt).' });
  }

  try {
    // 1. Verifica utente e crediti
    const { data: utente, error: dbError } = await supabaseAdmin
      .from('profili')
      .select('crediti')
      .eq('id', userId)
      .single();

    if (dbError || !utente) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    // Calcola costo in crediti
    const costoCrediti = durata_secondi <= 6 ? 1 : 2;
    if (utente.crediti < costoCrediti) {
      return res.status(403).json({
        error: `Crediti insufficienti. Servono \ crediti, ne hai ${utente.crediti}.`,
      });
    }

    // 2. Scala crediti (optimistic lock)
    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti - costoCrediti })
      .eq('id', userId)
      .eq('crediti', utente.crediti);

    if (updateError) {
      return res.status(500).json({ error: 'Errore aggiornamento crediti.' });
    }

    // 3. Crea record "rendering" nel DB (id è generato da Supabase)
    const { data: nuovoVideo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({
        user_id: userId,
        prompt: prompt,
        prompt_negativo: prompt_negativo,
        seed: seed || null,
        modello: modello,
        tipo_input: tipo_input,
        durata_secondi: durata_secondi,
        risoluzione: risoluzione,
        genera_audio: genera_audio,
        ottimizza_prompt: ottimizza_prompt,
        titolo: prompt.substring(0, 60),
        stato: 'rendering',
      })
      .select('id')
      .single();

    if (insertError || !nuovoVideo) {
      // Rollback crediti
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);
      return res.status(500).json({ error: 'Errore creazione record video.' });
    }

    const videoId = nuovoVideo.id;

    // 4. Costruisci il payload per Fal.ai
    // Mappa risoluzione a aspect_ratio
    const aspectRatioMap = {
      '720p': '16:9',
      '1080p': '16:9',
      '4K': '16:9',
    };

    const aspectRatioFinale =
      aspect_ratio === '9:16' || aspect_ratio === '16:9'
        ? aspect_ratio
        : (aspectRatioMap[risoluzione] || '16:9');

    const falBody = {
      prompt: ottimizza_prompt
        ? `${prompt}. Cinematic, high quality, detailed scene, smooth camera movement, professional lighting.`
        : prompt,
      ...(prompt_negativo && { negative_prompt: prompt_negativo }),
      ...(seed !== null && { seed: Number(seed) }),
      aspect_ratio: aspectRatioFinale,
      duration_seconds: durata_secondi,
      ...(genera_audio && { enable_audio: true }),
      ...(immagine_base64 && {
        image_url: String(immagine_base64).startsWith('data:')
          ? String(immagine_base64)
          : `data:image/png;base64,${immagine_base64}`,
      }),
      // user_data per il webhook
      user_data: {
        userId: userId,
        videoId: videoId,
        promptUsato: prompt,
      },
    };

    // 5. Webhook URL (DOVE Fal.ai ci risponde)
    const baseUrl = process.env.SITE_BASE_URL || `https://${process.env.VERCEL_URL || 'jumbai.vercel.app'}`;
    // Pass ids in query: Fal often does not echo custom user_data to the webhook
    const webhookUrl = `${baseUrl}/api/webhook-video-pronto?videoId=${encodeURIComponent(videoId)}&userId=${encodeURIComponent(userId)}`;

    // 6. Determina endpoint Fal.ai in base al modello
    let falEndpoint = 'https://queue.fal.run/fal-ai/hunyuan-video';
    if (modello === 'hunyuan-video-pro') {
      falEndpoint = 'https://queue.fal.run/fal-ai/hunyuan-video-pro';
    } else if (modello === 'minimax-video') {
      falEndpoint = 'https://queue.fal.run/fal-ai/minimax-video';
    } else if (modello === 'cogvideo') {
      falEndpoint = 'https://queue.fal.run/fal-ai/cogvideox';
    }

    // 7. Invia a Fal.ai
    const falRes = await fetch(
      `${falEndpoint}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_AI_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(falBody),
      }
    );

    let falData = null;
    try {
      falData = await falRes.json();
    } catch {}

    if (!falRes.ok) {
      // Rollback: ripristina credito e segna come fallito
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);

      await supabaseAdmin
        .from('video_generati')
        .update({ stato: 'fallito', errore: `Fal.ai error: ${falRes.status}` })
        .eq('id', videoId);

      console.error('Fal.ai error:', falRes.status, falData);
      return res.status(502).json({ error: 'Impossibile inviare la richiesta a Fal.ai.' });
    }

    // 8. Salva request_id per tracciamento
    const requestId = falData?.request_id || null;
    if (requestId) {
      await supabaseAdmin
        .from('video_generati')
        .update({ request_id: requestId })
        .eq('id', videoId);
    }

    // 9. Rispondi SUBITO (lancia e dimentica — anti-timeout)
    return res.status(200).json({
      status: 'In coda',
      video_id: videoId,
      request_id: requestId,
      crediti_rimasti: utente.crediti - costoCrediti,
      message: '✅ Richiesta presa in carico! Il video apparirà nella galleria tra 30-90 secondi (si aggiorna in tempo reale).',
    });
  } catch (e) {
    console.error('Errore backend premium:', e);
    return res.status(500).json({ error: 'Errore interno nel sottosistema premium.' });
  }
}