# Assets — sources, licences and status

Nothing in the current build is final art. Everything below is **prototype** quality and is
listed so it can be replaced deliberately. "Status" says what still has to happen.

## 3D models (GLB)
All current models are authored by script in Blender 5.0 (`tools/blender/*.py`, run with the
`bpy` Python module) and exported as glTF binary. They are original work for this project
(no third-party meshes), so there is no external licence to track.

| File | Contents | How it's made | Status |
|---|---|---|---|
| `adam.glb` | Adam: rigged (19 bones), 16 animation clips (Idle, Walk, Run, Crouch, CrouchWalk, Jump, Fall, Push, CarryIdle, CarryWalk, Climb, Interact, SitSleep, WakeUp, LookBack, Caught) | Lofted-tube body, weighted by script; keyframed animation | Stylised prototype. Final: sculpted character + cloth, mocap or hand-keyed animation |
| `train_car.glb` | Carriage interior + exterior; nodes `FrontWall` (cut-away), `DoorFront`, `Lamp_0..3` | Bevelled modular pieces, snow caps | Blockout+ quality; needs detailed seats, trims, decals |
| `station.glb` | Platform, track, buffer stop, station building, clock (hands at 11:59), bench, lamp post, luggage cart, crate, battery, generator, control panel + lever, gate, walls, fence, barrel, notice board | Same | Prototype; needs real architecture detail and props |
| `nature.glb` | 4 snowy pines, dead pine, rocks, snow drifts, mountain backdrop | Procedural cones / noise terrain | Prototype; final pines should use cards/alpha foliage |

## Textures
Procedural (numpy) 512×512: wood, fabric, snow, stone, plaster, metal, concrete, bark, needles,
coat, knitted scarf, wallpaper. Exported as WebP inside the GLBs. Runtime canvas textures:
snow ground, chalk marks, footprints, glow sprites, Arabic sign text. Original work.

## Fonts
- **Amiri** (Arabic + Latin) — SIL Open Font License 1.1, © The Amiri Project Authors.
  Licence text: `public/fonts/Amiri-OFL.txt`. Source: github.com/aliftype/amiri (release 1.000).

## Audio
All sound is synthesised at runtime with WebAudio (`src/game/Sound.js`): wind, train, brakes,
station chime, footsteps (snow/wood), generator, lever, gate, flashlight, memory sting,
piano theme, the child's distant call. Original work, no files. **Prototype:** the child's call
is a tonal placeholder, not a voice; final game needs recorded VO (AR/EN) and recorded foley.

## Planned final sources (to evaluate; licences must be checked per asset)
- CC0: Poly Haven (HDRIs, PBR textures, some models), ambientCG (PBR textures), Kenney, Quaternius
  (stylised characters/animations), freesound.org CC0 filter (foley).
- Commissioned: Adam, Lina, Elias, Dr. Victor Hale, The Hollow, The Listener (identity-critical).
- These sites were not reachable from the build environment used so far, so none are included yet.

## Engine / libraries
- three.js r170 (MIT) — rendering, glTF loading, post-processing.
- Vite 5 (MIT) — dev server and build. Playwright (Apache-2.0) — automated screenshot tests.
