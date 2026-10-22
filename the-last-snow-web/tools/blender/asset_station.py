"""Norville station: platform, track, station building and interactive props.
Every prop is exported as a named top-level node with its origin at its base,
so the game can place/clone it. Blender -Y = toward camera.
"""
import math
from lib import *


def M():
    return dict(
        concrete=mat("Concrete", tex="concrete", rough=0.95),
        stone=mat("Stone_Block", tex="stone", rough=0.9),
        plaster=mat("Plaster", (0.75, 0.72, 0.66), tex="plaster", rough=0.95),
        wood=mat("Wood_Dark", (0.6, 0.55, 0.5), tex="wood", rough=0.8),
        wood_light=mat("Wood_Crate", (1.0, 0.92, 0.8), tex="wood", rough=0.85),
        metal=mat("Iron_Painted", (0.55, 0.6, 0.6), tex="metal", rough=0.6, metal=0.7),
        iron=mat("Iron_Black", (0.04, 0.045, 0.05), rough=0.45, metal=0.8),
        green=mat("Paint_Green", (0.1, 0.2, 0.16), tex="metal", rough=0.55, metal=0.4),
        rail=mat("Rail_Steel", (0.35, 0.33, 0.32), rough=0.35, metal=1.0),
        roof=mat("Roof_Slate", (0.14, 0.15, 0.18), tex="stone", rough=0.7),
        snow=mat("Snow", tex="snow", rough=0.9),
        yellow=mat("Paint_Yellow", (0.75, 0.6, 0.12), rough=0.7),
        glass_dark=mat("Glass_Dark", (0.03, 0.04, 0.06), rough=0.08, metal=0.2),
        glass_warm=mat("Glass_Warm", (1.0, 0.6, 0.25), emission=(1.0, 0.55, 0.2), strength=3.0),
        clock_face=mat("Clock_Face", (0.85, 0.82, 0.72), emission=(0.9, 0.82, 0.62), strength=0.25),
        lamp=mat("Lamp_Warm", (1, 0.8, 0.5), emission=(1.0, 0.7, 0.35), strength=8.0),
        red=mat("Paint_Red", (0.5, 0.05, 0.04), rough=0.5),
        tarp=mat("Tarp", (0.16, 0.18, 0.14), tex="fabric", rough=0.95),
        battery=mat("Battery_Body", (0.08, 0.08, 0.09), rough=0.4),
        led_off=mat("LED_Off", (0.15, 0.03, 0.02), rough=0.3),
        brass=mat("Brass", (0.6, 0.45, 0.2), rough=0.3, metal=1.0),
        ballast=mat("Ballast", (0.3, 0.29, 0.28), tex="concrete", rough=1.0),
    )


def platform(m):
    parts = []
    x0, x1 = -16.0, 42.0
    L = x1 - x0
    cx = (x0 + x1) / 2
    # body: y from -3.0 (front) to 2.4 (track edge)
    parts.append(box("pf_body", (L, 5.4, 1.1), (cx, -0.3, -0.55), m["concrete"], uv_scale=0.5))
    parts.append(box("pf_coping", (L, 0.5, 0.12), (cx, 2.2, 0.0), m["stone"], bevel=0.02))
    parts.append(box("pf_line", (L, 0.12, 0.012), (cx, 1.8, 0.065), m["yellow"]))
    # front retaining wall (camera side), stone
    parts.append(box("pf_front", (L, 0.3, 1.5), (cx, -3.1, -0.45), m["stone"], uv_scale=0.6))
    plat = group("Platform", parts, (0, 0, 0))
    snow = box("pf_snow", (L - 0.4, 5.0, 0.12), (cx, -0.4, 0.02), m["snow"], uv_scale=0.25)
    sub = snow.modifiers.new("sub", "SUBSURF"); sub.levels = 3; sub.subdivision_type = "SIMPLE"
    apply_all(snow)
    displace_noise(snow, 0.07, 0.6)
    for v in snow.data.vertices:  # keep the walking line flatter, drifts at the edges
        if v.co.z > 0.04:
            edge = max(0.0, abs(v.co.y + 0.4) - 1.6)
            v.co.z = 0.05 + (v.co.z - 0.05) * 0.4 + edge * 0.12
    snow = group("PlatformSnow", [snow], (0, 0, 0))
    return [plat, snow]


def track(m):
    parts = []
    y = 4.0
    x0, x1 = -60.0, 13.0
    parts.append(box("ballast", (x1 - x0, 3.6, 0.35), ((x0 + x1) / 2, y, -1.45), m["ballast"], uv_scale=0.5))
    for x in [x0 + 0.3 + i * 0.65 for i in range(int((x1 - x0) / 0.65))]:
        parts.append(box(f"sl{x:.1f}", (0.24, 2.6, 0.14), (x, y, -1.22), m["wood"]))
    for ry in (-0.72, 0.72):
        parts.append(box(f"rail{ry}", (x1 - x0, 0.07, 0.14), ((x0 + x1) / 2, y + ry, -1.09), m["rail"]))
    tr = group("Track", parts, (0, 0, 0))
    snow = box("tr_snow", (x1 - x0, 3.4, 0.2), ((x0 + x1) / 2, y, -1.3), m["snow"], uv_scale=0.3)
    sub = snow.modifiers.new("sub", "SUBSURF"); sub.levels = 3; sub.subdivision_type = "SIMPLE"
    apply_all(snow)
    displace_noise(snow, 0.15, 0.5)
    snow = group("TrackSnow", [snow], (0, 0, 0))
    # buffer stop at the end of the line (terminus)
    bs = []
    bx = 12.4
    bs.append(box("bs_frame", (0.4, 2.2, 0.9), (bx, y, -0.7), m["red"], bevel=0.03))
    bs.append(box("bs_beam", (0.3, 2.6, 0.35), (bx - 0.25, y, -0.45), m["iron"], bevel=0.03))
    for by in (-0.8, 0.8):
        bs.append(cyl(f"bs_buf{by}", 0.16, 0.5, (bx - 0.55, y + by, -0.45), m["rail"], rot=(0, math.pi / 2, 0)))
    bs.append(box("bs_brace", (1.6, 0.15, 0.15), (bx + 0.7, y, -0.9), m["iron"], rot=(0, math.radians(30), 0)))
    stop = group("BufferStop", bs + add_snow(bs, m["snow"], 0.06, 0.02), (bx, y, -1.15))
    return [tr, snow, stop]


def building(m):
    """Station hall: stone ground floor with arched windows, timber gable, steep slate roof."""
    p = []
    x0, x1, y0, y1 = 14.0, 33.0, 0.6, 7.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    W, D, H = x1 - x0, y1 - y0, 4.6
    T = 0.4
    # walls (front wall has windows + door)
    p.append(box("b_plinth", (W + 0.2, D + 0.2, 0.5), (cx, cy, 0.0), m["stone"], bevel=0.03))
    p.append(box("b_back", (W, T, H), (cx, y1 - T / 2, H / 2), m["stone"], uv_scale=0.5))
    for sx in (x0, x1):
        p.append(box(f"b_side{sx}", (T, D, H), (sx + (T / 2 if sx == x0 else -T / 2), cy, H / 2), m["stone"], uv_scale=0.5))
    # front: pillars between bays
    bays = [16.0, 19.5, 23.0, 27.5, 31.0]
    door_x = 23.0
    edges = [x0] + sum([[b - 0.8, b + 0.8] for b in bays], []) + [x1]
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i + 1]
        p.append(box(f"b_pier{i}", (b - a, T, H), ((a + b) / 2, y0 + T / 2, H / 2), m["stone"], uv_scale=0.5))
    for bx in bays:
        is_door = bx == door_x
        top = 2.9 if is_door else 3.2
        bottom = 0.0 if is_door else 1.0
        if not is_door:
            p.append(box(f"b_under{bx}", (1.6, T, bottom), (bx, y0 + T / 2, bottom / 2), m["stone"]))
        p.append(box(f"b_over{bx}", (1.6, T, H - top - 0.3), (bx, y0 + T / 2, (top + 0.3 + H) / 2), m["stone"]))
        # arch voussoir ring (half torus)
        arch = torus(f"b_arch{bx}", 0.8, 0.13, (bx, y0 - 0.02, top - 0.5), m["plaster"], rot=(math.pi / 2, 0, 0), major=20, minor=6)
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(arch.data)
        _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < 0.0], context="VERTS")
        bm.to_mesh(arch.data); bm.free()
        p.append(arch)
        # infill above the arch spring
        p.append(box(f"b_tymp{bx}", (1.6, T * 0.6, 0.8), (bx, y0 + T / 2 + 0.05, top - 0.1), m["stone"]))
        if is_door:
            continue
        p.append(box(f"b_sill{bx}", (1.8, 0.3, 0.1), (bx, y0 - 0.05, bottom), m["plaster"], bevel=0.02))
        lit = bx == 31.0
        p.append(box(f"b_glass{bx}", (1.6, 0.04, top - 0.5 - bottom), (bx, y0 + 0.2, (top - 0.5 + bottom) / 2), m["glass_warm"] if lit else m["glass_dark"]))
        for gx in (-0.4, 0.0, 0.4):
            p.append(box(f"b_bar{bx}{gx}", (0.04, 0.06, top - 0.5 - bottom), (bx + gx, y0 + 0.15, (top - 0.5 + bottom) / 2), m["wood"]))
        p.append(box(f"b_tran{bx}", (1.6, 0.06, 0.04), (bx, y0 + 0.15, bottom + 1.0), m["wood"]))
    # main doors (decorative, locked - boarded)
    p.append(box("b_door", (1.5, 0.12, 2.4), (door_x, y0 + 0.25, 1.2), m["wood"], bevel=0.02))
    for k, a in enumerate((25, -25)):
        p.append(box(f"b_board{k}", (1.9, 0.05, 0.2), (door_x, y0 + 0.15, 1.3 + k * 0.6), m["wood_light"], rot=(0, math.radians(a), 0)))
    # cornice + timber upper band
    p.append(box("b_cornice", (W + 0.5, D + 0.5, 0.25), (cx, cy, H + 0.1), m["plaster"], bevel=0.04))
    p.append(box("b_upper", (W, D, 1.2), (cx, cy, H + 0.8), m["wood"], uv_scale=0.6))
    for k in range(13):
        x = x0 + 0.3 + k * (W - 0.6) / 12
        p.append(box(f"b_beam{k}", (0.15, 0.1, 1.2), (x, y0 - 0.05, H + 0.8), m["iron"]))
    # roof: two slopes along X (ridge parallel to platform)
    rh = 3.2
    ov = 0.6
    verts = [(x0 - ov, y0 - ov, H + 1.4), (x1 + ov, y0 - ov, H + 1.4), (x1 + ov, cy, H + 1.4 + rh), (x0 - ov, cy, H + 1.4 + rh),
             (x0 - ov, y1 + ov, H + 1.4), (x1 + ov, y1 + ov, H + 1.4)]
    roof = from_pydata("b_roof", verts, [(0, 1, 2, 3), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2)], m["roof"])
    sol = roof.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.2; apply_all(roof)
    cube_uv(roof, 0.5)
    p.append(roof)
    # gable wall triangles
    for sx in (x0, x1):
        g = from_pydata(f"b_gable{sx}", [(sx, y0, H + 1.4), (sx, y1, H + 1.4), (sx, cy, H + 1.4 + rh - 0.1)], [(0, 1, 2)], m["wood"])
        sol = g.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.2; apply_all(g)
        p.append(g)
    # chimneys
    for chx in (17.5, 29.5):
        p.append(box(f"b_chim{chx}", (0.8, 0.8, 2.6), (chx, cy + 1.0, H + 1.4 + rh - 0.6), m["stone"], bevel=0.02))
        p.append(box(f"b_chimcap{chx}", (1.0, 1.0, 0.15), (chx, cy + 1.0, H + 1.4 + rh + 0.75), m["plaster"]))
    # canopy over the platform (cast iron posts + glass-less frame), covers bays 16..31
    for px in (15.0, 19.0, 23.0, 27.0, 31.0):
        p.append(cyl(f"c_post{px}", 0.08, 3.6, (px, -1.6, 1.8), m["green"], verts=10))
        p.append(cyl(f"c_cap{px}", 0.14, 0.2, (px, -1.6, 3.55), m["green"], verts=10))
        brace = box(f"c_brace{px}", (0.08, 2.4, 0.08), (px, -0.5, 3.6), m["green"])
        p.append(brace)
    p.append(box("c_beam", (17.0, 0.18, 0.25), (23.0, -1.6, 3.7), m["green"]))
    canopy = box("c_roof", (17.6, 3.0, 0.08), (23.0, -0.2, 4.0), m["roof"], rot=(math.radians(-8), 0, 0))
    p.append(canopy)
    # station name board (English letters as 3D text; Arabic is drawn by the game on a canvas texture)
    p.append(box("sign_board", (4.2, 0.1, 0.8), (door_x, y0 - 0.06, 3.75), m["green"], bevel=0.02))
    p.append(box("sign_frame", (4.4, 0.06, 0.95), (door_x, y0 - 0.0, 3.75), m["brass"]))
    p.append(text_mesh("sign_text", "NORVILLE", 0.5, (door_x, y0 - 0.13, 3.75), m["clock_face"], depth=0.01))
    snow = add_snow([roof, canopy] + [o for o in p if o.name.startswith(("b_sill", "b_cornice", "b_chimcap", "sign_board"))], m["snow"], 0.12, 0.05, 0.3)
    b = group("StationBuilding", p, (0, 0, 0))
    s = group("StationBuildingSnow", snow, (0, 0, 0))
    return [b, s]


def clock_post(m):
    """Victorian platform clock. Hands are separate nodes pivoting at the dial centre."""
    p = []
    p.append(cyl("cp_base", 0.3, 0.4, (0, 0, 0.2), m["green"], verts=12, r2=0.22))
    p.append(cyl("cp_pole", 0.09, 3.0, (0, 0, 1.9), m["green"], verts=12))
    for z in (0.6, 3.2):
        p.append(torus(f"cp_ring{z}", 0.11, 0.03, (0, 0, z), m["brass"], major=12, minor=6))
    p.append(cyl("cp_case", 0.55, 0.36, (0, 0, 3.85), m["green"], verts=32, rot=(math.pi / 2, 0, 0)))
    p.append(torus("cp_bezel", 0.5, 0.04, (0, -0.19, 3.85), m["brass"], rot=(math.pi / 2, 0, 0), major=32, minor=8))
    p.append(torus("cp_bezel2", 0.5, 0.04, (0, 0.19, 3.85), m["brass"], rot=(math.pi / 2, 0, 0), major=32, minor=8))
    p.append(cyl("cp_face", 0.48, 0.38, (0, 0, 3.85), m["clock_face"], verts=32, rot=(math.pi / 2, 0, 0)))
    for k in range(12):
        a = k * math.pi / 6
        ln = 0.09 if k % 3 == 0 else 0.05
        for yy in (-0.195, 0.195):
            t = box(f"cp_tick{k}{yy}", (0.025, 0.01, ln), (math.sin(a) * 0.4, yy, 3.85 + math.cos(a) * 0.4), m["iron"], rot=(0, a, 0))
            p.append(t)
    p.append(sphere("cp_finial", 0.08, (0, 0, 4.48), m["brass"]))
    post = group("ClockPost", p + add_snow(p, m["snow"], 0.05, 0.015, 0.5), (0, 0, 0))
    hands = []
    for nm, ln, w in (("ClockHandHour", 0.27, 0.06), ("ClockHandMinute", 0.4, 0.04)):
        hs = []
        for yy in (-0.21, 0.21):
            hs.append(box(nm + str(yy), (w, 0.01, ln), (0, yy, 3.85 + ln / 2 - 0.04), m["iron"]))
        hands.append(group(nm, hs, (0, 0, 3.85)))
    return [post] + hands


def props(m):
    out = []
    # bench
    p = []
    for sx in (-0.8, 0.8):
        p.append(box(f"bn_leg{sx}", (0.08, 0.5, 0.45), (sx, 0, 0.22), m["iron"], bevel=0.01))
        p.append(box(f"bn_back{sx}", (0.06, 0.06, 0.9), (sx, 0.24, 0.6), m["iron"], rot=(math.radians(-12), 0, 0)))
    for k in range(3):
        p.append(box(f"bn_slat{k}", (1.9, 0.13, 0.04), (0, -0.16 + k * 0.16, 0.46), m["wood"], bevel=0.01))
    for k in range(2):
        p.append(box(f"bn_bslat{k}", (1.9, 0.04, 0.12), (0, 0.27 + k * 0.03, 0.72 + k * 0.2), m["wood"], bevel=0.01, rot=(math.radians(-12), 0, 0)))
    out.append(group("Bench", p + add_snow(p, m["snow"], 0.07, 0.02), (0, 0, 0)))
    # lamp post (gas-style), bulb separate so the game can light it
    p = [cyl("lp_base", 0.18, 0.5, (0, 0, 0.25), m["iron"], verts=10, r2=0.12), cyl("lp_pole", 0.06, 3.2, (0, 0, 2.0), m["iron"], verts=10),
         box("lp_arm", (0.6, 0.05, 0.05), (0.25, 0, 3.55), m["iron"]),
         cyl("lp_cage", 0.18, 0.4, (0.5, 0, 3.3), m["iron"], verts=6, r2=0.24), cyl("lp_hat", 0.28, 0.2, (0.5, 0, 3.6), m["iron"], verts=6, r2=0.05)]
    out.append(group("LampPost", p + add_snow(p, m["snow"], 0.06, 0.01), (0, 0, 0)))
    out.append(group("LampBulb", [sphere("lp_bulb", 0.11, (0.5, 0, 3.3), m["lamp"])], (0, 0, 0)))
    # luggage cart with tarp (battery hidden underneath)
    p = [box("lc_bed", (2.0, 1.0, 0.08), (0, 0, 0.55), m["wood"], bevel=0.01), box("lc_handle", (0.05, 0.9, 0.05), (-1.2, 0, 0.95), m["iron"]),
         box("lc_h1", (0.4, 0.05, 0.05), (-1.05, 0.42, 0.75), m["iron"], rot=(0, math.radians(-50), 0)),
         box("lc_h2", (0.4, 0.05, 0.05), (-1.05, -0.42, 0.75), m["iron"], rot=(0, math.radians(-50), 0))]
    for wx in (-0.7, 0.7):
        for wy in (-0.52, 0.52):
            p.append(cyl(f"lc_w{wx}{wy}", 0.24, 0.06, (wx, wy, 0.26), m["iron"], rot=(math.pi / 2, 0, 0), verts=14))
    p.append(box("lc_case1", (0.7, 0.45, 0.4), (0.5, 0.15, 0.79), m["red"], bevel=0.03))
    p.append(box("lc_case2", (0.55, 0.4, 0.3), (0.45, 0.1, 1.14), m["wood_light"], bevel=0.03))
    tarp = box("lc_tarp", (1.0, 1.05, 0.5), (-0.45, 0, 0.82), m["tarp"], bevel=0.12, segments=3)
    displace_noise(tarp, 0.06, 0.2)
    p.append(tarp)
    out.append(group("LuggageCart", p + add_snow(p, m["snow"], 0.06, 0.02), (0, 0, 0)))
    # crate (1 m, pushable/climbable)
    p = [box("cr_body", (1.0, 1.0, 1.0), (0, 0, 0.5), m["wood_light"], bevel=0.02)]
    for z in (0.08, 0.92):
        p.append(box(f"cr_band{z}", (1.04, 1.04, 0.1), (0, 0, z), m["wood"], bevel=0.01))
    for k in (-1, 1):
        p.append(box(f"cr_diag{k}", (1.25, 1.03, 0.1), (0, 0, 0.5), m["wood"], rot=(0, math.radians(45 * k), 0)))
    out.append(group("Crate", p, (0, 0, 0)))
    out.append(group("CrateSnow", add_snow(p[:1], m["snow"], 0.06, 0.02), (0, 0, 0)))
    # battery (carryable)
    p = [box("bt_body", (0.36, 0.2, 0.24), (0, 0, 0.12), m["battery"], bevel=0.015),
         box("bt_top", (0.37, 0.21, 0.03), (0, 0, 0.245), m["red"]),
         cyl("bt_t1", 0.022, 0.04, (0.12, 0, 0.27), m["brass"], verts=8), cyl("bt_t2", 0.022, 0.04, (-0.12, 0, 0.27), m["brass"], verts=8),
         box("bt_handle", (0.2, 0.025, 0.02), (0, 0, 0.33), m["iron"]), box("bt_hl", (0.02, 0.025, 0.07), (0.09, 0, 0.29), m["iron"]),
         box("bt_hr", (0.02, 0.025, 0.07), (-0.09, 0, 0.29), m["iron"])]
    out.append(group("Battery", p, (0, 0, 0)))
    # generator (on a skid, slot for the battery)
    p = [box("gn_skid", (1.6, 0.9, 0.12), (0, 0, 0.06), m["iron"]),
         box("gn_engine", (0.9, 0.7, 0.65), (-0.25, 0, 0.45), m["green"], bevel=0.04),
         cyl("gn_tank", 0.25, 0.8, (-0.25, 0, 0.98), m["red"], rot=(0, math.pi / 2, 0)),
         cyl("gn_alt", 0.26, 0.5, (0.45, 0, 0.42), m["metal"], rot=(0, math.pi / 2, 0)),
         cyl("gn_exhaust", 0.04, 0.9, (-0.6, 0.25, 1.1), m["iron"], verts=8),
         box("gn_slot", (0.42, 0.3, 0.06), (0.45, -0.1, 0.12 + 0.03), m["iron"]),
         box("gn_panel", (0.3, 0.05, 0.3), (0.45, -0.34, 0.75), m["metal"])]
    for k in range(5):
        p.append(box(f"gn_fin{k}", (0.92, 0.72, 0.02), (-0.25, 0, 0.3 + k * 0.08), m["iron"]))
    out.append(group("Generator", p + add_snow(p, m["snow"], 0.05, 0.02), (0, 0, 0)))
    out.append(group("GeneratorLamp", [sphere("gn_lamp", 0.03, (0.45, -0.37, 0.82), m["led_off"])], (0.45, -0.37, 0.82)))
    # control panel (wall mounted) - lever separate
    p = [box("cp_box", (0.6, 0.18, 0.8), (0, 0.09, 0.4), m["metal"], bevel=0.02),
         box("cp_door", (0.52, 0.03, 0.72), (0, -0.01, 0.4), m["green"], bevel=0.01),
         cyl("cp_conduit", 0.04, 2.2, (0.2, 0.09, -1.1), m["iron"], verts=8),
         box("cp_plate", (0.3, 0.02, 0.08), (0, -0.03, 0.7), m["brass"])]
    out.append(group("ControlPanel", p + add_snow(p, m["snow"], 0.04, 0.01), (0, 0, 0)))
    p = [cyl("lv_hub", 0.05, 0.08, (0, -0.06, 0.0), m["iron"], rot=(math.pi / 2, 0, 0), verts=10),
         cyl("lv_rod", 0.018, 0.28, (0, -0.08, 0.14), m["rail"], verts=8),
         sphere("lv_knob", 0.04, (0, -0.08, 0.29), m["red"])]
    out.append(group("PanelLever", p, (0, -0.06, 0.0)))
    out.append(group("PanelLamp", [sphere("pl_lamp", 0.035, (0, -0.04, 0.0), m["led_off"])], (0, -0.04, 0.0)))
    # iron gate: posts + two leaves (pivot at hinge)
    p = []
    for sx in (-1.6, 1.6):
        p.append(box(f"gt_post{sx}", (0.4, 0.4, 2.8), (sx, 0, 1.4), m["stone"], bevel=0.03))
        p.append(box(f"gt_cap{sx}", (0.5, 0.5, 0.12), (sx, 0, 2.86), m["stone"], bevel=0.02))
        p.append(sphere(f"gt_ball{sx}", 0.14, (sx, 0, 3.05), m["stone"]))
    p.append(box("gt_lock", (0.18, 0.12, 0.3), (0.0, -0.08, 1.15), m["iron"]))
    out.append(group("GatePosts", p + add_snow(p, m["snow"], 0.07, 0.02), (0, 0, 0)))
    for side, sx in (("GateLeafL", -1), ("GateLeafR", 1)):
        lp = [box(side + "_top", (1.4, 0.05, 0.06), (sx * 0.7, 0, 2.3), m["iron"]), box(side + "_bot", (1.4, 0.05, 0.06), (sx * 0.7, 0, 0.15), m["iron"]),
              box(side + "_mid", (1.4, 0.05, 0.05), (sx * 0.7, 0, 1.2), m["iron"])]
        for k in range(8):
            x = sx * (0.08 + k * 0.17)
            lp.append(cyl(f"{side}_bar{k}", 0.016, 2.4, (x, 0, 1.25), m["iron"], verts=6))
            lp.append(cyl(f"{side}_spike{k}", 0.03, 0.12, (x, 0, 2.5), m["iron"], verts=6, r2=0.0))
        out.append(group(side, lp, (sx * 1.4, 0, 0)))
    # boundary wall section (2 m)
    p = [box("wl_body", (2.0, 0.4, 1.6), (0, 0, 0.8), m["stone"], uv_scale=0.6), box("wl_cap", (2.05, 0.5, 0.1), (0, 0, 1.65), m["plaster"])]
    out.append(group("WallSection", p + add_snow(p, m["snow"], 0.1, 0.03), (0, 0, 0)))
    # picket fence section (2 m)
    p = [box("fn_rail1", (2.0, 0.04, 0.08), (0, 0, 0.35), m["wood"]), box("fn_rail2", (2.0, 0.04, 0.08), (0, 0, 0.85), m["wood"])]
    for k in range(9):
        h = 1.05 + 0.05 * math.sin(k * 1.7)
        p.append(box(f"fn_p{k}", (0.09, 0.03, h), (-0.9 + k * 0.225, -0.03, h / 2), m["wood"]))
    out.append(group("Fence", p + add_snow(p, m["snow"], 0.05, 0.01, 0.6), (0, 0, 0)))
    # barrel + bin
    p = [cyl("br_body", 0.3, 0.9, (0, 0, 0.45), m["red"], verts=16)] + [torus(f"br_hoop{z}", 0.305, 0.015, (0, 0, z), m["iron"], major=16, minor=4) for z in (0.12, 0.45, 0.78)]
    out.append(group("Barrel", p + add_snow(p[:1], m["snow"], 0.06, 0.02), (0, 0, 0)))
    # notice board with timetable
    p = [box("nb_board", (1.2, 0.06, 0.8), (0, 0, 1.6), m["wood"], bevel=0.02), box("nb_paper", (0.95, 0.02, 0.6), (0, -0.04, 1.6), m["clock_face"]),
         box("nb_post1", (0.08, 0.08, 2.0), (-0.5, 0.02, 1.0), m["wood"]), box("nb_post2", (0.08, 0.08, 2.0), (0.5, 0.02, 1.0), m["wood"])]
    out.append(group("NoticeBoard", p + add_snow(p, m["snow"], 0.05, 0.01), (0, 0, 0)))
    return out


def build():
    reset(); reset_caches()
    m = M()
    nodes = []
    nodes += platform(m)
    nodes += track(m)
    nodes += building(m)
    nodes += clock_post(m)
    nodes += props(m)
    for n in nodes:
        shade_smooth(n, 35)
    root = place_root(nodes, "Station")
    export_glb("station", [root])


if __name__ == "__main__":
    build()
