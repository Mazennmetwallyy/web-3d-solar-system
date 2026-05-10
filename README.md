# 🪐 Solar System Explorer

Interactive Web 3D Application — Web 3D Assignment 2025

---

## Quick Start

### Option A — With PHP (full MVC, recommended)

```bash
# From the project root folder:
php -S localhost:8000

# Then visit in your browser:
http://localhost:8000
```

The PHP server auto-creates `data/planets.db` on first load.
You can also seed it manually by visiting: `http://localhost:8000/php/setup.php`

### Option B — Static only (no PHP required)

Open `index.html` directly in Chrome or Firefox.
All planet data falls back to the hardcoded JSON in `js/api.js` automatically.
Everything works except the live PHP API responses.

> **Note:** Because the app uses ES Modules (importmap), it must be served
> over HTTP (localhost) — not opened as a `file://` URL — for the THREE.js
> CDN imports to work correctly in all browsers.

---

## Project Structure

```
Web 3D/
├── index.html          Home — full animated solar system orrery
├── explore.html        Explore — individual planet viewer (dynamic loading)
├── about.html          About — development process, design choices, testing
│
├── css/
│   └── style.css       Custom dark-space theme (CSS Custom Properties + Bootstrap 5)
│
├── js/
│   ├── api.js          AJAX controller — fetches from PHP API, falls back to static JSON
│   ├── solar-system.js THREE.js home scene (shaders, bloom, starfield, orbits)
│   └── explore.js      THREE.js explore scene (dynamic planet loading, camera animations)
│
├── php/
│   ├── api.php         REST API controller — routes GET requests
│   ├── Planet.php      Model class — SQLite queries
│   └── setup.php       Database initialisation & seeding (run once)
│
└── data/
    └── planets.db      SQLite database (auto-created on first PHP request)
```

---

## Technology Highlights

| Technology | Usage |
|---|---|
| THREE.js r160 | 3D rendering engine (ES modules via CDN importmap) |
| GLSL ShaderMaterial | Animated Sun surface (fBm noise) + Fresnel atmosphere glow |
| UnrealBloomPass | HDR bloom post-processing on the Sun |
| OrbitControls | Drag-to-rotate, scroll-to-zoom, camera presets |
| CanvasTexture | Procedural planet surfaces (no external image files) |
| Bootstrap 5.3 | Responsive layout, navbar, fluid grid |
| PHP 8 + SQLite3 | REST API backend, MVC model layer |
| Fetch API / AJAX | Dynamic planet data loading |
| Web Audio API | Procedural ambient space drone |

---

## API Reference

```
GET php/api.php?action=planets            → all 9 bodies (JSON array)
GET php/api.php?action=planet&name=Mars   → single planet by name
GET php/api.php?action=planet&id=4        → single planet by id
GET php/api.php?action=setup              → re-initialise the database
```
