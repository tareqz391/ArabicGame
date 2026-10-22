"""Builds adam.glb, lina.glb, elias.glb, hollow.glb (rigged + animated)."""
import sys
from character import *


def adam():
    reset(); reset_caches()
    P = dict(
        trousers=mat("Adam_Trousers", (0.09, 0.09, 0.11), tex="coat", rough=0.9),
        boots=mat("Adam_Boots", (0.07, 0.045, 0.03), rough=0.6),
        coat=mat("Adam_Coat", tex="coat", rough=0.85),
        coat_trim=mat("Adam_CoatTrim", (0.04, 0.04, 0.05), rough=0.7),
        gloves=mat("Adam_Gloves", (0.12, 0.09, 0.07), rough=0.8),
        skin=mat("Adam_Skin", (0.66, 0.48, 0.4), rough=0.75),
        eyes=mat("Eyes", (0.02, 0.02, 0.03), rough=0.2),
        hair=mat("Adam_Hair", (0.09, 0.06, 0.04), rough=0.7),
        scarf=mat("Adam_Scarf", tex="scarf", rough=0.95),
        backpack=mat("Adam_Backpack", (0.2, 0.23, 0.2), rough=0.9),
        backpack_dark=mat("Adam_BackpackStrap", (0.08, 0.08, 0.07), rough=0.8),
    )
    S = dict(scale=1.0, hip=0.93, chest=1.42, neck=1.52, head=1.78, head_r=0.125, shoulder_w=0.17, arm_len=0.58, arm_r=0.052,
             leg_x=0.095, thigh_r=0.085, chest_w=0.19, chest_d=0.12, coat_bottom=0.5, coat_flare=0.22, scarf=True, backpack=True)
    arm, body = build_humanoid("Adam", S, P)
    debug_axes(arm)
    humanoid_anims(Anim(arm), dict(stride=1.0, bob=0.03))
    export_character("adam", arm)


if __name__ == "__main__":
    which = sys.argv[1:] or ["adam"]
    for w in which:
        globals()[w]()
