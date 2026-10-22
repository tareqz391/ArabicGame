"""Rigged, animated characters (Adam, Lina, Elias, The Hollow).

Characters are stylised (slightly large heads, simple faces, heavy winter clothes) to suit a
cinematic 2.5D puzzle-adventure. Built from lofted tubes so clothing deforms smoothly.
Facing: -Y in Blender (=> +Z in glTF / three.js). Height in metres.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from lib import *

FPS = 30


# ---------------------------------------------------------------- geometry helpers
def tube(name, rings, m=None, seg=14, cap_top=False, cap_bottom=False):
    """rings: list of (center(x,y,z), rx, ry). Builds a lofted tube along the ring centres."""
    verts, faces = [], []
    for c, rx, ry in rings:
        for i in range(seg):
            a = 2 * math.pi * i / seg
            verts.append((c[0] + math.cos(a) * rx, c[1] + math.sin(a) * ry, c[2]))
    for r in range(len(rings) - 1):
        for i in range(seg):
            a = r * seg + i
            b = r * seg + (i + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    if cap_bottom:
        faces.append(tuple(reversed(range(seg))))
    if cap_top:
        n = len(rings) - 1
        faces.append(tuple(n * seg + i for i in range(seg)))
    o = from_pydata(name, verts, faces, m)
    # make normals point outward consistently
    select_only([o])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def limb(name, pts, radii, m, seg=12, steps=4, cap=True):
    """Tube along a polyline, interpolating radius; dense rings for good skinning."""
    rr = [r if isinstance(r, tuple) else (r, r) for r in radii]
    rings = []
    for k in range(len(pts) - 1):
        a, b = Vector(pts[k]), Vector(pts[k + 1])
        for s in range(steps):
            t = s / steps
            p = a.lerp(b, t)
            rings.append((tuple(p), rr[k][0] + (rr[k + 1][0] - rr[k][0]) * t, rr[k][1] + (rr[k + 1][1] - rr[k][1]) * t))
    rings.append((tuple(pts[-1]), rr[-1][0], rr[-1][1]))
    return tube(name, rings, m, seg, cap_top=cap, cap_bottom=cap)


def weight_const(o, group):
    vg = o.vertex_groups.get(group) or o.vertex_groups.new(name=group)
    vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")


def weight_fn(o, fn):
    """fn(co) -> dict(group -> weight)."""
    groups = {}
    for v in o.data.vertices:
        ws = fn(v.co)
        tot = sum(ws.values()) or 1.0
        for g, w in ws.items():
            if w <= 0:
                continue
            if g not in groups:
                groups[g] = o.vertex_groups.get(g) or o.vertex_groups.new(name=g)
            groups[g].add([v.index], w / tot, "REPLACE")


def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- skeleton
def make_rig(name, S):
    """S: dict of proportions. Returns armature object."""
    ad = bpy.data.armatures.new(name + "_rig")
    arm = bpy.data.objects.new(name, ad)
    link(arm)
    select_only([arm])
    bpy.ops.object.mode_set(mode="EDIT")
    eb = ad.edit_bones

    def bone(n, h, t, parent=None, connect=False):
        b = eb.new(n)
        b.head = h
        b.tail = t
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    hip, ch, nk, hd = S["hip"], S["chest"], S["neck"], S["head"]
    sw, aw = S["shoulder_w"], S["arm_len"]
    lx = S["leg_x"]
    bone("root", (0, 0, 0), (0, 0.25, 0))
    bone("hips", (0, 0, hip), (0, 0, hip + 0.12), "root")
    bone("spine", (0, 0, hip + 0.12), (0, 0, (hip + ch) / 2 + 0.05), "hips", True)
    bone("chest", (0, 0, (hip + ch) / 2 + 0.05), (0, 0, ch), "spine", True)
    bone("neck", (0, 0, ch), (0, 0, nk), "chest", True)
    bone("head", (0, 0, nk), (0, 0, hd), "neck", True)
    for side, sx in (("L", 1), ("R", -1)):
        bone(f"shoulder.{side}", (sx * 0.04, 0, ch - 0.02), (sx * sw, 0, ch - 0.04), "chest")
        sh = Vector((sx * (sw + 0.02), 0, ch - 0.05))
        el = sh + Vector((sx * 0.04, 0.0, -aw * 0.5))
        wr = el + Vector((sx * 0.02, -0.03, -aw * 0.45))
        bone(f"upperarm.{side}", sh, el, f"shoulder.{side}")
        bone(f"forearm.{side}", el, wr, f"upperarm.{side}", True)
        bone(f"hand.{side}", wr, wr + Vector((0, -0.01, -aw * 0.12)), f"forearm.{side}", True)
        kn = Vector((sx * lx, -0.01, hip * 0.53))
        an = Vector((sx * lx, 0.02, hip * 0.1))
        bone(f"thigh.{side}", (sx * lx, 0, hip - 0.03), kn, "hips")
        bone(f"shin.{side}", kn, an, f"thigh.{side}", True)
        bone(f"foot.{side}", an, an + Vector((0, -0.14, -0.06)), f"shin.{side}", True)
    if S.get("scarf"):
        bone("scarf", (0.05, -0.1, ch + 0.02), (0.07, -0.14, ch - 0.3), "chest")
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


# ---------------------------------------------------------------- bodies
def build_humanoid(name, S, palette):
    """Generic clothed humanoid; S = proportions, palette = materials dict."""
    arm = make_rig(name, S)
    hip, ch, nk, hd = S["hip"], S["chest"], S["neck"], S["head"]
    sw, aw, lx = S["shoulder_w"], S["arm_len"], S["leg_x"]
    coat_bottom = S["coat_bottom"]
    parts = []

    # legs (trousers) + boots
    for side, sx in (("L", 1), ("R", -1)):
        leg = limb(f"leg{side}", [(sx * lx, 0, hip), (sx * lx, -0.01, hip * 0.53), (sx * lx, 0.02, hip * 0.12)],
                   [S["thigh_r"], S["thigh_r"] * 0.8, S["thigh_r"] * 0.62], palette["trousers"], seg=12, steps=6)
        kz = hip * 0.53
        weight_fn(leg, lambda co, sx=sx, side=side: {f"thigh.{side}": 1 - ss(kz - 0.06, kz + 0.06, -co.z + 2 * kz),
                                                      f"shin.{side}": ss(kz - 0.06, kz + 0.06, -co.z + 2 * kz)} if True else {})
        parts.append(leg)
        boot = limb(f"boot{side}", [(sx * lx, 0.06, hip * 0.16), (sx * lx, 0.02, 0.07), (sx * lx, -0.13, 0.05)],
                    [(S["thigh_r"] * 0.72, S["thigh_r"] * 0.8), (0.062, 0.07), (0.05, 0.045)], palette["boots"], seg=12, steps=3)
        for v in boot.data.vertices:  # flatten soles
            if v.co.z < 0.0:
                v.co.z = 0.0
        weight_fn(boot, lambda co, side=side: {f"foot.{side}": ss(0.04, 0.09, -co.y + 0.02) + 0.001, f"shin.{side}": 1 - ss(0.04, 0.09, -co.y + 0.02)})
        parts.append(boot)

    # coat / torso
    cw, cd = S["chest_w"], S["chest_d"]
    rings = [
        ((0, 0.0, nk - 0.02), 0.065, 0.065),
        ((0, 0.0, ch + 0.01), cw * 0.75, cd * 0.85),
        ((0, 0.0, ch - 0.05), cw, cd),
        ((0, 0.0, ch - 0.18), cw * 0.95, cd * 0.97),
        ((0, 0.0, (hip + ch) / 2), cw * 0.9, cd * 0.92),
        ((0, 0.0, hip + 0.05), cw * 0.93, cd * 0.98),
        ((0, 0.0, hip - 0.08), cw * 1.0, cd * 1.08),
    ]
    z = hip - 0.08
    while z > coat_bottom + 0.01:
        z = max(coat_bottom, z - 0.08)
        t = (hip - 0.08 - z) / max(0.01, hip - 0.08 - coat_bottom)
        rings.append(((0, 0.01 * t, z), cw * (1.0 + S["coat_flare"] * t), cd * (1.08 + S["coat_flare"] * 1.3 * t)))
    coat = tube("coat", rings, palette["coat"], seg=20)

    def coat_w(co):
        x, zz = co.x, co.z
        w = {}
        if zz > ch - 0.1:
            w["chest"] = 1.0
            side = "L" if x > 0 else "R"
            sh = ss(cw * 0.55, cw * 0.95, abs(x)) * ss(ch - 0.2, ch - 0.05, zz)
            if sh > 0:
                w[f"upperarm.{side}"] = sh * 0.5
            if zz > ch + 0.02:
                w["neck"] = ss(ch, nk, zz)
        elif zz > (hip + ch) / 2:
            t = ss((hip + ch) / 2, ch - 0.1, zz)
            w["chest"] = t
            w["spine"] = 1 - t
        elif zz > hip:
            t = ss(hip, (hip + ch) / 2, zz)
            w["spine"] = t
            w["hips"] = 1 - t
        else:
            side = "L" if x > 0 else "R"
            down = ss(hip, coat_bottom, zz)
            sidew = ss(0.0, cw * 0.6, abs(x))
            w["hips"] = 1 - down * (0.35 + 0.55 * sidew)
            w[f"thigh.{side}"] = down * (0.35 + 0.55 * sidew)
        return w

    weight_fn(coat, coat_w)
    parts.append(coat)
    if palette.get("coat_trim") is not None:
        hem = tube("hem", [((0, 0.01, coat_bottom + 0.03), rings[-1][1] + 0.006, rings[-1][2] + 0.006),
                           ((0, 0.01, coat_bottom), rings[-1][1] + 0.008, rings[-1][2] + 0.008)], palette["coat_trim"], seg=20)
        weight_fn(hem, coat_w)
        parts.append(hem)
        # button placket
        plk = box("placket", (0.03, 0.01, ch - coat_bottom - 0.05), (0, -cd * 1.05, (ch + coat_bottom) / 2 - 0.03), palette["coat_trim"])
        weight_fn(plk, coat_w)
        parts.append(plk)

    # arms (sleeves) + hands
    for side, sx in (("L", 1), ("R", -1)):
        sh = Vector((sx * (sw + 0.02), 0, ch - 0.05))
        el = sh + Vector((sx * 0.04, 0.0, -aw * 0.5))
        wr = el + Vector((sx * 0.02, -0.03, -aw * 0.45))
        sl = limb(f"sleeve{side}", [tuple(sh + Vector((-sx * 0.03, 0, 0.03))), tuple(el), tuple(wr)],
                  [S["arm_r"] * 1.15, S["arm_r"], S["arm_r"] * 0.92], palette["coat"], seg=12, steps=5)
        ez = el.z
        weight_fn(sl, lambda co, side=side, ez=ez: {f"upperarm.{side}": 1 - ss(ez - 0.05, ez + 0.05, -co.z + 2 * ez),
                                                     f"forearm.{side}": ss(ez - 0.05, ez + 0.05, -co.z + 2 * ez)})
        parts.append(sl)
        cuff = limb(f"cuff{side}", [tuple(wr + Vector((0, 0, 0.04))), tuple(wr)], [S["arm_r"] * 0.98, S["arm_r"] * 0.98],
                    palette.get("cuff", palette["coat"]), seg=12, steps=1)
        weight_const(cuff, f"forearm.{side}")
        parts.append(cuff)
        hand = sphere(f"hand{side}", 0.045 * S["scale"], tuple(wr + Vector((0, -0.005, -0.055 * S["scale"]))), palette["gloves"], scale=(0.8, 1.0, 1.3), segs=10, rings=8)
        weight_const(hand, f"hand.{side}")
        parts.append(hand)

    # head
    hr = S["head_r"]
    hc = (0, -0.01, nk + hr * 0.95)
    head = sphere("head", hr, hc, palette["skin"], scale=(0.92, 1.0, 1.1), segs=20, rings=14)
    weight_const(head, "head")
    parts.append(head)
    nose = sphere("nose", hr * 0.15, (0, hc[1] - hr * 1.0, hc[2] - hr * 0.12), palette["skin"], scale=(0.8, 1.0, 1.2), segs=8, rings=6)
    weight_const(nose, "head")
    parts.append(nose)
    for sx in (-1, 1):
        eye = sphere(f"eye{sx}", hr * 0.12, (sx * hr * 0.34, hc[1] - hr * 0.9, hc[2] + hr * 0.06), palette["eyes"], scale=(1, 0.5, 1.15), segs=8, rings=6)
        weight_const(eye, "head")
        parts.append(eye)
    if palette.get("hair") is not None:
        hair = sphere("hair", hr * 1.09, (hc[0], hc[1] + 0.012, hc[2] + 0.015), palette["hair"], scale=(0.95, 1.02, 1.08), segs=20, rings=14)
        bm = bmesh.new(); bm.from_mesh(hair.data)
        def keep(co):  # mesh coords are local to the sphere centre
            lz, ly = co.z, co.y
            return lz > hr * 0.32 or (ly > hr * 0.15 and lz > -hr * 0.75) or (ly > -hr * 0.2 and lz > hr * 0.05)
        cut = [v for v in bm.verts if not keep(v.co)]
        bmesh.ops.delete(bm, geom=cut, context="VERTS")
        bm.to_mesh(hair.data); bm.free()
        weight_const(hair, "head")
        parts.append(hair)
    if palette.get("hood") is not None:
        hood = sphere("hood", hr * 1.22, (hc[0], hc[1] + 0.03, hc[2] + 0.01), palette["hood"], scale=(0.98, 1.05, 1.08), segs=20, rings=14)
        bm = bmesh.new(); bm.from_mesh(hood.data)
        cut = [v for v in bm.verts if v.co.y < -hr * 0.55 and v.co.z > -hr * 0.9]
        bmesh.ops.delete(bm, geom=cut, context="VERTS")
        bm.to_mesh(hood.data); bm.free()
        weight_fn(hood, lambda co: {"head": ss(nk - 0.05, nk + 0.08, co.z) + 0.01, "neck": 1 - ss(nk - 0.05, nk + 0.08, co.z)})
        parts.append(hood)
        if palette.get("pompom") is not None:
            pp = sphere("pompom", hr * 0.28, (0, hc[1] + hr * 0.6, hc[2] + hr * 1.15), palette["pompom"], segs=10, rings=8)
            weight_const(pp, "head")
            parts.append(pp)

    # scarf (Adam's red visual signature)
    if S.get("scarf"):
        m = palette["scarf"]
        ring = torus("scarf_ring", 0.085 * S["scale"] + cw * 0.15, 0.04 * S["scale"], (0, -0.005, ch + 0.03), m, major=20, minor=8)
        ring.scale = (1.0, 0.85, 1.25)
        select_only([ring]); bpy.ops.object.transform_apply(scale=True)
        weight_fn(ring, lambda co: {"neck": 0.6, "chest": 0.4})
        parts.append(ring)
        tail = limb("scarf_tail", [(0.05, -cd - 0.03, ch + 0.0), (0.06, -cd - 0.05, ch - 0.16), (0.07, -cd - 0.06, ch - 0.33)],
                    [(0.055, 0.014), (0.055, 0.014), (0.05, 0.012)], m, seg=8, steps=4)
        weight_fn(tail, lambda co: {"scarf": ss(ch + 0.0, ch - 0.12, co.z) + 0.001, "chest": 1 - ss(ch + 0.0, ch - 0.12, co.z)})
        parts.append(tail)
        tail2 = limb("scarf_tail2", [(-0.03, cd + 0.02, ch + 0.0), (-0.05, cd + 0.06, ch - 0.12), (-0.06, cd + 0.08, ch - 0.26)],
                     [(0.05, 0.013), (0.05, 0.013), (0.045, 0.012)], m, seg=8, steps=3)
        weight_const(tail2, "chest")
        parts.append(tail2)

    # backpack
    if S.get("backpack"):
        bp = box("backpack", (cw * 1.5, 0.14, 0.34), (0, cd + 0.08, ch - 0.2), palette["backpack"], bevel=0.04, segments=3)
        flap = box("backpack_flap", (cw * 1.45, 0.05, 0.12), (0, cd + 0.14, ch - 0.07), palette["backpack_dark"], bevel=0.02)
        bp2 = box("backpack_pocket", (cw * 1.0, 0.06, 0.13), (0, cd + 0.17, ch - 0.3), palette["backpack_dark"], bevel=0.02)
        for o in (bp, flap, bp2):
            weight_const(o, "chest")
            parts.append(o)
        for sx in (-1, 1):
            strap = box(f"strap{sx}", (0.035, cd * 2.2, 0.025), (sx * cw * 0.55, -0.0, ch + 0.0), palette["backpack_dark"])
            weight_const(strap, "chest")
            parts.append(strap)

    # extra parts (e.g. Hollow claws)
    for extra in S.get("extras", []):
        o = extra()
        parts.append(o)

    body = join(parts, name + "_body")
    shade_smooth(body, 60)
    mod = body.modifiers.new("arm", "ARMATURE")
    mod.object = arm
    body.parent = arm
    return arm, body


# ---------------------------------------------------------------- animation
class Anim:
    def __init__(self, arm):
        self.arm = arm
        arm.animation_data_create()
        for pb in arm.pose.bones:
            pb.rotation_mode = "XYZ"

    def begin(self, name):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        self.arm.animation_data.action = act
        self.act = act
        for pb in self.arm.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
        return act

    def key(self, frame, poses):
        """poses: {bone: (rx, ry, rz) degrees} or {bone: {"r": (..), "l": (..)}}"""
        for bn, p in poses.items():
            pb = self.arm.pose.bones[bn]
            if isinstance(p, dict):
                r, l = p.get("r"), p.get("l")
            else:
                r, l = p, None
            if r is not None:
                pb.rotation_euler = tuple(math.radians(a) for a in self._fix(bn, r))
                pb.keyframe_insert("rotation_euler", frame=frame)
            if l is not None:
                # authored as world (x, y=back, z=up); hips bone local axes are (X, Z, -Y)
                pb.location = (l[0], l[2], -l[1])
                pb.keyframe_insert("location", frame=frame)

    @staticmethod
    def _fix(bn, r):
        """Poses are authored as: +X = limb swings forward / bends naturally, +Z on arms = outward.
        Convert to the rig's real bone axes (validated with debug_axes)."""
        x, y, z = r
        base = bn.split(".")[0]
        if base in ("thigh", "shin", "foot", "upperarm", "scarf"):
            x = -x
        if base == "upperarm":
            z = -z
        return (x, y, z)

    def end(self):
        ad = self.arm.animation_data
        tr = ad.nla_tracks.new()
        tr.name = self.act.name
        st = tr.strips.new(self.act.name, 1, self.act)
        tr.mute = True
        ad.action = None


def cycle(A, name, length, frames_fn, keys=8):
    """Loop: frames_fn(phase 0..1) -> poses. Last key equals first for seamless looping."""
    A.begin(name)
    for i in range(keys + 1):
        ph = (i % keys) / keys
        A.key(1 + round(i * length * FPS / keys), frames_fn(ph))
    A.end()


def sinp(ph, off=0.0):
    return math.sin(2 * math.pi * (ph + off))


def humanoid_anims(A, style):
    """style: dict with 'stride', 'bob', 'hunch' etc."""
    H = style.get("hunch", 0)
    st = style.get("stride", 1.0)
    bob = style.get("bob", 0.03)

    def base(extra=None):
        p = {"spine": (H * 0.5, 0, 0), "chest": (H * 0.5, 0, 0), "neck": (-H * 0.6, 0, 0)}
        if extra:
            p.update(extra)
        return p

    # Idle: breathing, slight weight shift, arms relaxed
    def idle(ph):
        b = sinp(ph)
        return base({"hips": {"l": (0, 0, 0.004 * b)}, "chest": (H * 0.5 + 1.5 * b, 0, 0), "head": (1.0 * sinp(ph, 0.25), 2 * sinp(ph * 0.5), 0),
                     "upperarm.L": (2 * b, 0, 4), "upperarm.R": (2 * b, 0, -4), "forearm.L": (-8, 0, 0), "forearm.R": (-8, 0, 0),
                     "scarf": (3 * b, 0, 0)})
    cycle(A, "Idle", 3.0, idle, keys=12)

    def gait(ph, speed):
        s = sinp(ph)
        c = math.cos(2 * math.pi * ph)
        sw = (28 if speed == "walk" else 42) * st
        knee = 35 if speed == "walk" else 70
        lean = 4 if speed == "walk" else 12
        armsw = 22 if speed == "walk" else 45
        up = abs(c) if speed == "walk" else abs(s)
        return base({
            "hips": {"l": (0, 0, (bob if speed == "walk" else bob * 1.8) * (up - 0.5)), "r": (0, 6 * s if speed == "walk" else 8 * s, 0)},
            "spine": (H * 0.5 + lean * 0.5, 0, 0), "chest": (H * 0.5 + lean * 0.5, -5 * s, 0),
            "thigh.L": (sw * s, 0, 0), "thigh.R": (-sw * s, 0, 0),
            "shin.L": (-knee * max(0, -c) - 5, 0, 0), "shin.R": (-knee * max(0, c) - 5, 0, 0),
            "foot.L": (12 * max(0, s) - 8 * max(0, -s), 0, 0), "foot.R": (12 * max(0, -s) - 8 * max(0, s), 0, 0),
            "upperarm.L": (-armsw * s, 0, 6), "upperarm.R": (armsw * s, 0, -6),
            "forearm.L": (-15 - (25 if speed == "run" else 8) * (1 + s) / 2, 0, 0), "forearm.R": (-15 - (25 if speed == "run" else 8) * (1 - s) / 2, 0, 0),
            "head": (-lean * 0.4, 3 * s, 0),
            "scarf": (15 + 10 * c if speed == "run" else 6 + 4 * c, 0, 0),
        })
    cycle(A, "Walk", 1.05 / st, lambda ph: gait(ph, "walk"), keys=8)
    cycle(A, "Run", 0.68 / st, lambda ph: gait(ph, "run"), keys=8)

    # Crouch idle + crouch walk (sneaking)
    def crouch(ph, moving):
        s = sinp(ph)
        c = math.cos(2 * math.pi * ph)
        sw = 22 if moving else 0
        return base({
            "hips": {"l": (0, 0, -0.32 + (0.015 * abs(c) if moving else 0.005 * s))},
            "spine": (H * 0.5 + 18, 0, 0), "chest": (H * 0.5 + 12, 0, 0), "neck": (-18, 0, 0), "head": (-8, 0, 0),
            "thigh.L": (55 + sw * s, 0, -4), "thigh.R": (55 - sw * s, 0, 4),
            "shin.L": (-95 - (15 * max(0, -c) if moving else 0), 0, 0), "shin.R": (-95 - (15 * max(0, c) if moving else 0), 0, 0),
            "foot.L": (38, 0, 0), "foot.R": (38, 0, 0),
            "upperarm.L": (25 - (10 * s if moving else 0), 0, 8), "upperarm.R": (25 + (10 * s if moving else 0), 0, -8),
            "forearm.L": (-45, 0, 0), "forearm.R": (-45, 0, 0), "scarf": (25, 0, 0),
        })
    cycle(A, "Crouch", 2.0, lambda ph: crouch(ph, False), keys=4)
    cycle(A, "CrouchWalk", 1.2, lambda ph: crouch(ph, True), keys=8)

    # Jump (rising pose) and Fall (airborne)
    A.begin("Jump")
    A.key(1, base({"hips": {"l": (0, 0, -0.08)}, "thigh.L": (30, 0, 0), "thigh.R": (20, 0, 0), "shin.L": (-50, 0, 0), "shin.R": (-40, 0, 0),
                   "upperarm.L": (-30, 0, 10), "upperarm.R": (-30, 0, -10), "spine": (10, 0, 0)}))
    A.key(8, base({"thigh.L": (45, 0, 0), "thigh.R": (-10, 0, 0), "shin.L": (-70, 0, 0), "shin.R": (-20, 0, 0),
                   "upperarm.L": (60, 0, 25), "upperarm.R": (70, 0, -25), "forearm.L": (-30, 0, 0), "forearm.R": (-30, 0, 0), "scarf": (35, 0, 0)}))
    A.key(14, base({"thigh.L": (40, 0, 0), "thigh.R": (5, 0, 0), "shin.L": (-60, 0, 0), "shin.R": (-35, 0, 0),
                    "upperarm.L": (45, 0, 35), "upperarm.R": (50, 0, -35), "forearm.L": (-25, 0, 0), "forearm.R": (-25, 0, 0), "scarf": (40, 0, 0)}))
    A.end()

    def fall(ph):
        s = sinp(ph)
        return base({"thigh.L": (30 + 6 * s, 0, 0), "thigh.R": (5 - 6 * s, 0, 0), "shin.L": (-55, 0, 0), "shin.R": (-35, 0, 0),
                     "upperarm.L": (40 + 10 * s, 0, 50), "upperarm.R": (40 - 10 * s, 0, -50), "forearm.L": (-20, 0, 0), "forearm.R": (-20, 0, 0),
                     "scarf": (55 + 10 * s, 0, 0), "spine": (6, 0, 0)})
    cycle(A, "Fall", 0.6, fall, keys=4)

    # Push / Pull: leaning into a heavy object, short heavy steps
    def push(ph):
        s = sinp(ph)
        c = math.cos(2 * math.pi * ph)
        return base({
            "hips": {"l": (0, 0.06, -0.1 + 0.01 * abs(c))},
            "spine": (H * 0.5 + 18, 0, 0), "chest": (H * 0.5 + 10, 0, 0), "neck": (-15, 0, 0), "head": (-10, 0, 0),
            "thigh.L": (25 + 22 * s, 0, 0), "thigh.R": (25 - 22 * s, 0, 0),
            "shin.L": (-30 - 25 * max(0, -c), 0, 0), "shin.R": (-30 - 25 * max(0, c), 0, 0),
            "foot.L": (10, 0, 0), "foot.R": (10, 0, 0),
            "upperarm.L": (80, 0, 6), "upperarm.R": (80, 0, -6), "forearm.L": (-25, 0, 0), "forearm.R": (-25, 0, 0),
            "hand.L": (-30, 0, 0), "hand.R": (-30, 0, 0), "scarf": (10, 0, 0),
        })
    cycle(A, "Push", 1.4, push, keys=8)

    # Carry: walking while holding an object in front (upper body override)
    def carry(ph):
        p = gait(ph, "walk")
        p.update({"upperarm.L": (50, 0, 8), "upperarm.R": (50, 0, -8), "forearm.L": (-55, 0, -10), "forearm.R": (-55, 0, 10),
                  "chest": (H * 0.5 - 3, 0, 0)})
        return p
    cycle(A, "CarryWalk", 1.1, carry, keys=8)

    def carry_idle(ph):
        p = idle(ph)
        p.update({"upperarm.L": (50, 0, 8), "upperarm.R": (50, 0, -8), "forearm.L": (-55, 0, -10), "forearm.R": (-55, 0, 10)})
        return p
    cycle(A, "CarryIdle", 3.0, carry_idle, keys=6)

    # Climb (mantle a ledge ~1m): reach, pull up, knee over, stand
    A.begin("Climb")
    A.key(1, base({"upperarm.L": (150, 0, 10), "upperarm.R": (150, 0, -10), "forearm.L": (-10, 0, 0), "forearm.R": (-10, 0, 0),
                   "hips": {"l": (0, 0, -0.6)}, "thigh.L": (10, 0, 0), "thigh.R": (-5, 0, 0), "shin.L": (-10, 0, 0)}))
    A.key(10, base({"upperarm.L": (100, 0, 10), "upperarm.R": (100, 0, -10), "forearm.L": (-70, 0, 0), "forearm.R": (-70, 0, 0),
                    "hips": {"l": (0, 0.05, -0.35)}, "spine": (30, 0, 0), "thigh.L": (70, 0, 0), "shin.L": (-110, 0, 0), "thigh.R": (10, 0, 0)}))
    A.key(18, base({"upperarm.L": (20, 0, 10), "upperarm.R": (20, 0, -10), "forearm.L": (-40, 0, 0), "forearm.R": (-40, 0, 0),
                    "hips": {"l": (0, -0.05, -0.2)}, "spine": (35, 0, 0), "thigh.L": (80, 0, 0), "shin.L": (-120, 0, 0), "thigh.R": (40, 0, 0), "shin.R": (-80, 0, 0)}))
    A.key(26, base({"hips": {"l": (0, 0, 0)}, "spine": (5, 0, 0)}))
    A.end()

    # Interact: reach forward with the right hand
    A.begin("Interact")
    A.key(1, base({}))
    A.key(8, base({"upperarm.R": (75, 0, -5), "forearm.R": (-15, 0, 0), "chest": (H * 0.5 + 6, -8, 0), "head": (-6, 0, 0)}))
    A.key(16, base({"upperarm.R": (70, 0, -5), "forearm.R": (-20, 0, 0), "chest": (H * 0.5 + 6, -8, 0)}))
    A.key(24, base({}))
    A.end()

    # Sit (on a train bench) - looped, slow breathing, head drooping (asleep)
    def sit(ph):
        b = sinp(ph)
        return base({"hips": {"l": (0, 0.08, -0.45)}, "thigh.L": (88, 0, -3), "thigh.R": (88, 0, 3), "shin.L": (-88, 0, 0), "shin.R": (-88, 0, 0),
                     "spine": (-6 + 1.5 * b, 0, 0), "chest": (2, 0, 0), "neck": (28, 0, 8), "head": (12, 8, 0),
                     "upperarm.L": (25, 0, 4), "upperarm.R": (25, 0, -4), "forearm.L": (-55, 0, 0), "forearm.R": (-55, 0, 0)})
    cycle(A, "SitSleep", 4.0, sit, keys=4)

    # WakeUp: from sitting asleep -> startled -> look around -> stand
    A.begin("WakeUp")
    seat = {"hips": {"l": (0, 0.08, -0.45)}, "thigh.L": (88, 0, -3), "thigh.R": (88, 0, 3), "shin.L": (-88, 0, 0), "shin.R": (-88, 0, 0),
            "upperarm.L": (25, 0, 4), "upperarm.R": (25, 0, -4), "forearm.L": (-55, 0, 0), "forearm.R": (-55, 0, 0)}
    def s(extra):
        p = dict(seat); p.update(extra); return base(p)
    A.key(1, s({"spine": (-6, 0, 0), "neck": (28, 0, 8), "head": (12, 8, 0)}))
    A.key(12, s({"spine": (-10, 0, 0), "neck": (-5, 0, 0), "head": (-8, 0, 0)}))           # jolt awake
    A.key(30, s({"spine": (-4, 0, 0), "neck": (0, 0, 0), "head": (0, 45, 0)}))             # look left
    A.key(50, s({"spine": (-4, 0, 0), "neck": (0, 0, 0), "head": (0, -45, 0)}))            # look right
    A.key(62, s({"spine": (20, 0, 0), "upperarm.L": (10, 0, 20), "upperarm.R": (10, 0, -20), "forearm.L": (-20, 0, 0), "forearm.R": (-20, 0, 0)}))
    A.key(78, base({"hips": {"l": (0, 0.0, -0.05)}, "spine": (8, 0, 0), "thigh.L": (10, 0, 0), "thigh.R": (10, 0, 0), "shin.L": (-15, 0, 0), "shin.R": (-15, 0, 0)}))
    A.key(90, base({}))
    A.end()

    # LookBack: glance over the shoulder while standing (scared)
    A.begin("LookBack")
    A.key(1, base({}))
    A.key(10, base({"chest": (H * 0.5, 30, 0), "neck": (0, 25, 0), "head": (0, 35, 0), "upperarm.R": (10, 0, -15)}))
    A.key(30, base({"chest": (H * 0.5, 30, 0), "neck": (0, 25, 0), "head": (0, 35, 0), "upperarm.R": (10, 0, -15)}))
    A.key(40, base({}))
    A.end()

    # Caught: fall to knees
    A.begin("Caught")
    A.key(1, base({}))
    A.key(10, base({"hips": {"l": (0, 0, -0.45)}, "thigh.L": (80, 0, 0), "thigh.R": (80, 0, 0), "shin.L": (-130, 0, 0), "shin.R": (-130, 0, 0),
                    "spine": (25, 0, 0), "neck": (20, 0, 0), "upperarm.L": (30, 0, 30), "upperarm.R": (30, 0, -30)}))
    A.key(24, base({"hips": {"l": (0, 0, -0.5)}, "thigh.L": (85, 0, 0), "thigh.R": (85, 0, 0), "shin.L": (-135, 0, 0), "shin.R": (-135, 0, 0),
                    "spine": (35, 0, 0), "neck": (30, 0, 0), "upperarm.L": (40, 0, 10), "upperarm.R": (40, 0, -10), "forearm.L": (-60, 0, 0), "forearm.R": (-60, 0, 0)}))
    A.end()


def export_character(name, arm):
    bpy.context.scene.render.fps = FPS
    select_only([arm])
    for c in arm.children:
        c.select_set(True)
    export_glb(name, [arm], animations=True,
               extra=dict(export_animation_mode="NLA_TRACKS", export_skins=True, export_morph=False))


def debug_axes(arm):
    """Print where the left foot goes for +X thigh rotation (to validate animation sign conventions)."""
    for b in arm.pose.bones:
        b.rotation_mode = "XYZ"
    pb = arm.pose.bones["thigh.L"]
    before = arm.matrix_world @ arm.pose.bones["shin.L"].tail
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = (math.radians(30), 0, 0)
    bpy.context.view_layer.update()
    after = arm.matrix_world @ arm.pose.bones["shin.L"].tail
    pb.rotation_euler = (0, 0, 0)
    ua = arm.pose.bones["upperarm.L"]
    b2 = arm.matrix_world @ arm.pose.bones["forearm.L"].tail
    ua.rotation_euler = (math.radians(30), 0, 0)
    bpy.context.view_layer.update()
    a2 = arm.matrix_world @ arm.pose.bones["forearm.L"].tail
    ua.rotation_euler = (0, 0, 0)
    sp = arm.pose.bones["spine"]
    b3 = arm.matrix_world @ arm.pose.bones["head"].tail
    sp.rotation_euler = (math.radians(30), 0, 0)
    bpy.context.view_layer.update()
    a3 = arm.matrix_world @ arm.pose.bones["head"].tail
    sp.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    print("AXES thigh+X: dy=%.3f (neg=forward)  arm+X: dy=%.3f  spine+X: dy=%.3f" % (after.y - before.y, a2.y - b2.y, a3.y - b3.y))
