# -*- coding: utf-8 -*-
from pathlib import Path
import json

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")
ok = []
fail = []

def check(name, cond, detail=""):
    (ok if cond else fail).append(f"{name}" + (f" — {detail}" if detail and not cond else ""))

idx = (ROOT / "pages/index.tsx").read_text(encoding="utf-8")
wh = (ROOT / "pages/api/webhook-video-pronto.js").read_text(encoding="utf-8")
gp = (ROOT / "pages/api/genera-premium.js").read_text(encoding="utf-8")
claim = (ROOT / "pages/api/claim-free-credits.js").read_text(encoding="utf-8")

# Credits
check("no select crediti, credits", ".select('crediti, credits')" not in idx and '.select("crediti, credits")' not in idx)
check("eseguiFree select crediti only", ".select('crediti')" in idx[idx.find("eseguiFree"):idx.find("eseguiPremium")])
check("no profilo?.credits", "profilo?.credits" not in idx)
check("claim API uses crediti", ".select('id, crediti')" in claim or ".select('id, crediti'" in claim)
check("genera-premium select crediti", ".select('crediti')" in gp)
check("no credits column update in APIs", "credits:" not in gp and "credits:" not in claim)

# Free -> Fal
free_block = idx[idx.find("async function eseguiFree"):idx.find("async function eseguiPremium")]
check("eseguiFree calls genera-premium", "/api/genera-premium" in free_block)
check("eseguiFree does NOT call byok for free", "/api/byok-veo-start" not in free_block)

# Progetti wiring
check("free success -> progetti", "setSezione('progetti')" in free_block or idx.count("setSezione('progetti')") >= 2)
check("free success caricaVideo", "caricaVideo()" in free_block)
check("webhook request_id fallback", "maybeSingle" in wh and "request_id" in wh)
check("webhook query videoId", "q.videoId" in wh)
check("genera webhook query ids", "videoId=${encodeURIComponent(videoId)}" in gp)

# Editor
check("pages/editor.tsx exists", (ROOT / "pages/editor.tsx").exists())
check("Apri in Editor button", "Apri in Editor" in idx)
check("editor opens /editor", "/editor?" in idx or "`/editor?" in idx)

# Other required
check("integrazioni Presto", "Presto" in idx)
check("BYOK optional separate", "eseguiByokVeo" in idx)
check("avviaCheckout wired", "crea-checkout" in idx and "avviaCheckout" in idx)
check("favicon.svg", (ROOT / "public/favicon.svg").exists())
check("robots.txt", (ROOT / "public/robots.txt").exists())

print("=== PASS ({}) ===".format(len(ok)))
for x in ok:
    print("  OK", x)
print("=== FAIL ({}) ===".format(len(fail)))
for x in fail:
    print("  FAIL", x)

# git-ish summary via files
changed = []
for rel in [
    "pages/index.tsx",
    "pages/editor.tsx",
    "pages/api/genera-premium.js",
    "pages/api/webhook-video-pronto.js",
    "pages/landing.tsx",
    "pages/_document.tsx",
    "lib/supabase-admin.js",
    "lib/analytics.ts",
    "lib/auth-google.ts",
    "vercel.json",
    "public/robots.txt",
    "public/sitemap.xml",
    "public/favicon.svg",
]:
    p = ROOT / rel
    check_exists = p.exists()
    print(f"FILE {'OK' if check_exists else 'MISSING'}: {rel}")

raise SystemExit(1 if fail else 0)
