// ============================================================
// /api/byok-veo-download — Stream Veo MP4 (API key NEVER stored)
// Avoids browser CORS on Google file download URIs.
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { apiKey, videoUri } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'apiKey mancante nel body (non viene mai salvata).' });
  }
  if (!videoUri || typeof videoUri !== 'string' || !videoUri.trim()) {
    return res.status(400).json({ error: 'videoUri mancante.' });
  }

  const key = apiKey.trim();
  let uri = videoUri.trim();

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return res.status(400).json({ error: 'videoUri non valida.' });
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === 'generativelanguage.googleapis.com' ||
    host.endsWith('.googleapis.com') ||
    host === 'www.googleapis.com';
  if (!allowed) {
    return res.status(400).json({ error: 'Host videoUri non consentito.' });
  }

  if (!parsed.searchParams.has('key')) {
    parsed.searchParams.set('key', key);
  }
  if (parsed.pathname.includes(':download') && !parsed.searchParams.has('alt')) {
    parsed.searchParams.set('alt', 'media');
  }

  try {
    const googleRes = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'x-goog-api-key': key,
      },
    });

    if (!googleRes.ok) {
      let msg = `Download Google fallito (${googleRes.status})`;
      try {
        const errBody = await googleRes.json();
        msg = errBody?.error?.message || msg;
      } catch {
        try {
          const t = await googleRes.text();
          if (t) msg = t.slice(0, 300);
        } catch {}
      }
      return res.status(502).json({ error: msg });
    }

    const contentType = googleRes.headers.get('content-type') || 'video/mp4';
    const buf = Buffer.from(await googleRes.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'inline; filename="jumbai-byok.mp4"');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('byok-veo-download exception:', e);
    return res.status(500).json({ error: e?.message || 'Errore interno download Veo.' });
  }
}
