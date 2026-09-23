# Come usare questi file in Cursor

1. Apri la cartella `JumbAI_Site` in Cursor (già il workspace tipico).
2. Parti da `docs/audit/PROBLEMI.md` (cosa è rotto) e `docs/audit/PROPOSTE_FIX.md` (come sistemarlo).
3. Usa il tuo router / modello locale o OpenRouter: incolla un blocco tipo «Applica solo D2 e L3 come da PROPOSTE_FIX.md, non fare altro».
4. Ordine consigliato: L1 → L3+D2 → D3 → D1 → resto.
5. **Non serve sbloccare usage Cloud Agent Cursor** per questa documentazione: è già nel repo locale.
6. Quando vuoi condividere su GitHub: `git add docs/audit && git commit && git push` (quando sei pronto tu).

Nessun file di applicazione codice è stato modificato da questo audit oltre a questa cartella `docs/audit/`.
