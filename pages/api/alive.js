// ============================================================
// /api/alive.js — Health Check per monitoraggio
// ============================================================
export default function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      ok: true,
      name: 'JumbAI T2I',
      version: '3.0',
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(405).json({ error: 'Metodo non consentito' });
}