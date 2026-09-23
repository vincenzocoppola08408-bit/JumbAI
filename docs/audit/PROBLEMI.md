# Problemi trovati — audit JumbAI

Stato: documentato, **non corretto**.  
Priorità: P0 = blocca conversione/prodotto · P1 = funzionale grave · P2 = UX/credibilità · P3 = igiene.

---

## Stato ADD (2026-09-23)
ADD-1..6, ADD-8, ADD-10, ADD-11 (TODO email) e ADD-12 sono ora presenti nel codice; ADD-7 è cancellato/rimosso. ADD-9 resta backlog.

## Landing (`/landing`)

### L1 — Thumbnail Cyberpunk e Fashion rotte (P0)
- **Sintomo (browser + HTTP):** le card «Cyberpunk Night» e «Fashion Cinematic» non mostrano l’immagine (icona/alt); Nature ok.
- **Dettaglio:** URL Unsplash rispondono **404**:
  - `photo-1518770660439-4636500cff5f` (Cyberpunk)
  - `photo-1529626455594-4ff0802cf14e` (Fashion)
  - `photo-1472214103451-9374bd1c798e` (Nature) → 200
- **File:** `pages/landing.tsx` (tag `<img src="https://images.unsplash.com/...">`).

### L2 — «Demo video» non sono video (P1)
- **Sintomo:** copy parla di Hunyuan 8s / 4K / audio; UI mostra solo immagini statiche, nessun `<video>` né player.
- **File:** `pages/landing.tsx` sezione vetrina.

### L3 — Piani senza CTA acquisto / start (P0)
- **Sintomo (browser):** Free / Starter / Pro sono solo testo + elenchi; **nessun** pulsante «Acquista», «Inizia», «Scegli piano».
- **File:** `pages/landing.tsx` sezione `#pricing`.

### L4 — OAuth Google senza `redirectTo` / UX errori debole (P1)
- **Sintomo:** «Accedi con Google» / «Inizia con Google» chiamano `supabase.auth.signInWithOAuth({ provider: 'google' })` senza `options.redirectTo` esplicito; in caso di fallimento solo `catch` che spegne loading.
- **File:** `pages/landing.tsx`.

### L5 — Claim Trustpilot 4.8/5 non verificabile (P2)
- **Sintomo:** footer pricing mostra «4.8/5 su Trustpilot» senza link a profilo reale.
- **Rischio:** fiducia / compliance marketing.
- **File:** `pages/landing.tsx`.

### L6 — Logo punta a `/` (dashboard gate), non resta in marketing (P2)
- **Sintomo:** logo «JumbAI» → `href="/"` → utente finisce sul gate login invece che sulla landing.
- **File:** `pages/landing.tsx`.

### L7 — Assenti `robots.txt` e `sitemap.xml` (P3)
- **Sintomo:** `GET /robots.txt` e `/sitemap.xml` → 404 (pagina Next error/HTML).

### L8 — Favicon assente (P3)
- **Sintomo (browser console):** 404 su `favicon.ico`.

### L9 — Route marketing attese 404 (P2)
- `/dashboard`, `/pricing`, `/login`, `/signup`, `/app` → 404.  
- Build live espone solo `/` e `/landing` (`_buildManifest`).

---

## Dashboard (`/` — `pages/index.tsx`)

### D1 — Senza login non si entra in Casa / Progetti / Integrazioni / Sviluppatori (P0 prodotto vs marketing)
- **Sintomo (browser):** dopo loading, gate «JumbAI Dashboard» + **«Accedi con Google»** only sulla card iniziale; sezioni sidebar **non raggiungibili** senza sessione.
- **Nota codice:** il modal (email/password + Google + Registrati) si apre solo dopo click su Accedi; BYOK e console sono dietro auth, in contrasto col messaggio landing «Free BYOK / telecomando grafico».

### D2 — Checkout Stripe ancora stub (P0)
- **Sintomo (codice):** pulsanti Starter/Pro:
  ```ts
  onClick={() => session ? alert('Checkout Stripe in arrivo!') : setShowLogin(true)}
  ```
- **Paradosso:** `POST /api/crea-checkout` è **già implementato** e vivo in produzione, ma la UI non lo chiama.

### D3 — BYOK non genera video (P0)
- **Sintomo (codice):** `eseguiFree` chiama  
  `generativelanguage.googleapis.com/.../gemini-2.0-flash-exp:generateContent`  
  (testo), poi `alert('…Verifica la console per la risposta.')`.
- **UI:** select modelli include Veo 3.1 / Gemini Pro ma l’URL è **sempre** `gemini-2.0-flash-exp` (il valore `modello` non viene usato nella fetch BYOK).
- **Copy marketing** promette generazione video Free; comportamento reale = prompt rewriting via Gemini text.

### D4 — Pulsanti «Connetti» integrazioni senza handler (P1)
- **Sintomo (codice):** Discord / X / YouTube / Telegram: `connected: false` fisso; bottone **senza `onClick`**.
- **File:** `renderIntegrazioni()` in `pages/index.tsx`.

### D5 — Tab input Immagine / Frame / Multiple incompleti vs Premium (P1)
- **Sintomo:** UI espone tab `immagine` | `frame` | `multiple`; Premium manda `immagine_base64` solo se non `testo`, ma **Fal body in API non usa `immagine_base64`** (solo prompt text) → image-to-video di fatto non collegato.

### D6 — Mismatch prezzi landing vs checkout (P2)
- Landing: «€1,50 /settimana» e «€3,75 /settimana» + testo «equivalente a €6 / €15 una tantum».
- API `crea-checkout`: one-shot **600 / 1500 cent** (€6 / €15), `mode: 'payment'` (non subscription).
- UI dashboard ripete pacchetti one-shot ma copy landing spinge «/settimana».

### D7 — Header «Accedi» / email utente fa `router.push('/landing')` (P2)
- **Sintomo (codice):** click sull’area utente in header chiude login e naviga a `/landing` anche quando si è loggati (usa email split come label ma onClick va a landing). Comportamento confuso.

### D8 — Gate CTA dice «Accedi con Google» ma apre modal generico (P3)
- Label del bottone gate non riflette email/password disponibili nel modal.

### D9 — Alert-driven UX (P2)
- Errori/successi via `alert()` (auth, BYOK, premium, checkout stub) invece di toast/inline.

### D10 — `nextExport: true` nel HTML esportato vs API serverless (P3)
- Segnale di config ambigua; le API comunque rispondono. Da chiarire in build Vercel.

---

## Backend / ops (codice + probe)

### B1 — Checkout UI scollegato dall’API (vedi D2) (P0)

### B2 — Dipendenza env produzione (P1 — da verificare in Vercel)
Variabili attese (README / codice):  
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `FAL_AI_MASTER_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_BASE_URL`.  
Probe pubblico non può confermare se Stripe/Fal/Supabase admin funzionano end-to-end senza chiavi.

### B3 — Typo `costoCredienti` in `genera-premium.js` (P3)
- Nome variabile typo; funziona ma rumore manutenzione.

### B4 — Crediti scalati prima della conferma Fal (P1)
- Pattern: debit → insert → call Fal → rollback se Fal fail. Race/concorrenza su `.eq('crediti', utente.crediti)` ok-ish, ma webhook/error paths vanno testati a mano in staging.

### B5 — README obsoleto vs struttura reale (P3)
- README parla di `index.html` e `api/*.js` root; progetto reale è Next `pages/` + `pages/api/`.

---

## Matrice sezioni dashboard (click / raggiungibilità)

| Sezione | Senza login (browser) | Con login (da codice) | Problemi principali |
|---------|----------------------|------------------------|---------------------|
| Gate `/` | Visibile | — | D1, D8 |
| Login modal | Solo dopo click Accedi | email/password/Google/Registrati | L4-like OAuth; alert UX |
| Casa / Console | Non raggiungibile | Genera Gratis/Premium, tab, avanzate, pricing cards | D2, D3, D5, D9 |
| Progetti | Non raggiungibile | Galleria filtri + realtime | dipende da DB/auth |
| Integrazioni | Non raggiungibile | Lista stub Connetti | D4 |
| Sviluppatori / BYOK | Non raggiungibile | Salva chiave localStorage | D3 (uso chiave) |
| Checkout | — | alert «in arrivo» | D2 |

---

## Già segnalati (checklist)

- [x] Immagini 404 (L1)  
- [x] Piani senza CTA (L3)  
- [x] Checkout «in arrivo» (D2)  
- [x] BYOK → Gemini testo (D3)  
- [x] Integrazioni stub (D4)  
- [x] Trustpilot non verificabile (L5)  
- [x] robots/sitemap assenti (L7)  

## Nuovi rispetto a quella lista

- L2 demo non-video · L6 logo → `/` · L8 favicon · L9 route 404  
- D1 gate vs Free BYOK marketing · D5 image-to-video non in Fal body · D6 mismatch prezzi · D7 header → landing · D8 label gate · D9 alert UX · D10 nextExport  
- B3 typo · B4 ordine debit/Fal · B5 README stale  

---

## Fallback URL (fornito dall’utente 2026-09-23)

| URL | Ruolo | Stato verificato |
|-----|--------|------------------|
| https://jumbai.vercel.app | App / gate dashboard (`/`) | **OK** HTTP 200 |
| https://jumbai.vercel.app/landing | Landing marketing | **OK** HTTP 200 |
| https://jumbay.vercel.app | Piano B se landing/console falliscono | **NON DISPONIBILE** — HTTP 404 `DEPLOYMENT_NOT_FOUND` (Vercel) |
| https://jumbay.vercel.app/landing | Piano B landing | **NON DISPONIBILE** — HTTP 404 |

Uso previsto (quando il deploy jumbay tornerà online): se `jumbai.vercel.app/landing` non carica o la console generativa va in errore, aprire `jumbay.vercel.app` come alternativa e ripetere i controlli browser lì.

---

## Aggiornamento browser interattivo (2026-09-23 sera, Europe/Rome)

Pass senza OAuth completato, senza password/API key/pagamenti.

### L10 — OAuth Google landing → Supabase HTTP 400 (P0)
- **Sintomo:** click «Accedi con Google» su `/landing` reindirizza a  
  `https://pvytkbouuhhnrpcyozir.supabase.co/auth/v1/authorize?provider=google`  
  e l’endpoint risponde **HTTP 400**. OAuth non completato; ritorno alla landing.
- **Impatto:** login Google dalla marketing page inutilizzabile.
- **Da verificare in Supabase:** provider Google abilitato, Client ID/Secret, Redirect URLs (site URL + `https://jumbai.vercel.app/**` e callback Supabase).

### D11 — CTA «Accedi con Google» sul gate dashboard è no-op (P0)
- **Sintomo (browser):** sul gate `/` il pulsante Google **non apre modal** e **non fa redirect**; la pagina resta uguale.
- **Conseguenza:** non compaiono Registrati / email / password / Continua con Google; Casa, Progetti, Integrazioni, Sviluppatori irraggiungibili senza auth.
- **Nota codice:** in `pages/index.tsx` il gate dovrebbe aprire il modal (`setShowLogin`); da allineare comportamento live vs codice (handler mancante, overlay, o build non aggiornata).

### Conferme (già in elenco)
- `#pricing` / «Scopri i piani» ok  
- Cyberpunk + Fashion broken; Nature (Mountain Sunset) ok  
- Nessun CTA acquisto sui piani Free/Starter/Pro  

---

## Struttura dashboard (confermata 2026-09-23, voce + codice + live)

**L’utente ha ragione: non è divisa in pagine separate. È un’unica pagina.**

| Cosa | Dove |
|------|------|
| URL reale dashboard | **`https://jumbai.vercel.app/`** (`pages/index.tsx`) |
| `https://jumbai.vercel.app/dashboard` | **404** — route **inesistente** (buildManifest: solo `/` e `/landing`) |
| Casa | Sezione in-page (`sezione === 'casa'`) — console + pricing/checkout stub |
| Progetti | Sezione in-page (`sezione === 'progetti'`) |
| Integrazioni | Sezione in-page (`sezione === 'integrazioni'`) |
| Sviluppatori / BYOK | Sezione in-page (`sezione === 'sviluppatori'`) — salva chiave; genera gratis sta in Casa |
| Checkout | **Non** una pagina: card prezzi dentro **Casa**; oggi `alert('Checkout Stripe in arrivo!')` |

Meccanismo: `useState<Sezione>('casa')` + sidebar `setSezione(v.id)`. Nessun `router.push` tra queste voci. Switch render:

```ts
switch (sezione) {
  case 'casa': return renderCasa();
  case 'progetti': return renderProgetti();
  case 'integrazioni': return renderIntegrazioni();
  case 'sviluppatori': return renderSviluppatori();
}
```

Gate auth (senza sessione) nasconde tutta la shell a una sola card «Accedi con Google»; le sezioni esistono comunque nello stesso file React, non come URL distinti.

### Implicazione per l’audit
- Non cercare `/dashboard`, `/progetti`, ecc.
- Controlli sezioni = click sidebar **dopo** login, restando su `/`.
- Eventuale redirect `/dashboard` → `/` andrebbe documentato come miglioramento (L9), non come struttura attuale.
