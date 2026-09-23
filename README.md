# JumbAI — AI Video Generator SaaS

Struttura completa basata sul capitolo tecnico fornito: architettura serverless (Vercel + Supabase + Fal.ai + Stripe) con piano Free BYOK e Premium a margine automatico.

## Struttura file

- `database/schema.sql` — Schema SQL da incollare in Supabase (profili, video_generati, RLS, trigger)
- `index.html` — Interfaccia elegante (UI scura/dark con accenti viola/rosa, tipografia Inter + Space Grotesk)
- `api/genera-premium.js` — Endpoint serverless per generazione Premium (controlli crediti DB + chiamata asincrona Fal.ai con webhook)
- `api/webhook-video-pronto.js` — Ricevitore webhook che salva il video pronto in Supabase
- `package.json` / `vercel.json` / `tsconfig.json` / `tailwind.config.ts` — Configurazione progetto

## Variabili d'ambiente (Vercel Settings → Environment Variables)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FAL_AI_MASTER_KEY`
- `STRIPE_SECRET_KEY`
- `VERCEL_URL` (automatico, usato per costruire l'URL webhook)

## Note di sicurezza

- La chiave BYOK viene memorizzata esclusivamente in `localStorage` del browser (`jumbai_byok_key`)
- Il backend non la trasmette, non la elabora, non la salva
- Il webhook di Fal.ai deve puntare al tuo dominio reale (es. `https://tuosito.vercel.app/api/webhook-video-pronto`)
- Per la produzione, attiva autenticazione Supabase e sostituisci `userId` con `auth.uid()` nei flussi premium

## Ispirazione visuale

UI ispirata a Krea AI Video Generator e DeepVid: palette scura quasi nera, vetro (glass), gradienti viola/rosa, tipografia grande e pulita, controlli chiari, card per la galleria.

## Come usare

1. Esegui `database/schema.sql` in Supabase SQL Editor
2. Configura le Environment Variables su Vercel
3. Attiva RLS e verifica che `auth.users` sia attiva
4. Pubblica su Vercel (`vercel --prod`)
5. Inserisci in `index.html` il tuo URL webhook reale se necessario
