"""Rigenera le icone dell'app dal sorgente SVG (assets/icon/catalogflow-icon.svg).

Produce:
  - catalogflow-icon-1024.png  (sorgente trasparente, usato anche come logo)
  - CatalogFlow.icns           (macOS: icona dell'app)
  - CatalogFlow.ico            (Windows: icona del collegamento)

Richiede Playwright (rasterizza l'SVG) e Pillow. Si esegue dalla cartella del
progetto:  python3 scripts/mac/genera-icone.py
"""

import pathlib
import shutil
import subprocess

from PIL import Image
from playwright.sync_api import sync_playwright

ICON_DIR = pathlib.Path(__file__).resolve().parents[2] / "assets" / "icon"
SVG = ICON_DIR / "catalogflow-icon.svg"
PNG = ICON_DIR / "catalogflow-icon-1024.png"


def main() -> None:
    # 1) SVG -> PNG trasparente
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1024, "height": 1024})
        page.goto(SVG.as_uri())
        page.wait_for_timeout(300)
        page.screenshot(path=str(PNG), omit_background=True)
        browser.close()
    src = Image.open(PNG).convert("RGBA")

    # 2) iconset macOS -> .icns
    iconset = ICON_DIR / "CatalogFlow.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()
    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            size = base * scale
            name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
            src.resize((size, size), Image.LANCZOS).save(iconset / name)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICON_DIR / "CatalogFlow.icns")], check=True)
    shutil.rmtree(iconset)

    # 3) .ico multi-dimensione per Windows
    src.save(ICON_DIR / "CatalogFlow.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    for name in ("catalogflow-icon-1024.png", "CatalogFlow.icns", "CatalogFlow.ico"):
        print(f"{name}: {(ICON_DIR / name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
