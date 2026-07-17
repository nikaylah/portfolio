#!/usr/bin/env python3
"""Wrap converted images in <picture> elements and swap icon PNGs for SVGs."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# src in HTML -> (webp, opt fallback)
PICTURE_MAP = {
    "portfolio-assets/cs-v2-about.png": (
        "portfolio-assets/cs-v2-about.webp",
        "portfolio-assets/cs-v2-about-opt.png",
    ),
    "portfolio-assets/cs-v2-before-you-come.png": (
        "portfolio-assets/cs-v2-before-you-come.webp",
        "portfolio-assets/cs-v2-before-you-come-opt.png",
    ),
    "portfolio-assets/cs-v2-experiences.png": (
        "portfolio-assets/cs-v2-experiences.webp",
        "portfolio-assets/cs-v2-experiences-opt.png",
    ),
    "portfolio-assets/cs-v2-hero-detail.png": (
        "portfolio-assets/cs-v2-hero-detail.webp",
        "portfolio-assets/cs-v2-hero-detail-opt.png",
    ),
    "portfolio-assets/cs-v2-home.png": (
        "portfolio-assets/cs-v2-home.webp",
        "portfolio-assets/cs-v2-home-opt.png",
    ),
    "portfolio-assets/cs-live-about.png": (
        "portfolio-assets/cs-live-about.webp",
        "portfolio-assets/cs-live-about-opt.png",
    ),
    "portfolio-assets/cs-live-before-you-come.png": (
        "portfolio-assets/cs-live-before-you-come.webp",
        "portfolio-assets/cs-live-before-you-come-opt.png",
    ),
    "portfolio-assets/cs-live-experiences.png": (
        "portfolio-assets/cs-live-experiences.webp",
        "portfolio-assets/cs-live-experiences-opt.png",
    ),
    "portfolio-assets/cs-live-home.png": (
        "portfolio-assets/cs-live-home.webp",
        "portfolio-assets/cs-live-home-opt.png",
    ),
    "portfolio-assets/cs-user-testing.png": (
        "portfolio-assets/cs-user-testing.webp",
        "portfolio-assets/cs-user-testing-opt.png",
    ),
    "portfolio-assets/sg-user-testing.png": (
        "portfolio-assets/sg-user-testing.webp",
        "portfolio-assets/sg-user-testing-opt.png",
    ),
    "portfolio-assets/before-1.jpg": (
        "portfolio-assets/before-1.webp",
        "portfolio-assets/before-1-opt.jpg",
    ),
    "portfolio-assets/before-2.jpg": (
        "portfolio-assets/before-2.webp",
        "portfolio-assets/before-2-opt.jpg",
    ),
    "portfolio-assets/before-3.jpg": (
        "portfolio-assets/before-3.webp",
        "portfolio-assets/before-3-opt.jpg",
    ),
    "portfolio-assets/before-4.jpg": (
        "portfolio-assets/before-4.webp",
        "portfolio-assets/before-4-opt.jpg",
    ),
    "portfolio-assets/before-5.jpg": (
        "portfolio-assets/before-5.webp",
        "portfolio-assets/before-5-opt.jpg",
    ),
    "/about/icons/cursor.png": (
        "/about/icons/cursor.webp",
        "/about/icons/cursor-opt.png",
    ),
    "/about/icons/film-roll.png": (
        "/about/icons/film-roll.webp",
        "/about/icons/film-roll-opt.png",
    ),
    "/about/icons/journal.png": (
        "/about/icons/journal.webp",
        "/about/icons/journal-opt.png",
    ),
}

ICON_SVG = {
    "/about/icons/sketchbook.png": "/about/icons/sketchbook.svg",
    "/about/icons/needle.png": "/about/icons/needle.svg",
    "/about/icons/camera.png": "/about/icons/camera.svg",
    "/about/icons/book.png": "/about/icons/book.svg",
    "/about/icons/computer.png": "/about/icons/computer.svg",
    "/about/icons/saddle.png": "/about/icons/saddle.svg",
}


def wrap_picture(html: str) -> str:
    for src, (webp, opt) in PICTURE_MAP.items():
        pattern = rf"<img\b(?=[^>]*\bsrc=[\"']{re.escape(src)}[\"'])([^>]*)>"

        def repl(match: re.Match[str]) -> str:
            attrs = match.group(1)
            attrs = re.sub(
                rf"\bsrc=[\"']{re.escape(src)}[\"']",
                f'src="{opt}"',
                attrs,
                count=1,
            )
            return (
                f'<picture><source srcset="{webp}" type="image/webp">'
                f"<img{attrs}></picture>"
            )

        html = re.sub(pattern, repl, html)
    return html


def swap_icon_svgs(html: str) -> str:
    for png, svg in ICON_SVG.items():
        html = html.replace(f'src="{png}"', f'src="{svg}"')
    return html


def update_texture_css(html: str) -> str:
    old = "background-image:url('/editorial-texture.png');"
    new = (
        "background-image:url('/editorial-texture-opt.png');"
        "background-image:-webkit-image-set("
        "url('/editorial-texture.webp') type('image/webp'),"
        "url('/editorial-texture-opt.png') 1x);"
        "background-image:image-set("
        "url('/editorial-texture.webp') type('image/webp'),"
        "url('/editorial-texture-opt.png') 1x);"
    )
    return html.replace(old, new)


def process_file(rel: str, *, texture: bool = False, icons: bool = False) -> int:
    path = ROOT / rel
    original = path.read_text()
    updated = wrap_picture(original)
    if icons:
        updated = swap_icon_svgs(updated)
    if texture:
        updated = update_texture_css(updated)
    if updated == original:
        return 0
    path.write_text(updated)
    return sum(1 for a, b in zip(original, updated) if a != b)


def main() -> None:
    changes = []
    n = process_file("crescent-stables.html")
    changes.append(("crescent-stables.html", n))
    n = process_file("sustainable-generator.html")
    changes.append(("sustainable-generator.html", n))
    n = process_file("about/index.html", icons=True)
    changes.append(("about/index.html", n))
    n = process_file("index.html", texture=True)
    changes.append(("index.html", n))
    for name, _ in changes:
        print(f"Updated {name}")


if __name__ == "__main__":
    main()
