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

url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

cols_candidates = [
    "id",
    "user_id",
    "titolo",
    "prompt",
    "prompt_usato",
    "prompt_negativo",
    "seed",
    "modello",
    "tipo_input",
    "immagine_url",
    "durata_secondi",
    "risoluzione",
    "genera_audio",
    "ottimizza_prompt",
    "stato",
    "url_video",
    "url_anteprima",
    "request_id",
    "errore",
    "creato_il",
    "completato_il",
    "credits",
    "crediti",
    "aspect_ratio",
]

# probe each column via select
for col in cols_candidates:
    q = f"{url}/rest/v1/video_generati?select={col}&limit=0"
    req = urllib.request.Request(
        q,
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
            "Prefer": "count=exact",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print("OK", col, r.status, "content-range", r.headers.get("content-range"))
    except Exception as e:
        body = ""
        if hasattr(e, "read"):
            try:
                body = e.read().decode()[:300]
            except Exception:
                pass
        print("FAIL", col, getattr(e, "code", None), body)

print("--- profili ---")
for col in ["id", "email", "crediti", "credits", "piano", "api_provider", "created_at", "updated_at"]:
    q = f"{url}/rest/v1/profili?select={col}&limit=0"
    req = urllib.request.Request(
        q,
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print("OK", col, r.status)
    except Exception as e:
        body = ""
        if hasattr(e, "read"):
            try:
                body = e.read().decode()[:300]
            except Exception:
                pass
        print("FAIL", col, getattr(e, "code", None), body)
