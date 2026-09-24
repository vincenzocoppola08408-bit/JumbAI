# -*- coding: utf-8 -*-
"""Fix remaining broken items for 100% readiness."""
from pathlib import Path
import json
import re

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")

# ---------- 1) auth-google: ensure redirectTo ----------
ag = ROOT / "lib" / "auth-google.ts"
ag_text = ag.read_text(encoding="utf-8")
if "redirectTo" not in ag_text:
    ag.write_text(
        "import { supabase } from './supabase-client';\n\n"
        "export async function signInWithGoogle() {\n"
        "  const origin = typeof window !== 'undefined' ? window.location.origin : '';\n"
        "  const { data, error } = await supabase.auth.signInWithOAuth({\n"
        "    provider: 'google',\n"
        "    options: {\n"
        "      redirectTo: origin ? `${origin}/` : undefined,\n"
        "    },\n"
        "  });\n"
        "  if (error) throw error;\n"
        "  return data;\n"
        "}\n",
        encoding="utf-8",
    )
    print("auth-google: wrote redirectTo")
else:
    print("auth-google: redirectTo already present")

# ---------- 2) supabase-admin null guard ----------
sa = ROOT / "lib" / "supabase-admin.js"
sat = sa.read_text(encoding="utf-8")
if "if (!supabaseUrl" not in sat:
    sa.write_text(
        "// Client Supabase per il server (service_role - solo API routes)\n"
        "import { createClient } from '@supabase/supabase-js';\n\n"
        "const supabaseUrl = process.env.SUPABASE_URL;\n"
        "const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;\n\n"
        "if (!supabaseUrl || !supabaseServiceRoleKey) {\n"
        "  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');\n"
        "}\n\n"
        "export const supabaseAdmin = createClient(\n"
        "  supabaseUrl || 'https://placeholder.supabase.co',\n"
        "  supabaseServiceRoleKey || 'placeholder',\n"
        "  {\n"
        "    auth: {\n"
        "      autoRefreshToken: false,\n"
        "      persistSession: false,\n"
        "    },\n"
        "  }\n"
        ");\n",
        encoding="utf-8",
    )
    print("supabase-admin: null guard")
else:
    print("supabase-admin: ok")

# ---------- 3) landing fixes ----------
land = ROOT / "pages" / "landing.tsx"
lt = land.read_text(encoding="utf-8")
lt0 = lt
lt = re.sub(r".{0,80}Trustpilot.{0,80}\n?", "", lt, flags=re.IGNORECASE)
lt = lt.replace('href="/" className="font-display', 'href="/landing" className="font-display', 1)
lt = lt.replace("/settimana", " una tantum")
lt = lt.replace("/ settimana", " una tantum")
# OAuth redirectTo on landing if inline signInWithOAuth without options
if "signInWithOAuth" in lt and "redirectTo" not in lt:
    lt = lt.replace(
        "signInWithOAuth({ provider: 'google' })",
        "signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } })",
    )
    lt = lt.replace(
        'signInWithOAuth({ provider: "google" })',
        'signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/" } })',
    )
if lt != lt0:
    land.write_text(lt, encoding="utf-8")
    print("landing: cleaned")
else:
    print("landing: unchanged")

# ---------- 4) index patches ----------
idx_path = ROOT / "pages" / "index.tsx"
idx = idx_path.read_text(encoding="utf-8")
orig = idx

# Soften gate: add email button if only Google
if "Accedi o registrati con email" not in idx and "Se non autenticato" in idx:
    idx = idx.replace(
        ">Accedi con Google</button>",
        ">Continua con Google</button>\n"
        "          <button type=\"button\" onClick={() => setShowLogin(true)} "
        "className=\"mt-3 rounded-xl border border-white/15 bg-surface2 text-textMain font-semibold px-8 py-3 hover:bg-white/[0.06] transition\">"
        "Accedi o registrati con email</button>\n"
        "          <a href=\"/landing\" className=\"block text-sm text-coolGray hover:text-violetSoft transition mt-4\">Torna alla landing</a>",
        1,
    )
    gate_slice_start = idx.find("Se non autenticato")
    gate_slice = idx[gate_slice_start:gate_slice_start + 1200]
    if "{renderLoginModal()}" not in gate_slice:
        idx = idx.replace(
            "        </div>\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"min-h-screen bg-ink\">",
            "        </div>\n        {renderLoginModal()}\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"min-h-screen bg-ink\">",
            1,
        )
    print("index: gate multi-login")
else:
    print("index: gate ok/skip")

# Image tabs -> Presto
if "function setTabInputSafe" not in idx:
    idx = idx.replace(
        "  // ============ FILE IMMAGINE ============",
        "  function setTabInputSafe(tab: TabInput) {\n"
        "    if (tab !== 'testo') {\n"
        "      setMessaggio('Image-to-video: Presto. Per ora usa input Testo (Fal testo-video).');\n"
        "      setTimeout(() => setMessaggio(''), 5000);\n"
        "      return;\n"
        "    }\n"
        "    setTabInput(tab);\n"
        "  }\n\n"
        "  // ============ FILE IMMAGINE ============",
    )
    idx = idx.replace("onClick={() => setTabInput(", "onClick={() => setTabInputSafe(")
    print("index: image tabs Presto")
else:
    print("index: setTabInputSafe exists")

# BYOK function
if "async function eseguiByokVeo" not in idx:
    byok_fn = (
        "\n  async function eseguiByokVeo() {\n"
        "    if (!byokKey.trim()) return alert('Inserisci e salva la tua API Key BYOK.');\n"
        "    if (!prompt.trim()) return alert('Scrivi un prompt nella sezione Casa prima di generare con BYOK.');\n"
        "    if (!session?.user?.id) return setShowLogin(true);\n\n"
        "    const apiKey = byokKey.trim();\n"
        "    const veoModel = modello.startsWith('veo-') ? modello : 'veo-3.1-generate-preview';\n"
        "    trackGenera('byok');\n"
        "    setInviando(true);\n"
        "    setMessaggio('Avvio Veo BYOK...');\n"
        "    try {\n"
        "      let immagine_base64: string | null = null;\n"
        "      if (tabInput !== 'testo' && fileImmagine) {\n"
        "        immagine_base64 = await file2base64(fileImmagine);\n"
        "      }\n"
        "      const startResp = await fetch('/api/byok-veo-start', {\n"
        "        method: 'POST',\n"
        "        headers: { 'Content-Type': 'application/json' },\n"
        "        body: JSON.stringify({\n"
        "          apiKey,\n"
        "          prompt: prompt.trim(),\n"
        "          model: veoModel,\n"
        "          durata_secondi: durata,\n"
        "          risoluzione,\n"
        "          aspect_ratio: aspectRatio,\n"
        "          genera_audio: generaAudio,\n"
        "          prompt_negativo: promptNegativo.trim() || undefined,\n"
        "          immagine_base64: immagine_base64 || undefined,\n"
        "        }),\n"
        "      });\n"
        "      const startData = await startResp.json();\n"
        "      if (!startResp.ok) throw new Error(startData?.error || `Avvio fallito (${startResp.status})`);\n"
        "      const operationName = startData.operationName as string;\n"
        "      if (!operationName) throw new Error('operationName mancante');\n\n"
        "      let videoUri: string | null = null;\n"
        "      for (let attempt = 1; attempt <= 120; attempt++) {\n"
        "        setMessaggio(`Veo BYOK in corso… (${attempt}/120)`);\n"
        "        await new Promise((r) => setTimeout(r, 6000));\n"
        "        const stResp = await fetch('/api/byok-veo-status', {\n"
        "          method: 'POST',\n"
        "          headers: { 'Content-Type': 'application/json' },\n"
        "          body: JSON.stringify({ apiKey, operationName }),\n"
        "        });\n"
        "        const stData = await stResp.json();\n"
        "        if (!stResp.ok) throw new Error(stData?.error || `Status fallito (${stResp.status})`);\n"
        "        if (stData.error) throw new Error(stData.error);\n"
        "        if (stData.done) {\n"
        "          videoUri = stData.videoUri || null;\n"
        "          if (!videoUri) throw new Error('videoUri assente');\n"
        "          break;\n"
        "        }\n"
        "      }\n"
        "      if (!videoUri) throw new Error('Timeout Veo BYOK (~12 min)');\n\n"
        "      setMessaggio('Download video BYOK…');\n"
        "      const dlResp = await fetch('/api/byok-veo-download', {\n"
        "        method: 'POST',\n"
        "        headers: { 'Content-Type': 'application/json' },\n"
        "        body: JSON.stringify({ apiKey, videoUri }),\n"
        "      });\n"
        "      if (!dlResp.ok) {\n"
        "        const err = await dlResp.json().catch(() => ({}));\n"
        "        throw new Error(err?.error || `Download fallito (${dlResp.status})`);\n"
        "      }\n"
        "      const blob = await dlResp.blob();\n"
        "      const localUrl = URL.createObjectURL(blob);\n\n"
        "      const { data: inserted, error: insertErr } = await supabase\n"
        "        .from('video_generati')\n"
        "        .insert({\n"
        "          user_id: session.user.id,\n"
        "          prompt: prompt.trim(),\n"
        "          prompt_negativo: promptNegativo.trim() || '',\n"
        "          modello: veoModel,\n"
        "          tipo_input: tabInput,\n"
        "          durata_secondi: durata,\n"
        "          risoluzione,\n"
        "          genera_audio: generaAudio,\n"
        "          ottimizza_prompt: ottimizzaPrompt,\n"
        "          titolo: prompt.trim().substring(0, 60),\n"
        "          stato: 'completato',\n"
        "          url_video: videoUri,\n"
        "          completato_il: new Date().toISOString(),\n"
        "        })\n"
        "        .select('id')\n"
        "        .single();\n"
        "      if (insertErr) console.warn('BYOK insert video_generati:', insertErr);\n\n"
        "      setMessaggio('BYOK completato — video in Progetti');\n"
        "      await caricaVideo();\n"
        "      setSezione('progetti');\n"
        "      const a = document.createElement('a');\n"
        "      a.href = localUrl;\n"
        "      a.download = `jumbai-byok-${inserted?.id || Date.now()}.mp4`;\n"
        "      a.click();\n"
        "    } catch (e: any) {\n"
        "      alert('BYOK: ' + (e?.message || 'errore'));\n"
        "      setMessaggio('');\n"
        "    } finally {\n"
        "      setInviando(false);\n"
        "      setTimeout(() => setMessaggio(''), 8000);\n"
        "    }\n"
        "  }\n\n"
    )
    idx = idx.replace("  async function eseguiFree()", byok_fn + "  async function eseguiFree()", 1)
    print("index: added eseguiByokVeo")
else:
    print("index: eseguiByokVeo exists")

if "onClick={() => void eseguiByokVeo()}" not in idx and "eseguiByokVeo" in idx:
    needle = (
        '            <p className="text-xs text-coolGray mt-2">'
        "Memorizzata in localStorage. Il server non vede mai questa chiave.</p>\n"
        "          </div>"
    )
    repl = (
        '            <p className="text-xs text-coolGray mt-2">'
        "Memorizzata in localStorage. Per Veo la chiave passa solo ephemeral alle API byok-veo-* (mai salvata su DB).</p>\n"
        "            <button\n"
        '              type="button"\n'
        "              disabled={inviando || !byokKey.trim()}\n"
        "              onClick={() => void eseguiByokVeo()}\n"
        '              className="mt-4 w-full rounded-xl bg-amber/20 border border-amber/40 text-amber font-semibold py-3 hover:bg-amber/30 transition disabled:opacity-50"\n'
        "            >\n"
        "              {inviando ? 'Generazione BYOK…' : 'Genera con BYOK Veo (opzionale)'}\n"
        "            </button>\n"
        '            <p className="text-[11px] text-coolGray mt-2">Usa il prompt della sezione Casa. Genera Gratis resta su Fal + crediti JumbAI.</p>\n'
        "          </div>"
    )
    if needle in idx:
        idx = idx.replace(needle, repl, 1)
        print("index: BYOK button")
    else:
        print("WARN: BYOK button needle missing")

idx = idx.replace(
    "Le chiamate partono direttamente dal tuo browser all&apos;API Google",
    "Le chiamate Veo passano ephemeral da /api/byok-veo-* (chiave mai salvata su DB)",
)
idx = idx.replace(
    "Nessun proxy intermedio — zero logging lato server",
    "Nessuna persistenza della chiave; solo inoltro ephemeral verso Google",
)

# ---------- 5) genera-premium image_url ----------
gp = ROOT / "pages" / "api" / "genera-premium.js"
gpt = gp.read_text(encoding="utf-8")
if "image_url:" not in gpt and "...(immagine_base64" not in gpt:
    anchor = "      ...(genera_audio && { enable_audio: true }),\n"
    insert = (
        "      ...(genera_audio && { enable_audio: true }),\n"
        "      ...(immagine_base64 && {\n"
        "        image_url: String(immagine_base64).startsWith('data:')\n"
        "          ? String(immagine_base64)\n"
        "          : `data:image/png;base64,${immagine_base64}`,\n"
        "      }),\n"
    )
    if anchor in gpt:
        gpt = gpt.replace(anchor, insert, 1)
        gp.write_text(gpt, encoding="utf-8")
        print("genera-premium: image_url mapped")
    else:
        print("WARN: fal audio anchor missing")
else:
    print("genera-premium: image mapping ok/skip")

# Re-enable image tabs if we mapped image — actually keep Presto until Fal confirms; leave Presto.

# ---------- 6) favicon ----------
public = ROOT / "public"
ico_svg = public / "favicon.svg"
if not ico_svg.exists():
    ico_svg.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="14" fill="#7C3AED"/>'
        '<text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" '
        'font-size="32" font-weight="700" fill="#fff">J</text></svg>\n',
        encoding="utf-8",
    )
    print("favicon.svg written")

doc = ROOT / "pages" / "_document.tsx"
dt = doc.read_text(encoding="utf-8")
if "favicon" not in dt:
    dt = dt.replace(
        "<Head>",
        "<Head>\n"
        '        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
        1,
    )
    doc.write_text(dt, encoding="utf-8")
    print("_document favicon link")
else:
    print("_document favicon ok")

# ---------- 7) vercel redirects ----------
vj = ROOT / "vercel.json"
vj_data = json.loads(vj.read_text(encoding="utf-8"))
vj_data["redirects"] = [
    {"source": "/dashboard", "destination": "/", "permanent": False},
    {"source": "/pricing", "destination": "/landing#pricing", "permanent": False},
    {"source": "/login", "destination": "/?login=1", "permanent": False},
    {"source": "/signup", "destination": "/?login=1", "permanent": False},
    {"source": "/app", "destination": "/", "permanent": False},
]
vj.write_text(json.dumps(vj_data, indent=2) + "\n", encoding="utf-8")
print("vercel.json redirects")

if idx != orig:
    idx_path.write_text(idx, encoding="utf-8")
    print("wrote index.tsx")
else:
    print("index.tsx unchanged")


# ---------- 8) analytics trackGenera allow byok ----------
an = ROOT / "lib" / "analytics.ts"
at = an.read_text(encoding="utf-8")
if "byok" not in at:
    at2 = at.replace("'free' | 'premium'", "'free' | 'premium' | 'byok'")
    at2 = at2.replace('"free" | "premium"', '"free" | "premium" | "byok"')
    if at2 == at:
        # looser
        at2 = at.replace("type GeneraKind", "type GeneraKind")
        if "premium" in at and "byok" not in at:
            at2 = at.replace("premium", "premium' | 'byok")
            # careful - might break too much
            pass
    if "'free' | 'premium' | 'byok'" in at2 or '"free" | "premium" | "byok"' in at2:
        an.write_text(at2, encoding="utf-8")
        print("analytics: byok allowed")
    else:
        print("analytics raw:\n", at)
else:
    print("analytics: byok already")

print("DONE remaining fixes")
