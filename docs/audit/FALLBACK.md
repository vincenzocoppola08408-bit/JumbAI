# Fallback deploy JumbAI

## Primario (funzionante)
- App: https://jumbai.vercel.app/
- Landing: https://jumbai.vercel.app/landing

## Piano B (fornito dall’utente)
- https://jumbay.vercel.app
- https://jumbay.vercel.app/landing

### Stato al 2026-09-23 (Europe/Rome)
Probe HTTP:
- `GET https://jumbay.vercel.app/` → **404** body `DEPLOYMENT_NOT_FOUND` (Vercel)
- `GET https://jumbay.vercel.app/landing` → **404** stesso

Quindi **non usabile** finché non viene ripubblicato un deployment su quel progetto Vercel.
Quando torna online, usarlo come alternativa se la landing/console su `jumbai` non risponde, e rifare i controlli di audit lì.

### Come ripristinarlo (quando vorrai)
1. Vercel → progetto corretto (o crea alias `jumbay`)
2. Assicurati che il dominio `jumbay.vercel.app` punti a un deployment Production
3. Rilancia deploy da `JumbAI_Site` / GitHub
