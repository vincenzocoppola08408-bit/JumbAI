# Struttura UI JumbAI (dashboard)

## Una sola pagina app

- **URL:** `https://jumbai.vercel.app/`  
- **File:** `pages/index.tsx`  
- **Non esiste** la route `/dashboard` (live → 404).

## Navigazione

Sidebar con stato React `sezione`:

| Voce sidebar | `sezione` | Contenuto |
|--------------|-----------|-----------|
| Casa | `casa` | Console generativa (Gratis BYOK + Premium), tab input, card prezzi/checkout |
| Progetti | `progetti` | Galleria progetti |
| Integrazioni | `integrazioni` | Lista stub Connetti |
| Sviluppatori | `sviluppatori` | BYOK (salva API key in `localStorage`) |

BYOK e checkout **non** sono pagine: BYOK = tab Sviluppatori (+ bottone in Casa); checkout = bottoni nelle card prezzi in Casa.

Landing marketing = unica altra pagina pubblica: `/landing`.
