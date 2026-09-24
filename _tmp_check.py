from pathlib import Path

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")

print("ROOT", ROOT)
print("editor exists", (ROOT / "pages" / "editor.tsx").exists())
