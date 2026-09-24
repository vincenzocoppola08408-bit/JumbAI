# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site\pages\landing.tsx")
t = p.read_text(encoding="utf-8")
repls = [
    (
        "https://images.unsplash.com/photo-1518770660439-4636500cff5f?w=600&h=340&fit=crop&q=80",
        "https://picsum.photos/seed/jumbai-cyber/600/340",
    ),
    (
        "https://images.unsplash.com/photo-1529626455594-4ff0802cf14e?w=600&h=340&fit=crop&q=80",
        "https://picsum.photos/seed/jumbai-fashion/600/340",
    ),
    (
        "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=340&fit=crop&q=80",
        "https://picsum.photos/seed/jumbai-nature/600/340",
    ),
]
n = 0
for a, b in repls:
    if a in t:
        t = t.replace(a, b)
        n += 1
p.write_text(t, encoding="utf-8")
print("landing thumbs replaced", n)
