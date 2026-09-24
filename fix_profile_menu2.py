from pathlib import Path
import tempfile
import os

p = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site\pages\index.tsx")
text = p.read_text(encoding="utf-8")

old_alert = "alert(' Richiesta BYOK completata! Verifica la console per la risposta.');"
new_alert = "setMessaggio('Richiesta BYOK completata.');"
if old_alert not in text:
    raise SystemExit("success alert not found")
text = text.replace(old_alert, new_alert, 1)

old_err = "alert(' Errore BYOK: ' + e.message);"
new_err = "setMessaggio('Errore BYOK: ' + (e?.message || 'richiesta fallita'));"
if old_err in text:
    text = text.replace(old_err, new_err, 1)
    print("error alert replaced")
else:
    print("error alert variant missing, skip")

# Extract exact menu block using unique anchors
start_marker = '                            <div className="relative">\n              <button\n                type="button"\n                onClick={() => {\n                  if (!session) {\n                    setShowLogin(true);\n                    return;\n                  }\n                  setShowAccountMenu((v) => !v);'
start = text.find(start_marker)
if start < 0:
    # try without leading spaces variant
    start_marker2 = '<div className="relative">\n              <button\n                type="button"\n                onClick={() => {\n                  if (!session) {\n                    setShowLogin(true);\n                    return;\n                  }\n                  setShowAccountMenu((v) => !v);'
    start = text.find(start_marker2)
    if start < 0:
        raise SystemExit("menu start not found")
    # include possible leading whitespace already at start
else:
    pass

end_marker = '''                    Esci
                  </button>
                </div>
              )}
            </div>'''
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("menu end not found")
end = end + len(end_marker)

old = text[start:end]
print("replacing menu bytes", len(old))

new_menu = '''            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={session ? showAccountMenu : undefined}
                onClick={() => {
                  if (!session) {
                    setShowLogin(true);
                    return;
                  }
                  setShowAccountMenu((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1.5 pr-3 py-1 text-sm text-violetSoft hover:text-white hover:border-violet/40 hover:bg-violet/10 transition"
              >
                {session ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet to-roseSoft text-[11px] font-bold text-white">
                      {(session.user?.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[9rem] truncate">{session.user?.email?.split("@")[0]}</span>
                    <span className={`text-[10px] text-coolGray transition ${showAccountMenu ? "rotate-180" : ""}`}>▾</span>
                  </>
                ) : (
                  <span className="px-1">Accedi</span>
                )}
              </button>
              {session && showAccountMenu && (
                <>
                  <button
                    type="button"
                    aria-label="Chiudi menu account"
                    className="fixed inset-0 z-40 cursor-default bg-black/20"
                    onClick={() => setShowAccountMenu(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 bg-ink/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-violet/20 backdrop-blur-md z-50"
                  >
                    <div className="rounded-xl bg-white/[0.03] px-3 py-3 mb-1">
                      <p className="text-[11px] uppercase tracking-wide text-coolGray mb-1">Account</p>
                      <p className="text-sm text-textMain truncate">{session.user?.email}</p>
                      <p className="text-xs text-violetSoft mt-1">
                        Crediti: <strong className="tabular-nums">{profilo?.crediti ?? 0}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione("progetti"); setShowAccountMenu(false); }}
                    >
                      I miei progetti
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione("casa"); setShowAccountMenu(false); }}
                    >
                      Console Generativa
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-roseSoft hover:bg-roseSoft/10 hover:text-white transition"
                      onClick={() => { setShowAccountMenu(false); void handleLogout(); }}
                    >
                      Esci
                    </button>
                  </div>
                </>
              )}
            </div>'''

out = text[:start] + new_menu + text[end:]
# atomic write
tmp = p.with_suffix(".tsx.tmp")
tmp.write_text(out, encoding="utf-8", newline="\n")
if tmp.stat().st_size < 1000:
    raise SystemExit("tmp too small, abort")
os.replace(tmp, p)
print("ok size", p.stat().st_size)
print("has Console Generativa", "Console Generativa" in p.read_text(encoding="utf-8"))
print("no old console alert", "Verifica la console" not in p.read_text(encoding="utf-8"))
