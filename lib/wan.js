// ============================================================
// lib/wan.js — Alibaba Model Studio (DashScope intl / Singapore)
// Wan2.1 text-to-image (T2I) + Wan2.6 video (legacy)
// Env: DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL (optional)
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
  if (ar === '9:16') return '720*1280';
  if (ar === '1:1') return '960*960';
  return '1280*720';
}

export const WAN_MODELS = {
  t2v: process.env.WAN_T2V_MODEL || 'wan2.6-t2v',
  i2v: process.env.WAN_I2V_MODEL || 'wan2.6-i2v',
  t2i: process.env.WAN_T2I_MODEL || 'wanx2.1-t2i-turbo',
};

// ============================================================
// WAN SIZE MAP for T2I — aspect ratio presets
// ============================================================
export const WAN_T2I_SIZES = {
  '1:1': '1024*1024',
  '4:3': '1152*896',
  '3:4': '896*1152',
  '16:9': '1280*720',
  '9:16': '720*1280',
  '3:2': '1152*768',
  '2:3': '768*1152',
};

function getT2ISize(aspectRatio) {
  return WAN_T2I_SIZES[aspectRatio] || WAN_T2I_SIZES['1:1'];
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// SUBMIT WAN TEXT-TO-IMAGE (async)
// ============================================================
export async function submitWanImage({
  prompt,
  negativePrompt = '',
  aspectRatio = '1:1',
  seed = null,
  promptExtend = true,
  n = 1,
}) {
  const { apiKey, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    return { ok: false, status: 500, code: 'MISSING_KEY', message: 'DASHSCOPE_API_KEY mancante' };
  }

  const model = WAN_MODELS.t2i;
  const size = getT2ISize(aspectRatio);

  const input = { prompt: String(prompt || '').slice(0, 500) };
  if (negativePrompt) input.negative_prompt = String(negativePrompt).slice(0, 500);

  const parameters = {
    size,
    n: Math.min(Math.max(1, Number(n) || 1), 4),
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

// ============================================================
// SUBMIT WAN VIDEO (legacy — keep for compatibility)
// ============================================================
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

// ============================================================
// POLL WAN TASK STATUS
// ============================================================
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

  // Handle n>1 results (multiple images)
  if (!mediaUrl && Array.isArray(output.results) && output.results.length > 0) {
    mediaUrl = output.results[0].url;
    mediaKind = 'image';
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