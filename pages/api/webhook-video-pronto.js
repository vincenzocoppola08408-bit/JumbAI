// ============================================================
// /api/webhook-video-pronto - Riceve il video finito da Fal.ai
// LIVE schema video_generati: id, user_id, url_video, prompt_usato, creato_il
// (schema-v2 stato/request_id/errore not on production yet)
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

    const userData = payload?.payload?.user_data || payload?.user_data || {};
    const q = req.query || {};
    const userId = userData.userId || (typeof q.userId === 'string' ? q.userId : null);
    const videoId = userData.videoId || (typeof q.videoId === 'string' ? q.videoId : null);

    if (payload.status === 'ERROR' || payload.status === 'error') {
      console.error('Fal.ai report error:', payload);
      // Legacy schema has no stato/errore — leave pending row; client can ignore non-http urls
      return res.status(200).json({ status: 'error_received', request_id: requestId });
    }

    if (!videoUrl && (payload.status === 'IN_QUEUE' || payload.status === 'IN_PROGRESS')) {
      return res.status(200).json({ status: 'ok', received: false, progress: payload.status });
    }

    if (!videoUrl) {
      return res.status(200).json({ status: 'ok', received: false, request_id: requestId });
    }

    if (videoId) {
      const { data: existing } = await supabaseAdmin
        .from('video_generati')
        .select('id, url_video')
        .eq('id', videoId)
        .single();

      // Idempotency: already has a real http(s) URL
      if (existing?.url_video && String(existing.url_video).startsWith('http')) {
        return res.status(200).json({ status: 'success', duplicate: true });
      }

      const { error: updateError } = await supabaseAdmin
        .from('video_generati')
        .update({ url_video: videoUrl })
        .eq('id', videoId);

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({
          error: 'Errore aggiornamento video.',
          updateError: { message: updateError.message, code: updateError.code },
        });
      }

      return res.status(200).json({
        status: 'success',
        video_id: videoId,
        request_id: requestId,
      });
    }

    // No videoId: aggiorna la riga pending piu vecchia dell'utente, altrimenti inserisci
    if (userId && videoUrl) {
      const { data: pending } = await supabaseAdmin
        .from('video_generati')
        .select('id')
        .eq('user_id', userId)
        .eq('url_video', 'pending')
        .order('creato_il', { ascending: true })
        .limit(1);
      if (pending && pending.length > 0) {
        const { error: upErr } = await supabaseAdmin
          .from('video_generati')
          .update({ url_video: videoUrl })
          .eq('id', pending[0].id);
        if (!upErr) return res.status(200).json({ status: 'success', video_id: pending[0].id, request_id: requestId });
        console.error('Update pending error:', upErr);
      }
    }
    if (userId && videoUrl) {
      const { error: insertError } = await supabaseAdmin
        .from('video_generati')
        .insert({
          user_id: userId,
          url_video: videoUrl,
          prompt_usato: userData.promptUsato || (typeof q.prompt === 'string' ? q.prompt : ''),
        });

      if (insertError) {
        console.error('Insert error legacy:', insertError);
        return res.status(500).json({
          error: 'Errore salvataggio video legacy.',
          insertError: { message: insertError.message, code: insertError.code },
        });
      }

      return res.status(200).json({ status: 'success', request_id: requestId });
    }

    return res.status(200).json({ status: 'ok', received: false, request_id: requestId });
  } catch (e) {
    console.error('Errore webhook:', e);
    return res.status(500).json({ error: 'Errore interno webhook.' });
  }
}
