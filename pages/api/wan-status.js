// ============================================================
// /api/wan-status — Poll DashScope task; update immagini_generate
// POST { taskId, imageId, userId }
// On SUCCEEDED: store image URL into url_immagine
// On FAILED: set stato='fallita' (NO refund — provider already accepted)
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';
import { getWanTask } from '../../lib/wan';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { taskId, imageId, userId } = req.body || {};
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

      if (imageId) {
        const { data: existing } = await supabaseAdmin
          .from('immagini_generate')
          .select('id, url_immagine, stato')
          .eq('id', imageId)
          .single();
        if (existing?.stato === 'completata' && existing?.url_immagine) {
          return res.status(200).json({
            status: 'SUCCEEDED',
            image_id: imageId,
            url: existing.url_immagine,
            duplicate: true,
            mediaKind: poll.mediaKind,
          });
        }
        const { error: upErr } = await supabaseAdmin
          .from('immagini_generate')
          .update({
            url_immagine: mediaUrl,
            stato: 'completata',
            completato_il: new Date().toISOString(),
          })
          .eq('id', imageId);
        if (upErr) {
          console.error('wan-status update error:', upErr);
          return res.status(500).json({ error: 'Errore aggiornamento immagine.', detail: upErr.message });
        }
        return res.status(200).json({
          status: 'SUCCEEDED',
          image_id: imageId,
          url: mediaUrl,
          mediaKind: poll.mediaKind,
          expiresNote: 'DashScope URL ~24h — TODO permanent Storage',
        });
      }

      // Fallback: oldest pending for user
      if (userId) {
        const { data: pending } = await supabaseAdmin
          .from('immagini_generate')
          .select('id')
          .eq('user_id', userId)
          .eq('stato', 'generazione')
          .order('creato_il', { ascending: true })
          .limit(1);
        if (pending && pending.length > 0) {
          await supabaseAdmin
            .from('immagini_generate')
            .update({
              url_immagine: mediaUrl,
              stato: 'completata',
              completato_il: new Date().toISOString(),
            })
            .eq('id', pending[0].id);
          return res.status(200).json({
            status: 'SUCCEEDED',
            image_id: pending[0].id,
            url: mediaUrl,
            mediaKind: poll.mediaKind,
          });
        }
      }

      return res.status(200).json({
        status: 'SUCCEEDED',
        url: mediaUrl,
        mediaKind: poll.mediaKind,
        warning: 'Nessuna riga immagini_generate aggiornata',
      });
    }

    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      if (imageId) {
        await supabaseAdmin
          .from('immagini_generate')
          .update({
            stato: 'fallita',
            errore: String(poll.message || 'Task fallito').slice(0, 500),
            completato_il: new Date().toISOString(),
          })
          .eq('id', imageId);
      } else if (userId) {
        const { data: pending } = await supabaseAdmin
          .from('immagini_generate')
          .select('id')
          .eq('user_id', userId)
          .eq('stato', 'generazione')
          .order('creato_il', { ascending: true })
          .limit(1);
        if (pending && pending.length > 0) {
          await supabaseAdmin
            .from('immagini_generate')
            .update({
              stato: 'fallita',
              errore: String(poll.message || 'Task fallito').slice(0, 500),
              completato_il: new Date().toISOString(),
            })
            .eq('id', pending[0].id);
        }
      }

      return res.status(200).json({
        status,
        image_id: imageId || null,
        providerCode: poll.code,
        providerMessage: poll.message,
        refunded: false,
        note: 'Nessuno storno: il provider aveva accettato il task.',
      });
    }

    // PENDING / RUNNING
    return res.status(200).json({
      status: status || 'PENDING',
      image_id: imageId || null,
      task_id: taskId,
    });
  } catch (e) {
    console.error('Errore wan-status:', e);
    return res.status(500).json({ error: 'Errore interno wan-status.' });
  }
}