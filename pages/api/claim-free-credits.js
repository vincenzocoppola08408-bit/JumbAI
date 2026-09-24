// ============================================================
// /api/claim-free-credits — Assegna crediti gratis ai nuovi utenti
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante' });
  }

  try {
    // Concedi crediti solo se l'utente non ha mai generato e ha 0 crediti
    const { data: profilo } = await supabaseAdmin
      .from('profili')
      .select('crediti')
      .eq('id', userId)
      .single();

    if (!profilo) {
      return res.status(404).json({ error: 'Profilo non trovato' });
    }

    if (profilo.crediti > 0) {
      return res.status(200).json({ crediti: profilo.crediti, note: 'Già ha crediti' });
    }

    // Verifica se ha già immagini
    const { count } = await supabaseAdmin
      .from('immagini_generate')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count && count > 0) {
      return res.status(200).json({ crediti: profilo.crediti, note: 'Già ha generato' });
    }

    // Assegna 3 crediti gratis (race condition safe: update con eq crediti=0)
    const FREE_CREDITS = 3;
    const { data: updated, error } = await supabaseAdmin
      .from('profili')
      .update({ crediti: FREE_CREDITS })
      .eq('id', userId)
      .eq('crediti', 0)
      .select('crediti')
      .single();

    if (error) {
      console.error('claim-free-credits error:', error);
      return res.status(500).json({ error: 'Errore assegnazione crediti' });
    }

    return res.status(200).json({
      crediti: updated?.crediti || FREE_CREDITS,
      note: 'Benvenuto! 3 crediti gratuiti per iniziare.',
    });
  } catch (e) {
    console.error('claim-free-credits error:', e);
    return res.status(500).json({ error: 'Errore interno' });
  }
}