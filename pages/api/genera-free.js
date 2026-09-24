// ============================================================
// /api/genera-free — Genera Gratis via Alibaba Wan (DashScope intl)
// Anti-refund: debit + video_generati row ONLY after provider accepts.
// Premium Fal path stays in /api/genera-premium.
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';
import { submitWanVideo, mapWanDuration } from '../../lib/wan';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const {
    userId,
    prompt,
    durata_secondi = 4,
    risoluzione = '720p',
    aspect_ratio = '16:9',
    ottimizza_prompt = false,
    prompt_negativo = '',
    seed = null,
    tipo_input = 'testo',
    immagine_base64 = null,
    immagine_url = null,
  } = req.body || {};

  if (!userId || !prompt) {
    return res.status(400).json({ error: 'Parametri mancanti (userId, prompt).' });
  }

  if (!process.env.DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: 'DASHSCOPE_API_KEY mancante' });
  }

  try {
    const { data: utente, error: dbError } = await supabaseAdmin
      .from('profili')
      .select('crediti')
      .eq('id', userId)
      .single();

    if (dbError || !utente) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    const durataMapped = mapWanDuration(durata_secondi);
    const costoCrediti = Number(durata_secondi) <= 6 ? 1 : 2;
    if (utente.crediti < costoCrediti) {
      return res.status(403).json({
        error: `Crediti insufficienti. Servono ${costoCrediti} crediti, ne hai ${utente.crediti}.`,
      });
    }

    const finalPrompt = ottimizza_prompt
      ? `${prompt}. Cinematic, high quality, detailed scene, smooth camera movement, professional lighting.`
      : prompt;

    // I2V needs a public http(s) URL — base64 alone is not hosted (no Storage bucket yet).
    let imgUrl = null;
    if (immagine_url && String(immagine_url).startsWith('http')) {
      imgUrl = immagine_url;
    } else if (immagine_base64 && String(immagine_base64).startsWith('http')) {
      imgUrl = immagine_base64;
    }
    // If client sent base64 for I2V without a public URL, fall back to T2V (prompt only).

    const wan = await submitWanVideo({
      prompt: finalPrompt,
      negativePrompt: prompt_negativo,
      durationSeconds: durata_secondi,
      aspectRatio: aspect_ratio,
      risoluzione,
      imgUrl,
      seed,
      promptExtend: Boolean(ottimizza_prompt),
    });

    if (!wan.ok) {
      if (wan.code === 'MISSING_KEY') {
        return res.status(500).json({ error: 'DASHSCOPE_API_KEY mancante' });
      }
      console.error('Wan submit rejected:', wan.status, wan.code, wan.message);
      return res.status(502).json({
        error: 'Impossibile inviare la richiesta a Wan/DashScope.',
        providerStatus: wan.status,
        providerCode: wan.code,
        providerMessage: String(wan.message || '').slice(0, 800),
        crediti_rimasti: utente.crediti,
      });
    }

    // Provider accepted → debit + pending row (anti-refund rule)
    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti - costoCrediti })
      .eq('id', userId)
      .eq('crediti', utente.crediti);
    if (updateError) console.error('Errore addebito crediti post-Wan:', updateError);

    const { data: nuovoVideo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({ user_id: userId, prompt_usato: prompt, url_video: 'pending' })
      .select('id')
      .single();
    if (insertError) console.error('video_generati insert error:', insertError);
    const videoId = nuovoVideo?.id || null;

    return res.status(200).json({
      status: 'In coda',
      provider: 'wan',
      video_id: videoId,
      task_id: wan.taskId,
      request_id: wan.requestId,
      model: wan.model,
      duration_requested: Number(durata_secondi),
      duration_actual: durataMapped,
      size: wan.size,
      crediti_rimasti: utente.crediti - costoCrediti,
      message:
        'Richiesta Wan presa in carico. Il video apparira in Progetti (polling stato ~10s). URL provider validi ~24h.',
    });
  } catch (e) {
    console.error('Errore genera-free Wan:', e);
    return res.status(500).json({ error: 'Errore interno generazione gratuita Wan.' });
  }
}
