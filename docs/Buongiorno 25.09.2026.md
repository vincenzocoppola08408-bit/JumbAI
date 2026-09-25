# Buongiorno 25 Settembre 2026 — Piano d'Azione JumbAI T2I

## Stato Attuale

Il progetto è stato convertito da **Video Generator** a **Text-to-Image Generator** (Wan T2I + Fal.ai SDXL). Build passato, deploy su Vercel fatto, schema DB applicato su Supabase.

## COSA NON FUNZIONA / GAP IDENTIFICATI

### P0 — Bloccanti (da fare SUBITO)

| # | Dove | Problema | Fix |
|---|------|----------|-----|
| **P0-1** | `index.tsx` | Checkout non funziona — `handleCheckout` non gestisce `?checkout=success` dopo redirect da Stripe | Aggiungere gestione query string checkout all'avvio |
| **P0-2** | `api/genera-immagine-free.js` | Manca `DASHSCOPE_API_KEY` su Vercel. **Tutte le generazioni gratis sono rotte** | Aggiungere env su Vercel |
| **P0-3** | `index.tsx` | OAuth Google → usa `signInWithOAuth` ma la finestra popup viene bloccata da alcuni browser | Aggiungere fallback redirect full-page |
| **P0-4** | `api/genera-premium.js` | Chiama Fal.ai SDXL ma `safety_checker: true` può rifiutare prompt legittimi | Mettere `false` di default |
| **P0-5** | `index.tsx` | `pollTask()` chiama `/api/wan-status` che aggiorna DB ma se non c'è `mediaUrl` l'immagine resta "generazione" per sempre | Timeout massimo con fallback a fallita |

### P1 — Funzionali (da fare oggi)

| # | Dove | Problema | Fix |
|---|------|----------|-----|
| **P1-1** | `index.tsx` | `caricaImmagini()` carica ANCHE da `video_generati` (legacy) ma il tipo `Immagine` non ha campo `prompt_usato` — crash silenzioso | Normalizzare meglio il legacy |
| **P1-2** | `api/genera-premium.js` | Non mappa correttamente gli aspect ratio Fal (usa parametro `aspect_ratio` che Fal non supporta su SDXL) | Fal SDXL usa `image_size` non `aspect_ratio` |
| **P1-3** | `index.tsx` | `handleGoogleLogin()` apre popup che viene bloccato — nessun feedback all'utente | Aggiungere link diretto con redirect |
| **P1-4** | `index.tsx` | `renderIntegrazioni()` — tutte le integrazioni sono stub "Presto" inutilizzabili | Rimuovere o mettere link reali |
| **P1-5** | `api/genera-immagine-free.js` | Wan T2I non ritorna `size` nel response di submit — log `wan.size` undefined | Fix mapping size in submit |
| **P1-6** | `api/webhook-stripe.js` | Chiama `supabaseAdmin.rpc('add_crediti',...)` che **non esiste** come funzione RPC | Fix fallback update diretto |
| **P1-7** | `index.tsx` | Categorie selezionate non vengono passate correttamente alla generazione (categoria 'Tutte' diventa 'generale' ma DB vuole testo) | Ok ma migliorare UX |
| **P1-8** | `index.tsx` | `messaggio` stato non viene resettato dopo errori | Aggiungere cleanup |

### P2 — UX / Design (dopo funzionali)

| # | Dove | Problema | Fix |
|---|------|----------|-----|
| **P2-1** | `index.tsx` | Sidebar: "Acquista Starter/Pro" nel footer non linkato | Aggiungere link pricing |
| **P2-2** | `index.tsx` | Lightbox: non chiude con tasto ESC | Aggiungere keyboard event listener |
| **P2-3** | `index.tsx` | Nessuna animazione di transizione tra sezioni | Aggiungere fade |
| **P2-4** | `landing.tsx` | "Trustpilot 4.8/5" ancora presente (falso) | RIMOSSO nel fix precedente |
| **P2-5** | `_app.tsx` | Meta description generica | Migliorare SEO |

### P3 — Performance / Deploy

| # | Dove | Problema | Fix |
|---|------|----------|-----|
| **P3-1** | Vercel | Build passa ma ci sono warning su `npm audit` (2 vulnerabilities) | `npm audit fix` |
| **P3-2** | `next.config.js` | Remote patterns immagini: mancano domini di alcuni provider | Aggiungere `**.cloudflare.com`, `**.replicate.ai` |
| **P3-3** | `vercel.json` | `memory: 1024` deprecato (CPU billing) | RIMUOVERE |
| **P3-4** | Root | `codereview_temp.js` ancora presente | CANCELLARE |

---

## PIANO D'AZIONE — ORDINE DI ESECUZIONE

### STEP 1: P0 Bloccanti (30 min)
1. Aggiungere `DASHSCOPE_API_KEY` su Vercel → env
2. Fixare `api/genera-premium.js` aspect ratio per Fal SDXL
3. Fixare `handleGoogleLogin()` con redirect full-page fallback
4. Aggiungere timeout max a `pollTask()`
5. Fixare Stripe webhook (RPC mancante)

### STEP 2: P1 Funzionali (1 ora)
1. Fixare `api/genera-premium.js`: `aspect_ratio` → `image_size` per Fal
2. Fixare `caricaImmagini()` legacy mapping
3. Rimuovere stub integrazioni inutili
4. Aggiornare meta tag SEO
5. Fixare `api/webhook-stripe.js` RPC mancante

### STEP 3: P2 UX (30 min)
1. Aggiungere ESC key listener alla lightbox
2. Animazioni transition tra sezioni
3. Migliorare feedback utente su errori

### STEP 4: P3 Housekeeping (15 min)
1. `npm audit fix`
2. Rimuovere `codereview_temp.js`
3. Aggiornare `vercel.json`

---

## TEST DA FARE DOPO OGNI STEP

1. **Test API:** `curl /api/alive` → 200
2. **Test Generazione Free:** prompt "gatto" → 200 con task_id
3. **Test Generazione Premium:** prompt "gatto" → 200 con image_id
4. **Test OAuth:** pulsante Google → redirect a Supabase
5. **Test Checkout:** Acquista Starter → redirect a Stripe
6. **Test Galleria:** l'immagine appare dopo generazione
7. **Test Categorie:** cambio categoria aggiorna prompt suggerito
8. **Test Lightbox:** click immagine → dettagli + download
9. **Test Build:** `npm run build` → zero errori

---

## COMANDI RAPIDI

```bash
# Build
npm run build

# Dev server
npm run dev

# Deploy su Vercel
npx vercel --prod --yes

# Aggiungere env su Vercel
npx vercel env add DASHSCOPE_API_KEY production --value "<chiave>" --yes

# Test da browser
curl https://jumbai.vercel.app/api/alive
```