from pathlib import Path
import re
p = Path("pages/index.tsx")
t = p.read_text(encoding="utf-8")
t2, n = re.subn(
    r"per continuare .{1,6} senza chiavi Google\.",
    "per continuare - senza chiavi Google.",
    t,
    count=1,
)
print("exhausted msg fixes", n)
for f in [
    "pages/api/byok-veo-start.js",
    "pages/api/byok-veo-status.js",
    "pages/api/byok-veo-download.js",
    "pages/api/genera-premium.js",
    "pages/api/claim-free-credits.js",
]:
    fp = Path(f)
    print(f, fp.exists(), fp.stat().st_size if fp.exists() else 0)
idx = t2.find("opzionale e avanzato")
print("SVIL:", repr(t2[idx:idx+220]))
# Ensure claim API comment uses ASCII only (cosmetic)
claim = Path("pages/api/claim-free-credits.js")
c = claim.read_text(encoding="utf-8")
c2 = c.replace("\u2014", "-").replace("\u2192", "->")
# also fix mojibake sequences if any
c2 = re.sub(r"// /api/claim-free-credits .{1,6} One-time", "// /api/claim-free-credits - One-time", c2, count=1)
c2 = re.sub(r"Already has credits .{1,6} no-op", "Already has credits -> no-op", c2, count=1)
c2 = re.sub(r"Any prior video row .{1,6} no-op", "Any prior video row -> no-op", c2, count=1)
claim.write_text(c2, encoding="utf-8", newline="\n")
p.write_text(t2, encoding="utf-8", newline="\n")
print("done")
