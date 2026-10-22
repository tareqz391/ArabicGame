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
      this.gltfs[f] = url.endsWith('.json') ? await this._loadJson(url) : await this.loader.loadAsync(url);
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

  /**
   * glTF JSON with an embedded base64 buffer. Sandboxed hosts (claude.ai Artifacts) block
   * fetch() of data: URIs, so decode the buffer here and hand GLTFLoader an in-memory GLB.
   */
  async _loadJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    const json = await res.json();
    const uri = json.buffers[0].uri;
    const b64 = uri.slice(uri.indexOf(',') + 1);
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    delete json.buffers[0].uri;
    json.buffers[0].byteLength = bin.length;
    const enc = new TextEncoder().encode(JSON.stringify(json));
    const jsonLen = Math.ceil(enc.length / 4) * 4;
    const binLen = Math.ceil(bin.length / 4) * 4;
    const glb = new ArrayBuffer(12 + 8 + jsonLen + 8 + binLen);
    const dv = new DataView(glb);
    const u8 = new Uint8Array(glb);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.byteLength, true);
    dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
    u8.set(enc, 20); u8.fill(0x20, 20 + enc.length, 20 + jsonLen);
    const o = 20 + jsonLen;
    dv.setUint32(o, binLen, true); dv.setUint32(o + 4, 0x004e4942, true);
    u8.set(bin, o + 8);
    const basePath = url.slice(0, url.lastIndexOf('/') + 1);
    return this.loader.parseAsync(glb, basePath);
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
