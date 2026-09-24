// ============================================================
// /api/webhook-image-pronto — Fal.ai / Wan Webhook Receiver
// Updates immagini_generate row when image is ready.
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Accept POST from Fal.ai or Wan callback
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const body = req.body || {};
    const queryUserId = req.query?.userId || null;
    const queryPrompt = req.query?.prompt || null;

    // Extract image URL from various provider payloads
    let imageUrl = null;
    let requestId = null;
    let status = 'completata';
    let errorMsg = null;

    // Fal.ai webhook payload
    if (body.request_id) {
      requestId = body.request_id;
      imageUrl = body?.images?.[0]?.url || body?.output?.images?.[0]?.url || body?.video?.url || null;
      if (body.status === 'ERROR' || body.status === 'FAILED') {
        status = 'fallita';
        errorMsg = body.error || body.detail || 'Unknown Fal error';
      }
    }
    // Wan callback (via metadata)
    else if (body.task_id) {
      requestId = body.task_id;
      const output = body?.output || {};
      if (output.task_status === 'SUCCEEDED') {
        if (Array.isArray(output.results) && output.results[0]?.url) {
          imageUrl = output.results[0].url;
        }
      } else if (output.task_status === 'FAILED' || output.task_status === 'CANCELED') {
        status = 'fallita';
        errorMsg = output.message || 'Wan task failed';
      }
      requestId = body.task_id;
    }

    // Find userId from metadata or query
    let userId = queryUserId;
    if (!userId) {
      userId = body?.user_data?.userId || body?.metadata?.userId || null;
    }

    // Find the pending image by request_id or userId
    let imageId = null;

    if (requestId) {
      const { data: existing } = await supabaseAdmin
        .from('immagini_generate')
        .select('id, url_immagine, stato')
        .eq('request_id', requestId)
        .single()
        .catch(() => ({ data: null }));

      if (existing) {
        imageId = existing.id;
        // Skip if already completed (idempotent)
        if (existing.stato === 'completata' && existing.url_immagine) {
          return res.status(200).json({ ok: true, duplicate: true });
        }
      }
    }

    // Fallback: find by userId oldest pending
    if (!imageId && userId) {
      const { data: pending } = await supabaseAdmin
        .from('immagini_generate')
        .select('id')
        .eq('user_id', userId)
        .eq('stato', 'generazione')
        .order('creato_il', { ascending: true })
        .limit(1);
      if (pending && pending.length > 0) {
        imageId = pending[0].id;
      }
    }

    // Update the image row
    if (imageId) {
      const updateData = {};
      if (status === 'completata' && imageUrl) {
        updateData.url_immagine = imageUrl;
        updateData.stato = 'completata';
        updateData.completato_il = new Date().toISOString();
      } else if (status === 'fallita') {
        updateData.stato = 'fallita';
        updateData.errore = String(errorMsg || '').slice(0, 500);
        updateData.completato_il = new Date().toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        await supabaseAdmin
          .from('immagini_generate')
          .update(updateData)
          .eq('id', imageId)
          .catch((e) => console.error('Webhook update error:', e));
      }

      return res.status(200).json({
        ok: true,
        image_id: imageId,
        status,
        ...(imageUrl && { url: imageUrl }),
      });
    }

    // No matching image found — log and create placeholder
    console.warn('Webhook: no matching image row for request', {
      requestId,
      userId,
      status,
    });

    // Create a fallback row if we have userId and image
    if (userId && imageUrl) {
      const { data: newImage } = await supabaseAdmin
        .from('immagini_generate')
        .insert({
          user_id: userId,
          prompt: queryPrompt || 'Webhook fallback',
          stato: 'completata',
          url_immagine: imageUrl,
          provider: 'fal',
          request_id: requestId,
          completato_il: new Date().toISOString(),
        })
        .select('id')
        .single()
        .catch(() => ({ data: null }));

      if (newImage) {
        return res.status(200).json({ ok: true, image_id: newImage.id, created: true });
      }
    }

    return res.status(200).json({ ok: true, note: 'No update needed' });
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(200).json({ ok: false, error: String(e).slice(0, 200) });
  }
}