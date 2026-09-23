# REPORT AUDIT JumbAI

**Data:** 2026-09-23 (Europe/Rome)  
**Scope:** live `https://jumbai.vercel.app` + codice locale `JumbAI_Site`  
**Azione su codice:** nessuna — solo istruzioni per Cursor

---

## Stato ADD (2026-09-23)

### DONE in code
- **ADD-1** badge crediti (`profilo?.crediti ?? credits`).
- **ADD-2** onboarding a 3 step con `localStorage.jumbai_onboarded`.
- **ADD-3** FAQ accordion con 5 domande/risposte.
- **ADD-4** chip per template prompt.
- **ADD-5** download MP4 illimitato dalle card Progetti.
- **ADD-6** UI «Export formato»: MP4 funziona; WebM/GIF scaricano lo stesso file con estensione scelta e spiegano il limite del provider.
- **ADD-8** aspect ratio 9:16/16:9 solo Premium/Fal.
- **ADD-10** Vercel Web Analytics + `trackGenera`/`trackCheckout`.
- **ADD-11** solo TODO in `pages/api/webhook-video-pronto.js`; nessun provider email in `package.json`.
- **ADD-12** `GET /api/alive`.

### CANCELLED
- **ADD-7** watermark: rimosso/cancellato; Free senza watermark.

### BACKLOG
- **ADD-9** gallery statica «Ispirati»: non implementata.

## 1. LINK DEL SITO

| Ruolo | URL |
|-------|-----|
| App / console | https://jumbai.vercel.app/ |
| Landing | https://jumbai.vercel.app/landing |
| `/dashboard` | **404** — route inesistente |
| Piano B `https://jumbay.vercel.app` | **404** `DEPLOYMENT_NOT_FOUND` — non usare |

---

## 2. STRUTTURA

- Stack: Next.js (pages router), Supabase, Stripe, Fal.ai su Vercel.
- **Una sola pagina app:** `/` = `pages/index.tsx`.
- Sidebar in-page (`useState`): **Casa** | **Progetti** | **Integrazioni** | **Sviluppatori** — non sono URL separati.
- Landing: `pages/landing.tsx` → `/landing`.
- Checkout e BYOK vivono dentro Casa / Sviluppatori, non come route.

**Cosa funziona (sintesi):** deploy Vercel live; `#pricing` scroll; thumbnail Nature ok; API `POST /api/crea-checkout` e webhook Stripe presenti in codice; Premium path verso Fal in codice; galleria Progetti / realtime previsti in codice.

**Vincolo di calibro:** solo fix basso/medio su questo stack. Fuori scala (non roadmap): team multi-utente, GPU farm, modelli custom, Edit Studio tipo Runway, app native, marketplace multi-modello, SSO enterprise.

---

## 3. PROBLEMI

Ogni problema appare **una sola volta**, con Dove / Cosa / Perché / Fix / Azioni / Prompt Cursor.

### P0 — blocca login, conversione o prodotto promesso

#### P0-1 — Checkout Stripe da collegare (+ CTA pricing)
- **Dove:** Casa `pages/index.tsx` bottoni Starter/Pro; landing `#pricing`; API `POST /api/crea-checkout` già viva
- **Cosa:** UI fa `alert('Checkout Stripe in arrivo!')`; landing spesso senza bottoni Acquista
- **Perché:** UI non chiama l'API; markup pricing incompleto
- **Fix:** `avviaCheckout('starter'|'pro')` → fetch crea-checkout → `window.location = data.url`; CTA Free→`/`, Starter/Pro→stesso flusso
- **Azioni da fare:**
  1. In `pages/index.tsx` aggiungi:

```ts
async function avviaCheckout(pacchetto: 'starter' | 'pro') {
  if (!session?.user?.id) { setShowLogin(true); return; }
  try {
    setMessaggio('Reindirizzamento a Stripe.');
    const res = await fetch('/api/crea-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, pacchetto }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) { alert(data.error || 'Checkout non disponibile'); setMessaggio(''); return; }
    window.location.href = data.url;
  } catch (e: any) {
    alert('Errore checkout: ' + (e?.message || e));
    setMessaggio('');
  }
}
```

  2. Bottone Starter: `onClick={() => avviaCheckout('starter')}` — Pro: `avviaCheckout('pro')`.
  3. Opzionale: toast su `?checkout=success|cancelled`.
  4. Env Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_BASE_URL=https://jumbai.vercel.app`; webhook → `/api/webhook-stripe` evento `checkout.session.completed`.
  5. Landing `#pricing`: Free → `/`; Starter/Pro → `/?piano=...` o checkout dopo login.
- **Prompt Cursor:**
```
Collega Acquista Starter/Pro in pages/index.tsx a POST /api/crea-checkout con avviaCheckout.
Sostituisci alert checkout. Non modificare crea-checkout.js se già corretto.
CTA minime su pages/landing.tsx #pricing (Free→/, Starter/Pro→/?piano=...). Solo questi file.
```

#### P0-2 — OAuth Google HTTP 400
- **Dove:** `/landing` → Accedi con Google → Supabase `/auth/v1/authorize?provider=google`
- **Cosa:** authorize risponde **400**; login non completa
- **Perché:** provider Google / Client ID-Secret / Redirect URLs / Site URL incompleti o mismatch; spesso manca `redirectTo` esplicito
- **Fix:** abilita Google in Supabase; Site URL `https://jumbai.vercel.app`; allowlist redirect; Google Cloud → callback Supabase; nel client `signInWithOAuth({ provider:'google', options:{ redirectTo: origin + '/' } })` + toast errore
- **Azioni da fare:** checklist Supabase + Google Cloud; fix `landing.tsx` / `index.tsx`; coordina con P0-3
- **Prompt Cursor:** `Sistema OAuth Google: redirectTo esplicito in landing/index, toast su errore. Checklist Supabase/Google Cloud per https://jumbai.vercel.app. Coordina con gate P0-3.`

#### P0-3 — Gate solo al click Genera + OAuth multi-provider
- **Dove:** early-return gate su `/` in `pages/index.tsx`; modal login; Supabase Auth
- **Cosa:** oggi gate a ingresso (CTA Google spesso no-op); console irraggiungibile da guest; marketing Free vs muro login
- **Perché:** early-return «non loggato → gate»; Genera non è il trigger auth
- **Fix (decisione definitiva):**
  1. Landing **libera**.
  2. Console sfogliabile da **guest**.
  3. Gate **solo** al click **Genera** (e azioni generazione equivalenti); dopo auth riprendi Genera.
  4. Modal: **Google**, **GitHub**, **Discord**, **Apple**, **Microsoft** (+ email se già c'è).
  5. **Non rimuovere** il gate: **spostarlo**. Collega anche l'ex CTA gate no-op al modal/OAuth.
- **Azioni da fare:** togli early-return a ingresso; wrap Genera con check sessione; bottoni OAuth multi-provider in Supabase+UI; label «Accedi o registrati»
- **Prompt Cursor:** `In pages/index.tsx: togli gate a ingresso. Console da guest. Al click Genera se non auth apri modal e dopo login riprendi Genera. Modal: Google, GitHub, Discord, Apple, Microsoft. Abilita provider in Supabase. Non rimuovere il gate: spostalo.`

#### P0-4 — Thumbnail Cyberpunk / Fashion 404
- **Dove:** `/landing` vetrina; Unsplash ID morti
- **Cosa:** thumbnail broken; Nature ok
- **Perché:** URL Unsplash 404
- **Fix:** file in `public/demo/*.jpg` o URL verificati; `onError` → placeholder; favicon se manca
- **Azioni da fare:** sostituisci src; verifica HEAD; fallback UI
- **Prompt Cursor:** `In landing.tsx sostituisci thumbnail Unsplash 404 (Cyberpunk/Fashion) con public/demo o URL vivi + onError. Favicon se manca.`

#### P0-5 — BYOK non genera video
- **Dove:** Casa «Genera Gratis BYOK» + Sviluppatori; `eseguiFree` in `pages/index.tsx`
- **Cosa:** chiama Gemini `generateContent` (testo); select modello (anche Veo) **ignorato** (URL fisso `gemini-2.0-flash-exp`); alert «check console»
- **Perché:** implementazione = prompt rewrite, non video
- **Fix (decisione definitiva):** cablare un **endpoint video reale** che usi il **modello selezionato** nel select (chiave BYOK utente / proxy sicuro se serve). Output, loading ed errori in UI. **Non** risolvere rinominando in «Ottimizza prompt».
- **Azioni da fare:**
  1. Mappa `modello` → API video corretta.
  2. Rimuovi il percorso solo-testo Gemini come «generazione video».
  3. UI: progresso / errore / link o anteprima output (non solo `console.log`).
  4. Modelli non ancora cablati: disabilita con «Non collegato» finché non lo sono.
- **Prompt Cursor:** `Riscrivi eseguiFree in pages/index.tsx: genera VIDEO reale con chiave BYOK usando il modello del select. Niente solo Gemini text rewrite. Output/errori in UI. Disabilita modelli non cablati. Niente rename marketing come fix.`

### P1 — funzionale grave / incompleto

#### P1-1 — Integrazioni «Connetti» stub
- **Dove:** `renderIntegrazioni()` in `pages/index.tsx`
- **Cosa:** Discord/X/YouTube/Telegram `connected: false`; bottone senza `onClick`
- **Perché:** UI senza logica
- **Fix (decisione):** A) `disabled` + badge «Presto» **oppure** B) un solo webhook Discord (URL in localStorage, POST embed a job complete). Niente OAuth social multi-piattaforma ora
- **Azioni da fare:** scegli A (consigliato) o B; solo `index.tsx`
- **Prompt Cursor:** `Disabilita bottoni Connetti integrazioni e mostra badge Presto in index.tsx. Solo UI. (Alt: campo Discord webhook + POST embed a complete.)`

#### P1-2 — Demo video assente / non video
- **Dove:** `/landing` vetrina «demo»
- **Cosa:** claim video/8s/4K ma niente `<video>` / mp4 (o solo immagini)
- **Perché:** markup senza demo reali
- **Fix:** 3 mp4 in `public/demo` + `<video muted autoPlay loop playsInline>` **oppure** togli claim falsi
- **Azioni da fare:** asset + markup o copy onesta
- **Prompt Cursor:** `Landing: 3 demo MP4 in public/demo con video autoplay muted loop, oppure togli claim video falsi.`

#### P1-3 — Mismatch prezzi
- **Dove:** `landing.tsx` `#pricing` vs `crea-checkout` / card Casa
- **Cosa:** landing «/settimana»; API one-shot €6 / €15 (`mode: payment`)
- **Perché:** copy ≠ billing
- **Fix:** ovunque «€6 / €15 una tantum»; togli «/settimana» come prezzo reale
- **Azioni da fare:** allinea landing + Casa
- **Prompt Cursor:** `Allinea copy prezzi landing+Casa a one-shot €6 starter / €15 pro come API Stripe. Niente subscription.`

#### P1-4 — Image-to-video non cablato
- **Dove:** tab Immagine/Frame/Multiple; `genera-premium.js`
- **Cosa:** UI espone tab; Fal body solo prompt; `immagine_base64` non mappato
- **Perché:** Premium text-only
- **Fix:** se docs Fal/Hunyuan accettano image → mappa; altrimenti tab «Presto»
- **Azioni da fare:** leggi docs; collega o disabilita
- **Prompt Cursor:** `Se Fal hunyuan supporta image input, collegalo in genera-premium.js da immagine_base64; altrimenti disabilita tab immagine con Presto.`

#### P1-5 — Crediti scalati prima della conferma Fal
- **Dove:** `genera-premium.js`
- **Cosa:** debit → insert → Fal → rollback se fail; path errori da verificare
- **Perché:** ordine operazioni sensibile
- **Fix:** test staging + logging/TODO; niente redesign architetturale
- **Azioni da fare:** checklist manuale; log chiari sul rollback
- **Prompt Cursor:** `Aggiungi commento/TODO e logging chiaro in genera-premium sul rollback crediti. Niente redesign debit.`

#### P1-6 — Env Vercel da verificare
- **Dove:** dashboard Vercel (non codice)
- **Cosa:** Stripe/Fal/Supabase end-to-end dipendono da secret
- **Perché:** probe pubblico non vede le env
- **Fix:** checklist umana: `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`, `FAL_AI_MASTER_KEY`, `STRIPE_*`, `SITE_BASE_URL`
- **Azioni da fare:** verifica in Vercel; nessun prompt codice obbligatorio
- **Prompt Cursor:** `(Checklist umana env Vercel — niente codice se già documentato in README/PROBLEMI.)`

#### P1-7 — Empty states assenti
- **Dove:** Progetti vuoti, BYOK senza chiave
- **Cosa:** schermate vuote senza CTA
- **Perché:** non implementati
- **Fix:** empty state + CTA («Genera il primo», focus chiave)
- **Azioni da fare:** solo UI `index.tsx`
- **Prompt Cursor:** `Empty states con CTA verso Casa o focus BYOK in index.tsx. Solo UI.`

### P2 — UX / credibilità / igiene

#### P2-1 — Trustpilot non verificabile
- **Dove:** claim 4.8/5 in landing e/o index
- **Cosa:** rating non verificabile
- **Perché:** claim non linkato/verificato
- **Fix:** rimuovi Trustpilot; tieni badge Stripe / claim onesti
- **Azioni da fare:** togli stringhe Trustpilot
- **Prompt Cursor:** `Rimuovi claim Trustpilot non verificabili; lascia badge Stripe.`

#### P2-2 — Logo landing manda a `/` (gate)
- **Dove:** `landing.tsx` logo href
- **Cosa:** logo porta al gate invece di restare in marketing
- **Perché:** href `/`
- **Fix:** logo → `/landing` o `#`; CTA «Console» separata → `/`
- **Azioni da fare:** fix href
- **Prompt Cursor:** `Logo landing href /landing; link Console separato a /. `

#### P2-3 — Header utente fa push a `/landing`
- **Dove:** `index.tsx` click email/area utente
- **Cosa:** naviga a landing anche se loggato
- **Perché:** `router.push('/landing')` sull'header
- **Fix:** menu Esci / Crediti; niente push landing al click email
- **Azioni da fare:** togli push; menu minimo
- **Prompt Cursor:** `Header utente loggato: non navigare a /landing al click; mostra esci/crediti.`

#### P2-4 — Alert al posto di toast
- **Dove:** auth, BYOK, premium, checkout in `index.tsx`
- **Cosa:** UX a `alert()`
- **Perché:** nessun toast
- **Fix:** state `toast` + fixed div; riusa `messaggio` / filtri Progetti per job
- **Azioni da fare:** toast minimo senza librerie se evitabile
- **Prompt Cursor:** `Sostituisci alert principali in index.tsx con toast UI minimo.`

#### P2-5 — Redirect `/dashboard` → `/`
- **Dove:** route inesistente `/dashboard`
- **Cosa:** 404
- **Perché:** nessun redirect
- **Fix:** redirect in `next.config` o page stub → `/`
- **Azioni da fare:** redirect minimo
- **Prompt Cursor:** `Aggiungi redirect /dashboard → / . Solo config o page stub.`

#### P2-6 — robots.txt / sitemap / favicon / OG assenti
- **Dove:** `public/` / meta landing
- **Cosa:** 404 o meta incomplete
- **Perché:** file non aggiunti
- **Fix:** `robots.txt`, `sitemap.xml` (`/` e `/landing`), favicon, OG base
- **Azioni da fare:** solo static assets + meta
- **Prompt Cursor:** `Aggiungi public/robots.txt, sitemap.xml, favicon e OG base per jumbai.vercel.app.`

#### P2-7 — Segnale `nextExport` ambiguo
- **Dove:** HTML esportato vs API serverless
- **Cosa:** config ambigua
- **Perché:** flag/export legacy
- **Fix:** chiarisci build Vercel; togli flag fuorviante se presente
- **Azioni da fare:** check `next.config`; nota in README
- **Prompt Cursor:** `Verifica next.config rispetto alle API serverless; rimuovi segnali nextExport fuorvianti se sicuri.`

#### P2-8 — Typo `costoCredienti`
- **Dove:** `genera-premium.js`
- **Cosa:** nome variabile typo
- **Perché:** typo
- **Fix:** rinomina in `costoCrediti` (con care ai riferimenti)
- **Azioni da fare:** rename sicuro
- **Prompt Cursor:** `Rinomina costoCredienti → costoCrediti in genera-premium.js e riferimenti.`

#### P2-9 — README obsoleto
- **Dove:** README root
- **Cosa:** parla di `index.html` / `api/` root; reale = Next `pages/`
- **Perché:** docs stale
- **Fix:** aggiorna README alla struttura reale
- **Azioni da fare:** rewrite breve README
- **Prompt Cursor:** `Aggiorna README alla struttura Next pages/ + pages/api/ reale.`

#### P2-10 — Fallback jumbay non disponibile
- **Dove:** `https://jumbay.vercel.app`
- **Cosa:** 404 DEPLOYMENT_NOT_FOUND
- **Perché:** deploy assente
- **Fix:** non documentare come piano B finché non torna online; usa solo jumbai
- **Azioni da fare:** nessuna codice; tieni nota qui
- **Prompt Cursor:** `(Nessun codice — non usare jumbay finché 404.)`

**Ordine consigliato in Cursor:** P0-1 → P0-3 → P0-2 → P0-5 → P0-4 → P1-1… → P2… — una voce / una PR.

**Prompt master:** `Lavora SOLO sulla voce [ID] di docs/audit/REPORT.md. Nessun refactor fuori scope. Niente team/GPU farm/edit studio.`

---

## 4. BACKLOG RESIDUO

L?unico ADD non implementato ? **ADD-9 ? gallery statica ?Ispirati?**. ADD-11 resta un TODO tecnico per l?email, come indicato nello stato sopra.

---

## 5. CONCORRENTI — solo gap replicabili

Riferimento: Runway, Pika, Kling, Luma, Sora, Hailuo, Veo, HeyGen. **Copiamo solo pattern MVP.**

| Gap | Da chi (ispirazione) | Cosa tenere | Sforzo | Già in PROBLEMI / ADD |
|-----|----------------------|-------------|--------|------------------------|
| GAP-A Demo motion | Pika/Luma/Kling | MP4 landing | basso | P1-2 |
| GAP-B CTA + piani chiari | Runway/HeyGen | bottoni + prezzi onesti | medio | P0-1, P1-3 |
| GAP-C Crediti visibili | Runway/Kling | badge header | basso | ADD-1 |
| GAP-D Empty + onboarding | SaaS buoni | overlay + CTA | basso | P1-7, ADD-2 |
| GAP-E Download chiaro | tutti | Scarica | basso | ADD-5 |
| GAP-F Template prompt | Pika-like | chip | basso | ADD-4 |
| GAP-G FAQ + badge onesti | landing mature | accordion + Stripe | basso | ADD-3, P2-1 |
| GAP-H SEO base | tutti | robots/sitemap/OG | basso | P2-6 |
| GAP-I Job status semplice | Luma/Runway | toast + stato | medio | P2-4 |
| GAP-J Gallery ispirati statica | Sora/Pika explore povera | JSON curato | medio | ADD-9 |
| GAP-L Discord webhook | integrazioni light | 1 URL | medio | P1-1 opzione B |
| GAP-M Auth multi-provider + gate sul Genera | SaaS moderni | OAuth + delay gate | medio | P0-3 |
| GAP-N BYOK video reale | promesse competitor Free | modello select → video | medio–alto | P0-5 |

### Non copiare (fuori scala per JumbAI ora)
- Edit Studio / Aleph / Modify Video lungo (Runway, Luma Modify avanzato)
- Lip-sync avatar / Pikaformance / HeyGen localization
- Multi-shot nativo 15s 4K + voice control (Kling 3.0 full)
- Bundle ChatGPT / community social (Sora)
- Roster multi-modello tipo invideo
- Team seats, API prepaid packs, Adobe partnership
- App iOS/Android native
- Farm GPU proprie / fine-tune proprietari

