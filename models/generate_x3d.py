"""
Solar System X3D Generator
===========================
Run this from Terminal (no Blender needed):

    python3 generate_x3d.py

Creates a folder called  x3d/  next to this script containing 10 X3D files.
"""

import os
import math

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "x3d")
os.makedirs(OUT_DIR, exist_ok=True)
print(f"Output → {OUT_DIR}\n")

# ── Planet data ───────────────────────────────────────────────────────────────
# (name, radius, orbit_r, color_rgba, has_rings, ring_inner, ring_outer, ring_color)
PLANETS = [
    ("Mercury", 0.38,  4.0,  (0.55, 0.47, 0.40, 1.0), False, 0,   0,   None),
    ("Venus",   0.95,  7.5,  (0.90, 0.78, 0.50, 1.0), False, 0,   0,   None),
    ("Earth",   1.00, 11.0,  (0.20, 0.45, 0.80, 1.0), False, 0,   0,   None),
    ("Mars",    0.53, 15.0,  (0.80, 0.35, 0.20, 1.0), False, 0,   0,   None),
    ("Jupiter", 2.80, 22.0,  (0.85, 0.72, 0.55, 1.0), False, 0,   0,   None),
    ("Saturn",  2.40, 30.0,  (0.90, 0.82, 0.60, 1.0), True,  3.2, 5.5, (0.85, 0.80, 0.65, 0.75)),
    ("Uranus",  1.60, 38.0,  (0.55, 0.85, 0.90, 1.0), True,  2.0, 2.8, (0.70, 0.90, 0.92, 0.50)),
    ("Neptune", 1.55, 45.0,  (0.25, 0.40, 0.90, 1.0), False, 0,   0,   None),
]

SUN_RADIUS = 3.5
SUN_COLOR  = (1.0, 0.85, 0.30, 1.0)


# ── Formatting helpers ────────────────────────────────────────────────────────

def f(v):
    return f"{v:.4f}"

def col(rgba):
    return f"{f(rgba[0])} {f(rgba[1])} {f(rgba[2])}"

def vec(x, y, z):
    return f"{f(x)} {f(y)} {f(z)}"


# ── Geometry builders ─────────────────────────────────────────────────────────

def sphere_xml(name, radius, color, tx=0, ty=0, tz=0, emissive=False):
    emit = col(color) if emissive else "0 0 0"
    shine = "0.05" if emissive else "0.25"
    return f"""
  <!-- {name} -->
  <Transform translation="{vec(tx, ty, tz)}">
    <Shape>
      <Appearance>
        <Material DEF="{name}Mat"
          diffuseColor="{col(color)}"
          emissiveColor="{emit}"
          specularColor="0.15 0.15 0.15"
          shininess="{shine}"
          transparency="0"/>
      </Appearance>
      <Sphere radius="{f(radius)}"/>
    </Shape>
  </Transform>"""


def ring_xml(name, inner_r, outer_r, color, tx=0, ty=0, tz=0, segments=80):
    """Flat annular ring as an IndexedFaceSet."""
    verts = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        verts.append((inner_r * math.cos(a), inner_r * math.sin(a), 0))
    for i in range(segments):
        a = 2 * math.pi * i / segments
        verts.append((outer_r * math.cos(a), outer_r * math.sin(a), 0))

    coord_str = " ".join(f"{f(x)} {f(y)} {f(z)}" for x, y, z in verts)
    faces = []
    for i in range(segments):
        i0, i1 = i, (i + 1) % segments
        o0, o1 = segments + i, segments + (i + 1) % segments
        faces.append(f"{i0} {i1} {o1} {o0} -1")
    idx = " ".join(faces)
    transp = f(max(0.0, 1.0 - color[3]))

    return f"""
  <!-- {name} Rings -->
  <Transform translation="{vec(tx, ty, tz)}">
    <Shape>
      <Appearance>
        <Material diffuseColor="{col(color)}"
          emissiveColor="0.05 0.05 0.03"
          shininess="0.1"
          transparency="{transp}"/>
      </Appearance>
      <IndexedFaceSet solid="false" coordIndex="{idx}">
        <Coordinate point="{coord_str}"/>
      </IndexedFaceSet>
    </Shape>
  </Transform>"""


def orbit_xml(radius, segments=120):
    """Dashed orbit ring as an IndexedLineSet."""
    pts = []
    for i in range(segments + 1):
        a = 2 * math.pi * i / segments
        pts.append(f"{f(radius * math.cos(a))} {f(radius * math.sin(a))} 0")
    coord_str = " ".join(pts)
    idx = " ".join(str(i) for i in range(segments + 1)) + " -1"
    return f"""
  <Shape>
    <Appearance>
      <Material emissiveColor="0.25 0.25 0.45"/>
    </Appearance>
    <IndexedLineSet coordIndex="{idx}">
      <Coordinate point="{coord_str}"/>
    </IndexedLineSet>
  </Shape>"""


def viewpoint(name, pos, look_at=(0, 0, 0), fov=0.785):
    dx = look_at[0] - pos[0]
    dy = look_at[1] - pos[1]
    dz = look_at[2] - pos[2]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz) or 1
    ax = -dy / dist
    ay =  dx / dist
    az = 0.0
    angle = math.acos(max(-1.0, min(1.0, -dz / dist)))
    return (f'  <Viewpoint DEF="{name}" description="{name}" '
            f'position="{vec(*pos)}" '
            f'orientation="{f(ax)} {f(ay)} {f(az)} {f(angle)}" '
            f'fieldOfView="{f(fov)}"/>')


def point_light(pos, energy=5000):
    intensity = min(1.0, energy / 5000)
    radius    = max(100.0, energy / 10)
    return (f'  <PointLight location="{vec(*pos)}" '
            f'intensity="{f(intensity)}" radius="{f(radius)}" '
            f'ambientIntensity="0.12" color="1.0 0.97 0.88" on="true"/>')


# ── File writer ───────────────────────────────────────────────────────────────

def write_x3d(filename, body_parts, viewpoints, light_pos=(0,0,0), light_energy=5000):
    path = os.path.join(OUT_DIR, filename)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN"',
        '  "http://www.web3d.org/specifications/x3d-3.3.dtd">',
        '<X3D version="3.3" profile="Immersive">',
        '  <Scene>',
        '    <Background skyColor="0.00 0.00 0.05"/>',
        '    ' + point_light(light_pos, light_energy),
    ]
    for vp in viewpoints:
        lines.append('    ' + vp)
    for part in body_parts:
        lines.append(part)
    lines += ['  </Scene>', '</X3D>']

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print(f"  ✓ {filename}")


# ── Generate files ────────────────────────────────────────────────────────────

def generate_full_scene():
    parts = [sphere_xml("Sun", SUN_RADIUS, SUN_COLOR, emissive=True)]
    for name, r, orb, col_, rings, ri, ro, rc in PLANETS:
        parts.append(orbit_xml(orb))
        parts.append(sphere_xml(name, r, col_, tx=orb))
        if rings:
            parts.append(ring_xml(name, ri, ro, rc, tx=orb))

    vps = [
        viewpoint("Overview_Top",   (0, 0, 120),    (0, 0, 0)),
        viewpoint("Overview_Angle", (80, -80, 50),  (0, 0, 0)),
        viewpoint("Near_Sun",       (14, 0, 6),     (0, 0, 0)),
        viewpoint("Inner_Planets",  (25, -15, 15),  (12, 0, 0)),
        viewpoint("Outer_Planets",  (50, -40, 30),  (32, 0, 0)),
    ]
    write_x3d("solar_system_full.x3d", parts, vps)


def generate_planet_file(name, radius, color, has_rings, ri, ro, rc):
    cam_d = radius * 5 + 2
    parts = [sphere_xml(name, radius, color)]
    if has_rings:
        parts.append(ring_xml(name, ri, ro, rc))

    vps = [
        viewpoint("Front",      (0, -cam_d,        cam_d * 0.3),  (0, 0, 0)),
        viewpoint("Top",        (0, 0,              cam_d * 1.5),  (0, 0, 0)),
        viewpoint("Side",       (cam_d, 0,          cam_d * 0.3),  (0, 0, 0)),
    ]
    write_x3d(f"{name.lower()}.x3d", parts, vps,
              light_pos=(-cam_d * 1.2, -cam_d, cam_d),
              light_energy=600)


def generate_sun_file():
    parts = [sphere_xml("Sun", SUN_RADIUS, SUN_COLOR, emissive=True)]
    vps = [
        viewpoint("Front", (0, -14, 5),  (0, 0, 0)),
        viewpoint("Close", (0, -8,  3),  (0, 0, 0)),
    ]
    write_x3d("sun.x3d", parts, vps, light_pos=(0, 0, 0), light_energy=5000)


# ── Main ──────────────────────────────────────────────────────────────────────

print("Generating X3D files …")
generate_full_scene()
generate_sun_file()
for name, radius, orbit_r, color, has_rings, ri, ro, rc in PLANETS:
    generate_planet_file(name, radius, color, has_rings, ri, ro, rc)

print(f"\nDone! {len(PLANETS) + 2} files written to:\n  {OUT_DIR}")
