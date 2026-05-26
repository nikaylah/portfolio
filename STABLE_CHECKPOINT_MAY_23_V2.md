# Stable Checkpoint — May 23, 2026 (v2 — Two-Engine Refactor)

Snapshot of the gesture-interface gallery after the full **Two-Engine** refactor (3D cylinder + mobile flex isolation, layout bleed fixes, motion physics restore). Use this file to restore behavior if future edits break the carousel.

**Previous checkpoint:** `STABLE_CHECKPOINT_MAY_23.md` (pre-refactor grid/flex experiments)

---

## Core configuration

| Setting | Value |
|--------|--------|
| **Breakpoint** | `768px` (mobile ≤768, desktop ≥769) |
| **Motion curve** | `cubic-bezier(0.19, 1, 0.22, 1)` |
| **Motion duration** | `1.2s` (`MOTION_MS = 1200` in JS) |
| **Panel dimensions (desktop)** | `300px × 400px` |
| **Ring radius (`--gc-ring-z`)** | `800px` |
| **Scene perspective** | `3000px` on `.gc-gallery-scene` |
| **Cache version** | `v=13` (`gesture-interface.css?v=13`) |

---

## Architecture summary

The gallery uses a **Two-Engine Architecture** where Desktop 3D and Mobile Flex are strictly isolated by media queries. JavaScript uses **`isDesktop3D()`** (`window.innerWidth > 768`) as the **sole** trigger for 3D transforms, ring angles, drag, idle spin, and spatial tilt.

### CSS (`gesture-interface.css`)

#### Base layer
- **No layout engine** on `.gc-gallery` / `.gc-gallery-ring` / `.gc-panel` (tokens only: `--gc-focus`, `--gc-ring-z`, `--gc-motion-*`, `--panel-angle`).
- No `display`, `position`, `width`, or `height` on gallery/ring in base (prevents flat-layout bleed).

#### Desktop — `@media (min-width: 769px)`
| Element | Role |
|---------|------|
| `.gc-stage`, `.gc-spatial-hub`, `.gc-gallery-scene` | `display: grid; place-items: center` |
| `.gc-gallery-scene` | `perspective: 3000px`, `transform-style: preserve-3d`, spatial tilt transition (0.5s) |
| `.gc-gallery` | `display: grid`, `place-items: center`, `100vh`/`100dvh`, `transform-style: preserve-3d`, carousel `rotateY` via JS |
| `.gc-gallery-ring` | `width: 0; height: 0`, `preserve-3d` hub |
| `.gc-panel` | `absolute`, **300×400px**, `rotateY(var(--panel-angle)) translateZ(var(--gc-ring-z))`, `backface-visibility: hidden` |
| **Depth-of-field** | Unfocused: `opacity: 0.3`, `grayscale(50%) brightness(0.7)` · Focused: `opacity: 1`, `filter: none` |
| **Images** | `object-fit: cover` on `.gc-panel img` / `.gc-panel-photo` |
| **Glass** | `backdrop-filter: blur(20px)`, focused glass `translateZ(65px)` |

**Desktop must NOT use:** `display: flex` on `.gc-gallery` (except via erroneous inline JS on mobile).

#### Mobile — `@media (max-width: 768px)`
| Element | Role |
|---------|------|
| `.gc-gallery` | `display: flex`, horizontal scroll-snap, `transform: none`, flat stacking |
| `.gc-gallery-ring` | `display: contents` (panels become flex children) |
| `.gc-panel` | `position: relative`, `transform: none`, `80vw × 60vh`, `scroll-snap-align: center` |

---

### JavaScript (`gesture-interface.html`)

#### Layout engine API
| Function | Purpose |
|----------|---------|
| `isDesktop3D()` | `window.innerWidth > 768` — **only** 3D gate |
| `isMobileLayout()` | `!isDesktop3D()` |
| `setLayoutEngine()` | Routes to desktop or mobile engine on init / resize |
| `applyDesktopEngine()` | Clears inline mobile styles, sets ring angles, `renderFocus` |
| `applyMobileEngine()` | Sets `display: flex` inline, clears 3D transform, scroll to panel 6 |
| `clearGalleryInlineStyles()` | Removes all inline layout props on engine switch |
| `applyDesktopRingAngles()` | Sets `--panel-angle` per panel (desktop only) |

#### 3D carousel (`isDesktop3D()` only)
- `renderFocus()` → `gallery.style.transform = 'rotateY(...deg)'` (grid-centered; no `translate(-50%, -50%)` on gallery).
- `recalculateDesktopRing()` / init → `--panel-angle` = `index * (360 / 13)`.
- **Drag:** pointer on `#gc-gallery` background, `DRAG_GAIN: 2.65`, `VELOCITY_GAIN: 3.1`, inertia glide + snap.
- **Idle spin:** `BASE_SPIN: 0.14`, `spinRate` eases down on `pointerdown`, up on `pointerup`.
- **Wheel:** step focus panel with `animateTo`.
- **Snap motion:** `setGalleryMotion()` → `MOTION_MS` + `MOTION_EASE` on gallery transform.

#### Spatial tilt (desktop only)
- `window` `pointermove` → `updateSpatialTilt()` on `#gc-gallery-scene`: `rotateY(X×5deg) rotateX(-Y×5deg)`.
- Disabled on mobile and `prefers-reduced-motion`.

#### Mobile (≤768)
- Horizontal native scroll; scroll listener updates focus classes.
- No `rotateY`, no ring angles, no drag engine.

#### Analytics
- Vercel Insights script loads only when hostname is **not** `localhost` / `127.0.0.1`.

---

## Files in this checkpoint

- `gesture-interface.html`
- `gesture-interface.css`
- `STABLE_CHECKPOINT_MAY_23.md` (earlier snapshot)
- `STABLE_CHECKPOINT_MAY_23_V2.md` (this file)

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

**If the carousel breaks in future updates, revert `gesture-interface.css` and `gesture-interface.html` to the patterns documented in this file (v2).**

### Key invariants

1. **Base CSS** must not assign `display`, `flex`, `grid`, or panel dimensions outside media queries.
2. **Desktop** uses **grid + absolute panels + preserve-3d** — never inline `display: flex` on `.gc-gallery` at widths >768.
3. **Mobile** uses **flex scroll track** only inside `@media (max-width: 768px)` or `applyMobileEngine()`.
4. **JS breakpoint** must stay aligned with CSS: **768 / 769**.
5. **3D transforms** (`rotateY` on gallery, `--panel-angle` on panels) run **only** when `isDesktop3D()` is true.
6. On engine switch (resize), always call `clearGalleryInlineStyles()` before applying the new engine.

### Common failure modes

| Symptom | Likely cause |
|---------|----------------|
| Flat horizontal row on desktop | Inline `display: flex` left on `#gc-gallery`, or base CSS bleed |
| No cylinder / stacked panels | `--panel-angle` not set; init not running on desktop |
| Mobile won’t scroll | Desktop transforms not cleared; missing flex on gallery |
| Jittery rotation | Missing `backface-visibility: hidden` on panels |

---

## Changelog from v1 checkpoint (`STABLE_CHECKPOINT_MAY_23.md`)

- Replaced conflicting absolute-only gallery with **grid-centered 3D hub**.
- Added **`setLayoutEngine()` / `applyDesktopEngine()` / `applyMobileEngine()`** for clean resize handling.
- Restored **depth-of-field** (opacity 0.3 + grayscale/brightness on unfocused panels).
- Added **spatial tilt** on `.gc-gallery-scene` (pointer-driven, desktop only).
- Removed desktop `!important` wars; mobile/desktop isolated by media query only.
- Unified motion: **1.2s** + **Phawita ease** on transform, opacity, filter, and gallery snap.
