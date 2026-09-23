// ============================================================
// /api/webhook-video-pronto - Riceve il video finito da Fal.ai
// Aggiorna il record DB: stato -> "completato" con URL video
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const payload = req.body || {};
    const requestId = payload.request_id || payload.requestId || null;
    const videoUrl = payload?.payload?.video?.url || payload?.video?.url;
    const imageUrl = payload?.payload?.images?.[0]?.url || payload?.images?.[0]?.url || null;

    // user_data from Fal payload OR query string (more reliable than Fal echoing user_data)
    const userData = payload?.payload?.user_data || payload?.user_data || {};
    const q = req.query || {};
    const userId = userData.userId || (typeof q.userId === 'string' ? q.userId : null);
    let videoId = userData.videoId || (typeof q.videoId === 'string' ? q.videoId : null);

    // Fallback: resolve videoId by Fal request_id saved at enqueue time
    if (!videoId && requestId) {
      const { data: byReq } = await supabaseAdmin
        .from('video_generati')
        .select('id, stato')
        .eq('request_id', requestId)
        .maybeSingle();
      if (byReq?.id) videoId = byReq.id;
    }

    // Se Fal.ai segnala un errore
    if (payload.status === 'ERROR' || payload.status === 'error') {
      console.error('Fal.ai report error:', payload);

      if (videoId) {
        await supabaseAdmin
          .from('video_generati')
          .update({
            stato: 'fallito',
            errore: payload.error?.message || payload.detail || 'Errore generazione video',
            completato_il: new Date().toISOString(),
          })
          .eq('id', videoId);
      }

      return res.status(200).json({ status: 'error_received', request_id: requestId });
    }

    // Payload intermedio (status update) - non contiene ancora il video
    if (!videoUrl && (payload.status === 'IN_QUEUE' || payload.status === 'IN_PROGRESS')) {
      return res.status(200).json({ status: 'ok', received: false, progress: payload.status });
    }

    // Se non abbiamo videoUrl => non e' il payload finale, lo ignoriamo
    if (!videoUrl) {
      return res.status(200).json({ status: 'ok', received: false, request_id: requestId });
    }

    // Se abbiamo videoId, aggiorna il record specifico
    if (videoId) {
      // Idempotenza: evita doppi aggiornamenti
      const { data: existing } = await supabaseAdmin
        .from('video_generati')
        .select('stato')
        .eq('id', videoId)
        .single();

      if (existing?.stato === 'completato') {
        return res.status(200).json({ status: 'success', duplicate: true });
      }

      const { error: updateError } = await supabaseAdmin
        .from('video_generati')
        .update({
          stato: 'completato',
          url_video: videoUrl,
          url_anteprima: imageUrl,
          completato_il: new Date().toISOString(),
          errore: null,
        })
        .eq('id', videoId);

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({ error: 'Errore aggiornamento video.' });
      }

      // TODO(ADD-11): Email video pronto - nessun provider email gia' nel progetto

      return res.status(200).json({
        status: 'success',
        video_id: videoId,
        request_id: requestId,
      });
    }

    // Se NON abbiamo videoId (webhook legacy), cerchiamo per user_id
    if (userId && videoUrl) {
      const { error: insertError } = await supabaseAdmin
        .from('video_generati')
        .insert({
          user_id: userId,
          url_video: videoUrl,
          url_anteprima: imageUrl,
          prompt: userData.promptUsato || '',
          stato: 'completato',
          completato_il: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Insert error legacy:', insertError);
        return res.status(500).json({ error: 'Errore salvataggio video legacy.' });
      }

      return res.status(200).json({ status: 'success', request_id: requestId });
    }

    // Nessun dato utile
    return res.status(200).json({ status: 'ok', received: false, request_id: requestId });
  } catch (e) {
    console.error('Errore webhook:', e);
    return res.status(500).json({ error: 'Errore interno webhook.' });
  }
}
