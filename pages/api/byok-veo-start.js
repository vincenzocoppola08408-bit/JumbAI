// ============================================================
// /api/byok-veo-start — Ephemeral Veo start (API key NEVER stored)
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const {
    apiKey,
    prompt,
    model = 'veo-3.1-generate-preview',
    durata_secondi = 4,
    risoluzione = '720p',
    aspect_ratio = '16:9',
    genera_audio = false,
    prompt_negativo = '',
    immagine_base64 = null,
  } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'apiKey mancante nel body (non viene mai salvata).' });
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt mancante.' });
  }

  const key = apiKey.trim();
  let modelId = String(model || 'veo-3.1-generate-preview').trim();
  if (!modelId.startsWith('veo-')) {
    modelId = 'veo-3.1-generate-preview';
  }

  let durationSeconds = Number(durata_secondi) || 4;
  if (![4, 6, 8].includes(durationSeconds)) {
    durationSeconds = durationSeconds <= 5 ? 4 : durationSeconds <= 7 ? 6 : 8;
  }

  const aspectRatio =
    aspect_ratio === '9:16' || aspect_ratio === '16:9' ? aspect_ratio : '16:9';

  const resolution =
    risoluzione === '1080p' || risoluzione === '720p' ? risoluzione : '720p';

  const instance = { prompt: prompt.trim() };
  if (prompt_negativo && String(prompt_negativo).trim()) {
    instance.negativePrompt = String(prompt_negativo).trim();
  }

  if (immagine_base64 && typeof immagine_base64 === 'string') {
    let raw = immagine_base64;
    let mimeType = 'image/png';
    const m = /^data:([^;]+);base64,(.+)$/s.exec(immagine_base64);
    if (m) {
      mimeType = m[1] || mimeType;
      raw = m[2];
    } else if (immagine_base64.includes(',')) {
      raw = immagine_base64.split(',').pop();
    }
    instance.image = { mimeType, bytesBase64Encoded: raw };
  }

  const parameters = {
    aspectRatio,
    durationSeconds,
    sampleCount: 1,
  };
  if (resolution === '720p' || resolution === '1080p') {
    parameters.resolution = resolution;
  }
  if (genera_audio) {
    parameters.generateAudio = true;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:predictLongRunning`;

  try {
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({ instances: [instance], parameters }),
    });

    let data = null;
    try {
      data = await googleRes.json();
    } catch {
      data = null;
    }

    if (!googleRes.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        `Google API error ${googleRes.status}`;
      console.error('byok-veo-start error:', googleRes.status, msg);
      return res.status(googleRes.status >= 400 && googleRes.status < 600 ? googleRes.status : 502).json({
        error: msg,
        details: data?.error || null,
      });
    }

    const operationName = data?.name;
    if (!operationName) {
      return res.status(502).json({
        error: 'Risposta Google senza operation name.',
        details: data,
      });
    }

    return res.status(200).json({
      operationName,
      model: modelId,
      message: 'Generazione Veo avviata.',
    });
  } catch (e) {
    console.error('byok-veo-start exception:', e);
    return res.status(500).json({ error: e?.message || 'Errore interno start Veo.' });
  }
}
