# -*- coding: utf-8 -*-
from pathlib import Path
import re

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")
files = [f for f in (ROOT / "pages").rglob("*") if f.suffix in {".ts", ".tsx", ".js", ".jsx"}]
files += [f for f in (ROOT / "lib").rglob("*") if f.suffix in {".ts", ".tsx", ".js", ".jsx"}]

print("=== CREDITS COLUMN ===")
for f in files:
    s = f.read_text(encoding="utf-8", errors="replace")
    for i, l in enumerate(s.splitlines(), 1):
        if "profilo?.credits" in l or "profilo.credits" in l:
            print(f"{f.relative_to(ROOT)}:{i}: {l.strip()}")
        if re.search(r"select\(['\"][^'\"]*\bcredits\b", l):
            print(f"{f.relative_to(ROOT)}:{i}: SELECT {l.strip()}")
        if re.search(r"\bcredits\b", l) and "claim-free-credits" not in l and "already_has_credits" not in l and "free credit" not in l.lower() and "crediti" not in l.lower() and "Credits" not in Path(str(f)).name:
            if "credit" in l.lower() and ("from('profili')" in s[max(0,s.find(l)-200):s.find(l)+200] or "profili" in l):
                print(f"{f.relative_to(ROOT)}:{i}: maybe {l.strip()[:140]}")

print("\n=== KEY PATHS ===")
idx = (ROOT / "pages/index.tsx").read_text(encoding="utf-8")
wh = (ROOT / "pages/api/webhook-video-pronto.js").read_text(encoding="utf-8")
gp = (ROOT / "pages/api/genera-premium.js").read_text(encoding="utf-8")
checks = {
    "Apri in Editor": "Apri in Editor" in idx,
    "editor.tsx": (ROOT / "pages/editor.tsx").exists(),
    "free->progetti": "Richiesta gratuita" in idx and "setSezione('progetti')" in idx,
    "webhook maybeSingle": "maybeSingle" in wh,
    "webhook q.videoId": "q.videoId" in wh,
    "genera webhook query": "videoId=${encodeURIComponent(videoId)}" in gp,
    "select crediti only free": ".select('crediti')" in idx and ".select('crediti, credits')" not in idx,
    "profilo?.credits gone": "profilo?.credits" not in idx,
    "integrazioni Presto": "Presto" in idx and "Integrazione in arrivo" in idx,
    "avviaCheckout": "avviaCheckout" in idx and "crea-checkout" in idx,
    "byok-veo in index": "byok-veo" in idx,
    "early auth gate": "Se non autenticato" in idx,
    "gate Accedi Google only": "Accedi con Google" in idx,
}
for k, v in checks.items():
    print(f"  [{'OK' if v else 'NO'}] {k}")

print("\n=== LANDING ===")
land = (ROOT / "pages/landing.tsx").read_text(encoding="utf-8")
for key in ["Trustpilot", "/settimana", "redirectTo", "Acquista", "picsum.photos", "unsplash.com"]:
    print(f"  {key}: {land.count(key)}")

print("\n=== AUTH GOOGLE ===")
ag = (ROOT / "lib/auth-google.ts").read_text(encoding="utf-8")
print(ag)

print("\n=== ENV ===")
envs = set()
for f in files:
    envs |= set(re.findall(r"process\.env\.([A-Z0-9_]+)", f.read_text(encoding="utf-8", errors="replace")))
print(sorted(envs))

print("\n=== PUBLIC ===")
for name in ["robots.txt", "sitemap.xml", "favicon.ico", "favicon.png", "icon.png"]:
    print(f"  {name}: {(ROOT/'public'/name).exists()}")

print("\n=== API FILES ===")
for f in sorted((ROOT / "pages/api").glob("*.js")):
    print(" ", f.name)
