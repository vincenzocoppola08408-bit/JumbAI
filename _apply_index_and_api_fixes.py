# -*- coding: utf-8 -*-
"""Apply remaining JumbAI fixes on MSI repo."""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")
if not ROOT.exists():
    ROOT = Path.cwd()

index = ROOT / "pages" / "index.tsx"
gp = ROOT / "pages" / "api" / "genera-premium.js"
wh_src = Path(__file__).resolve().parent / "webhook-video-pronto.js"
wh_dst = ROOT / "pages" / "api" / "webhook-video-pronto.js"
editor = ROOT / "pages" / "editor.tsx"

print("ROOT", ROOT)

# 1) Copy webhook if sibling present
if wh_src.exists():
    shutil.copyfile(wh_src, wh_dst)
    print("copied webhook")
else:
    print("WARN: webhook source missing", wh_src)

# 2) genera-premium: typo + webhook query
text = gp.read_text(encoding="utf-8")
text2 = text.replace("costoCredienti", "costoCrediti")
old = "const webhookUrl = `${baseUrl}/api/webhook-video-pronto`;"
new = (
    "const webhookUrl = `${baseUrl}/api/webhook-video-pronto"
    "?videoId=${encodeURIComponent(videoId)}&userId=${encodeURIComponent(userId)}`;"
)
if old not in text2:
    # maybe already patched
    if "videoId=${encodeURIComponent(videoId)}" in text2:
        print("genera-premium webhook already query-patched")
    else:
        print("ERROR: webhookUrl line not found")
        sys.exit(1)
else:
    # add comment above
    text2 = text2.replace(
        old,
        "// Pass ids in query: Fal often does not echo custom user_data to the webhook\n    " + new,
    )
    print("patched genera-premium webhook URL")
gp.write_text(text2, encoding="utf-8")
print("costoCrediti", text2.count("costoCrediti"), "costoCredienti", text2.count("costoCredienti"))

# 3) index.tsx patches
t = index.read_text(encoding="utf-8")
orig = t

# 3a remove credits fallback
t = t.replace(
    "  // Prefer profili.crediti (schema attuale); fallback credits se assente a runtime\n  const creditiUtente = profilo?.crediti ?? profilo?.credits ?? 0;",
    "  // Schema reale: solo profili.crediti (colonna 'credits' non esiste -> PostgREST 400)\n  const creditiUtente = profilo?.crediti ?? 0;",
)

# 3b after successful free gen: refresh gallery + go Progetti
needle_free = """      if (resp.ok) {
        setMessaggio(' ' + (data.message || 'Richiesta gratuita presa in carico!'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        await caricaProfilo(session.user.id, { skipClaim: true });
      } else {
        alert(' ' + (data.error || 'Errore'));
      }
    } catch (e: any) {
      alert(' Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }"""

repl_free = """      if (resp.ok) {
        setMessaggio(' ' + (data.message || 'Richiesta gratuita presa in carico! Il video e in Progetti.'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        await caricaProfilo(session.user.id, { skipClaim: true });
        await caricaVideo();
        setSezione('progetti');
        setFiltroGalleria('tutti');
        // Soft refresh: realtime may lag; poll briefly
        setTimeout(() => { void caricaVideo(); }, 2500);
        setTimeout(() => { void caricaVideo(); }, 8000);
      } else {
        alert(' ' + (data.error || 'Errore'));
      }
    } catch (e: any) {
      alert(' Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }"""

if needle_free not in t:
    # try flexible match on key markers
    if "await caricaVideo();\n        setSezione('progetti');" in t:
        print("free success path already patched")
    else:
        print("WARN: free success block exact match failed; trying regex")
        # softer: insert after skipClaim in free branch only once
        m = re.search(
            r"(async function eseguiFree\(\)[\s\S]*?await caricaProfilo\(session\.user\.id, \{ skipClaim: true \};)",
            t,
        )
        if not m:
            print("ERROR: cannot locate free success caricaProfilo")
            sys.exit(1)
        # find the specific occurrence inside ok branch - last skipClaim in eseguiFree before catch
        # Insert after first skipClaim that follows genera-premium in eseguiFree
        idx = t.find("setMessaggio(' ' + (data.message || 'Richiesta gratuita presa in carico!'));")
        if idx < 0:
            # emoji/encoding variants
            idx = t.find("Richiesta gratuita presa in carico!")
        if idx < 0:
            print("ERROR: free success message not found")
            sys.exit(1)
        # find caricaProfilo after idx
        cp = t.find("await caricaProfilo(session.user.id, { skipClaim: true });", idx)
        if cp < 0:
            print("ERROR: skipClaim after free success not found")
            sys.exit(1)
        end = cp + len("await caricaProfilo(session.user.id, { skipClaim: true });")
        insert = (
            "\n        await caricaVideo();\n"
            "        setSezione('progetti');\n"
            "        setFiltroGalleria('tutti');\n"
            "        setTimeout(() => { void caricaVideo(); }, 2500);\n"
            "        setTimeout(() => { void caricaVideo(); }, 8000);"
        )
        if "setSezione('progetti')" not in t[cp:cp+400]:
            t = t[:end] + insert + t[end:]
            print("inserted free->progetti refresh via soft path")
        else:
            print("free progetti refresh already present")
else:
    t = t.replace(needle_free, repl_free)
    print("patched free success block")

# 3c premium success also refresh gallery
if "Richiesta presa in carico!" in t and "setSezione('progetti')" in t:
    pass
prem_marker = "        // Aggiorna badge crediti dopo consumo Premium\n        if (session?.user?.id) await caricaProfilo(session.user.id);"
prem_repl = (
    "        // Aggiorna badge crediti dopo consumo Premium + galleria Progetti\n"
    "        if (session?.user?.id) await caricaProfilo(session.user.id);\n"
    "        await caricaVideo();\n"
    "        setSezione('progetti');\n"
    "        setFiltroGalleria('tutti');\n"
    "        setTimeout(() => { void caricaVideo(); }, 2500);\n"
    "        setTimeout(() => { void caricaVideo(); }, 8000);"
)
if prem_marker in t and "consumo Premium + galleria" not in t:
    t = t.replace(prem_marker, prem_repl)
    print("patched premium success -> progetti")
elif "consumo Premium + galleria" in t:
    print("premium progetti already patched")
else:
    print("WARN: premium marker not found")

# 3d Apri in Editor button in Progetti export section
if "Apri in Editor" not in t:
    export_anchor = """                  {video.stato === 'completato' && video.url_video && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-coolGray">Export formato</p>"""
    export_with_btn = """                  {video.stato === 'completato' && video.url_video && (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const q = new URLSearchParams({
                            url: video.url_video as string,
                            id: video.id,
                            prompt: (video.prompt || '').slice(0, 120),
                          });
                          window.open(`/editor?${q.toString()}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet to-roseSoft text-white text-[11px] font-bold py-2.5 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition"
                      >
                        Apri in Editor
                      </button>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-coolGray">Export formato</p>"""
    if export_anchor not in t:
        print("ERROR: export anchor not found for Apri in Editor")
        sys.exit(1)
    t = t.replace(export_anchor, export_with_btn, 1)
    print("added Apri in Editor button")
else:
    print("Apri in Editor already present")

# 3e integrazioni: disable + Presto
old_int_btn = """              <button
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  int.connected
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                    : 'bg-surface2 text-coolGray border border-white/[0.10] hover:text-textMain'
                }`}
              >
                {int.connected ? 'Connesso' : 'Connetti'}
              </button>"""
new_int_btn = """              <button
                type="button"
                disabled
                title="Integrazione in arrivo"
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition opacity-70 cursor-not-allowed ${
                  int.connected
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                    : 'bg-surface2 text-coolGray border border-white/[0.10]'
                }`}
              >
                {int.connected ? 'Connesso' : 'Presto'}
              </button>"""
if old_int_btn in t:
    t = t.replace(old_int_btn, new_int_btn)
    print("patched integrazioni Presto")
elif "Presto" in t and "Integrazione in arrivo" in t:
    print("integrazioni already patched")
else:
    print("WARN: integrazioni button block not exact")

# Ensure editor page exists with UTF-8 no BOM
if not editor.exists():
    print("ERROR: editor.tsx missing")
    sys.exit(1)
raw = editor.read_bytes()
if raw.startswith(b"\xef\xbb\xbf"):
    editor.write_bytes(raw[3:])
    print("stripped BOM editor.tsx")

if t != orig:
    index.write_text(t, encoding="utf-8")
    print("wrote index.tsx")
else:
    print("index.tsx unchanged")

# Verify no select credits column left
bad = []
for path in (ROOT / "pages").rglob("*"):
    if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
        continue
    s = path.read_text(encoding="utf-8", errors="replace")
    if re.search(r"select\(['\"][^'\"]*\bcredits\b", s):
        bad.append(str(path))
    if re.search(r"\bcredits\b\s*:", s) and "claim-free-credits" not in path.name and "already_has_credits" not in s:
        # metadata-ish; report only column-like
        if ".from('profili')" in s or 'from("profili")' in s:
            bad.append(str(path) + ":profili-credits")
print("BAD credits selects:", bad)
print("DONE")
