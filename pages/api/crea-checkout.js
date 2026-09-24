// ============================================================
// /api/crea-checkout — Stripe Checkout Session per piani
// Piani: starter (€6, 10 crediti), pro (€15, 100 crediti)
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PREZZI = {
  starter: {
    amount: 600, // €6 in centesimi
    crediti: 10,
    label: 'Starter',
  },
  pro: {
    amount: 1500, // €15 in centesimi
    crediti: 100,
    label: 'Pro',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { userId, pacchetto } = req.body || {};

  if (!userId || !pacchetto || !PREZZI[pacchetto]) {
    return res.status(400).json({ error: 'Parametri mancanti o pacchetto non valido.' });
  }

  const prezzo = PREZZI[pacchetto];
  const baseUrl = process.env.SITE_BASE_URL || `https://${process.env.VERCEL_URL || 'jumbai.vercel.app'}`;

  try {
    // Verifica che l'utente esista
    const { data: utente } = await supabaseAdmin
      .from('profili')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!utente) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `JumbAI ${prezzo.label}`,
              description: `${prezzo.crediti} crediti per generare immagini AI`,
            },
            unit_amount: prezzo.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        crediti: String(prezzo.crediti),
        pacchetto,
      },
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      customer_email: utente.email,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Errore creazione checkout:', e);
    return res.status(500).json({ error: 'Errore creazione checkout: ' + ((e && e.message) || 'sconosciuto') });
  }
}