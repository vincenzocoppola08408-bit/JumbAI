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

payloads = [
    {"prompt_usato": "probe"},
    {"user_id": "00000000-0000-0000-0000-000000000000", "prompt_usato": "probe"},
    {"user_id": "00000000-0000-0000-0000-000000000000", "prompt_usato": "probe", "url_video": ""},
    {"user_id": "00000000-0000-0000-0000-000000000000", "prompt_usato": "probe", "url_video": "pending"},
]

for i, body in enumerate(payloads):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url + "/rest/v1/video_generati",
        data=data,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(i, "OK", r.status, r.read()[:200])
    except Exception as e:
        body_txt = ""
        if hasattr(e, "read"):
            try:
                body_txt = e.read().decode()[:500]
            except Exception:
                pass
        print(i, "FAIL", getattr(e, "code", None), body_txt)
