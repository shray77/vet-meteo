#!/usr/bin/env python3
"""Generate PWA PNG icons from icon-source.svg."""
import cairosvg
from pathlib import Path

ICON_DIR = Path("/home/z/my-project/public/icons")
SRC = ICON_DIR / "icon-source.svg"

# (filename, size, padding)
OUTPUTS = [
    ("icon-192.png", 192, 0),
    ("icon-512.png", 512, 0),
    ("icon-maskable-512.png", 512, 0.15),  # 15% padding for maskable
]

for name, size, padding in OUTPUTS:
    out_path = ICON_DIR / name
    cairosvg.svg2png(
        url=str(SRC),
        write_to=str(out_path),
        output_width=size,
        output_height=size,
    )
    print(f"Generated {out_path} ({size}x{size})")

print("Done.")
