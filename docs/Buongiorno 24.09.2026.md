# Buongiorno 24.09.2026

Checklist operativa per la mattina di **mercoledì 24 settembre 2026** (Europe/Rome).  
Basata sull’audit serale del 23/09 su `https://jumbai.vercel.app` (commit live `399b90c`).

**Contesto rapido:** home e `/editor` rispondono 200; claim-free-credits e genera-premium sono vivi; lo smoke **Genera Gratis** fallisce con alert esatto «Errore creazione record video.» (insert `video_generati` in `/api/genera-premium`). Nessun video Fal e niente in Progetti. Push `399b90c` già su `origin/main`; Vercel **jumbai** SUCCESS, twin **jumb-ai** FAILURE (non usare il twin).

---

## Tabella limiti e costi (prodotto JumbAI)

Fonte codice: `pages/api/crea-checkout.js`, `pages/api/claim-free-credits.js`, `pages/index.tsx` (`costoCrediti`), card piani Casa/Landing.

| Piano / path | Cosa ottieni | Costo utente | Limite operativo |
|--------------|--------------|--------------|------------------|
| Free (claim una tantum) | `crediti = 3` se profilo a 0 e zero video | €0 (lato JumbAI) | ~3 video se durata ≤6s (1 cr ciascuno) |
| Starter (Stripe one-shot) | 10 crediti | €6 una tantum (`amount: 600`) | ~10 video ≤6s |
| Pro (Stripe one-shot) | 100 crediti | €15 una tantum (`amount: 1500`) | ~100 video ≤6s |
| Genera Gratis / Premium (Fal) | Debito crediti JumbAI → Fal master key | 1 credito se durata ≤6s; **2 crediti** se >6s | Blocca se `crediti < costo` (403) |
| BYOK Veo (Sviluppatori) | Google Veo con chiave utente | €0 lato server; costi/quote sul progetto Google | Niente debit crediti JumbAI; rischio 429 / billing Google |

**Nota:** nel repo non c’è una tabella RPM server-side dedicata. Il “rate limit” prodotto è il saldo `profili.crediti` + regole claim (idempotente se già ha crediti o video).

---

## Costi stimati provider (riferimento per margine / smoke)

Stime pubbliche Fal.ai (set 2026, da pagine modello fal.ai — verificare in dashboard Fal prima di campagne). Non sono prezzi Stripe JumbAI.

| Modello in UI / endpoint | Uso in JumbAI | Costo stimato Fal | Note |
|--------------------------|---------------|-------------------|------|
| Hunyuan Video (`fal-ai/hunyuan-video`) | Default Genera Gratis/Premium | ~**$0,40 / video** | Pro mode ~2× billing units |
| Hunyuan Video Pro | Opzione Premium | tipicamente più alto dello standard | Endpoint `hunyuan-video-pro` |
| CogVideoX (`cogvideox`) | Opzione Premium | ~**$0,20 / video** (CogVideoX-5B) | Endpoint mappato `cogvideox` |
| MiniMax Video | Opzione Premium | dipende da risoluzione/s; ordine ~$0,05–0,16/s su famiglie MiniMax recenti | Endpoint `minimax-video` |
| Veo 3 (riferimento Fal list) | Non path Free JumbAI | ~**$0,40 / secondo** (list Fal “Veo 3”) | Solo confronto; BYOK usa Google diretto |
| Gemini testo (legacy) | Non è generazione video Free | quote Google AI Studio / Cloud | Free path attuale = Fal + crediti |

**Smoke mattina:** preferire 1 generazione Hunyuan ≤6s (1 credito) per contenere costo Fal (~$0,40) e validare Progetti.

---

## Passi concreti (ordine obbligatorio)

1. **Allinea repo locale MSI**  
   Cosa: in `C:\Users\vince\OneDrive\Desktop\JumbAI_Site` esegui `git fetch` e `git status -sb`; conferma `main` = `399b90c` o commit successivo se il fix notturno è già pushato.  
   Verifica: `git rev-parse HEAD` e `git ls-remote origin refs/heads/main` coincidono; working tree senza modifiche accidentali ai secret.

2. **P0 — Diagnosi insert `video_generati`**  
   Cosa: apri `pages/api/genera-premium.js` e confronta le colonne dell’`.insert({...})` con lo schema reale Supabase (`video_generati` in SQL/dashboard). Cerca mismatch (nomi colonna, tipi, NOT NULL, RLS via service role).  
   Verifica: elenco differenze scritto (es. colonna assente / tipo sbagliato). Non toccare ancora il flusso Free→Fal.

3. **P0 — Fix codice `genera-premium.js`**  
   Cosa: allinea l’insert allo schema; mantieni rollback crediti se insert fallisce; nella risposta 500 includi `insertError.message` e `insertError.code` (oltre al messaggio umano).  
   Verifica: in locale, mock o log chiaro; nessun select `credits` lato server.

4. **P0 — Bundle client: niente `crediti,credits`**  
   Cosa: grep su `pages/` (escluso `.next`) per `credits` / `select('crediti, credits')`. In `eseguiFree` deve restare `.select('crediti')` solo.  
   Verifica: zero match sul path Free; se trovi leftover, rimuovili nello stesso commit del fix insert.

5. **P0 — Commit + push `origin/main`**  
   Cosa: commit solo file prodotto (niente `_*.py` di scratch); `git push origin main` **senza** force.  
   Verifica: remote `main` = nuovo SHA; `git status` clean sui tracked.

6. **P0 — Redeploy Vercel progetto `jumbai`**  
   Cosa: attendi (o triggera) Production su **jumbai** per il nuovo SHA. Ignora/non usare il twin **jumb-ai** (su `399b90c` era FAILURE).  
   Verifica: status GitHub `Vercel – jumbai` = success; `https://jumbai.vercel.app/` e `/editor` HTTP 200.

7. **Hard refresh / cache JS**  
   Cosa: apri il sito loggato, hard refresh (Ctrl+F5) o finestra anonima.  
   Verifica: in Network il JS caricato è del nuovo deploy; nessuna request `profili?select=crediti%2Ccredits` (non deve più dare 400 su colonna `credits`).

8. **Ritest API claim (sanity)**  
   Cosa: `POST /api/claim-free-credits` senza body → atteso 400 «Parametro userId mancante.»; da sessione loggata, claim no-op se già hai crediti.  
   Verifica: badge crediti coerente (es. Premium · N crediti).

9. **P0 smoke — Genera Gratis → Progetti**  
   Cosa: prompt corto, modello Hunyuan, durata ≤6s, click **Genera Gratis**.  
   Verifica OK: niente alert «Errore creazione record video.»; risposta API 200 con `video_id`; riga in Progetti stato `rendering` poi `completato`; badge crediti −1.  
   Se fallisce: copia JSON errore completo (ora deve contenere message/code PostgREST) e ferma il smoke Fal.

10. **P1 smoke — webhook Fal completo**  
    Cosa: dopo P0 verde, attendi 30–90s (o più) finché il video è pronto.  
    Verifica: URL MP4 in galleria; download funziona; nessun rollback crediti a sorpresa.

11. **P1 — Apri in Editor**  
    Cosa: da un video completato usa il bridge `/editor` (Timeline Studio).  
    Verifica: `/editor` 200; player locale / open Studio in nuova tab funziona; ricorda che iframe cross-origin può restare bloccato da CORP (comportamento documentato, non regressione P0).

12. **P2 — Twin `jumb-ai` (opzionale)**  
    Cosa: decide se riparare il deploy fallito del twin o lasciarlo spento. Produzione ufficiale = solo `jumbai.vercel.app`.  
    Verifica: se lo ripari, status Vercel jumb-ai success; altrimenti nota “twin ignorato” e chiudi.

13. **Aggiorna questo file a fine mattina**  
    Cosa: in fondo aggiungi sezione «Esito 24.09» con SHA deployato, esito smoke (ok/fail), e eventuali residuali.  
    Verifica: una riga SHA + tre checkbox Genera/Progetti/Editor spuntate.

---

## Checklist P0–P2 (riepilogo)

- [ ] **P0** Fix insert `video_generati` + colonne allineate + `insertError` in JSON + push + redeploy **jumbai**
- [ ] **P0** Ritest Genera Gratis → Progetti → (video creato)
- [ ] **P1** Verifica bundle live (niente select `crediti,credits`) + hard refresh
- [ ] **P1** Smoke Fal completo (webhook → MP4) + Apri in Editor
- [ ] **P2** Decisione twin `jumb-ai` FAILURE / hard refresh documentato

---

## Non fare domani mattina (fuori scope)

- Redesign «I miei progetti»
- Riattivare monitor gadcheck
- Force-push
- Tornare a Free = solo BYOK Google (path Free = Fal + crediti)
- Usare `jumbay.vercel.app` (404) o SSO URL Vercel gated come URL pubblico

---

*File creato la sera del 23/09/2026 per ripresa mattutina del 24/09/2026.*
