import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Loads GLB files once and hands out clones of named nodes. */
export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    this.gltfs = {};
  }

  async loadAll(files, onProgress) {
    let done = 0;
    await Promise.all(files.map(async (f) => {
      // GLB by default; the Artifact build uses glTF JSON (see tools/make_artifact.mjs)
      const url = `${import.meta.env.BASE_URL}models/${f}.${import.meta.env.VITE_MODEL_EXT || "glb"}`;
      this.gltfs[f] = await this.loader.loadAsync(url);
      this.gltfs[f].scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) m.map.anisotropy = 4;
            // Snow should read bright & matte under moonlight
            if (/Snow/.test(m.name)) { m.roughness = 0.85; m.envMapIntensity = 0.6; }
          }
        }
      });
      done++;
      if (onProgress) onProgress(done / files.length, f);
    }));
  }

  gltf(file) { return this.gltfs[file]; }

  /** Clone a named top-level node from a file. Skinned meshes are cloned with their skeleton. */
  node(file, name) {
    const src = this.gltfs[file].scene.getObjectByName(name);
    if (!src) throw new Error(`Node ${name} not found in ${file}`);
    let skinned = false;
    src.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
    const c = skinned ? skeletonClone(src) : src.clone(true);
    c.position.set(0, 0, 0);
    return c;
  }

  /** Whole scene of a file (cloned), plus its animation clips. */
  character(file) {
    const g = this.gltfs[file];
    const root = skeletonClone(g.scene);
    return { root, clips: g.animations };
  }
}
