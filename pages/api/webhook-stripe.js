// ============================================================
// /api/webhook-stripe — Stripe Webhook per checkout completato
// Aggiorna profili.crediti + piano dopo pagamento
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = (err && err.message) || 'Unknown webhook error';
    console.error('Stripe webhook signature verification failed:', msg);
    return res.status(400).json({ error: 'Webhook Error: ' + msg });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const crediti = parseInt(session.metadata?.crediti || '0', 10);

    if (userId && crediti > 0) {
      try {
        // Update diretto (nessuna RPC — potrebbe non esistere)
        const { data: profilo } = await supabaseAdmin
          .from('profili')
          .select('crediti')
          .eq('id', userId)
          .single();

        const nuoviCrediti = (profilo?.crediti || 0) + crediti;
        await supabaseAdmin
          .from('profili')
          .update({ crediti: nuoviCrediti, piano: 'premium' })
          .eq('id', userId);

        console.log(`Stripe: ${crediti} crediti aggiunti a ${userId}`);
      } catch (err) {
        console.error('Errore aggiornamento crediti da Stripe:', err);
        return res.status(500).json({ error: 'Errore aggiornamento crediti' });
      }
    }
  }

  res.status(200).json({ received: true });
}