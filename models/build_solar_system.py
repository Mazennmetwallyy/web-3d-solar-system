"""
Solar System – Blender Python Script
=====================================
Run inside Blender 3.x or 4.x:

  Option A – Blender Scripting tab (GUI)
  1. Open Blender → Scripting workspace
  2. Click "Open" and load this file
  3. Click the ▶ Run Script button

  Option B – Headless command line
  blender --background --python build_solar_system.py

Output
------
Running the script creates a  models/x3d/  folder next to this file and writes:
  solar_system_full.x3d   – the complete orrery scene
  sun.x3d
  mercury.x3d
  venus.x3d
  earth.x3d
  mars.x3d
  jupiter.x3d
  saturn.x3d
  uranus.x3d
  neptune.x3d

Each file is a stand-alone X3D scene with geometry, material, lighting and a
camera so a browser / X3D viewer can open any single file independently.
"""

import bpy
import os
import math

# Enable the X3D exporter addon (disabled by default in Blender)
try:
    bpy.ops.preferences.addon_enable(module="io_scene_x3d")
except Exception as e:
    print(f"Note: could not enable io_scene_x3d addon: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Output directory — saves to Desktop/solar_system_x3d/ (always writable)
# ─────────────────────────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "solar_system_x3d")
os.makedirs(OUT_DIR, exist_ok=True)
print(f"Output directory: {OUT_DIR}")

# ─────────────────────────────────────────────────────────────────────────────
# Planet definitions
# (name, radius, orbit_radius, color_rgba, emissive, metallic, roughness,
#  has_rings, ring_inner, ring_outer, ring_color)
# ─────────────────────────────────────────────────────────────────────────────
PLANETS = [
    # name       r     orb   RGBA                        emit   met  rough  rings  ri    ro   ring_col
    ("Mercury", 0.38, 4.0,  (0.55, 0.47, 0.40, 1.0),  False, 0.0, 0.95, False, 0,    0,   None),
    ("Venus",   0.95, 7.5,  (0.90, 0.78, 0.50, 1.0),  False, 0.0, 0.85, False, 0,    0,   None),
    ("Earth",   1.00, 11.0, (0.20, 0.45, 0.80, 1.0),  False, 0.0, 0.70, False, 0,    0,   None),
    ("Mars",    0.53, 15.0, (0.80, 0.35, 0.20, 1.0),  False, 0.0, 0.90, False, 0,    0,   None),
    ("Jupiter", 2.80, 22.0, (0.85, 0.72, 0.55, 1.0),  False, 0.0, 0.75, False, 0,    0,   None),
    ("Saturn",  2.40, 30.0, (0.90, 0.82, 0.60, 1.0),  False, 0.0, 0.80, True,  3.2, 5.5, (0.85, 0.80, 0.65, 0.75)),
    ("Uranus",  1.60, 38.0, (0.55, 0.85, 0.90, 1.0),  False, 0.0, 0.65, True,  2.0, 2.8, (0.70, 0.90, 0.92, 0.50)),
    ("Neptune", 1.55, 45.0, (0.25, 0.40, 0.90, 1.0),  False, 0.0, 0.60, False, 0,    0,   None),
]

SUN_RADIUS = 3.5
SUN_COLOR  = (1.0, 0.85, 0.30, 1.0)
SUN_EMISSION_STRENGTH = 5.0


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def clear_scene():
    """Delete every object and every material in the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)


def make_material(name, base_color, metallic=0.0, roughness=0.5,
                  emission_color=None, emission_strength=0.0):
    """Create a Principled BSDF material and return it."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output  = nodes.new("ShaderNodeOutputMaterial")
    bsdf    = nodes.new("ShaderNodeBsdfPrincipled")
    output.location = (300, 0)
    bsdf.location   = (0, 0)

    bsdf.inputs["Base Color"].default_value  = base_color
    bsdf.inputs["Metallic"].default_value    = metallic
    bsdf.inputs["Roughness"].default_value   = roughness

    if emission_color and emission_strength > 0:
        # Blender 4.x uses "Emission Color" + "Emission Strength"
        # Blender 3.x uses "Emission" (color) + "Emission Strength"
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = emission_color
                break
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def add_noise_texture(mat, scale=5.0, detail=8.0, roughness=0.7, distortion=0.5):
    """Inject a Noise Texture into the Base Color of an existing Principled BSDF material."""
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')

    noise   = nodes.new("ShaderNodeTexNoise")
    mapping = nodes.new("ShaderNodeMapping")
    coord   = nodes.new("ShaderNodeTexCoord")
    mix_rgb = nodes.new("ShaderNodeMixRGB")

    noise.location   = (-400, 0)
    mapping.location = (-600, 0)
    coord.location   = (-800, 0)
    mix_rgb.location = (-200, 0)

    noise.inputs["Scale"].default_value      = scale
    noise.inputs["Detail"].default_value     = detail
    noise.inputs["Roughness"].default_value  = roughness
    noise.inputs["Distortion"].default_value = distortion

    mix_rgb.blend_type = 'MULTIPLY'
    mix_rgb.inputs["Fac"].default_value = 0.35

    # Pipe existing base colour into mix_rgb colour 1
    orig_color = bsdf.inputs["Base Color"].default_value[:]
    mix_rgb.inputs["Color1"].default_value = orig_color
    mix_rgb.inputs["Color2"].default_value = (1, 1, 1, 1)

    links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"],  noise.inputs["Vector"])
    links.new(noise.outputs["Fac"],       mix_rgb.inputs["Color2"])
    links.new(mix_rgb.outputs["Color"],   bsdf.inputs["Base Color"])


def add_band_texture(mat, color_a, color_b, frequency=6.0):
    """Add horizontal banding (for Jupiter / Saturn)."""
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf    = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    coord   = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    wave    = nodes.new("ShaderNodeTexWave")
    ramp    = nodes.new("ShaderNodeValToRGB")

    coord.location   = (-900, 0)
    mapping.location = (-700, 0)
    wave.location    = (-500, 0)
    ramp.location    = (-300, 0)

    wave.wave_type                       = 'BANDS'
    wave.inputs["Scale"].default_value   = frequency
    wave.inputs["Distortion"].default_value = 1.5
    wave.inputs["Detail"].default_value  = 6.0

    ramp.color_ramp.elements[0].color = color_a
    ramp.color_ramp.elements[1].color = color_b

    links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"],  wave.inputs["Vector"])
    links.new(wave.outputs["Fac"],        ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"],      bsdf.inputs["Base Color"])


def sphere(name, radius, location=(0, 0, 0), subdivisions=4):
    """Add a UV sphere and return the object."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        location=location,
        segments=64,
        ring_count=32,
    )
    obj = bpy.context.active_object
    obj.name = name

    # Smooth shading
    bpy.ops.object.shade_smooth()

    # Subdivision surface for rounder silhouette
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels          = subdivisions
    mod.render_levels   = subdivisions

    return obj


def ring(name, inner_r, outer_r, location=(0, 0, 0), color=(0.8, 0.75, 0.6, 0.7)):
    """Add a flat ring (disk) for Saturn / Uranus rings."""
    bpy.ops.mesh.primitive_circle_add(
        vertices=128,
        radius=outer_r,
        fill_type='NGON',
        location=location,
    )
    outer_obj = bpy.context.active_object
    outer_obj.name = name + "_outer"

    bpy.ops.mesh.primitive_circle_add(
        vertices=128,
        radius=inner_r,
        fill_type='NGON',
        location=location,
    )
    inner_obj = bpy.context.active_object
    inner_obj.name = name + "_inner"

    # Boolean difference to punch the hole
    bool_mod = outer_obj.modifiers.new("Hole", "BOOLEAN")
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object    = inner_obj
    bpy.context.view_layer.objects.active = outer_obj
    bpy.ops.object.modifier_apply(modifier="Hole")

    # Remove the cutter
    bpy.data.objects.remove(inner_obj, do_unlink=True)

    outer_obj.name = name
    mat = make_material(name + "_mat", base_color=color,
                        roughness=0.6, metallic=0.0)
    mat.blend_method = 'BLEND'   # transparency
    outer_obj.data.materials.append(mat)
    return outer_obj


def orbit_circle(radius, name="Orbit"):
    """Add a thin torus to visualise the orbit path."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=0.03,
        major_segments=128,
        minor_segments=8,
    )
    obj = bpy.context.active_object
    obj.name = name
    mat = make_material(name + "_mat", base_color=(0.6, 0.6, 0.8, 0.3),
                        roughness=1.0)
    mat.blend_method = 'BLEND'
    obj.data.materials.append(mat)
    return obj


def sun_light(location=(0, 0, 0)):
    """Add a Point light at the Sun's position."""
    bpy.ops.object.light_add(type='POINT', location=location)
    light = bpy.context.active_object
    light.name = "SunLight"
    light.data.energy = 5000
    light.data.color  = (1.0, 0.97, 0.88)
    light.data.shadow_soft_size = SUN_RADIUS
    return light


def add_camera(name, location, target=(0, 0, 0)):
    """Add a camera and aim it at target."""
    bpy.ops.object.camera_add(location=location)
    cam = bpy.context.active_object
    cam.name = name

    # Point at target
    dx = target[0] - location[0]
    dy = target[1] - location[1]
    dz = target[2] - location[2]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    pitch = math.asin(-dz / dist) if dist > 0 else 0
    yaw   = math.atan2(dx, -dy)
    cam.rotation_euler = (math.pi/2 + pitch, 0, yaw)
    cam.data.lens = 35
    return cam


def export_x3d(filepath):
    """Export the entire visible scene to X3D."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.x3d(
        filepath=filepath,
        use_selection=True,
        use_normals=True,
        use_triangulate=False,
        use_compress=False,
    )
    print(f"  → Exported: {filepath}")


def export_single_object(obj, filepath, extra_objects=None):
    """
    Export one planet object (plus optional ring/extras) as a standalone X3D file.
    Adds a dedicated camera and point light for the individual file.
    """
    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    # Select the planet + any extras (rings, etc.)
    obj.select_set(True)
    if extra_objects:
        for eo in extra_objects:
            eo.select_set(True)

    # Temporary camera aimed at planet centre
    cam_dist = obj.dimensions.x * 4 + 2
    bpy.ops.object.camera_add(
        location=(obj.location.x + cam_dist,
                  obj.location.y - cam_dist * 0.5,
                  obj.location.z + cam_dist * 0.4)
    )
    tmp_cam = bpy.context.active_object
    tmp_cam.name = "_tmp_cam"
    tmp_cam.data.lens = 50
    # Aim
    dx = obj.location.x - tmp_cam.location.x
    dy = obj.location.y - tmp_cam.location.y
    dz = obj.location.z - tmp_cam.location.z
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    pitch = math.asin(-dz / dist) if dist > 0 else 0
    yaw   = math.atan2(dx, -dy)
    tmp_cam.rotation_euler = (math.pi/2 + pitch, 0, yaw)
    tmp_cam.select_set(True)

    # Temporary point light near planet
    bpy.ops.object.light_add(type='POINT',
                              location=(obj.location.x - cam_dist * 0.3,
                                        obj.location.y - cam_dist * 0.3,
                                        obj.location.z + cam_dist * 0.5))
    tmp_light = bpy.context.active_object
    tmp_light.name = "_tmp_light"
    tmp_light.data.energy = 500
    tmp_light.select_set(True)

    bpy.ops.export_scene.x3d(
        filepath=filepath,
        use_selection=True,
        use_normals=True,
        use_triangulate=False,
        use_compress=False,
    )
    print(f"  → Exported: {filepath}")

    # Clean up temps
    bpy.data.objects.remove(tmp_cam,   do_unlink=True)
    bpy.data.objects.remove(tmp_light, do_unlink=True)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUILD
# ─────────────────────────────────────────────────────────────────────────────

def build_scene():
    print("\n── Solar System Builder ─────────────────────────────────")

    clear_scene()

    # ── Sun ──────────────────────────────────────────────────────────────────
    print("Building Sun …")
    sun_obj = sphere("Sun", SUN_RADIUS)
    sun_mat = make_material(
        "Sun_mat",
        base_color=SUN_COLOR,
        roughness=1.0,
        emission_color=SUN_COLOR,
        emission_strength=SUN_EMISSION_STRENGTH,
    )
    add_noise_texture(sun_mat, scale=4.0, detail=10.0, roughness=0.8,
                      distortion=1.2)
    sun_obj.data.materials.append(sun_mat)

    sun_light()   # point light at origin

    # Overview cameras
    add_camera("Cam_Overview_Top",   (0, 0, 90),  (0, 0, 0))
    add_camera("Cam_Overview_Angle", (60, -60, 40), (0, 0, 0))
    add_camera("Cam_Close_Sun",      (12, 0, 5),  (0, 0, 0))

    # ── Planets ──────────────────────────────────────────────────────────────
    planet_objs = {}
    ring_objs   = {}

    for (pname, pradius, orbit_r, pcolor, emit,
         metallic, roughness, has_rings, ring_in, ring_out, ring_col) in PLANETS:

        print(f"Building {pname} …")

        # Orbit visualisation circle
        orbit_circle(orbit_r, name=f"Orbit_{pname}")

        # Place planet at 0° on its orbit (x = orbit_r, y = 0)
        px = orbit_r
        py = 0.0

        # Sphere
        pobj = sphere(pname, pradius, location=(px, py, 0))

        # Material
        pmat = make_material(
            f"{pname}_mat",
            base_color=pcolor,
            metallic=metallic,
            roughness=roughness,
        )

        # Procedural surface detail per planet
        if pname in ("Jupiter", "Saturn"):
            # Banded gas giants
            c1 = (pcolor[0]*0.7, pcolor[1]*0.6, pcolor[2]*0.5, 1.0)
            c2 = (min(pcolor[0]*1.1,1), min(pcolor[1]*1.1,1), pcolor[2]*0.8, 1.0)
            add_band_texture(pmat, c1, c2, frequency=8.0)
        elif pname == "Earth":
            add_noise_texture(pmat, scale=6.0, detail=12.0, roughness=0.6,
                              distortion=0.4)
        elif pname in ("Uranus", "Neptune"):
            add_noise_texture(pmat, scale=3.0, detail=6.0, roughness=0.3,
                              distortion=0.2)
        else:
            add_noise_texture(pmat, scale=5.0, detail=8.0, roughness=0.7,
                              distortion=0.5)

        pobj.data.materials.append(pmat)
        planet_objs[pname] = pobj

        # Rings
        if has_rings:
            robj = ring(f"{pname}_Rings",
                        ring_in, ring_out,
                        location=(px, py, 0),
                        color=ring_col)
            ring_objs[pname] = robj

    # ── Close-up cameras for a few planets ────────────────────────────────
    for pname in ("Earth", "Saturn", "Jupiter"):
        po = planet_objs[pname]
        dist = po.dimensions.x * 5
        add_camera(f"Cam_{pname}",
                   (po.location.x + dist, po.location.y - dist*0.4, dist*0.3),
                   (po.location.x, po.location.y, 0))

    # ── Ambient world light (dim, so planets on the far side still visible) ──
    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value    = (0.01, 0.01, 0.03, 1.0)
        bg.inputs["Strength"].default_value = 0.3

    print("Scene build complete.\n")
    return planet_objs, ring_objs


# ─────────────────────────────────────────────────────────────────────────────
# X3D WRITER  (pure Python – no Blender addon required)
# ─────────────────────────────────────────────────────────────────────────────

def _fmt(v):
    """Format a float for X3D attributes."""
    return f"{v:.4f}"

def _col(rgba):
    """Convert RGBA tuple to X3D 'r g b' string."""
    return f"{_fmt(rgba[0])} {_fmt(rgba[1])} {_fmt(rgba[2])}"

def _vec(x, y, z):
    return f"{_fmt(x)} {_fmt(y)} {_fmt(z)}"


def ring_ifs(inner_r, outer_r, segments=64):
    """
    Build an X3D IndexedFaceSet string for a flat annular ring in the XY plane.
    """
    import math as _math
    verts = []
    # inner ring vertices  (indices 0 … segments-1)
    for i in range(segments):
        a = 2 * _math.pi * i / segments
        verts.append((inner_r * _math.cos(a), inner_r * _math.sin(a), 0))
    # outer ring vertices  (indices segments … 2*segments-1)
    for i in range(segments):
        a = 2 * _math.pi * i / segments
        verts.append((outer_r * _math.cos(a), outer_r * _math.sin(a), 0))

    coord_str = " ".join(f"{_fmt(x)} {_fmt(y)} {_fmt(z)}" for x, y, z in verts)

    faces = []
    for i in range(segments):
        i0 = i
        i1 = (i + 1) % segments
        o0 = segments + i
        o1 = segments + (i + 1) % segments
        faces.append(f"{i0} {i1} {o1} {o0} -1")
    index_str = " ".join(faces)

    return f"""
        <IndexedFaceSet solid="false" coordIndex="{index_str}">
          <Coordinate point="{coord_str}"/>
        </IndexedFaceSet>"""


def write_x3d(filepath, nodes_xml, viewpoints_xml="", background_color="0 0 0.05",
              sun_pos=(0, 0, 0), light_energy=5000):
    """Write a complete X3D file."""
    light_x, light_y, light_z = sun_pos
    # X3D point light radius scaled from energy
    radius = max(100, light_energy / 10)
    intensity = min(1.0, light_energy / 5000)

    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN"
  "http://www.web3d.org/specifications/x3d-3.3.dtd">
<X3D version="3.3" profile="Immersive"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance"
  xsd:noNamespaceSchemaLocation="http://www.web3d.org/specifications/x3d-3.3.xsd">
  <Scene>
    <Background skyColor="{background_color}"/>
    <PointLight DEF="SunLight"
      location="{_vec(*sun_pos)}"
      intensity="{_fmt(intensity)}"
      radius="{_fmt(radius)}"
      ambientIntensity="0.15"
      color="1.0 0.97 0.88"
      on="true"/>
{viewpoints_xml}
{nodes_xml}
  </Scene>
</X3D>
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  → Exported: {filepath}")


def planet_shape_xml(name, radius, color, tx=0, ty=0, tz=0,
                     emissive=False, emit_strength=0, transparency=0,
                     has_ring=False, ring_in=0, ring_out=0, ring_color=None):
    """Return X3D XML string for a planet sphere (and optional ring)."""
    emit_col = _col(color) if emissive else "0 0 0"
    shininess = 0.05 if emissive else 0.25
    transp = _fmt(transparency)

    sphere_xml = f"""
    <!-- {name} -->
    <Transform translation="{_vec(tx, ty, tz)}">
      <Shape>
        <Appearance>
          <Material DEF="{name}Mat"
            diffuseColor="{_col(color)}"
            emissiveColor="{emit_col}"
            specularColor="0.1 0.1 0.1"
            shininess="{_fmt(shininess)}"
            transparency="{transp}"/>
        </Appearance>
        <Sphere radius="{_fmt(radius)}"/>
      </Shape>
    </Transform>"""

    if has_ring and ring_color:
        rc = ring_color
        ring_xml = f"""
    <!-- {name} Rings -->
    <Transform translation="{_vec(tx, ty, tz)}">
      <Shape>
        <Appearance>
          <Material diffuseColor="{_col(rc)}"
            specularColor="0.05 0.05 0.05"
            shininess="0.1"
            transparency="{_fmt(1.0 - rc[3])}"/>
        </Appearance>{ring_ifs(ring_in, ring_out)}
      </Shape>
    </Transform>"""
        return sphere_xml + ring_xml

    return sphere_xml


def orbit_line_xml(radius, segments=128):
    """Thin orbit circle as a LineSet."""
    import math as _math
    pts = []
    for i in range(segments + 1):
        a = 2 * _math.pi * i / segments
        pts.append(f"{_fmt(radius * _math.cos(a))} {_fmt(radius * _math.sin(a))} 0")
    coord_str = " ".join(pts)
    indices   = " ".join(str(i) for i in range(segments + 1)) + " -1"
    return f"""
    <Shape>
      <Appearance>
        <Material emissiveColor="0.3 0.3 0.5"/>
      </Appearance>
      <IndexedLineSet coordIndex="{indices}">
        <Coordinate point="{coord_str}"/>
      </IndexedLineSet>
    </Shape>"""


def viewpoint_xml(name, pos, center=(0, 0, 0), fov=0.785):
    import math as _math
    dx, dy, dz = center[0]-pos[0], center[1]-pos[1], center[2]-pos[2]
    dist = _math.sqrt(dx*dx + dy*dy + dz*dz) or 1
    # Axis-angle toward centre
    # Simple: look along -Z in local space; rotate to point at centre
    ax, ay, az = -dy/dist, dx/dist, 0
    angle = _math.acos(max(-1, min(1, -dz/dist)))
    return f"""    <Viewpoint DEF="{name}"
      description="{name}"
      position="{_vec(*pos)}"
      orientation="{_fmt(ax)} {_fmt(ay)} {_fmt(az)} {_fmt(angle)}"
      fieldOfView="{_fmt(fov)}"/>"""


# ─────────────────────────────────────────────────────────────────────────────
# EXPORT ALL
# ─────────────────────────────────────────────────────────────────────────────

def export_all():
    print("\n── Exporting X3D files (no addon needed) ───────────────")

    # ── 1. Full solar system scene ────────────────────────────────────────────
    nodes = []
    # Sun
    nodes.append(planet_shape_xml("Sun", SUN_RADIUS, SUN_COLOR,
                                  emissive=True, emit_strength=SUN_EMISSION_STRENGTH))
    # Planets + orbit rings
    for (pname, pradius, orbit_r, pcolor, emit,
         metallic, roughness, has_rings, ring_in, ring_out, ring_col) in PLANETS:
        nodes.append(orbit_line_xml(orbit_r))
        nodes.append(planet_shape_xml(
            pname, pradius, pcolor,
            tx=orbit_r, ty=0, tz=0,
            has_ring=has_rings,
            ring_in=ring_in, ring_out=ring_out,
            ring_color=ring_col,
        ))

    vps = "\n".join([
        viewpoint_xml("Overview_Top",   (0, 0, 120), (0, 0, 0)),
        viewpoint_xml("Overview_Angle", (80, -80, 50), (0, 0, 0)),
        viewpoint_xml("Close_Sun",      (14, 0, 6),  (0, 0, 0)),
        viewpoint_xml("Inner_Planets",  (25, -15, 15), (12, 0, 0)),
        viewpoint_xml("Outer_Planets",  (50, -40, 30), (32, 0, 0)),
    ])

    write_x3d(
        os.path.join(OUT_DIR, "solar_system_full.x3d"),
        nodes_xml="\n".join(nodes),
        viewpoints_xml=vps,
    )

    # ── 2. Individual planet files ────────────────────────────────────────────
    # Sun
    vp_sun = viewpoint_xml("Front", (0, -14, 5), (0, 0, 0))
    write_x3d(
        os.path.join(OUT_DIR, "sun.x3d"),
        nodes_xml=planet_shape_xml("Sun", SUN_RADIUS, SUN_COLOR,
                                   emissive=True, emit_strength=SUN_EMISSION_STRENGTH),
        viewpoints_xml=vp_sun,
        sun_pos=(0, 0, 0),
    )

    planet_data = {p[0]: p for p in PLANETS}
    for pname, pdata in planet_data.items():
        (_, pradius, _, pcolor, emit,
         metallic, roughness, has_rings, ring_in, ring_out, ring_col) = pdata

        cam_dist = pradius * 5 + 2
        vp = viewpoint_xml("Front", (0, -cam_dist, cam_dist * 0.4), (0, 0, 0))

        node_xml = planet_shape_xml(
            pname, pradius, pcolor,
            tx=0, ty=0, tz=0,   # centred at origin for individual file
            has_ring=has_rings,
            ring_in=ring_in, ring_out=ring_out,
            ring_color=ring_col,
        )

        write_x3d(
            os.path.join(OUT_DIR, f"{pname.lower()}.x3d"),
            nodes_xml=node_xml,
            viewpoints_xml=vp,
            sun_pos=(-cam_dist * 1.5, -cam_dist, cam_dist),
            light_energy=800,
        )

    print(f"\n✓ All X3D files written to:\n  {OUT_DIR}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

build_scene()   # builds the Blender scene (viewable in viewport)
export_all()    # writes X3D files directly — no addon needed
