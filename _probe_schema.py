from pathlib import Path
import urllib.request
import json

env = {}
for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get("NEXT_PUBLIC_SUPABASE_URL")
key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
print("url_ok", bool(url and url.startswith("http")), "anon_len", len(key or ""))

req = urllib.request.Request(
    url.rstrip("/") + "/rest/v1/",
    headers={
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Accept": "application/openapi+json",
    },
)
with urllib.request.urlopen(req, timeout=30) as r:
    spec = json.loads(r.read().decode())

defs = spec.get("definitions") or spec.get("components", {}).get("schemas") or {}
print("tables", [k for k in defs.keys() if not k.endswith("Response") and "Filter" not in k][:40])
for name in ["video_generati", "profili"]:
    d = defs.get(name) or {}
    props = d.get("properties") or {}
    reqd = d.get("required") or []
    print("TABLE", name)
    print("  required", reqd)
    for col, meta in sorted(props.items()):
        print("  COL", col, "type=", meta.get("type"), "fmt=", meta.get("format"), "default=", meta.get("default"))
