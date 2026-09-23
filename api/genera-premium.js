import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// POST /api/genera-premium — body: { userId, prompt, model?, aspectRatio?, duration?, resolution? }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const { userId, prompt, model, aspectRatio, duration, resolution } = req.body || {};
  if (!userId || !prompt) {
    return res.status(400).json({ error: 'Parametri mancanti (userId, prompt).' });
  }

  try {
    // 1. Verifica esistenza utente e crediti
    const { data: utente, error: dbError } = await supabase
      .from('profili')
      .select('crediti')
      .eq('id', userId)
      .single();

    if (dbError || !utente) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }
    if (utente.crediti < 1) {
      return res.status(403).json({ error: 'Crediti insufficienti. Acquista un pacchetto tramite Stripe.' });
    }

    // 2. Scala 1 credito in modo atomico
    const { error: updateError } = await supabase
      .from('profili')
      .update({ crediti: utente.crediti - 1 })
      .eq('id', userId)
      .eq('crediti', utente.crediti); // optimistic lock

    if (updateError) {
      return res.status(500).json({ error: 'Errore aggiornamento crediti.' });
    }

    // 3. Costruisci il payload per Fal.ai (Hunyuan Video)
    const falBody = {
      prompt,
      ...(model && { model }),
      ...(aspectRatio && { aspect_ratio: aspectRatio }),
      ...(duration && { duration_seconds: Number(duration) }),
      ...(resolution && { resolution }),
    };

    // 4. Chiamata alla REST API di Fal.ai queue con webhook
    const falWebhookUrl = `${process.env.SITE_BASE_URL || 'https://vercel.app'}/api/webhook-video-pronto`;
    const falRes = await fetch(
      `https://queue.fal.run/fal-ai/hunyuan-video?fal_webhook=${encodeURIComponent(falWebhookUrl)}`,
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
    try { falData = await falRes.json(); } catch {}

    if (!falRes.ok) {
      console.error('Errore invio Fal.ai:', falRes.status, falData);
      return res.status(502).json({ error: 'Impossibile inviare la richiesta a Fal.ai.' });
    }

    // 5. Rispondi immediatamente per evitare timeout host (10-15s)
    return res.status(200).json({
      status: 'In coda',
      request_id: falData?.request_id || null,
      message: 'Richiesta presa in carico dai server cloud. Il video apparirà nella tua galleria tra 30-60 secondi.',
    });

  } catch (e) {
    console.error('Errore backend premium:', e);
    return res.status(500).json({ error: 'Errore interno nel sottosistema premium.' });
  }
}
