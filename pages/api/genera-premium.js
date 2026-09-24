// ============================================================
// /api/genera-premium — Generazione Immagine Premium (Fal.ai T2I)
// Anti-refund: debit only after Fal accepts.
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
    aspect_ratio = '1:1',
    ottimizza_prompt = false,
    modello = 'fal',
    categoria = 'generale',
    size = null,
  } = req.body || {};

  if (!userId || !prompt) {
    return res.status(400).json({ error: 'Parametri mancanti (userId, prompt).' });
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

    const costoCrediti = 2; // Premium costs 2 credits per image
    if (utente.crediti < costoCrediti) {
      return res.status(403).json({
        error: `Crediti insufficienti. Servono ${costoCrediti} crediti, ne hai ${utente.crediti}.`,
      });
    }

    // Build Fal.ai payload
    // Fal SDXL usa image_size (string enum) non aspect_ratio
    const falSizeMap = {
      '1:1': 'square_hd',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '3:2': 'landscape_3_2',
      '2:3': 'portrait_2_3',
    };
    const falSize = falSizeMap[aspect_ratio] || 'square_hd';

    let providerAccepted = false;
    let providerData = null;

    if (modello === 'fal' || modello === 'fal-fast') {
      // Fal.ai SDXL T2I endpoint
      const baseUrl = process.env.SITE_BASE_URL || `https://${process.env.VERCEL_URL || 'jumbai.vercel.app'}`;
      const webhookUrl = `${baseUrl}/api/webhook-image-pronto?userId=${encodeURIComponent(userId)}&prompt=${encodeURIComponent(String(prompt).slice(0, 300))}`;

      const falBody = {
        prompt: ottimizza_prompt
          ? `${prompt}. High quality, detailed, sharp focus, professional photography, 8K, award winning.`
          : prompt,
        ...(prompt_negativo && { negative_prompt: prompt_negativo }),
        ...(seed !== null && seed !== '' && { seed: Number(seed) }),
        image_size: falSize,
        safety_checker: false,
        num_images: 1,
        expand_image: false,
        user_data: { userId, promptUsato: prompt },
      };

      const falRes = await fetch(
        `https://queue.fal.run/fal-ai/fast-sdxl?fal_webhook=${encodeURIComponent(webhookUrl)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${process.env.FAL_AI_MASTER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(falBody),
        }
      );

      try { providerData = await falRes.json(); } catch {}
      providerAccepted = falRes.ok;
    } else {
      // Fallback to Wan/DashScope
      const wan = await submitWanImage({
        prompt,
        negativePrompt: prompt_negativo,
        aspectRatio: finalAspectRatio,
        seed,
        promptExtend: Boolean(ottimizza_prompt),
      });
      providerAccepted = wan.ok;
      providerData = wan;
    }

    if (!providerAccepted) {
      console.error('Provider rejected:', providerData);
      return res.status(502).json({
        error: 'Impossibile inviare la richiesta al provider.',
        providerDetail: providerData?.message || providerData?.error || 'Provider rejected',
        crediti_rimasti: utente.crediti,
      });
    }

    // Provider accepted → debit + pending row
    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti - costoCrediti })
      .eq('id', userId)
      .eq('crediti', utente.crediti);
    if (updateError) console.error('Errore addebito crediti Premium:', updateError);

    const taskId = providerData?.taskId || providerData?.request_id || providerData?.id || null;

    const { data: nuovo, error: insertError } = await supabaseAdmin
      .from('immagini_generate')
      .insert({
        user_id: userId,
        prompt,
        prompt_negativo,
        seed: seed || null,
        modello: modello,
        categoria,
        size: size || '1024*1024',
        stato: 'generazione',
        request_id: taskId,
        provider: modello === 'fal' || modello === 'fal-fast' ? 'fal' : 'wan',
      })
      .select('id')
      .single();
    if (insertError) {
      console.error('immagini_generate insert error:', insertError);
      return res.status(500).json({ error: 'Errore creazione record immagine premium.' });
    }

    return res.status(200).json({
      status: 'In coda',
      provider: modello,
      image_id: nuovo?.id || null,
      task_id: taskId,
      crediti_rimasti: utente.crediti - costoCrediti,
      message: 'Richiesta presa in carico! Immagine in generazione.',
    });
  } catch (e) {
    console.error('Errore backend premium:', e);
    return res.status(500).json({ error: 'Errore interno nel sottosistema premium.' });
  }
}