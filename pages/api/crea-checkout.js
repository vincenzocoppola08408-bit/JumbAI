// ============================================================
// /api/crea-checkout — Crea una sessione Stripe Checkout
// ============================================================
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { userId, pacchetto } = req.body || {};

  if (!userId || !pacchetto) {
    return res.status(400).json({ error: 'Parametri mancanti (userId, pacchetto).' });
  }

  // Prezzi fissi
  const piani = {
    starter: { amount: 600, name: 'Starter — 10 video', crediti: 10 },
    pro: { amount: 1500, name: 'Pro — 100 video', crediti: 100 },
  };

  const piano = piani[pacchetto];
  if (!piano) {
    return res.status(400).json({ error: 'Pacchetto non valido. Usa "starter" o "pro".' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: piano.name,
              description: `${piano.crediti} 🪙 crediti per JumbAI`,
            },
            unit_amount: piano.amount, // in centesimi
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        crediti: String(piano.crediti),
      },
      success_url: `${process.env.SITE_BASE_URL || 'https://jumbai.vercel.app'}?checkout=success`,
      cancel_url: `${process.env.SITE_BASE_URL || 'https://jumbai.vercel.app'}?checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Stripe checkout error:', e);
    return res.status(500).json({ error: 'Errore creazione sessione di pagamento.' });
  }
}