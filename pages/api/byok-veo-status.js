// ============================================================
// /api/byok-veo-status — Poll Veo LRO (API key NEVER stored)
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { apiKey, operationName } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'apiKey mancante nel body (non viene mai salvata).' });
  }
  if (!operationName || typeof operationName !== 'string' || !operationName.trim()) {
    return res.status(400).json({ error: 'operationName mancante.' });
  }

  const key = apiKey.trim();
  const op = operationName.trim().replace(/^\/+/, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/${op}`;

  try {
    const googleRes = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': key,
      },
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
      return res.status(googleRes.status >= 400 && googleRes.status < 600 ? googleRes.status : 502).json({
        error: msg,
        details: data?.error || null,
      });
    }

    const done = Boolean(data?.done);

    if (data?.error) {
      const msg =
        data.error.message ||
        data.error.status ||
        JSON.stringify(data.error);
      return res.status(200).json({
        done: true,
        error: msg,
        videoUri: null,
        raw: null,
      });
    }

    let videoUri = null;
    if (done) {
      const resp = data?.response || {};
      videoUri =
        resp?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        resp?.generateVideoResponse?.generatedSamples?.[0]?.video?.url ||
        resp?.generatedSamples?.[0]?.video?.uri ||
        null;

      if (!videoUri && resp?.response) {
        const inner = resp.response;
        videoUri =
          inner?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          inner?.generatedSamples?.[0]?.video?.uri ||
          null;
      }

      if (!videoUri) {
        const stack = [resp];
        while (stack.length) {
          const cur = stack.pop();
          if (!cur || typeof cur !== 'object') continue;
          if (cur.video && typeof cur.video.uri === 'string') {
            videoUri = cur.video.uri;
            break;
          }
          if (typeof cur.uri === 'string' && /download|files\//i.test(cur.uri)) {
            videoUri = cur.uri;
            break;
          }
          for (const v of Object.values(cur)) {
            if (v && typeof v === 'object') stack.push(v);
          }
        }
      }
    }

    return res.status(200).json({
      done,
      error: null,
      videoUri: videoUri || null,
      meta: done
        ? {
            hasResponse: Boolean(data?.response),
            responseKeys: data?.response ? Object.keys(data.response) : [],
          }
        : { metadata: data?.metadata || null },
    });
  } catch (e) {
    console.error('byok-veo-status exception:', e);
    return res.status(500).json({ error: e?.message || 'Errore interno status Veo.' });
  }
}
