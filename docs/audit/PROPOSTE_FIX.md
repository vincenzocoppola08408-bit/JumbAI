# Proposte di fix — JumbAI

Ogni voce mappa un ID in [PROBLEMI.md](./PROBLEMI.md).  
**Aggiornamento 2026-09-23:** ADD-1..6, ADD-8, ADD-10 e ADD-12 risultano già in codice; ADD-11 è solo TODO email; ADD-7 è cancellato/rimosso; ADD-9 resta backlog. Le proposte sotto descrivono il backlog P0/P1/P2, non questi ADD già chiusi.

Suggerimento ordine: **L1 → L3 → D2 → D3 → D4 → L2/L5 → resto**.

---

## L1 — Thumbnail Unsplash 404
1. Sostituisci gli URL in `pages/landing.tsx` con asset stabili (es. file in `public/demo/*.jpg` o Unsplash ID verificati con `curl -I`).
2. Aggiungi `onError` fallback (gradient/placeholder) così non resta il broken-image icon.
3. Verifica in locale e su preview Vercel.

## L2 — Demo non-video
**Opzione A (onesta):** rinomina sezione in «Esempi stile / mood» e togli claim 8s/4K/audio se non hai media.  
**Opzione B (prodotto):** metti 3 MP4 in `public/demo/` + `<video autoPlay muted loop playsInline>`.  
**Opzione C:** embed poster + link «Guarda esempio» a URL Fal/CDN.

## L3 — CTA piani landing
Su ogni card pricing aggiungi bottone:
- Free → `router.push('/')` o apri modal BYOK / «Vai alla console» (dopo aver reso BYOK usabile senza login, vedi D1/D3).
- Starter/Pro → stessa action del checkout (vedi D2) oppure `href="/?piano=starter"` che apre login+checkout.
Allinea copy «/settimana» vs one-shot (vedi D6) prima di pubblicare CTA.

## L4 — OAuth Google
```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`, // o /auth/callback se aggiungi pagina
  },
})
```
Gestisci errore con toast; verifica Google provider + redirect URL in Supabase Dashboard.

## L5 — Trustpilot
Rimuovi il claim **oppure** linka il profilo reale Trustpilot verificato. Non lasciare stelle inventate.

## L6 — Logo landing
`href="/landing"` oppure `#landing` se vuoi restare in pagina; tieni `/` solo su CTA «Apri console».

## L7 — robots / sitemap
Aggiungi `public/robots.txt` e `public/sitemap.xml` (o generazione Next) con `/` e `/landing`.

## L8 — Favicon
Metti `public/favicon.ico` (e/o `icon.png`) e referenzia in `_document.tsx` / Head.

## L9 — Route 404
O documenta che dashboard = `/`, oppure aggiungi redirect in `vercel.json` / `next.config`:
- `/dashboard` → `/`
- `/pricing` → `/landing#pricing`
- `/login` → `/?login=1`

---

## D1 — Gate vs Free BYOK
Scegli una strategia e allinea landing + `/`:
1. **Guest console:** permettere sezione Casa/Sviluppatori senza auth (solo BYOK); premium dietro login.  
2. **Oppure** cambia copy landing: «Free BYOK dopo accesso» e mantieni gate.  
Implementazione (1): in `pages/index.tsx` non fare early-return sul gate per le sezioni free; mostra sidebar ridotta.

## D2 — Collegare Stripe checkout (P0)
Sostituisci l’alert con qualcosa del tipo:
```ts
async function avviaCheckout(pacchetto: 'starter' | 'pro') {
  if (!session) { setShowLogin(true); return; }
  const res = await fetch('/api/crea-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: session.user.id, pacchetto }),
  });
  const data = await res.json();
  if (!res.ok) { /* toast data.error */ return; }
  window.location.href = data.url;
}
```
Usa lo stesso handler dai bottoni pricing in Casa **e** dalle CTA landing (L3).  
Verifica `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, endpoint webhook Stripe → `/api/webhook-stripe`, e `SITE_BASE_URL`.

## D3 — BYOK onesto o vera generazione
**Opzione A (veloce, onesta):** rinomina in «Ottimizza prompt (Gemini)» e mostra il testo in UI, non solo console.  
**Opzione B:** chiama un modello video BYOK reale (es. endpoint Veo se disponibile con la chiave utente) usando il `modello` selezionato nell’URL/body.  
**Opzione C:** BYOK chiama Fal con chiave utente lato client (se Fal lo consente) — valuta sicurezza/CORS.  
In ogni caso: **usa la variabile `modello`** nella fetch; oggi è ignorata.

## D4 — Integrazioni
Finché non ci sono OAuth reali: disabilita i bottoni (`disabled`) + badge «Presto», **oppure** rimuovi la sezione.  
Se implementi: un `onClick` per provider con stato in Supabase `integrazioni`.

## D5 — Image-to-video
In `pages/api/genera-premium.js`, se `immagine_base64` è presente, mappa al campo image richiesto dall’API Fal del modello scelto (verifica docs fal-ai/hunyuan-video).  
Valida size/MIME lato client prima dell’upload.

## D6 — Allinea pricing copy
Decidi: **one-shot** (€6 / €15) ovunque, oppure **subscription** Stripe (`mode: 'subscription'` + price ID).  
Aggiorna landing, dashboard e `crea-checkout.js` in blocco unico.

## D7 — Header utente
Se loggato: mostra menu (crediti, esci) **senza** `router.push('/landing')` sul click email.  
Link esplicito «Marketing / Landing» separato.

## D8 — Label gate
Cambia in «Accedi o registrati» visto che il modal ha email/password + Google.

## D9 — Toast al posto di `alert`
Componente toast minimo (state + fixed div) per auth, BYOK, premium, checkout.

## D10 — nextExport
Controlla `next.config.js` / settings Vercel: se usi `pages/api`, **non** usare `output: 'export'`. Rebuild e verifica che `__NEXT_DATA__` non segni `nextExport: true` se non voluto.

---

## B3 — Typo
Rinomina `costoCredienti` → `costoCrediti` in `genera-premium.js`.

## B4 — Debit / Fal
In staging: test credito insufficiente, Fal 502 (verifica rollback), webhook success, doppio click Genera Premium.  
Considera debit **dopo** `request_id` Fal se vuoi meno risk (tradeoff abandoned jobs).

## B5 — README
Riscrivi README sulla struttura Next reale (`pages/`, env `NEXT_PUBLIC_*`, script `npm run dev/build`).

---

## Checklist PR suggerita (quando applichi tu)

- [ ] L1 immagini + fallback  
- [ ] L3 + D2 checkout end-to-end (test mode Stripe)  
- [ ] D3 BYOK copy o video reale + modello rispettato  
- [ ] D1 decisione guest vs gate  
- [ ] L5 Trustpilot  
- [ ] L7/L8 robots + favicon  
- [ ] D4 integrazioni nascoste o disabled  
- [ ] D6 copy prezzi allineata  

---

## Aggiornamento proposte (L10, D11)

### L10 — Supabase Google OAuth 400
1. Supabase Dashboard → Authentication → Providers → Google: attiva e inserisci Client ID/Secret da Google Cloud Console.
2. Authentication → URL Configuration: Site URL = `https://jumbai.vercel.app` (o landing se preferisci).
3. Redirect URLs: almeno  
   - `https://jumbai.vercel.app/**`  
   - `https://jumbai.vercel.app/landing`  
   - `https://pvytkbouuhhnrpcyozir.supabase.co/auth/v1/callback`
4. In Google Cloud OAuth client: authorized redirect = callback Supabase sopra.
5. In codice landing: passa `redirectTo` esplicito (vedi L4) e gestisci errore se `authorize` fallisce.
6. Ripeti il click «Accedi con Google» e verifica che non torni più 400.

### D11 — Gate dashboard Google no-op
1. Apri `pages/index.tsx`: il bottone del gate deve chiamare `setShowLogin(true)` **oppure** direttamente `signInWithOAuth` (come landing), non restare senza handler.
2. Se il modal esiste ma non si apre: controlla z-index/overlay e che `showLogin` controlli il render del modal.
3. Allinea label (D8): «Accedi o registrati» se il modal ha email/password.
4. Dopo fix, senza sessione: click gate → modal o OAuth; con sessione → Casa/sidebar.
5. Non completare OAuth in ambienti di audit automatico; verifica solo che parta il flusso (URL authorize 302/200, non 400).
