#!/usr/bin/env python3
"""pane_shot.py — cattura lo schermo e ritaglia il riquadro Shopify del pannello Hermes.

Uso:  python3 pane_shot.py <file_output.png> [--url] [--top N] [--box x0,y0,x1,y1] [--redact x0,y0,x1,y1 ...]

Coordinate in PIXEL dello schermo (2880x1800 su questo Mac).
Default: pannello preview di Hermes = x 1226..2880, y 84..1756 (include la barra indirizzi).
Le coordinate di --redact sono relative al ritaglio (per mascherare token/segreti).
"""
from __future__ import annotations
import subprocess, sys, tempfile, os
from PIL import Image, ImageDraw

FULL = (722, 84, 2880, 1756)  # pannello preview con sidebar chat nascosta
URL_BAR_TOP = (1226, 60, 2880, 200)


def capture() -> str:
    p = tempfile.mktemp(suffix=".png")
    subprocess.run(["screencapture", "-x", p], check=True)
    return p


def main() -> None:
    args = sys.argv[1:]
    out = args[0]
    box = FULL
    only_url = "--url" in args
    redacts = []
    top = None
    i = 1
    while i < len(args):
        if args[i] == "--url":
            only_url = True
        elif args[i] == "--box":
            i += 1
            box = tuple(int(v) for v in args[i].split(","))
        elif args[i] == "--top":
            i += 1
            top = int(args[i])
        elif args[i] == "--redact":
            i += 1
            redacts.append(tuple(int(v) for v in args[i].split(",")))
        i += 1

    src = capture()
    im = Image.open(src)
    crop = im.crop(URL_BAR_TOP if only_url else box)
    if top:
        crop = crop.crop((0, 0, crop.width, top))
    if redacts:
        d = ImageDraw.Draw(crop)
        for (x0, y0, x1, y1) in redacts:
            d.rectangle([x0, y0, x1, y1], fill=(20, 20, 20))
    crop.save(out)
    print(f"{out} {crop.size}")


if __name__ == "__main__":
    main()
