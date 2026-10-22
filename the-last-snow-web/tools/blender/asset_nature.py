"""Winter nature set: snowy pines (3 variants + dead pine), rocks, mountain backdrop, drifts."""
import math
import random
from lib import *
import bmesh as _bm


def pine(name, height, tiers, seed, m_bark, m_needles, m_snow, snow_amount=1.0):
    random.seed(seed)
    parts = []
    trunk = cyl(name + "_trunk", 0.12 * height / 8, height * 0.95, (0, 0, height * 0.47), m_bark, verts=8, r2=0.02)
    parts.append(trunk)
    snow_parts = []
    for t in range(tiers):
        f = t / max(1, tiers - 1)
        z0 = height * (0.18 + 0.72 * f)
        r = height * 0.28 * (1.0 - 0.78 * f) * random.uniform(0.9, 1.1)
        h = height * 0.3 * (1.0 - 0.35 * f)
        n = 18
        verts = [(0, 0, z0 + h)]
        for i in range(n * 2):
            a = math.pi * i / n + random.uniform(-0.05, 0.05)
            rr = r * (1.0 if i % 2 == 0 else 0.72) * random.uniform(0.9, 1.08)
            dz = -0.12 * r * (1.0 if i % 2 == 0 else 0.3) + random.uniform(-0.04, 0.04) * r
            verts.append((math.cos(a) * rr, math.sin(a) * rr, z0 + dz))
        inner = len(verts)
        verts.append((0, 0, z0 + h * 0.18))
        faces = [(0, 1 + i, 1 + (i + 1) % (n * 2)) for i in range(n * 2)]
        faces += [(inner, 1 + (i + 1) % (n * 2), 1 + i) for i in range(n * 2)]
        tier = from_pydata(f"{name}_tier{t}", verts, faces, m_needles)
        sub = tier.modifiers.new("sub", "SUBSURF"); sub.levels = 1
        apply_all(tier)
        displace_noise(tier, 0.06 * r, 0.3)
        parts.append(tier)
        # snow: copy tier, keep upward faces near the top, slightly raised
        if snow_amount > 0:
            sc = snow_cap(tier, f"{name}_snow{t}", 0.035 * height / 8 + 0.02, m_snow, up_thresh=0.55 - 0.15 * snow_amount)
            if sc:
                for v in sc.data.vertices:
                    v.co.z += 0.02
                snow_parts.append(sc)
    return parts, snow_parts


def build():
    reset(); reset_caches()
    m_bark = mat("Bark", tex="bark", rough=0.95)
    m_needles = mat("Pine_Needles", tex="needles", rough=0.9)
    m_snow = mat("Snow", tex="snow", rough=0.9)
    m_rock = mat("Rock", (0.6, 0.62, 0.68), tex="stone", rough=0.95)
    m_mount = mat("Mountain_Rock", (0.35, 0.38, 0.45), tex="concrete", rough=1.0)
    m_mount_snow = mat("Mountain_Snow", (0.85, 0.9, 1.0), tex="snow", rough=0.95)
    nodes = []
    for name, h, tiers, seed, amt in (("PineA", 9.0, 6, 1, 1.0), ("PineB", 12.0, 7, 2, 0.8), ("PineC", 6.0, 5, 3, 1.2), ("PineSmall", 3.0, 4, 4, 1.0)):
        parts, snow = pine(name, h, tiers, seed, m_bark, m_needles, m_snow, amt)
        g = group(name, parts + snow, (0, 0, 0))
        shade_smooth(g, 60)
        nodes.append(g)
    # dead pine: bare trunk + a few broken branches
    random.seed(9)
    p = [cyl("dead_trunk", 0.14, 7.0, (0, 0, 3.5), m_bark, verts=8, r2=0.03)]
    for k in range(9):
        z = 1.5 + k * 0.6
        a = random.uniform(0, 6.28)
        ln = 1.2 * (1 - k / 10)
        b = cyl(f"dead_br{k}", 0.03, ln, (math.cos(a) * ln / 2, math.sin(a) * ln / 2, z), m_bark, verts=5, r2=0.005,
                rot=(0, math.radians(100), a))
        p.append(b)
    nodes.append(group("PineDead", p + add_snow(p, m_snow, 0.03, 0.0, 0.6), (0, 0, 0)))
    # rocks
    for k in range(3):
        r = sphere(f"rock{k}", 0.6 + 0.3 * k, (0, 0, 0.2), m_rock, scale=(1.3, 1.0, 0.7), segs=12, rings=8)
        displace_noise(r, 0.25, 0.4)
        nodes.append(group(f"Rock{k}", [r] + add_snow([r], m_snow, 0.08, 0.04, 0.45), (0, 0, 0)))
    # snow drifts (soft mounds)
    for k in range(2):
        d = sphere(f"drift{k}", 1.0, (0, 0, 0), m_snow, scale=(2.2 + k, 1.2, 0.45), segs=20, rings=10)
        displace_noise(d, 0.12, 0.6)
        nodes.append(group(f"Drift{k}", [d], (0, 0, 0)))
    # mountain backdrop: a long jagged ridge (x -160..160), seen far behind
    nx, ny = 160, 14
    verts, faces = [], []
    random.seed(7)
    peaks = [(random.uniform(-160, 160), random.uniform(25, 55), random.uniform(18, 40)) for _ in range(14)]
    for j in range(ny):
        for i in range(nx):
            x = -160 + 320 * i / (nx - 1)
            y = 60 * j / (ny - 1)
            hgt = 0
            for px, ph, pw in peaks:
                hgt = max(hgt, ph * max(0.0, 1 - abs(x - px) / pw) ** 1.4)
            hgt *= min(1.0, y / 25.0 + 0.15) * (1.0 - max(0, y - 40) / 25.0)
            hgt += 3 * math.sin(x * 0.11) * math.sin(y * 0.3) + random.uniform(-1.2, 1.2)
            verts.append((x, y, max(0.0, hgt)))
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    mtn = from_pydata("mountains", verts, faces, m_mount)
    for pgon in mtn.data.polygons:
        pgon.use_smooth = True
    cube_uv(mtn, 0.05)
    snow = snow_cap(mtn, "mountains_snow", 0.4, m_mount_snow, up_thresh=0.62)
    msn = [snow] if snow else []
    # snow is also on everything above the tree line
    nodes.append(group("Mountains", [mtn] + msn, (0, 0, 0)))
    root = place_root(nodes, "Nature")
    export_glb("nature", [root])


if __name__ == "__main__":
    build()
