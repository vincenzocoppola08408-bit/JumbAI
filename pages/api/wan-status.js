// ============================================================
// /api/wan-status — Poll DashScope task; update video_generati
// POST { taskId, videoId, userId }
// On SUCCEEDED: store media URL into url_video
// On FAILED: set url_video='failed' (NO refund — provider already accepted)
// TODO: DashScope URLs expire ~24h; upload to Supabase Storage when bucket exists.
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';
import { getWanTask } from '../../lib/wan';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { taskId, videoId, userId } = req.body || {};
  if (!taskId) {
    return res.status(400).json({ error: 'taskId mancante' });
  }

  if (!process.env.DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: 'DASHSCOPE_API_KEY mancante' });
  }

  try {
    const poll = await getWanTask(taskId);
    if (!poll.ok && poll.code === 'MISSING_KEY') {
      return res.status(500).json({ error: 'DASHSCOPE_API_KEY mancante' });
    }
    if (!poll.ok) {
      return res.status(502).json({
        error: 'Polling Wan fallito.',
        providerStatus: poll.status,
        providerCode: poll.code,
        providerMessage: String(poll.message || '').slice(0, 800),
      });
    }

    const status = poll.taskStatus;

    if (status === 'SUCCEEDED' && poll.mediaUrl) {
      const mediaUrl = poll.mediaUrl;
      // TODO(permanent-storage): download mediaUrl and upload to Supabase Storage bucket
      // (none wired in codebase yet). DashScope links expire ~24 hours.

      if (videoId) {
        const { data: existing } = await supabaseAdmin
          .from('video_generati')
          .select('id, url_video')
          .eq('id', videoId)
          .single();
        if (existing?.url_video && String(existing.url_video).startsWith('http')) {
          return res.status(200).json({
            status: 'SUCCEEDED',
            video_id: videoId,
            url: existing.url_video,
            duplicate: true,
            mediaKind: poll.mediaKind,
          });
        }
        const { error: upErr } = await supabaseAdmin
          .from('video_generati')
          .update({ url_video: mediaUrl })
          .eq('id', videoId);
        if (upErr) {
          console.error('wan-status update error:', upErr);
          return res.status(500).json({ error: 'Errore aggiornamento video.', detail: upErr.message });
        }
        return res.status(200).json({
          status: 'SUCCEEDED',
          video_id: videoId,
          url: mediaUrl,
          mediaKind: poll.mediaKind,
          expiresNote: 'DashScope URL ~24h — TODO permanent Storage',
        });
      }

      // Fallback: oldest pending for user
      if (userId) {
        const { data: pending } = await supabaseAdmin
          .from('video_generati')
          .select('id')
          .eq('user_id', userId)
          .eq('url_video', 'pending')
          .order('creato_il', { ascending: true })
          .limit(1);
        if (pending && pending.length > 0) {
          await supabaseAdmin
            .from('video_generati')
            .update({ url_video: mediaUrl })
            .eq('id', pending[0].id);
          return res.status(200).json({
            status: 'SUCCEEDED',
            video_id: pending[0].id,
            url: mediaUrl,
            mediaKind: poll.mediaKind,
          });
        }
      }

      return res.status(200).json({
        status: 'SUCCEEDED',
        url: mediaUrl,
        mediaKind: poll.mediaKind,
        warning: 'Nessuna riga video_generati aggiornata',
      });
    }

    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      // Keep charge: provider accepted the task (anti-refund / no visible refunds).
      if (videoId) {
        const { data: existing } = await supabaseAdmin
          .from('video_generati')
          .select('id, url_video')
          .eq('id', videoId)
          .single();
        if (existing && (!existing.url_video || existing.url_video === 'pending')) {
          await supabaseAdmin
            .from('video_generati')
            .update({ url_video: 'failed' })
            .eq('id', videoId);
        }
      } else if (userId) {
        const { data: pending } = await supabaseAdmin
          .from('video_generati')
          .select('id')
          .eq('user_id', userId)
          .eq('url_video', 'pending')
          .order('creato_il', { ascending: true })
          .limit(1);
        if (pending && pending.length > 0) {
          await supabaseAdmin
            .from('video_generati')
            .update({ url_video: 'failed' })
            .eq('id', pending[0].id);
        }
      }

      return res.status(200).json({
        status,
        video_id: videoId || null,
        providerCode: poll.code,
        providerMessage: poll.message,
        refunded: false,
        note: 'Nessuno storno: il provider aveva accettato il task.',
      });
    }

    // PENDING / RUNNING
    return res.status(200).json({
      status: status || 'PENDING',
      video_id: videoId || null,
      task_id: taskId,
    });
  } catch (e) {
    console.error('Errore wan-status:', e);
    return res.status(500).json({ error: 'Errore interno wan-status.' });
  }
}
