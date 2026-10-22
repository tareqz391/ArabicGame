import * as THREE from 'three';
import { Collision } from '../engine/Collision.js';
import { Input } from '../engine/Input.js';
import { Renderer } from '../engine/Renderer.js';
import { Snow } from '../fx/Snow.js';
import { Footprints } from '../fx/Footprints.js';
import { Player } from './Player.js';
import { CameraRig } from './CameraRig.js';
import { Interaction } from './Interact.js';
import { Flags, Save, Settings } from './State.js';
import { t } from './i18n.js';
import { sound } from './Sound.js';

/** Owns the scene, the main loop and the systems shared by every level. */
export class Game {
  constructor(ui, assets, container) {
    this.ui = ui;
    this.assets = assets;
    this.sound = sound;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 400);
    this.renderer = new Renderer(container, Settings.get().quality);
    this.renderer.setup(this.scene, this.camera);
    this.collision = new Collision();
    this.input = new Input(ui);
    this.interaction = new Interaction(this);
    this.cameraRig = new CameraRig(this.camera);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.paused = false;
    // ?dtmax=0.25 lets automated tests on software GL run in near real time
    this.maxDt = +(new URLSearchParams(location.search).get('dtmax') || 0.05);
    this.cutscene = false;
    this.cold = 0;
    this.coldRate = 0;
    this.updaters = [];
    this.clues = [];
    this._setupAtmosphere();
    this.player = new Player(assets, this.scene, this);
    this.cameraRig.target = this.player;
    this.footprints = new Footprints(this.scene);
    this.snow = new Snow(this.scene, { count: 3500, size: [26, 14, 20], flake: 0.055 });
    this.snowNear = new Snow(this.scene, { count: 70, size: [10, 6, 4], flake: 0.09, opacity: 0.35 });
  }

  _setupAtmosphere() {
    const s = this.scene;
    const fogColor = new THREE.Color(0x0c1322);
    s.background = fogColor.clone();
    s.fog = new THREE.FogExp2(fogColor, 0.021);
    this.hemi = new THREE.HemisphereLight(0x6f88c4, 0x1a2030, 1.15);
    s.add(this.hemi);
    // moonlight from behind-left: cold rim light on snow and silhouettes
    const moon = new THREE.DirectionalLight(0xb4caff, 2.1);
    moon.position.set(-12, 20, -10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const sc = moon.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 70;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.04;
    s.add(moon, moon.target);
    this.moon = moon;
    // fill from the camera side so faces read at night
    const fill = new THREE.DirectionalLight(0x7d93cc, 0.6);
    fill.position.set(4, 6, 14);
    s.add(fill);
  }

  addUpdate(fn) { this.updaters.push(fn); }

  /** Hidden clue: a mesh that only shows up inside the flashlight beam. */
  addClue(mesh, onSeen) {
    mesh.material.transparent = true;
    mesh.material.opacity = 0;
    mesh.material.depthWrite = false;
    this.clues.push({ mesh, onSeen, seen: false, k: 0 });
  }

  _updateClues(dt) {
    const p = this.player;
    const origin = new THREE.Vector3(), dir = new THREE.Vector3(), to = new THREE.Vector3();
    p.light.getWorldPosition(origin);
    p.lightTarget.getWorldPosition(dir);
    dir.sub(origin).normalize();
    for (const c of this.clues) {
      let lit = 0;
      if (p.lightOn) {
        c.mesh.getWorldPosition(to);
        to.sub(origin);
        const d = to.length();
        const cos = to.normalize().dot(dir);
        if (d < 12) lit = THREE.MathUtils.smoothstep(cos, Math.cos(Math.PI / 6), Math.cos(Math.PI / 14));
      }
      c.k += (lit - c.k) * Math.min(1, dt * 6);
      c.mesh.material.opacity = c.k;
      if (!c.seen && c.k > 0.6) { c.seen = true; if (c.onSeen) c.onSeen(); }
    }
  }

  checkpoint(id) {
    this.lastCheckpoint = id;
    Save.write(id);
    this.ui.flashSaved();
  }

  /** Respawn = reload from the last save; the level rebuilds itself from flags. */
  async respawn() {
    if (this._respawning) return;
    this._respawning = true;
    this.input.enabled = false;
    await this.ui.fadeTo(1, 1.2);
    sessionStorage.setItem('tls.boot', 'continue');
    location.reload();
  }

  onFellOut() { this.respawn(); }

  setPaused(p) {
    this.paused = p;
    this.ui.show(this.ui.pause, p);
    if (this.sound.ctx) (p ? this.sound.ctx.suspend() : this.sound.ctx.resume());
  }

  start(level) {
    this.level = level;
    this.ui.show(this.ui.hud, true);
    this.clock.start();
    const loop = () => {
      requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  frame() {
    let dt = Math.min(this.clock.getDelta(), this.maxDt);
    const input = this.input;
    input.update();
    if (input.take('pause')) this.setPaused(!this.paused);
    if (this.paused) { input.endFrame(); return; }
    this.time += dt;

    const p = this.player;
    // interaction focus & use
    const focus = !this.cutscene && !p.locked && !p.scripted ? this.interaction.update(p) : null;
    const promptKey = focus ? focus.prompt() : (p.carrying ? 'p.drop' : null);
    this.ui.setActLabel(p.grab ? 'p.release' : promptKey);
    if (input.take('act') && !this.cutscene) {
      if (p.grab) p.endGrab();
      else if (focus) focus.use();
      else if (p.carrying && this.level.dropItem) this.level.dropItem();
    }
    if (input.take('light') && !this.cutscene && !p.locked) p.toggleLight();

    p.update(dt, input);
    this.ui.hud.classList.toggle('cine', this.cutscene);
    if (this.level && this.level.update) this.level.update(dt);
    for (const fn of this.updaters) fn(dt, this.time);
    this._updateClues(dt);
    this._updateCold(dt);

    this.cameraRig.update(dt);
    // world prompt bubble over the focused object (mainly for keyboard players)
    if (focus && promptKey && !input.touchActive) {
      const v = focus.pos.clone(); v.y += focus.height ?? 1.2;
      v.project(this.camera);
      this.ui.showPrompt(`[E] ${t(promptKey)}`, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
    } else this.ui.showPrompt(null);

    // shadows follow the player
    this.moon.target.position.set(p.pos.x + 3, 0, p.pos.z);
    this.moon.position.set(p.pos.x - 12, 20, p.pos.z - 10);

    const focusPt = this.cameraRig.focus || p.pos;
    const pxScale = this.renderer.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.snow.update(this.time, new THREE.Vector3(focusPt.x, focusPt.y + 5, focusPt.z), pxScale);
    const camFwd = new THREE.Vector3();
    this.camera.getWorldDirection(camFwd);
    this.snowNear.update(this.time * 1.1, this.camera.position.clone().addScaledVector(camFwd, 3.2).add(new THREE.Vector3(0, 1.5, 0)), pxScale);
    this.footprints.update(dt);
    this.sound.listenerX = this.camera.position.x;

    this.renderer.render(this.time);
    this.renderer.adapt(dt, Settings.get().fps60 ? 60 : 30);
    input.endFrame();
  }

  _updateCold(dt) {
    const exposed = this.level && this.level.isExposed ? this.level.isExposed(this.player.pos) : 0;
    const warm = this.level && this.level.warmth ? this.level.warmth(this.player.pos) : 0;
    if (this.cutscene) return;
    const rate = exposed * 0.0045 - warm * 0.05 - (exposed ? 0 : 0.03);
    this.cold = THREE.MathUtils.clamp(this.cold + rate * dt, 0, 1);
    this.player.speedMul = 1 - 0.38 * THREE.MathUtils.smoothstep(this.cold, 0.45, 1);
    this.renderer.grade.uniforms.uFrost.value = THREE.MathUtils.smoothstep(this.cold, 0.3, 1);
    if (this.cold > 0.6 && !this._coldWarned) { this._coldWarned = true; this.ui.say('st.cold', { speaker: 'speaker.adam' }); }
    if (this.cold < 0.3) this._coldWarned = false;
    if (this.cold >= 1) this.respawn();
  }

  hasFlag(f) { return Flags.has(f); }
}
