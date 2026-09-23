# Cosa funziona

## Live

- `GET /landing` → 200, UI italiana (hero, vetrina modelli, pricing).
- `GET /` → 200, app dashboard (client React); dopo «Caricamento...» mostra gate auth se non loggato.
- Link landing «Piani» / «Scopri i piani» → scroll a `#pricing` (verificato in browser).
- Thumbnail Nature (Mountain Sunset) carica (Unsplash 200).
- API raggiungibili (metodo corretto):
  - `POST /api/genera-premium` → 400 se mancano `userId`/`prompt` (endpoint vivo)
  - `POST /api/crea-checkout` → 400 se mancano `userId`/`pacchetto` (endpoint vivo)
  - `POST /api/webhook-stripe` → 400 senza `stripe-signature` (endpoint vivo)
  - `GET` sulle API → 405 «Metodo non consentito»
- Client Supabase anon presente nel bundle (progetto `*.supabase.co`).
- Stack dichiarato coerente: Next 14 pages router, Stripe, Fal.ai, Supabase (vedi README e `vercel.json`).

## Nel codice (struttura)

- Dashboard monolitica in `pages/index.tsx`: sezioni Casa, Progetti, Integrazioni, Sviluppatori; modal login email/password + Google; BYOK localStorage `jumbai_byok_key`; realtime Supabase su `video_generati`.
- Premium path: `eseguiPremium` → `POST /api/genera-premium` → Fal.ai + webhook `webhook-video-pronto`.
- Checkout backend: `crea-checkout.js` (Starter €6 / Pro €15 one-shot) + `webhook-stripe.js` per accredito crediti.
- Schema SQL in `database/` (profili, video, RLS — da verificare in Supabase).
