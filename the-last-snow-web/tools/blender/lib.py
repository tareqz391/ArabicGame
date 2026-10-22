"""Shared helpers for authoring The Last Snow GLB assets with Blender (bpy).

Every asset is produced by a script, so models are reproducible and editable:
    python build_assets.py            (uses the bpy module, Blender 4.2+/5.x)
"""
import math
import os
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_MODELS = os.path.join(ROOT, "public", "models")
TEX_DIR = os.path.join(HERE, "_tex")
os.makedirs(OUT_MODELS, exist_ok=True)
os.makedirs(TEX_DIR, exist_ok=True)

rng = np.random.default_rng(1998)


# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions, bpy.data.armatures):
        for block in list(coll):
            coll.remove(block)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def apply_all(obj):
    select_only([obj])
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def shade_smooth(obj, angle=40):
    for p in obj.data.polygons:
        p.use_smooth = True
    # Blender 4.1+: auto smooth is a modifier/operator
    select_only([obj])
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass


def join(objs, name):
    objs = [o for o in objs if o is not None]
    select_only(objs)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


# ---------------------------------------------------------------- textures
def _save_image(name, arr):
    """arr: HxWx3 or HxWx4 float 0..1 (row 0 = top)."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1))], axis=2)
    path = os.path.join(TEX_DIR, name + ".png")
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


def fbm(h, w, octaves=5, seed=0, scale=4):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = scale * (2 ** o)
        grid = r.random((n + 1, n + 1))
        grid[-1, :] = grid[0, :]
        grid[:, -1] = grid[:, 0]
        ys = np.linspace(0, n, h, endpoint=False)
        xs = np.linspace(0, n, w, endpoint=False)
        y0 = ys.astype(int); x0 = xs.astype(int)
        fy = ys - y0; fx = xs - x0
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = grid[y0][:, x0]; b = grid[y0][:, x0 + 1]
        c = grid[y0 + 1][:, x0]; d = grid[y0 + 1][:, x0 + 1]
        top = a + (b - a) * fx[None, :]
        bot = c + (d - c) * fx[None, :]
        out += amp * (top + (bot - top) * fy[:, None])
        total += amp
        amp *= 0.5
    return out / total


def tint(n, c0, c1):
    c0 = np.array(c0); c1 = np.array(c1)
    return c0[None, None, :] + (c1 - c0)[None, None, :] * n[:, :, None]


_tex_cache = {}


def texture(kind, size=512):
    key = (kind, size)
    if key in _tex_cache:
        return _tex_cache[key]
    s = size
    if kind == "wood":  # vertical planks, warm brown
        n = fbm(s, s, 5, 11, 2)
        streak = fbm(s, s // 16 if s >= 64 else 4, 3, 12, 8)
        streak = np.repeat(streak, s // streak.shape[1] + 1, axis=1)[:, :s]
        v = 0.55 * n + 0.45 * np.abs(np.sin(np.linspace(0, 60, s))[:, None] * 0.3 + streak)
        img = tint(np.clip(v, 0, 1), (0.16, 0.09, 0.05), (0.42, 0.26, 0.14))
        planks = (np.arange(s) % (s // 6)) < 3
        img[:, planks] *= 0.45
    elif kind == "fabric":  # train seat velvet, deep teal-green
        n = fbm(s, s, 4, 21, 16)
        weave = (np.sin(np.arange(s) * 1.7)[:, None] * np.sin(np.arange(s) * 1.7)[None, :]) * 0.08
        img = tint(np.clip(n + weave, 0, 1), (0.03, 0.09, 0.09), (0.09, 0.22, 0.2))
    elif kind == "snow":
        n = fbm(s, s, 6, 31, 4)
        img = tint(n, (0.70, 0.76, 0.86), (0.95, 0.97, 1.0))
    elif kind == "stone":  # cut stone blocks
        n = fbm(s, s, 5, 41, 6)
        img = tint(n, (0.22, 0.23, 0.26), (0.45, 0.46, 0.5))
        rows = (np.arange(s) % (s // 8)) < 3
        img[rows, :] *= 0.35
        for r in range(8):
            off = (s // 8) if r % 2 else 0
            cols = ((np.arange(s) + off // 2) % (s // 4)) < 3
            img[r * s // 8:(r + 1) * s // 8, cols] *= 0.35
    elif kind == "plaster":
        n = fbm(s, s, 6, 51, 3)
        img = tint(n, (0.33, 0.3, 0.27), (0.55, 0.51, 0.45))
    elif kind == "metal":
        n = fbm(s, s, 5, 61, 8)
        rust = np.clip((fbm(s, s, 4, 62, 3) - 0.55) * 4, 0, 1)
        img = tint(n, (0.18, 0.2, 0.22), (0.34, 0.36, 0.38))
        img = img * (1 - rust[:, :, None]) + np.array([0.3, 0.13, 0.06])[None, None] * rust[:, :, None]
    elif kind == "concrete":
        n = fbm(s, s, 6, 71, 5)
        img = tint(n, (0.25, 0.26, 0.28), (0.42, 0.43, 0.45))
    elif kind == "bark":
        n = fbm(s, s, 4, 81, 3)
        stripes = np.abs(np.sin(np.arange(s) * 0.35 + n[0, :] * 6))[None, :] * 0.5
        img = tint(np.clip(n * 0.6 + stripes, 0, 1), (0.08, 0.05, 0.03), (0.28, 0.18, 0.11))
    elif kind == "needles":
        n = fbm(s, s, 5, 91, 10)
        img = tint(n, (0.02, 0.07, 0.06), (0.08, 0.2, 0.15))
    elif kind == "coat":
        n = fbm(s, s, 4, 101, 24)
        img = tint(n, (0.05, 0.06, 0.08), (0.12, 0.13, 0.17))
    elif kind == "scarf":  # knitted red
        n = fbm(s, s, 3, 111, 16)
        knit = (np.sin(np.arange(s)[:, None] * 0.9 + np.abs(np.sin(np.arange(s)[None, :] * 0.45)) * 3) * 0.5 + 0.5) * 0.25
        img = tint(np.clip(n * 0.7 + knit, 0, 1), (0.35, 0.02, 0.03), (0.75, 0.06, 0.06))
    elif kind == "wallpaper":
        n = fbm(s, s, 4, 121, 4)
        stripes = ((np.arange(s) // (s // 16)) % 2)[None, :] * 0.12
        img = tint(np.clip(n * 0.6 + stripes, 0, 1), (0.22, 0.17, 0.13), (0.42, 0.33, 0.24))
    else:
        raise ValueError(kind)
    im = _save_image("tex_" + kind, np.clip(img, 0, 1))
    _tex_cache[key] = im
    return im


# ---------------------------------------------------------------- materials
_mat_cache = {}


def mat(name, color=(0.8, 0.8, 0.8), rough=0.8, metal=0.0, tex=None, emission=None, strength=1.0, alpha=1.0):
    if name in _mat_cache:
        return _mat_cache[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if tex is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = texture(tex) if isinstance(tex, str) else tex
        if color != (0.8, 0.8, 0.8):
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            nt.links.new(t.outputs["Color"], mix.inputs[6])
            mix.inputs[7].default_value = (*color, 1)
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    _mat_cache[name] = m
    return m


def reset_caches():
    _mat_cache.clear()
    _tex_cache.clear()


def set_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


# ---------------------------------------------------------------- primitives
def box(name, size, loc=(0, 0, 0), m=None, bevel=0.0, rot=(0, 0, 0), segments=2, uv_scale=1.0):
    """size is (x, y, z) in Blender axes (Z up). Box-projected UVs in metres * uv_scale."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    select_only([o])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        apply_all(o)
    cube_uv(o, uv_scale)
    if m is not None:
        set_mat(o, m)
    return o


def cube_uv(o, scale=1.0):
    """World-scale box projection so textures keep a consistent texel density."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            l[uv].uv = (u * scale, v * scale)
    bm.to_mesh(me)
    bm.free()


def cyl(name, r, depth, loc=(0, 0, 0), m=None, verts=16, rot=(0, 0, 0), r2=None, cap=True):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot,
                                            end_fill_type="NGON" if cap else "NOTHING")
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot,
                                        end_fill_type="NGON" if cap else "NOTHING")
    o = bpy.context.active_object
    o.name = name
    cube_uv(o)
    if m is not None:
        set_mat(o, m)
    return o


def sphere(name, r, loc=(0, 0, 0), m=None, scale=(1, 1, 1), segs=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    select_only([o])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cube_uv(o)
    if m is not None:
        set_mat(o, m)
    return o


def torus(name, R, r, loc=(0, 0, 0), m=None, rot=(0, 0, 0), major=24, minor=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=major, minor_segments=minor)
    o = bpy.context.active_object
    o.name = name
    cube_uv(o)
    if m is not None:
        set_mat(o, m)
    return o


def from_pydata(name, verts, faces, m=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    link(o)
    cube_uv(o)
    if m is not None:
        set_mat(o, m)
    return o


def displace_noise(o, strength=0.05, size=0.5, seed=0):
    tex = bpy.data.textures.new(o.name + "_n", "CLOUDS")
    tex.noise_scale = size
    mod = o.modifiers.new("disp", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.5
    apply_all(o)


def snow_cap(src, name, thickness=0.06, m=None, up_thresh=0.35):
    """Duplicate faces of src that point upward, thicken them: a snow layer that follows the shape."""
    me = src.data.copy()
    o = bpy.data.objects.new(name, me)
    o.matrix_world = src.matrix_world.copy()
    link(o)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    kill = [f for f in bm.faces if f.normal.z < up_thresh]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(me)
    bm.free()
    if len(me.polygons) == 0:
        bpy.data.objects.remove(o)
        return None
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 1
    apply_all(o)
    cube_uv(o, 0.5)
    if m is not None:
        set_mat(o, m)
    return o


# ---------------------------------------------------------------- export
def export_glb(name, objects=None, animations=False, extra=None):
    path = os.path.join(OUT_MODELS, name + ".glb")
    if objects is not None:
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
            for c in o.children_recursive:
                c.select_set(True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=objects is not None,
        export_apply=True,
        export_yup=True,
        export_animations=animations,
        export_image_format="AUTO",
        export_extras=True,
        export_lights=False,
        export_cameras=False,
    )
    if animations:
        kwargs.update(export_animation_mode="ACTIONS", export_force_sampling=True, export_def_bones=True)
    if extra:
        kwargs.update(extra)
    bpy.ops.export_scene.gltf(**kwargs)
    print("  exported", os.path.relpath(path, ROOT), "%.1f KB" % (os.path.getsize(path) / 1024))
    return path


def text_mesh(name, txt, size, loc, m=None, depth=0.02, rot=(math.pi / 2, 0, 0), align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = txt
    cu.size = size
    cu.extrude = depth
    cu.align_x = align
    cu.align_y = "CENTER"
    o = bpy.data.objects.new(name, cu)
    o.location = loc
    o.rotation_euler = rot
    link(o)
    select_only([o])
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    if m is not None:
        set_mat(o, m)
    return o


def add_snow(objs, m, thickness=0.05, noise=0.02, thresh=0.5):
    out = []
    for o in objs:
        sc = snow_cap(o, o.name + "_snow", thickness, m, up_thresh=thresh)
        if sc is not None:
            if noise > 0:
                sub = sc.modifiers.new("sub", "SUBSURF"); sub.levels = 1
                apply_all(sc)
                displace_noise(sc, noise, 0.25)
            out.append(sc)
    return out


def group(name, objs, origin=(0, 0, 0)):
    """Join meshes into a single node named `name` with its origin at `origin`."""
    o = join(objs, name)
    select_only([o])
    bpy.context.scene.cursor.location = origin
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)
    o.location = (0, 0, 0)
    return o


def place_root(objs, name="Root"):
    root = bpy.data.objects.new(name, None)
    link(root)
    for o in objs:
        o.parent = root
    return root
