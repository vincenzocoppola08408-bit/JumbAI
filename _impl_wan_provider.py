# -*- coding: utf-8 -*-
"""Create Wan/DashScope provider files for JumbAI Genera Gratis."""
from pathlib import Path

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")

WAN_JS = r'''// ============================================================
// lib/wan.js — Alibaba Model Studio (DashScope intl / Singapore)
// Wan text-to-video, image-to-video, text-to-image (async + poll)
// Env: DASHSCOPE_API_KEY (required), DASHSCOPE_BASE_URL (optional)
// Default base: https://dashscope-intl.aliyuncs.com
// ============================================================

const DEFAULT_BASE = 'https://dashscope-intl.aliyuncs.com';

export function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY || '';
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  return { apiKey, baseUrl };
}

/** Map UI durata 4/6/8 to Wan-supported seconds (wan2.6-t2v: integer 2–15). */
export function mapWanDuration(requested) {
  const n = Math.round(Number(requested) || 5);
  if (!Number.isFinite(n)) return 5;
  return Math.min(15, Math.max(2, n));
}

/** 720p size string for wan2.6 (legacy size param). */
export function mapWanSize(aspectRatio, risoluzione) {
  const ar = aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9';
  const want480 = String(risoluzione || '').toLowerCase().includes('480');
  if (want480) {
    if (ar === '9:16') return '480*832';
    if (ar === '1:1') return '624*624';
    return '832*480';
  }
  // 720p default
  if (ar === '9:16') return '720*1280';
  if (ar === '1:1') return '960*960';
  return '1280*720';
}

export const WAN_MODELS = {
  t2v: process.env.WAN_T2V_MODEL || 'wan2.6-t2v',
  i2v: process.env.WAN_I2V_MODEL || 'wan2.6-i2v',
  t2i: process.env.WAN_T2I_MODEL || 'wanx2.1-t2i-turbo',
};

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Submit async Wan video synthesis (T2V or I2V).
 * @returns {{ ok: true, taskId, requestId, model, duration, size } | { ok: false, status, code, message, raw }}
 */
export async function submitWanVideo({
  prompt,
  negativePrompt = '',
  durationSeconds = 5,
  aspectRatio = '16:9',
  risoluzione = '720p',
  imgUrl = null,
  seed = null,
  promptExtend = true,
}) {
  const { apiKey, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    return { ok: false, status: 500, code: 'MISSING_KEY', message: 'DASHSCOPE_API_KEY mancante' };
  }

  const duration = mapWanDuration(durationSeconds);
  const size = mapWanSize(aspectRatio, risoluzione);
  const isI2v = Boolean(imgUrl && String(imgUrl).startsWith('http'));
  const model = isI2v ? WAN_MODELS.i2v : WAN_MODELS.t2v;

  const input = { prompt: String(prompt || '').slice(0, 1500) };
  if (negativePrompt) input.negative_prompt = String(negativePrompt).slice(0, 500);
  if (isI2v) input.img_url = imgUrl;

  const parameters = {
    size,
    duration,
    prompt_extend: Boolean(promptExtend),
    watermark: false,
  };
  if (seed !== null && seed !== undefined && seed !== '') {
    parameters.seed = Number(seed);
  }

  const url = `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({ model, input, parameters }),
  });

  const data = await parseJsonSafe(res);
  const taskId = data?.output?.task_id || null;

  if (!res.ok || !taskId) {
    return {
      ok: false,
      status: res.status || 502,
      code: data?.code || 'PROVIDER_REJECTED',
      message: data?.message || data?.code || `Wan submit failed (${res.status})`,
      raw: data,
      model,
      duration,
      size,
    };
  }

  return {
    ok: true,
    taskId,
    requestId: data?.request_id || null,
    model,
    duration,
    size,
    taskStatus: data?.output?.task_status || 'PENDING',
  };
}

/**
 * Submit async Wan text-to-image.
 */
export async function submitWanImage({
  prompt,
  negativePrompt = '',
  size = '1024*1024',
  seed = null,
  promptExtend = true,
}) {
  const { apiKey, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    return { ok: false, status: 500, code: 'MISSING_KEY', message: 'DASHSCOPE_API_KEY mancante' };
  }

  const model = WAN_MODELS.t2i;
  const input = { prompt: String(prompt || '').slice(0, 500) };
  if (negativePrompt) input.negative_prompt = String(negativePrompt).slice(0, 500);

  const parameters = {
    size,
    n: 1,
    prompt_extend: Boolean(promptExtend),
    watermark: false,
  };
  if (seed !== null && seed !== undefined && seed !== '') {
    parameters.seed = Number(seed);
  }

  const url = `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({ model, input, parameters }),
  });

  const data = await parseJsonSafe(res);
  const taskId = data?.output?.task_id || null;

  if (!res.ok || !taskId) {
    return {
      ok: false,
      status: res.status || 502,
      code: data?.code || 'PROVIDER_REJECTED',
      message: data?.message || data?.code || `Wan T2I submit failed (${res.status})`,
      raw: data,
      model,
    };
  }

  return {
    ok: true,
    taskId,
    requestId: data?.request_id || null,
    model,
    taskStatus: data?.output?.task_status || 'PENDING',
  };
}

/**
 * Poll DashScope task. Extracts video_url or image url from SUCCEEDED payloads.
 * TODO: DashScope URLs expire ~24h — upload to Supabase Storage when a bucket exists.
 */
export async function getWanTask(taskId) {
  const { apiKey, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    return { ok: false, status: 500, code: 'MISSING_KEY', message: 'DASHSCOPE_API_KEY mancante' };
  }
  if (!taskId) {
    return { ok: false, status: 400, code: 'MISSING_TASK', message: 'taskId mancante' };
  }

  const url = `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await parseJsonSafe(res);

  if (!res.ok && !data?.output) {
    return {
      ok: false,
      status: res.status || 502,
      code: data?.code || 'POLL_FAILED',
      message: data?.message || `Task poll failed (${res.status})`,
      raw: data,
    };
  }

  const output = data?.output || {};
  const taskStatus = output.task_status || data?.code || 'UNKNOWN';

  let mediaUrl = null;
  let mediaKind = null; // 'video' | 'image'

  if (output.video_url) {
    mediaUrl = output.video_url;
    mediaKind = 'video';
  } else if (Array.isArray(output.results) && output.results[0]?.url) {
    mediaUrl = output.results[0].url;
    mediaKind = 'image';
  } else if (Array.isArray(output.choices)) {
    const content = output.choices[0]?.message?.content;
    const img = Array.isArray(content) ? content.find((c) => c?.image || c?.type === 'image') : null;
    if (img?.image) {
      mediaUrl = img.image;
      mediaKind = 'image';
    }
  }

  return {
    ok: true,
    taskId: output.task_id || taskId,
    taskStatus,
    mediaUrl,
    mediaKind,
    code: output.code || data?.code || null,
    message: output.message || data?.message || null,
    usage: data?.usage || null,
    raw: data,
  };
}
'''

GENERAFREE = r'''// ============================================================
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
'''

GENERAIMGFREE = r'''// ============================================================
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
'''

WANSTATUS = r'''// ============================================================
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
'''

(ROOT / 'lib' / 'wan.js').write_text(WAN_JS, encoding='utf-8')
(ROOT / 'pages' / 'api' / 'genera-free.js').write_text(GENERAFREE, encoding='utf-8')
(ROOT / 'pages' / 'api' / 'genera-immagine-free.js').write_text(GENERAIMGFREE, encoding='utf-8')
(ROOT / 'pages' / 'api' / 'wan-status.js').write_text(WANSTATUS, encoding='utf-8')
print('Wrote lib/wan.js, genera-free.js, genera-immagine-free.js, wan-status.js')
