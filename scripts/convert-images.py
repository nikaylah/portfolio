#!/usr/bin/env python3
"""Resize and convert portfolio images to WebP. Originals are never modified."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

JOBS = [
    # (relative_path, max_width, webp_quality, format for opt fallback: png|jpeg)
    ("editorial-texture.png", 1920, 75, "png"),
    ("portfolio-assets/cs-v2-about.png", 1440, 80, "png"),
    ("portfolio-assets/cs-v2-before-you-come.png", 1440, 80, "png"),
    ("portfolio-assets/cs-v2-experiences.png", 1440, 80, "png"),
    ("portfolio-assets/cs-v2-hero-detail.png", 1440, 80, "png"),
    ("portfolio-assets/cs-v2-home.png", 1440, 80, "png"),
    ("portfolio-assets/cs-live-about.png", 1440, 80, "png"),
    ("portfolio-assets/cs-live-before-you-come.png", 1440, 80, "png"),
    ("portfolio-assets/cs-live-experiences.png", 1440, 80, "png"),
    ("portfolio-assets/cs-live-home.png", 1440, 80, "png"),
    ("portfolio-assets/cs-user-testing.png", 1600, 80, "png"),
    ("portfolio-assets/sg-user-testing.png", 1600, 80, "png"),
    ("portfolio-assets/before-1.jpg", 1400, 80, "jpeg"),
    ("portfolio-assets/before-2.jpg", 1400, 80, "jpeg"),
    ("portfolio-assets/before-3.jpg", 1400, 80, "jpeg"),
    ("portfolio-assets/before-4.jpg", 1400, 80, "jpeg"),
    ("portfolio-assets/before-5.jpg", 1400, 80, "jpeg"),
    ("about/icons/cursor.png", 320, 80, "png"),
    ("about/icons/film-roll.png", 320, 80, "png"),
    ("about/icons/journal.png", 320, 80, "png"),
]


def resize_to_max_width(im: Image.Image, max_width: int) -> Image.Image:
    w, h = im.size
    if w <= max_width:
        return im.copy()
    new_h = round(h * max_width / w)
    return im.resize((max_width, new_h), Image.Resampling.LANCZOS)


def convert_one(rel: str, max_width: int, quality: int, opt_fmt: str) -> dict:
    src = ROOT / rel
    if not src.exists():
        raise FileNotFoundError(src)

    original_size = src.stat().st_size
    stem = src.with_suffix("")
    webp_path = stem.with_suffix(".webp")
    if opt_fmt == "jpeg":
        opt_path = Path(str(stem) + "-opt.jpg")
    else:
        opt_path = Path(str(stem) + "-opt.png")

    with Image.open(src) as im:
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        resized = resize_to_max_width(im, max_width)

        save_kwargs = {}
        if resized.mode == "RGBA" and opt_fmt == "jpeg":
            resized = resized.convert("RGB")

        if opt_fmt == "jpeg":
            resized.save(opt_path, "JPEG", quality=85, optimize=True, progressive=True)
        else:
            resized.save(opt_path, "PNG", optimize=True)

        resized.save(webp_path, "WEBP", quality=quality, method=6)

    return {
        "src": rel,
        "original_bytes": original_size,
        "webp": str(webp_path.relative_to(ROOT)),
        "opt": str(opt_path.relative_to(ROOT)),
        "webp_bytes": webp_path.stat().st_size,
        "opt_bytes": opt_path.stat().st_size,
        "dimensions": resized.size,
    }


def main() -> None:
    results = []
    for job in JOBS:
        info = convert_one(*job)
        results.append(info)
        print(
            f"OK {info['src']}: "
            f"{info['original_bytes']/1024/1024:.2f}MB -> "
            f"webp {info['webp_bytes']/1024:.0f}KB, "
            f"opt {info['opt_bytes']/1024:.0f}KB "
            f"({info['dimensions'][0]}x{info['dimensions'][1]})"
        )

    orig_total = sum(r["original_bytes"] for r in results)
    webp_total = sum(r["webp_bytes"] for r in results)
    print(f"\nConverted {len(results)} files")
    print(f"Original total (converted set): {orig_total/1024/1024:.2f} MB")
    print(f"WebP total (converted set): {webp_total/1024/1024:.2f} MB")


if __name__ == "__main__":
    main()
