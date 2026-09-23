# Audit JumbAI — indice

Data: 2026-09-23 (Europe/Rome)  
Live: https://jumbai.vercel.app · Landing: https://jumbai.vercel.app/landing  
Repo locale: `JumbAI_Site` (branch `main`)

## File in questa cartella

| File | Contenuto |
|------|-----------|
| [PROBLEMI.md](./PROBLEMI.md) | Elenco completo di cosa non funziona / gap, con dettagli |
| [PROPOSTE_FIX.md](./PROPOSTE_FIX.md) | Proposta di fix per ogni problema, pronta da applicare in Cursor |
| [COSA_FUNZIONA.md](./COSA_FUNZIONA.md) | Cosa risulta ok (live + codice) |
| [COME_USARE.md](./COME_USARE.md) | Come lavorare questi file con il tuo router Cursor |

**Nessun fix è stato applicato al codice applicativo.** Solo documentazione per te.

## Fonti dell'audit

1. Live HTTP / HTML / buildManifest / probe API  
2. Codice in `pages/`, `pages/api/`, `lib/`  
3. Browser live (landing + gate `/`):
   - Hero e CTA «Scopri i piani» → `#pricing` ok  
   - Thumbnail Cyberpunk e Fashion rotte; Nature ok  
   - Pricing: tre card, **nessun** pulsante acquisto  
   - `/` = gate auth («Accedi con Google»); nessun login effettuato  
   - Solo anomalia console: 404 `favicon.ico`

## Prossimi passi (tu)

1. Apri `PROBLEMI.md` + `PROPOSTE_FIX.md` in Cursor  
2. Applica i fix col tuo router (ordine in PROPOSTE_FIX)  
3. Opzionale: `git add docs AUDIT.md && git commit` quando vuoi versionare

## Fallback (piano B)

- URL fornito: **https://jumbay.vercel.app**
- Verifica 2026-09-23 ~20:05 Europe/Rome: **404 DEPLOYMENT_NOT_FOUND** su `/` e `/landing`
- Primario ancora valido: https://jumbai.vercel.app/landing (200)

## Aggiornamento sera 2026-09-23
- Nuovi: **L10** OAuth landing → Supabase 400; **D11** CTA Google gate dashboard no-op.
- Dettaglio in PROBLEMI.md / PROPOSTE_FIX.md.

- [STRUTTURA.md](./STRUTTURA.md) — dashboard = unica pagina / con sezioni sidebar (non /dashboard)


## Report finale
**[REPORT.md](./REPORT.md)** — tutti i problemi P0/P1/P2 con dove / cosa / perché / fix. Usalo come input unico in Cursor.

## Estensione report (sera)
REPORT.md include ora anche:
- **§8 Da aggiungere** (ADD-P0…P2)
- **§9 Concorrenti** (Runway, Pika, Kling, Luma, Sora, Hailuo, Veo, HeyGen) + GAP vs JumbAI

## Azioni Cursor
REPORT.md **§13** = istruzioni passo-passo + Prompt Cursor per ogni P0/P1/P2 e ADD-*. Inizia da P0-5 checkout.

