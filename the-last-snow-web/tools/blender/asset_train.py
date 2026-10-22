"""Train carriage: interior + exterior shell. Local origin = floor centre.
Blender axes: X along the car, -Y faces the game camera, Z up.
Named nodes used by the game:
  FrontWall      - camera-side wall, faded out while the player is inside
  DoorFront      - sliding door panel in the front wall (opens toward +X)
  Lamp_0..n      - ceiling lamp bulbs (game adds lights + flicker)
  Interior/Exterior groups
"""
import math
from lib import *

L = 18.0          # length
W = 3.0           # outer width
H = 2.55          # interior height to roof spring
T = 0.08          # wall thickness
WIN_Z = (1.0, 1.85)
WINDOWS = [-7.0, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0]   # window centres along X (back wall)
FRONT_WINDOWS = [-7.0, -5.0, -3.0, -1.0, 1.0, 3.0]
DOOR_X = 6.6      # front door centre
DOOR_W = 1.1


def wall_with_holes(name, y, holes, m_low, m_up, frame_m, door=None):
    """A wall in the XZ plane at depth y with window holes [(x, w)], optional door (x, w)."""
    parts = []
    half = L / 2
    # lower wainscot and upper band are continuous except at the door
    spans = [(-half, half)]
    if door:
        spans = [(-half, door[0] - door[1] / 2), (door[0] + door[1] / 2, half)]
    for i, (a, b) in enumerate(spans):
        parts.append(box(f"{name}_low{i}", (b - a, T, WIN_Z[0]), ((a + b) / 2, y, WIN_Z[0] / 2), m_low))
        parts.append(box(f"{name}_up{i}", (b - a, T, H - WIN_Z[1]), ((a + b) / 2, y, (WIN_Z[1] + H) / 2), m_up))
    # piers between windows
    xs = sorted([h[0] for h in holes])
    edges = [-half]
    for x in xs:
        edges += [x - 0.55, x + 0.55]
    edges.append(half)
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i + 1]
        if door:
            # split piers around the door opening
            da, db = door[0] - door[1] / 2, door[0] + door[1] / 2
            if b > da and a < db:
                if a < da:
                    parts.append(box(f"{name}_pier{i}a", (da - a, T, WIN_Z[1] - WIN_Z[0]), ((a + da) / 2, y, sum(WIN_Z) / 2), m_up))
                if b > db:
                    parts.append(box(f"{name}_pier{i}b", (b - db, T, WIN_Z[1] - WIN_Z[0]), ((db + b) / 2, y, sum(WIN_Z) / 2), m_up))
                continue
        if b - a > 0.01:
            parts.append(box(f"{name}_pier{i}", (b - a, T, WIN_Z[1] - WIN_Z[0]), ((a + b) / 2, y, sum(WIN_Z) / 2), m_up))
    # window frames
    for x in xs:
        parts.append(box(f"{name}_sill{x}", (1.2, 0.16, 0.06), (x, y, WIN_Z[0]), frame_m, bevel=0.01))
        parts.append(box(f"{name}_head{x}", (1.2, 0.12, 0.05), (x, y, WIN_Z[1]), frame_m))
        for sx in (-0.57, 0.57):
            parts.append(box(f"{name}_jamb{x}{sx}", (0.05, 0.12, WIN_Z[1] - WIN_Z[0]), (x + sx, y, sum(WIN_Z) / 2), frame_m))
        parts.append(box(f"{name}_mull{x}", (0.03, 0.1, WIN_Z[1] - WIN_Z[0]), (x, y, sum(WIN_Z) / 2), frame_m))
    if door:
        dx, dw = door
        parts.append(box(f"{name}_doorhead", (dw + 0.1, 0.14, 0.08), (dx, y, 2.12), frame_m))
        parts.append(box(f"{name}_doorup", (dw, T, H - 2.16), (dx, y, (2.16 + H) / 2), m_up))
        for sx in (-dw / 2, dw / 2):
            parts.append(box(f"{name}_doorjamb{sx}", (0.06, 0.14, 2.16), (dx + sx, y, 1.08), frame_m))
    return parts


def seat(name, x, y, facing, fabric, wood, metal):
    """Double bench; facing=+1 means the sitter looks toward +X."""
    p = []
    p.append(box(name + "_base", (0.55, 1.0, 0.12), (x, y, 0.45), fabric, bevel=0.04, segments=3))
    p.append(box(name + "_frame", (0.5, 0.95, 0.38), (x, y, 0.2), wood, bevel=0.01))
    back = box(name + "_back", (0.12, 1.0, 0.72), (x - 0.27 * facing, y, 0.86), fabric, bevel=0.04, segments=3)
    back.rotation_euler = (0, math.radians(-8 * facing), 0)
    p.append(back)
    p.append(box(name + "_backwood", (0.06, 1.02, 0.78), (x - 0.34 * facing, y, 0.86), wood, bevel=0.01))
    p.append(box(name + "_head", (0.16, 1.0, 0.1), (x - 0.31 * facing, y, 1.26), fabric, bevel=0.04, segments=3))
    p.append(cyl(name + "_arm", 0.03, 0.5, (x, y - 0.5 * (1 if y < 0 else -1), 0.66), metal, rot=(0, math.pi / 2, 0)))
    return p


def build():
    reset(); reset_caches()
    m_wood = mat("Wood_Panel", tex="wood", rough=0.55)
    m_floor = mat("Wood_Floor", (0.55, 0.5, 0.45), tex="wood", rough=0.7)
    m_carpet = mat("Carpet_Red", (0.22, 0.04, 0.04), tex="fabric", rough=0.95)
    m_wall = mat("Wall_Cream", (0.62, 0.58, 0.48), tex="plaster", rough=0.9)
    m_fabric = mat("Seat_Velvet", tex="fabric", rough=0.95)
    m_frame = mat("Brass_Frame", (0.45, 0.33, 0.16), rough=0.35, metal=0.9)
    m_metal = mat("Chrome_Rail", (0.6, 0.62, 0.65), rough=0.3, metal=1.0)
    m_glass = mat("Window_Frost", (0.45, 0.58, 0.75), rough=0.15, emission=(0.35, 0.5, 0.75), strength=0.6)
    m_lamp = mat("Lamp_Bulb", (1, 0.95, 0.85), emission=(1.0, 0.9, 0.7), strength=6.0)
    m_body = mat("Body_Paint", (0.16, 0.05, 0.05), tex="metal", rough=0.45, metal=0.5)
    m_under = mat("Undercarriage", (0.05, 0.05, 0.06), rough=0.8, metal=0.6)
    m_roof = mat("Roof_Metal", (0.2, 0.21, 0.23), tex="metal", rough=0.6, metal=0.6)
    m_snow = mat("Snow", tex="snow", rough=0.9)
    m_ceiling = mat("Ceiling", (0.7, 0.68, 0.6), tex="plaster", rough=0.9)

    interior, front, exterior = [], [], []
    yb, yf = W / 2 - T / 2, -W / 2 + T / 2

    # floor + carpet runner
    interior.append(box("floor", (L, W - 0.1, 0.1), (0, 0, -0.05), m_floor, uv_scale=0.5))
    interior.append(box("carpet", (L - 0.6, 0.85, 0.012), (0, 0, 0.006), m_carpet))
    # back wall (with windows)
    interior += wall_with_holes("back", yb, [(x, 1.1) for x in WINDOWS], m_wood, m_wall, m_frame)
    for x in WINDOWS:
        interior.append(box(f"glass_b{x}", (1.1, 0.02, WIN_Z[1] - WIN_Z[0]), (x, yb + 0.02, sum(WIN_Z) / 2), m_glass))
    # front wall (camera side) - separate node
    front += wall_with_holes("front", yf, [(x, 1.1) for x in FRONT_WINDOWS], m_wood, m_wall, m_frame, door=(DOOR_X, DOOR_W))
    for x in FRONT_WINDOWS:
        front.append(box(f"glass_f{x}", (1.1, 0.02, WIN_Z[1] - WIN_Z[0]), (x, yf - 0.02, sum(WIN_Z) / 2), m_glass))
    # end walls with frames
    for sx in (-1, 1):
        x = sx * (L / 2 - T / 2)
        interior.append(box(f"end{sx}_l", (T, 0.95, H), (x, -0.98, H / 2), m_wood))
        interior.append(box(f"end{sx}_r", (T, 0.95, H), (x, 0.98, H / 2), m_wood))
        interior.append(box(f"end{sx}_top", (T, 1.1, H - 2.1), (x, 0, (H + 2.1) / 2), m_wood))
        interior.append(box(f"end{sx}_door", (0.05, 1.0, 2.05), (x - sx * 0.02, 0, 1.03), m_wood, bevel=0.01))
        interior.append(box(f"end{sx}_doorwin", (0.06, 0.5, 0.6), (x - sx * 0.03, 0, 1.5), m_glass))
    # arched ceiling: half-cylinder strip
    arch = cyl("ceiling", W / 2 - 0.02, L - 0.02, (0, 0, H - 0.6), m_ceiling, verts=32, rot=(0, math.pi / 2, 0), cap=False)
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(arch.data)
    _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > 0.05], context="VERTS")  # local X = world Z after rot
    bm.to_mesh(arch.data); bm.free()
    for p in arch.data.polygons:
        p.use_smooth = True
    select_only([arch]); bpy.ops.object.flip_normals() if False else None
    interior.append(arch)
    # ceiling ribs
    for i in range(-8, 9, 2):
        r = torus(f"rib{i}", W / 2 - 0.05, 0.025, (i, 0, H - 0.6), m_frame, rot=(0, math.pi / 2, 0), major=32, minor=6)
        bm = _bm.new(); bm.from_mesh(r.data)
        _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > 0.05], context="VERTS")
        bm.to_mesh(r.data); bm.free()
        interior.append(r)
    # lamps
    lamps = []
    for i, x in enumerate([-6.0, -2.0, 2.0, 6.0]):
        base = cyl(f"lampbase{i}", 0.16, 0.05, (x, 0, H + 0.33), m_frame)
        bulb = sphere(f"Lamp_{i}", 0.13, (x, 0, H + 0.24), m_lamp, scale=(1, 1, 0.6))
        interior.append(base)
        lamps.append(bulb)
    # luggage racks over both seat rows
    for y in (0.95, -0.95):
        for x0 in (-6.0, 0.0):
            interior.append(cyl(f"rack{y}{x0}a", 0.018, 5.6, (x0 + 2.0, y, 1.98), m_metal, rot=(0, math.pi / 2, 0), verts=8))
            interior.append(cyl(f"rack{y}{x0}b", 0.018, 5.6, (x0 + 2.0, y + 0.22 * (1 if y > 0 else -1), 2.02), m_metal, rot=(0, math.pi / 2, 0), verts=8))
    # seats: back row (y>0) and front row (y<0), facing pairs
    for i, x in enumerate([-7.6, -6.4, -5.6, -4.4, -3.6, -2.4, -1.6, -0.4, 0.4, 1.6, 2.4, 3.6, 4.4, 5.6]):
        facing = 1 if i % 2 == 0 else -1
        interior += seat(f"seatB{i}", x, 0.88, facing, m_fabric, m_wood, m_metal)
        if x < DOOR_X - 1.2:
            front += seat(f"seatF{i}", x, -0.88, facing, m_fabric, m_wood, m_metal)
    # small tables at the windows
    for x in WINDOWS:
        interior.append(box(f"table{x}", (0.5, 0.35, 0.04), (x, 1.25, 0.75), m_wood, bevel=0.01))

    # --- exterior shell
    exterior.append(box("body_back", (L + 0.1, 0.06, H + 0.4), (0, W / 2 + 0.02, (H + 0.4) / 2 - 0.35), m_body))
    exterior.append(box("skirt", (L, W + 0.06, 0.35), (0, 0, -0.27), m_body, bevel=0.03))
    roof = cyl("roof", W / 2 + 0.06, L + 0.3, (0, 0, H - 0.55), m_roof, verts=32, rot=(0, math.pi / 2, 0))
    bm = _bm.new(); bm.from_mesh(roof.data)
    _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > -0.25], context="VERTS")
    bm.to_mesh(roof.data); bm.free()
    exterior.append(roof)
    sc = snow_cap(roof, "roof_snow", 0.07, m_snow, up_thresh=0.25)
    if sc:
        displace_noise(sc, 0.04, 0.3)
        exterior.append(sc)
    # bogies + wheels
    for bx in (-6.2, 6.2):
        exterior.append(box(f"bogie{bx}", (2.6, 2.2, 0.35), (bx, 0, -0.62), m_under, bevel=0.03))
        for wx in (-0.8, 0.8):
            for wy in (-1.0, 1.0):
                exterior.append(cyl(f"wheel{bx}{wx}{wy}", 0.38, 0.1, (bx + wx, wy, -0.72), m_under, verts=20, rot=(math.pi / 2, 0, 0)))
    exterior.append(box("underframe", (L - 2, 2.4, 0.22), (0, 0, -0.5), m_under))
    # buffers and gangway
    for sx in (-1, 1):
        exterior.append(box(f"gangway{sx}", (0.35, 1.3, 2.3), (sx * (L / 2 + 0.17), 0, 1.0), m_under, bevel=0.05))
        for by in (-0.8, 0.8):
            exterior.append(cyl(f"buffer{sx}{by}", 0.16, 0.4, (sx * (L / 2 + 0.2), by, -0.3), m_metal, rot=(0, math.pi / 2, 0)))
    # front wall exterior skin, with the door hole
    front.append(box("skin_front_low_a", (DOOR_X - DOOR_W / 2 + L / 2, 0.04, 1.0), ((-L / 2 + DOOR_X - DOOR_W / 2) / 2, -W / 2 - 0.01, 0.1), m_body))
    front.append(box("skin_front_low_b", (L / 2 - DOOR_X - DOOR_W / 2, 0.04, 1.0), ((L / 2 + DOOR_X + DOOR_W / 2) / 2, -W / 2 - 0.01, 0.1), m_body))
    # door step
    exterior.append(box("doorstep", (DOOR_W, 0.35, 0.05), (DOOR_X, -W / 2 - 0.18, -0.2), m_metal))

    door = box("DoorFront", (DOOR_W - 0.04, 0.05, 2.1), (DOOR_X, -W / 2 + 0.02, 1.05), m_body, bevel=0.02)
    dwin = box("DoorFront_win", (0.5, 0.06, 0.7), (DOOR_X, -W / 2 + 0.02, 1.45), m_glass)
    door = join([door, dwin], "DoorFront")

    gi = join(interior, "Interior")
    gf = join(front, "FrontWall")
    ge = join(exterior, "Exterior")
    for o in (gi, gf, ge):
        shade_smooth(o, 35)
    root = bpy.data.objects.new("TrainCar", None)
    link(root)
    for o in [gi, gf, ge, door] + lamps:
        o.parent = root
    export_glb("train_car", [root])


if __name__ == "__main__":
    build()
