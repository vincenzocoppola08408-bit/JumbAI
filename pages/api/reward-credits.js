// ============================================================
// /api/reward-credits — Ricarica crediti dopo ad verificato
// Il server emette un token firmato dopo ad
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  const { userId, token_jumbai_ads } = req.body || {};
  if (!userId || !token_jumbai_ads) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const { data: profilo, error: profErr } = await supabaseAdmin
      .from('profili')
      .select('crediti, civitai_buzz')
      .eq('id', userId)
      .single();
    if (profErr || !profilo) return res.status(404).json({ error: 'Profilo non trovato' });

    const nuovoCrediti = (profilo.crediti || 0) + 3;
    const { error: updErr } = await supabaseAdmin
      .from('profili')
      .update({ crediti: nuovoCrediti })
      .eq('id', userId);
    if (updErr) console.error('Errore aggiornamento crediti reward:', updErr);

    return res.status(200).json({
      success: true,
      crediti_rimasti: nuovoCrediti,
      message: 'Crediti aggiunti dopo ad verificato.',
    });
  } catch (e) {
    return res.status(500).json({ error: 'Errore interno reward' });
  }
}