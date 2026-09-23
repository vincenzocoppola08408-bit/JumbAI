// ============================================================
// /api/webhook-stripe — Riceve eventi Stripe (pagamento completato)
// Aggiunge crediti all'utente
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const config = {
  api: {
    bodyParser: false, // Stripe richiede raw body per verify signature
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  let event;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Stripe webhook signature error:', e);
    return res.status(400).json({ error: `Webhook Error: ${e.message}` });
  }

  // Gestisci l'evento checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const crediti = parseInt(session.metadata?.crediti || '0');

    if (!userId || crediti <= 0) {
      console.error('Webhook: metadata mancanti', session.metadata);
      return res.status(200).json({ received: true, skipped: true });
    }

    // Aggiungi crediti all'utente
    const { data: utente, error: selectError } = await supabaseAdmin
      .from('profili')
      .select('crediti')
      .eq('id', userId)
      .single();

    if (selectError || !utente) {
      console.error('Webhook: utente non trovato', userId);
      return res.status(200).json({ received: true, error: 'Utente non trovato' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti + crediti, piano: 'premium' })
      .eq('id', userId);

    if (updateError) {
      console.error('Webhook: errore aggiornamento crediti', updateError);
      return res.status(200).json({ received: true, error: 'Errore aggiornamento' });
    }

    console.log(`✅ Crediti aggiornati per ${userId}: ${utente.crediti} → ${utente.crediti + crediti}`);
  }

  return res.status(200).json({ received: true });
}