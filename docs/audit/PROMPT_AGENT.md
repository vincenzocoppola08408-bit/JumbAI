# Prompt per Agent Cursor — JumbAI (continua da qui)

Cartella: C:\Users\vince\OneDrive\Desktop\JumbAI_Site
Commit HEAD: 69962009c0c2fd8e95a29ee340f954db20fa721e (main locale, ahead of origin — non push forzato)

## Stato ADD (già in codice — NON rifare)
- DONE: ADD-1..6, ADD-8, ADD-10, ADD-12
- ADD-11: solo TODO in webhook-video-pronto.js (manca provider email)
- ADD-7: CANCELLATO (niente watermark)
- ADD-9: BACKLOG (galleria Ispirati) — non implementare ora se non chiesto

Leggi `docs/audit/REPORT.md` sezione «Stato ADD» e i P0 aperti (checkout UI, BYOK reale, gate Genera).

## Cosa fare ora (priorità)
1. Collegare checkout UI a `POST /api/crea-checkout` (togliere alert stub).
2. Rispettare decisioni prodotto in REPORT: BYOK = video reale col modello scelto; gate auth solo su Genera; Free senza watermark.
3. Non inventare API key. Se manca env, elenca cosa serve.

Parti subito senza chiedere contenuti per chip/FAQ (già presenti).
