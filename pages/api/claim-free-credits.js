// ============================================================
// /api/claim-free-credits - One-time free credit pool (~3)
// Grants crediti=3 to eligible new users (no videos, crediti===0).
// Never exposes secrets. Idempotent no-op otherwise.
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Parametro userId mancante.' });
  }

  try {
    const { data: profilo, error: profiloErr } = await supabaseAdmin
      .from('profili')
      .select('id, crediti')
      .eq('id', userId)
      .single();

    if (profiloErr || !profilo) {
      return res.status(404).json({ error: 'Profilo non trovato.', claimed: false, crediti: 0 });
    }

    const creditiAttuali = typeof profilo.crediti === 'number' ? profilo.crediti : 0;

    // Already has credits -> no-op success
    if (creditiAttuali > 0) {
      return res.status(200).json({
        claimed: false,
        reason: 'already_has_credits',
        crediti: creditiAttuali,
      });
    }

    // Any prior video row -> no-op (already used free pool / not a brand-new account)
    const { count, error: countErr } = await supabaseAdmin
      .from('video_generati')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      console.error('claim-free-credits count error:', countErr);
      return res.status(500).json({ error: 'Errore verifica generazioni.' });
    }

    if ((count || 0) > 0) {
      return res.status(200).json({
        claimed: false,
        reason: 'already_has_videos',
        crediti: creditiAttuali,
      });
    }

    const FREE_POOL = 3;
    const { error: updateErr } = await supabaseAdmin
      .from('profili')
      .update({ crediti: FREE_POOL })
      .eq('id', userId)
      .eq('crediti', 0);

    if (updateErr) {
      console.error('claim-free-credits update error:', updateErr);
      return res.status(500).json({ error: 'Errore assegnazione crediti gratis.' });
    }

    return res.status(200).json({
      claimed: true,
      reason: 'granted',
      crediti: FREE_POOL,
    });
  } catch (e) {
    console.error('claim-free-credits error:', e);
    return res.status(500).json({ error: 'Errore interno.' });
  }
}
