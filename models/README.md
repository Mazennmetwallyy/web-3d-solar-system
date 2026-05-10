# 3D Models – Solar System X3D

This folder contains the Blender Python script used to generate the X3D models
for the Solar System Explorer assignment.

---

## How to run the script

### Step 1 – Install Blender (free)
Download from https://www.blender.org/download/ and install normally.

### Step 2 – Run the script (two ways)

**Option A – Blender GUI (easiest)**
1. Open Blender
2. Switch to the **Scripting** workspace (tab at the top)
3. Click **Open** → select `build_solar_system.py`
4. Click the **▶ Run Script** button

**Option B – Command line (headless)**
```bash
blender --background --python build_solar_system.py
```

### Step 3 – Collect the outputs
After running, a folder called `x3d/` appears next to the script containing:

| File | Contents |
|---|---|
| `solar_system_full.x3d` | Complete orrery scene — all planets, orbit rings, lighting, cameras |
| `sun.x3d` | Sun with emissive material and noise texture |
| `mercury.x3d` | Mercury — rocky, high-roughness surface |
| `venus.x3d` | Venus — warm ochre, noise texture |
| `earth.x3d` | Earth — blue oceanic tones, noise terrain detail |
| `mars.x3d` | Mars — rust red, rocky surface noise |
| `jupiter.x3d` | Jupiter — procedural horizontal gas bands |
| `saturn.x3d` | Saturn + transparent ring system |
| `uranus.x3d` | Uranus — ice-blue, faint rings |
| `neptune.x3d` | Neptune — deep blue, cloud noise |

---

## What the script does

The Blender Python (`bpy`) script programmatically builds the entire scene:

- **Geometry** – UV Spheres with Subdivision Surface modifiers for smooth silhouettes; 128-vertex ring meshes with Boolean Difference to carve the inner hole
- **Materials** – Principled BSDF for every body: correct metallic / roughness values, physically-based lighting response
- **Procedural textures** – Noise Texture nodes for rocky/oceanic surfaces; Wave Texture nodes for gas-giant banding (Jupiter, Saturn)
- **Emission** – Sun uses Emission Strength = 5 to self-illuminate
- **Lighting** – Point light at the Sun's origin (energy 5000) + dim ambient world shader
- **Cameras** – Overview (top-down), angled overview, close-up Sun, and individual close-up cameras for Earth, Saturn and Jupiter
- **Orbit paths** – Torus objects at each planet's orbital radius for visual reference

Each planet is also exported as a standalone X3D file with its own temporary camera and fill light so it can be viewed independently in any X3D-compatible browser or viewer (e.g. X3DOM, view3dscene, BS Contact).

---

## Viewing X3D files

Install **view3dscene** (free, cross-platform): https://castle-engine.io/view3dscene.php  
Or use the online viewer: https://www.x3dom.org/
