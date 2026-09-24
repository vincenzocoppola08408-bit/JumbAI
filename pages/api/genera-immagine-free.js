// ============================================================
// /api/genera-immagine-free — Genera Immagine Gratis (Wan T2I)
// Cost: 1 credit. Same anti-refund rule as video free path.
// Saves image URL into video_generati.url_video (legacy schema).
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';
import { submitWanImage } from '../../lib/wan';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const {
    userId,
    prompt,
    prompt_negativo = '',
    seed = null,
    size = '1024*1024',
    ottimizza_prompt = true,
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

    const costoCrediti = 1;
    if (utente.crediti < costoCrediti) {
      return res.status(403).json({
        error: `Crediti insufficienti. Serve 1 credito, ne hai ${utente.crediti}.`,
      });
    }

    const wan = await submitWanImage({
      prompt,
      negativePrompt: prompt_negativo,
      size,
      seed,
      promptExtend: Boolean(ottimizza_prompt),
    });

    if (!wan.ok) {
      if (wan.code === 'MISSING_KEY') {
        return res.status(500).json({ error: 'DASHSCOPE_API_KEY mancante' });
      }
      console.error('Wan T2I rejected:', wan.status, wan.code, wan.message);
      return res.status(502).json({
        error: 'Impossibile inviare la richiesta immagine a Wan/DashScope.',
        providerStatus: wan.status,
        providerCode: wan.code,
        providerMessage: String(wan.message || '').slice(0, 800),
        crediti_rimasti: utente.crediti,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti - costoCrediti })
      .eq('id', userId)
      .eq('crediti', utente.crediti);
    if (updateError) console.error('Errore addebito crediti post-Wan-T2I:', updateError);

    const { data: nuovo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({ user_id: userId, prompt_usato: `[img] ${prompt}`, url_video: 'pending' })
      .select('id')
      .single();
    if (insertError) console.error('video_generati insert error (img):', insertError);

    return res.status(200).json({
      status: 'In coda',
      provider: 'wan',
      kind: 'image',
      video_id: nuovo?.id || null,
      task_id: wan.taskId,
      request_id: wan.requestId,
      model: wan.model,
      crediti_rimasti: utente.crediti - costoCrediti,
      message: 'Immagine Wan in coda. Apparira in Progetti (URL provider ~24h).',
    });
  } catch (e) {
    console.error('Errore genera-immagine-free:', e);
    return res.status(500).json({ error: 'Errore interno generazione immagine Wan.' });
  }
}
