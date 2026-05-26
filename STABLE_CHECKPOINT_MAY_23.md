# Stable Checkpoint — May 23, 2026

Snapshot of the gesture-interface gallery at a known-good configuration. Use this file to restore behavior if future edits break the carousel.

---

## Core configuration

| Setting | Value |
|--------|--------|
| **Breakpoint** | `768px` (mobile ≤768, desktop ≥769) |
| **Motion curve** | `cubic-bezier(0.19, 1, 0.22, 1)` |
| **Motion duration** | `1.2s` (`MOTION_MS = 1200` in JS) |
| **Panel dimensions (desktop)** | `300px × 400px` |
| **Ring radius (`--gc-ring-z`)** | `800px` |
| **Cache version** | `v=8` (`gesture-interface.css?v=8`) |

---

## Architecture summary

The gallery uses a **Two-Engine Architecture** where Desktop 3D (Grid) and Mobile (Flex) are strictly isolated by media queries. JS init logic checks `window.innerWidth` to decide between 3D transforms or flat scrolling.

### CSS (`gesture-interface.css`)

1. **Base layer** — Shared tokens only on `.gc-gallery` / `.gc-gallery-ring` (no `display`, `position`, or layout engine on base gallery/ring).

2. **Desktop — `@media (min-width: 769px)`**
   - `.gc-gallery`: CSS Grid (`display: grid !important; place-items: center !important`), `height: 100vh` / `100dvh`, `perspective` on `.gc-gallery-scene`, `--gc-ring-z: 800px`.
   - `.gc-panel`: Fixed `300×400px`, `overflow: hidden`, 3D transforms (`rotateY` + `translateZ`), glass + `object-fit: cover` on images.
   - Transitions: `transition: all 1.2s cubic-bezier(0.19, 1, 0.22, 1)` on panels, glass, and `.gc-gallery.is-snapping`.
   - Wrappers (stage/scene): `display: grid; place-items: center`; gallery receives pointer events.

3. **Mobile — `@media (max-width: 768px)`**
   - `.gc-gallery`: `display: flex !important`, horizontal scroll-snap, `grid: none !important`.
   - `.gc-panel`: `position: relative`, `transform: none`, flex track sizing (`80vw × 60vh`).

### JavaScript (`gesture-interface.html`)

- **`isMobileLayout()`** → `window.innerWidth <= 768`
- **`initGallery()`** — On load: desktop clears inline flex, sets `--panel-angle` per panel, calls `renderFocus(6)`; mobile sets `display: flex` and scrolls to center panel.
- **`syncLayoutOnResize()`** — Debounced resize: recalculates ring angles on desktop; re-inits mobile layout when narrow.
- **Desktop interaction** — Drag/wheel on gallery; constant idle spin (`BASE_SPIN`) with `spinRate` easing down on `pointerdown` and back up on `pointerup`; unified snap via `setGalleryMotion()` + `MOTION_MS` / `MOTION_EASE`.
- **3D init guard** — Panel angles and `renderFocus(6)` only when `window.innerWidth > 768`.

### HTML / assets

- Inline gallery script (no external `script.js`).
- Vercel Analytics loads only when hostname is not `localhost` / `127.0.0.1`.
- 13 panels: `portfolio-assets/gallery-01.png` … `gallery-13.png`.

---

## Local preview

```bash
cd /path/to/nikaylah-portfolio
python3 -m http.server 8765
```

Open: **http://localhost:8765/gesture-interface.html**

Hard-refresh after CSS changes (`Cmd+Shift+R`). Bump `?v=` on the stylesheet link when cache is stale.

---

## Recovery note

**If the carousel breaks in future updates, revert `gesture-interface.css` and `gesture-interface.html` to the patterns documented here.**

Key invariants to preserve:

- Desktop grid must not be overridden by mobile flex except inside `@media (max-width: 768px)` or mobile `initGallery()` branch.
- Do not set `display: flex` inline on `.gc-gallery` for desktop widths.
- Keep JS breakpoint aligned with CSS: **768 / 769**.
- Keep `--gc-ring-z`, panel size, and motion curve in sync with this table.

---

## Files in this checkpoint

- `gesture-interface.html`
- `gesture-interface.css`
- `STABLE_CHECKPOINT_MAY_23.md` (this file)
