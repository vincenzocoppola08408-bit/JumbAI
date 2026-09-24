from pathlib import Path
import re

p = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site\pages\index.tsx")
text = p.read_text(encoding="utf-8")

text2, n1 = re.subn(
    r"alert\(['\"][^'\"]*BYOK completata[^'\"]*['\"]\);",
    "setMessaggio('Richiesta BYOK completata.');",
    text,
    count=1,
)
print("byok success", n1)

text2, n2 = re.subn(
    r"alert\(\s*['\"][^'\"]*Errore BYOK[^'\"]*['\"]\s*\);",
    "setMessaggio('Errore BYOK: ' + (e?.message || 'richiesta fallita'));",
    text2,
    count=1,
)
if n2 == 0:
    # common pattern: alert(' Errore BYOK: ' + e.message);
    text2, n2 = re.subn(
        r"alert\(\s*['\"][^'\"]*Errore BYOK:\s*['\"]\s*\+\s*e\.message\s*\);",
        "setMessaggio('Errore BYOK: ' + (e?.message || 'richiesta fallita'));",
        text2,
        count=1,
    )
print("byok error", n2)

# Find account menu relative block by markers
start = text2.find('<div className="relative">\n              <button\n                type="button"\n                onClick={() => {\n                  if (!session) {\n                    setShowLogin(true);')
if start < 0:
    # alternate whitespace
    start = text2.find('setShowAccountMenu((v) => !v);')
    if start < 0:
        raise SystemExit('cannot locate menu')
    # walk back to opening relative div
    start = text2.rfind('<div className="relative">', 0, start)

# find end: closing of relative div after Esci button — look for showAccountMenu block end
marker_esci = text2.find('void handleLogout();', start)
if marker_esci < 0:
    raise SystemExit('no logout in menu')
# from marker, find the closing </div> of absolute menu then relative
end = text2.find('</div>\n              )}\n            </div>', marker_esci)
if end < 0:
    end = text2.find('</div>\n              )}\n                            </div>', marker_esci)
if end < 0:
    raise SystemExit('cannot find menu end')
# include the closing pattern
end_pat = text2.find('</div>', end)
# better: extend to include full match length
close = '</div>\n              )}\n            </div>'
idx = text2.find(close, marker_esci)
if idx < 0:
    close = '</div>\n              )}\n                            </div>'
    idx = text2.find(close, marker_esci)
if idx < 0:
    raise SystemExit('close pattern missing')
end = idx + len(close)

old = text2[start:end]
print('OLD MENU SNIPPET LEN', len(old))
print(old[:200].replace('\n','|'))

new_menu = '''<div className="relative">
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
                      {(session.user?.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[9rem] truncate">{session.user?.email?.split('@')[0]}</span>
                    <span className={`text-[10px] text-coolGray transition ${showAccountMenu ? 'rotate-180' : ''}`}>▼</span>
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
                      <p className="text-xs text-violetSoft mt-1">Crediti: <strong className="tabular-nums">{profilo?.crediti ?? 0}</strong></p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione('progetti'); setShowAccountMenu(false); }}
                    >
                      I miei progetti
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione('casa'); setShowAccountMenu(false); }}
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

text2 = text2[:start] + new_menu + text2[end:]
p.write_text(text2, encoding='utf-8', newline='\n')
print('written ok')
