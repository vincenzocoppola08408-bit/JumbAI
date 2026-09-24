# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site\pages\api\genera-premium.js")
t = p.read_text(encoding="utf-8")
old = """// ============================================================
// /api/genera-premium — Generazione Video Premium
// Asincrono: scala crediti, invia a Fal.ai con webhook, risponde subito
// Free path: Fal + crediti (NOT BYOK). Live DB uses legacy video_generati columns.
// ============================================================"""
new = """// ============================================================
// /api/genera-premium — Generazione Video Premium (Fal.ai)
// Free path is /api/genera-free (Wan/DashScope). Keep Fal here for Premium.
// Anti-refund: debit + row ONLY after Fal accepts. Legacy video_generati columns.
// ============================================================"""
if old not in t:
    print("header not found exactly, trying soft replace")
else:
    t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    print("updated genera-premium header")
