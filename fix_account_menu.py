# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("pages/index.tsx")
t = p.read_text(encoding="utf-8")

if "showAccountMenu" not in t:
    old = "const [showLogin, setShowLogin] = useState(false);"
    if old not in t:
        raise SystemExit("showLogin state not found")
    t = t.replace(
        old,
        old + "\n  const [showAccountMenu, setShowAccountMenu] = useState(false);",
        1,
    )
    print("added showAccountMenu state")
else:
    print("showAccountMenu already present")

marker = "setShowLogin(false); router.push('/landing');"
if marker not in t:
    raise SystemExit("landing push marker not found")

idx = t.find(marker)
start = t.rfind("<button", 0, idx)
end = t.find("</button>", idx)
if start < 0 or end < 0:
    raise SystemExit(f"button bounds not found start={start} end={end}")
end = end + len("</button>")

new_block = """              <div className=\"relative\">
              <button
                type=\"button\"
                onClick={() => {
                  if (!session) {
                    setShowLogin(true);
                    return;
                  }
                  setShowAccountMenu((v) => !v);
                }}
                className=\"text-sm text-violetSoft hover:text-white transition\"
              >
                {session ? session.user?.email?.split('@')[0] : 'Accedi'}
              </button>
              {session && showAccountMenu && (
                <div className=\"absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-surfaceElevated shadow-xl p-3 z-50\">
                  <p className=\"text-xs text-coolGray truncate mb-2\">{session.user?.email}</p>
                  <p className=\"text-xs text-textMain mb-3\">
                    Crediti: {profilo?.crediti ?? 0}
                  </p>
                  <button
                    type=\"button\"
                    className=\"w-full text-left text-sm py-1.5 hover:text-violetSoft\"
                    onClick={() => { setSezione('progetti'); setShowAccountMenu(false); }}
                  >
                    I miei progetti
                  </button>
                  <button
                    type=\"button\"
                    className=\"w-full text-left text-sm py-1.5 hover:text-violetSoft\"
                    onClick={() => { setSezione('casa'); setShowAccountMenu(false); }}
                  >
                    Console
                  </button>
                  <button
                    type=\"button\"
                    className=\"w-full text-left text-sm py-1.5 text-roseSoft hover:text-white mt-1\"
                    onClick={() => { setShowAccountMenu(false); void handleLogout(); }}
                  >
                    Esci
                  </button>
                </div>
              )}
            </div>"""

t = t[:start] + new_block + t[end:]
print("replaced header button block")

p.write_text(t, encoding="utf-8", newline="\n")
print("done")
