import * as THREE from 'three';
import { Flags } from '../game/State.js';
import { Pushable } from '../game/Interact.js';
import { LightPool } from '../fx/LightPool.js';
import { snowGroundTexture, textTexture, chalkTexture, glowTexture } from '../fx/Textures.js';

const CAR_Z = -4.0;
const CAR_Y = 0.1;
const DOOR_X = 6.6;
const SEAT = { x: 0.62, z: -4.86 };
const GATE = { x: 37.4, z: -3.0 };
const PANEL = { x: 26.5, y: 2.0, z: -0.6 };
const GEN = { x: 30.4, z: 0.05 };
const CART = { x: -12.5, z: -0.9 };
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Chapter 1, scene 1: the last train and Norville station.
 * Layout (three.js): X = along the platform, Z+ = toward the camera, Y up.
 */
export class StationLevel {
  constructor(game) {
    this.game = game;
    this.A = game.assets;
    this.scene = game.scene;
    this.lights = new LightPool(this.scene, 6);
    this.trainMoving = false;
    this._build();
  }

  // ------------------------------------------------------------------ build
  _node(file, name, x = 0, y = 0, z = 0, ry = 0, s = 1) {
    const n = this.A.node(file, name);
    n.position.set(x, y, z);
    n.rotation.y = ry;
    n.scale.setScalar(s);
    this.scene.add(n);
    return n;
  }

  _build() {
    const g = this.game, col = g.collision;
    // ground (track level) and raised road beyond the gate
    const snowTex = snowGroundTexture();
    snowTex.repeat.set(60, 30);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xdfe7f5, map: snowTex, roughness: 0.92 });
    const gGeo = new THREE.PlaneGeometry(240, 120, 120, 60).rotateX(-Math.PI / 2);
    const pa = gGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const hills = Math.max(0, -z - 30) * 0.12 + Math.max(0, z - 12) * 0.25;
      pa.setY(i, Math.sin(x * 0.13) * Math.cos(z * 0.21) * 0.35 + Math.sin(x * 0.041 + z * 0.07) * 0.6 + hills);
    }
    gGeo.computeVertexNormals();
    const ground = new THREE.Mesh(gGeo, groundMat);
    ground.position.set(20, -1.25, -20);
    ground.receiveShadow = true;
    this.scene.add(ground);
    const roadMat = groundMat.clone();
    roadMat.map = snowTex.clone(); roadMat.map.repeat.set(8, 14); roadMat.map.needsUpdate = true;
    const road = new THREE.Mesh(new THREE.BoxGeometry(16, 1.3, 46, 16, 1, 40), roadMat);
    const ra = road.geometry.attributes.position;
    for (let i = 0; i < ra.count; i++) if (ra.getY(i) > 0) ra.setY(i, ra.getY(i) + Math.max(0, Math.abs(ra.getX(i)) - 3) * 0.08 * Math.random());
    road.geometry.computeVertexNormals();
    road.position.set(41, -0.65, -25.4);
    road.receiveShadow = true;
    this.scene.add(road);

    // station + track (authored in world space)
    for (const n of ['Platform', 'PlatformSnow', 'Track', 'TrackSnow', 'StationBuilding', 'StationBuildingSnow']) this._node('station', n);
    this._node('station', 'BufferStop', 12.4, -1.15, CAR_Z);
    // Arabic station name under the English sign
    const arSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), new THREE.MeshStandardMaterial({
      map: textTexture('نورفيل', { size: 130, color: '#efe2c4' }), transparent: true, emissive: 0xffe2b0, emissiveIntensity: 0.15, roughness: 0.6 }));
    arSign.position.set(23, 3.12, -0.47);
    this.scene.add(arSign);

    // the train
    this.car = this._node('train_car', 'TrainCar', 0, CAR_Y, CAR_Z);
    this.frontWall = this.car.getObjectByName('FrontWall');
    this.door = this.car.getObjectByName('DoorFront');
    this.doorClosedX = this.door.position.x;
    this._fadeable(this.frontWall);
    this._fadeable(this.door);
    this.trainLights = [];
    for (let i = 0; i < 4; i++) {
      const b = this.car.getObjectByName(`Lamp_${i}`);
      const wp = new THREE.Vector3(); b.getWorldPosition(wp);
      const bulbMat = b.material.clone(); b.material = bulbMat;
      this.trainLights.push(this.lights.add({ pos: wp.add(new THREE.Vector3(0, -0.2, 0)), color: 0xffd8a0, intensity: 7, distance: 7.5, flicker: 0.6,
        onUpdate: (k) => { bulbMat.emissiveIntensity = 0.2 + 5 * k; } }));
    }
    // light passing the windows while the train is moving
    this.passing = new THREE.PointLight(0xc8d8ff, 0, 9, 1.5);
    this.passing.position.set(10, 1.6, CAR_Z - 2.2);
    this.scene.add(this.passing);

    // clock (stopped at 11:59)
    const clock = { x: 10.6, z: 0.9 };
    this._node('station', 'ClockPost', clock.x, 0, clock.z);
    const hourHand = this._node('station', 'ClockHandHour', clock.x, 3.85, clock.z);
    const minHand = this._node('station', 'ClockHandMinute', clock.x, 3.85, clock.z);
    hourHand.rotation.z = THREE.MathUtils.degToRad(0.5);
    minHand.rotation.z = THREE.MathUtils.degToRad(6);
    col.addCentered(clock.x, 0, clock.z, 0.5, 4.5, 0.5);
    this.clockLight = this.lights.add({ pos: new THREE.Vector3(clock.x, 3.9, clock.z + 0.8), color: 0xfff0d0, intensity: 1.4, distance: 4, on: true, flicker: 0.1 });

    // platform furniture
    const benches = [[-6.2, 1.5], [1.8, 1.5]];
    for (const [x, z] of benches) { this._node('station', 'Bench', x, 0, z); col.addCentered(x, 0, z, 1.9, 0.47, 0.6, { surface: 'wood' }); }
    this.lamps = [];
    for (const [x, z, on, flick] of [[-12, 2.5, false, 0], [-3, 2.5, true, 0.9], [6.0, 2.5, false, 0], [34.5, 1.8, false, 0], [40.4, -2.2, false, 0]]) {
      this._node('station', 'LampPost', x, 0, z);
      const bulb = this._node('station', 'LampBulb', x, 0, z);
      bulb.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
      const bm = []; bulb.traverse((o) => { if (o.isMesh) bm.push(o.material); });
      const v = this.lights.add({ pos: new THREE.Vector3(x + 0.5, 3.1, z), color: 0xffa860, intensity: 6, distance: 11, on, flicker: flick,
        onUpdate: (k) => bm.forEach((m) => { m.emissiveIntensity = 0.05 + 8 * k; }) });
      this.lamps.push(v);
      col.addCentered(x, 0, z, 0.3, 3.5, 0.3);
    }
    // canopy posts + lights
    for (const px of [15, 19, 23, 27, 31]) col.addCentered(px, 0, 1.6, 0.2, 3.6, 0.2);
    this.canopyLights = [17, 23, 29].map((x) => this.lights.add({ pos: new THREE.Vector3(x, 3.5, 0.6), color: 0xffc890, intensity: 5, distance: 10, on: false }));
    // warm window of the station master's office
    this.lights.add({ pos: new THREE.Vector3(31, 2.0, 0.4), color: 0xff9a4a, intensity: 2.6, distance: 6, flicker: 0.15 });

    this._node('station', 'NoticeBoard', 12.2, 0, -1.6);
    col.addCentered(12.2, 0, -1.6, 1.2, 2.2, 0.2);
    this._node('station', 'Barrel', 32.5, 0, 0.3);
    col.addCentered(32.5, 0, 0.3, 0.6, 0.9, 0.6);
    this._node('station', 'Barrel', -14.8, 0, -1.6, 0.7);
    col.addCentered(-14.8, 0, -1.6, 0.6, 0.9, 0.6);
    this._node('station', 'LuggageCart', CART.x, 0, CART.z);
    col.addCentered(CART.x, 0, CART.z, 2.3, 1.2, 1.1);
    // a few broken fence sections along the front edge (kept sparse so the stage stays readable)
    for (const [x, r] of [[-15, 0], [-13, 0.08], [35, 0.1], [41, 0]]) this._node('station', 'Fence', x, 0, 3.15, r);

    // gate + boundary walls (the road to the village lies behind it)
    this._node('station', 'GatePosts', GATE.x, 0, GATE.z);
    this.leafL = this._node('station', 'GateLeafL', GATE.x - 1.4, 0, GATE.z);
    this.leafR = this._node('station', 'GateLeafR', GATE.x + 1.4, 0, GATE.z);
    for (const x of [34.0, 40.8, 42.8]) this._node('station', 'WallSection', x, 0, GATE.z);
    for (const z of [-1.0, 1.0]) this._node('station', 'WallSection', 43.6, 0, z, Math.PI / 2);

    // generator, battery, crate, control panel
    this._node('station', 'Generator', GEN.x, 0, GEN.z);
    col.addCentered(GEN.x, 0, GEN.z, 1.6, 1.2, 0.9);
    const genLamp = this._node('station', 'GeneratorLamp', GEN.x + 0.45, 0.82, GEN.z + 0.37);
    genLamp.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); this.genLampMat = o.material; } });
    this._node('station', 'ControlPanel', PANEL.x, PANEL.y, PANEL.z + 0.18);
    this.lever = this._node('station', 'PanelLever', PANEL.x, PANEL.y + 0.45, PANEL.z + 0.2);
    const pLamp = this._node('station', 'PanelLamp', PANEL.x + 0.18, PANEL.y + 0.68, PANEL.z + 0.2);
    pLamp.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); this.panelLampMat = o.material; } });
    this.panelGlow = this.lights.add({ pos: new THREE.Vector3(PANEL.x, PANEL.y + 0.6, PANEL.z + 0.7), color: 0xffa040, intensity: 1.6, distance: 3.5, on: false, flicker: 0.2 });
    this.genGlow = this.lights.add({ pos: new THREE.Vector3(GEN.x + 0.4, 1.2, GEN.z + 0.9), color: 0x9cffb0, intensity: 1.2, distance: 3, on: false });
    this.battery = this._node('station', 'Battery');
    const crateMesh = this._node('station', 'Crate');
    const crateSnow = this.A.node('station', 'CrateSnow');
    crateMesh.add(crateSnow);
    this.crate = new Pushable(g, crateMesh, 19.6, 0, -0.08, { x: 1, y: 1, z: 1 });

    // chalk arrow, visible only in the flashlight beam
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chalkTexture(), transparent: true }));
    chalk.position.set(-7.5, 0.075, 0.2);
    this.scene.add(chalk);
    g.addClue(chalk, () => { if (!Flags.has('clue.chalk')) { Flags.set('clue.chalk'); g.ui.say('st.chalk', { speaker: 'speaker.adam' }); } });
    const chalk2 = chalk.clone(); chalk2.material = chalk.material.clone();
    chalk2.position.set(-10.6, 0.075, -0.4); chalk2.scale.setScalar(0.7);
    this.scene.add(chalk2);
    g.addClue(chalk2);

    // nature: background forest, foreground silhouettes, mountains, drifts
    this._scatterForest();
    const mtn = this._node('nature', 'Mountains', 10, -3, -78);
    mtn.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    for (const [n, x, z, s, r] of [['Drift0', -14, 4.8, 1, 0], ['Drift1', 8, 5.5, 1.3, 0.4], ['Drift0', 26, 6.0, 1.1, 2], ['Drift1', 46, -6, 1.4, 1], ['Rock1', 31, 5.2, 1, 0.5], ['Rock2', -24, -9, 1.6, 2]]) {
      this._node('nature', n, x, -1.15, z, r, s);
    }
    // the village far away beyond the gate: warm points in the dark
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa050, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    for (const [x, y, z, s] of [[44, 4, -58, 4], [39, 3.4, -62, 2.6], [51, 5, -66, 3], [33, 6, -70, 2], [47, 2.8, -54, 1.8]]) {
      const sp = new THREE.Sprite(glowMat); sp.position.set(x, y, z); sp.scale.setScalar(s); this.scene.add(sp);
    }

    this._colliders();
    this._interactables();
    this._cameraZones();
    this._restoreFromFlags();
    g.addUpdate((dt, t) => this.lights.update(dt, g.player.pos, t));
  }

  _scatterForest() {
    const rng = (() => { let s = 1234; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const types = ['PineA', 'PineB', 'PineC', 'PineSmall'];
    const place = {};
    const add = (type, x, y, z, s, r) => { (place[type] = place[type] || []).push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r, 0)), new THREE.Vector3(s, s, s))); };
    // behind the track
    for (let i = 0; i < 70; i++) {
      const x = -70 + rng() * 150, z = -9 - rng() * 38;
      if (x > 13 && x < 34 && z > -12) continue;
      if (x > 34 && x < 49 && z > -50) continue; // keep the road clear
      add(types[Math.floor(rng() * 3)], x, -1.2 + Math.max(0, -z - 30) * 0.1, z, 0.8 + rng() * 0.6, rng() * 6.28);
    }
    // along the road
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      add(types[Math.floor(rng() * 3)], 41 + side * (9 + rng() * 6), -1.2, -8 - rng() * 45, 0.8 + rng() * 0.5, rng() * 6.28);
    }
    // foreground silhouettes (frame the shot, Little-Nightmares style): tall pines only outside the
    // play range, small ones low in frame so they never hide Adam for long
    for (const [x, z, s] of [[-22, 6.5, 1.1], [49, 7.0, 1.2], [-27, 9, 1.4]]) add('PineA', x, -1.2, z, s, rng() * 6);
    for (let i = 0; i < 18; i++) add('PineSmall', -26 + rng() * 76, -1.2, 4.6 + rng() * 2.6, 0.55 + rng() * 0.45, rng() * 6);
    this._node('nature', 'PineDead', -17.5, -1.2, -6.5, 0.3, 1.0);

    for (const type of types) {
      const mats = place[type];
      if (!mats) continue;
      const src = this.A.gltf('nature').scene.getObjectByName(type);
      src.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
      src.traverse((o) => {
        if (!o.isMesh) return;
        const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, local)));
        im.castShadow = true; im.receiveShadow = true;
        im.computeBoundingSphere();
        this.scene.add(im);
      });
    }
  }

  _fadeable(obj) {
    obj.userData.mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      obj.userData.mats.push(o.material);
    });
    obj.userData.alpha = 1;
  }

  _fadeTo(obj, target, dt) {
    const u = obj.userData;
    u.alpha += (target - u.alpha) * Math.min(1, dt * 5);
    for (const m of u.mats) { m.opacity = u.alpha; m.depthWrite = u.alpha > 0.95; }
    obj.visible = u.alpha > 0.02;
  }

  _colliders() {
    const c = this.game.collision;
    const wood = { surface: 'wood' };
    // platform + road
    c.add(-16.5, -1.1, -2.4, 44, 0, 3.0, { surface: 'snow' });
    c.add(33, -1.3, -50, 49, 0, -2.4, { surface: 'snow' });
    c.add(-17, 0, 3.0, 45, 3, 3.4);       // front fence
    c.add(-16.8, 0, -3, -16.4, 3, 3.4);    // left end
    c.add(43.4, 0, -3, 44, 3, 3.4);        // right end wall
    // platform edge (drop to the track) except the train door
    c.add(-16.5, 0, -2.65, DOOR_X - 0.55, 3, -2.4);
    this.doorGap = c.add(DOOR_X - 0.55, 0, -2.65, DOOR_X + 0.55, 3, -2.4);
    c.add(DOOR_X + 0.55, 0, -2.65, 14, 3, -2.4);
    c.add(12.4, -1.5, -7.2, 14.1, 4, -2.4);
    // station building footprint
    c.add(14, -1.5, -7.2, 33.2, 6, -0.6);
    // boundary wall + gate behind the building
    c.add(33.2, 0, GATE.z - 0.25, GATE.x - 1.5, 3, GATE.z + 0.25);
    c.add(GATE.x + 1.5, 0, GATE.z - 0.25, 44, 3, GATE.z + 0.25);
    this.gateBox = c.add(GATE.x - 1.5, 0, GATE.z - 0.15, GATE.x + 1.5, 3, GATE.z + 0.15);
    // road edges beyond the gate
    c.add(33, 0, -50, 34, 3, -3.2);
    c.add(48, 0, -50, 49, 3, -3.2);
    // train interior
    const z0 = CAR_Z;
    c.add(-9, -0.6, z0 - 1.5, 9, CAR_Y, z0 + 1.55, wood);
    c.add(-9.4, CAR_Y, z0 - 1.6, -8.9, 3, z0 + 1.5);
    c.add(8.9, CAR_Y, z0 - 1.6, 9.4, 3, z0 + 1.5);
    c.add(-9, CAR_Y, z0 - 1.7, 9, 3, z0 - 1.38);
    c.add(-9, 2.65, z0 - 1.5, 9, 3.2, z0 + 1.5);
    c.add(-8.3, CAR_Y, z0 - 1.38, 5.95, 1.35, z0 - 0.4, wood);           // back seats
    c.add(-8.3, CAR_Y, z0 + 0.4, 4.75, 1.35, z0 + 1.5, wood);            // front seats
    c.add(-9, CAR_Y, z0 + 1.42, DOOR_X - 0.55, 3, z0 + 1.6);              // front wall
    c.add(DOOR_X + 0.55, CAR_Y, z0 + 1.42, 9, 3, z0 + 1.6);
    this.doorBox = c.add(DOOR_X - 0.55, CAR_Y, z0 + 1.42, DOOR_X + 0.55, 3, z0 + 1.6);
  }

  _cameraZones() {
    const rig = this.game.cameraRig;
    rig.base.offset.set(0, 2.1, 7.9);
    rig.base.look.set(0, 1.0, 0);
    // inside the carriage: closer, front wall cut away
    rig.addZone({ min: { x: -9, z: CAR_Z - 1.6 }, max: { x: 9, z: CAR_Z + 1.45 }, offset: new THREE.Vector3(0, 1.55, 6.4), look: new THREE.Vector3(0, 1.0, 0), fov: 42, depthFollow: 0, anchorZ: CAR_Z, clampX: [-6.2, 6.6], priority: 2 });
    // stepping out of the door: high wide shot of the platform
    rig.addZone({ min: { x: 3, z: -2.6 }, max: { x: 10, z: 0.5 }, offset: new THREE.Vector3(1.0, 2.8, 9.2), look: new THREE.Vector3(1.0, 0.9, -0.5), fov: 40, depthFollow: 0.3, priority: 1, when: () => !Flags.has('left.train.wide') });
    // the stopped clock: tilt up so the dial stays in frame
    rig.addZone({ min: { x: 8.6, z: -2.4 }, max: { x: 12.6, z: 3 }, offset: new THREE.Vector3(0, 2.4, 8.6), look: new THREE.Vector3(0, 2.4, 0), fov: 42, depthFollow: 0.4, priority: 1 });
    // the crate / control-panel puzzle: wider, higher framing
    rig.addZone({ min: { x: 17, z: -3 }, max: { x: 33, z: 3 }, offset: new THREE.Vector3(0, 2.0, 8.6), look: new THREE.Vector3(0, 1.55, -0.3), fov: 42, depthFollow: 0.4, priority: 1 });
    // the gate and the road into the mountains: camera follows into depth
    rig.addZone({ min: { x: 33, z: -60 }, max: { x: 49, z: -2.6 }, offset: new THREE.Vector3(0, 2.6, 8.4), look: new THREE.Vector3(0, 1.2, -3), fov: 40, depthFollow: 1, clampX: [36, 39], priority: 1 });
  }

  // ------------------------------------------------------------------ gameplay
  _interactables() {
    const g = this.game, ui = g.ui, P = () => g.player;
    const I = g.interaction;
    const self = this;
    I.add({ pos: new THREE.Vector3(10.6, 0, 1.6), radius: 1.6, height: 2.2, prompt: () => 'p.look', use: () => ui.say('st.clock', { speaker: 'speaker.adam' }) });
    I.add({ pos: new THREE.Vector3(23, 0, -0.2), radius: 1.4, prompt: () => 'p.try', use: () => { g.sound.play('thud', { vol: 0.5, x: 23 }); ui.say('st.door', { speaker: 'speaker.adam' }); } });
    I.add({ pos: new THREE.Vector3(12.2, 0, -1.1), radius: 1.3, height: 2.0, prompt: () => 'p.read', use: () => this._memory() });
    I.add({
      pos: new THREE.Vector3(GATE.x, 0, GATE.z + 0.6), radius: 1.6, height: 2.4,
      enabled: () => !Flags.has('power.on'),
      prompt: () => 'p.try',
      use: () => {
        g.sound.play('clank', { vol: 0.5, x: GATE.x, rate: 0.7 });
        ui.say('st.gate', { speaker: 'speaker.adam' });
        if (!Flags.has('seen.gate')) { Flags.set('seen.gate'); ui.setObjective(Flags.has('battery.inserted') ? 'obj.panel' : 'obj.generator'); }
      },
    });
    // luggage cart: lift the tarp, then take the battery
    I.add({
      pos: new THREE.Vector3(CART.x, 0, CART.z + 0.8), radius: 1.6, height: 1.4,
      enabled: () => !Flags.has('battery.taken'),
      prompt: () => (Flags.has('tarp.lifted') ? 'p.take' : 'p.lift'),
      use: () => {
        if (!Flags.has('tarp.lifted')) {
          Flags.set('tarp.lifted');
          g.sound.play('cloth', { vol: 0.8 });
          this.battery.visible = true;
          ui.say('st.tarp', { speaker: 'speaker.adam' });
        } else {
          Flags.set('battery.taken');
          P().playScripted('Interact').then(() => P().releaseScripted());
          setTimeout(() => P().pickUp('battery', this.battery), 300);
          ui.say('st.battery', { speaker: 'speaker.adam' });
          ui.setObjective('obj.generator');
        }
      },
    });
    // dropped battery can be picked up again
    this.batteryPickup = I.add({
      pos: new THREE.Vector3(), radius: 1.1, height: 0.6,
      enabled: () => this.batteryOnGround && !P().carrying,
      prompt: () => 'p.take',
      use: () => { this.batteryOnGround = false; P().pickUp('battery', this.battery); },
    });
    // generator
    I.add({
      pos: new THREE.Vector3(GEN.x, 0, GEN.z + 0.9), radius: 1.5, height: 1.4,
      enabled: () => !Flags.has('gen.on'),
      prompt: () => (P().carrying ? 'p.insert' : Flags.has('battery.inserted') ? 'p.start' : 'p.look'),
      use: () => {
        if (P().carrying && P().carrying.id === 'battery') {
          P().drop();
          this.scene.add(this.battery);
          this.battery.position.set(GEN.x + 0.45, 0.15, GEN.z - 0.1);
          this.battery.rotation.set(0, 0, 0);
          Flags.set('battery.inserted');
          g.sound.play('clank', { vol: 0.6, x: GEN.x });
          ui.say('st.gen_ready', { speaker: 'speaker.adam' });
        } else if (Flags.has('battery.inserted')) {
          this._startGenerator(true);
        } else {
          ui.say('st.gen_nobat', { speaker: 'speaker.adam' });
          if (!Flags.has('battery.taken')) ui.setObjective('obj.battery');
        }
      },
    });
    // control panel (needs the crate underneath)
    I.add({
      pos: new THREE.Vector3(PANEL.x, 0, PANEL.z + 0.5), radius: 1.3, height: 2.6,
      enabled: () => !Flags.has('power.on'),
      prompt: () => (P().pos.y > 0.8 ? 'p.pull' : 'p.look'),
      use: () => {
        if (P().pos.y < 0.8) { ui.say('st.panel_high', { speaker: 'speaker.adam' }); if (Flags.has('gen.on')) ui.setObjective('obj.panel'); return; }
        if (!Flags.has('gen.on')) { g.sound.play('lever', { vol: 0.5, x: PANEL.x }); ui.say('st.panel_nopower', { speaker: 'speaker.adam' }); return; }
        this._powerOn();
      },
    });
    // crate: grab to push / pull
    I.add({
      get pos() { return self.crate.center.clone().setY(0); }, radius: 1.25, height: 1.3,
      enabled: () => !P().carrying && P().grounded && Math.abs(P().pos.y - this.crate.box.min.y) < 0.2,
      prompt: () => 'p.grab',
      use: () => P().startGrab(this.crate),
    });
  }

  dropItem() {
    const p = this.game.player;
    const c = p.drop();
    if (!c) return;
    const f = p.facingDir();
    this.scene.add(this.battery);
    this.battery.position.set(p.pos.x + f.x * 0.6, p.pos.y, p.pos.z + f.z * 0.6);
    this.batteryOnGround = true;
    this.batteryPickup.pos.copy(this.battery.position);
    this.game.sound.play('thud', { vol: 0.3 });
  }

  async _memory() {
    const g = this.game, ui = g.ui;
    await ui.say('st.notice', { speaker: 'speaker.adam' });
    if (Flags.has('memory.station')) return;
    Flags.set('memory.station');
    g.cutscene = true;
    g.player.locked = true;
    g.sound.play('whoosh', { vol: 0.7 });
    g.sound.sting();
    const gr = g.renderer.grade.uniforms;
    for (let k = 0; k <= 20; k++) { gr.uSepia.value = k / 20 * 0.9; await sleep(0.02); }
    g.sound.play('call', { vol: 0.35, rate: 1.15 });
    await ui.say('st.memory', { speaker: 'speaker.child', style: 'memory', dur: 3 });
    for (let k = 20; k >= 0; k--) { gr.uSepia.value = k / 20 * 0.9; await sleep(0.03); }
    await ui.say('st.memory2', { speaker: 'speaker.adam' });
    g.cutscene = false;
    g.player.locked = false;
  }

  _startGenerator(withSound) {
    const g = this.game;
    Flags.set('gen.on');
    if (withSound) {
      g.sound.play('gen_cough', { vol: 0.9, x: GEN.x });
      g.cameraRig.shake(0.05, 1.5);
      g.ui.say('st.gen_on', { speaker: 'speaker.adam' });
    }
    setTimeout(() => {
      g.sound.loop('gen', 0.35, 1.5, { buffer: 'gen_hum' });
      if (this.genLampMat) { this.genLampMat.color.set(0x30ff60); this.genLampMat.emissive.set(0x30ff60); this.genLampMat.emissiveIntensity = 4; }
      if (this.panelLampMat) { this.panelLampMat.color.set(0xffa020); this.panelLampMat.emissive.set(0xffa020); this.panelLampMat.emissiveIntensity = 4; }
      this.panelGlow.on = true;
      this.genGlow.on = true;
    }, withSound ? 1800 : 0);
    if (withSound) {
      setTimeout(() => g.checkpoint('generator'), 2200);
      g.ui.setObjective('obj.panel');
    }
  }

  async _powerOn(instant = false) {
    const g = this.game;
    Flags.set('power.on');
    this.lever.rotation.x = -1.2;
    if (this.panelLampMat) { this.panelLampMat.color.set(0x40ff70); this.panelLampMat.emissive.set(0x40ff70); }
    const lamps = [...this.lamps, ...this.canopyLights];
    if (instant) {
      lamps.forEach((l) => { l.on = true; l.flicker = 0; });
      this._openGate(true);
      return;
    }
    g.cutscene = true;
    g.player.locked = true;
    g.sound.play('lever', { vol: 0.8, x: PANEL.x });
    g.sound.play('spark', { vol: 0.6, x: PANEL.x, delay: 0.2 });
    g.sound.loop('buzz', 0.08, 2, { buffer: 'buzz' });
    g.cameraRig.setShot({ pos: new THREE.Vector3(21.5, 1.7, 7.0), look: new THREE.Vector3(27.5, 2.6, -0.6), fov: 50 }, 2.0);
    await sleep(0.6);
    for (const l of lamps) { l.on = true; l.flicker = 1.5; g.sound.play('spark', { vol: 0.15, x: l.pos.x }); await sleep(0.25); }
    await g.ui.say('st.panel_on', { speaker: 'speaker.adam' });
    lamps.forEach((l) => { l.flicker = 0.05; });
    g.cameraRig.setShot({ pos: new THREE.Vector3(36.5, 2.6, 4.5), look: new THREE.Vector3(GATE.x, 1.2, GATE.z), fov: 40 }, 2.0);
    await sleep(1.6);
    this._openGate(false);
    await g.ui.say('st.gate_open', { speaker: 'speaker.adam' });
    g.cameraRig.clearShot(1.8);
    await sleep(1.0);
    g.cutscene = false;
    g.player.locked = false;
    g.ui.setObjective('obj.exit');
  }

  _openGate(instant) {
    const g = this.game;
    this.gateBox.enabled = false;
    if (instant) { this.leafL.rotation.y = 1.45; this.leafR.rotation.y = -1.45; return; }
    g.sound.play('clank', { vol: 0.8, x: GATE.x, rate: 0.8 });
    g.sound.play('creak', { vol: 0.7, x: GATE.x, delay: 0.3 });
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 2600);
      const e = 1 - Math.pow(1 - k, 3);
      this.leafL.rotation.y = 1.45 * e;
      this.leafR.rotation.y = -1.45 * e;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  // ------------------------------------------------------------------ restore / respawn
  _restoreFromFlags() {
    this.battery.visible = Flags.has('tarp.lifted');
    this.battery.position.set(CART.x - 0.45, 0.62, CART.z + 0.05);
    if (Flags.has('battery.inserted')) {
      this.battery.visible = true;
      this.battery.position.set(GEN.x + 0.45, 0.15, GEN.z - 0.1);
    }
    if (Flags.has('gen.on')) this._startGenerator(false);
    if (Flags.has('power.on')) this._powerOn(true);
    if (Flags.has('train.arrived')) this._openDoor(true);
  }

  _openDoor(instant) {
    this.doorBox.enabled = false;
    this.doorGap.enabled = false;
    if (instant) { this.door.position.x = this.doorClosedX + 1.05; return; }
    const t0 = performance.now();
    this.game.sound.play('door_slide', { vol: 0.8, x: DOOR_X });
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1300);
      this.door.position.x = this.doorClosedX + 1.05 * (k * k * (3 - 2 * k));
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  /** Where to stand when (re)starting from a checkpoint. */
  spawnFor(cp) {
    switch (cp) {
      case 'platform': return { x: DOOR_X, y: 0, z: -1.2, yaw: Math.PI / 2 };
      case 'generator': return { x: GEN.x - 1.6, y: 0, z: GEN.z + 0.4, yaw: -Math.PI / 2 };
      default: return { x: 2.0, y: CAR_Y, z: CAR_Z, yaw: Math.PI / 2 };
    }
  }

  // ------------------------------------------------------------------ story
  async intro() {
    const g = this.game, ui = g.ui, p = g.player, rig = g.cameraRig;
    g.cutscene = true;
    g.input.enabled = false;
    p.locked = true;
    this.trainMoving = true;
    ui.setObjective(null);
    ui.fadeTo(1, 0);
    rig.setShot({ pos: new THREE.Vector3(SEAT.x + 2.4, 1.35, -1.6), look: new THREE.Vector3(SEAT.x, 0.95, SEAT.z), fov: 34 }, 0);
    p.setPosition(SEAT.x, CAR_Y + 0.04, SEAT.z, Math.PI / 2);
    p.playScripted('SitSleep', { loop: true, fade: 0 });
    g.sound.loop('train', 0.55, 2.5);
    g.sound.loop('wind', 0.12, 3, { buffer: 'wind' });
    await ui.title('intro.date', 3.4);
    g.renderer.grade.uniforms.uLetterbox.value = 1;
    await ui.fadeTo(0, 3.0);
    await sleep(1.6);
    this.trainLights.forEach((l) => { l.flicker = 3; });
    g.sound.play('thud', { vol: 0.5 });
    rig.shake(0.08, 0.5);
    await sleep(0.6);
    this.trainLights.forEach((l) => { l.flicker = 0.6; });
    await p.playScripted('WakeUp', { fade: 0.4 });
    await ui.say('intro.where', { speaker: 'speaker.adam' });
    rig.setShot({ pos: new THREE.Vector3(-1.5, 1.8, 3.4), look: new THREE.Vector3(-0.5, 1.1, CAR_Z), fov: 52, drift: 0.4 }, 2.5);
    await this._walkTo(SEAT.x + 0.3, CAR_Z, 0.9);
    p.playScripted('LookBack', { fade: 0.3 });
    await ui.say('intro.empty', { speaker: 'speaker.adam' });
    await ui.say('intro.remember', { speaker: 'speaker.adam' });
    rig.setShot({ pos: new THREE.Vector3(SEAT.x + 2.6, 1.5, -2.2), look: new THREE.Vector3(SEAT.x + 0.3, 1.1, CAR_Z), fov: 36 }, 1.5);
    await ui.say('intro.pocket', { speaker: 'speaker.adam' });
    g.sound.play('cloth', { vol: 0.7 });
    await p.playScripted('Interact', { fade: 0.2 });
    g.sound.sting([57, 64, 69, 72]);
    await ui.showPhoto();
    await ui.say('photo.who', { speaker: 'speaker.adam' });
    // brakes
    g.sound.play('brake', { vol: 0.8 });
    g.sound.loop('train', 0.0, 3.5, { rate: 0.6 });
    rig.shake(0.18, 3.0);
    this.trainLights.forEach((l) => { l.flicker = 2; });
    p.playScripted('LookBack', { fade: 0.2 });
    await sleep(3.6);
    this.trainMoving = false;
    g.sound.stopLoop('train', 0.5);
    this.trainLights.forEach((l) => { l.flicker = 0.4; });
    await sleep(0.8);
    g.sound.play('chime', { vol: 0.6 });
    await sleep(1.4);
    g.sound.play('static', { vol: 0.5 });
    await ui.say('intro.announce', { speaker: 'speaker.pa', style: 'pa', dur: 3.4 });
    Flags.set('train.arrived');
    rig.setShot({ pos: new THREE.Vector3(DOOR_X - 2.0, 1.7, 1.8), look: new THREE.Vector3(DOOR_X, 1.2, CAR_Z + 1.2), fov: 40 }, 1.6);
    await sleep(0.8);
    this._openDoor(false);
    g.sound.loop('wind', 0.3, 2, { buffer: 'wind' });
    await sleep(1.6);
    rig.clearShot(1.6);
    g.renderer.grade.uniforms.uLetterbox.value = 0;
    p.releaseScripted();
    p.locked = false;
    g.input.enabled = true;
    g.cutscene = false;
    Flags.set('intro.done');
    ui.setObjective('obj.leave');
    g.checkpoint('train');
  }

  _walkTo(x, z, dur) {
    const p = this.game.player;
    const from = p.pos.clone();
    p.playScripted('Walk', { fade: 0.25, loop: true });
    p.targetYaw = Math.atan2(x - from.x, z - from.z);
    return new Promise((res) => {
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
        p.pos.set(THREE.MathUtils.lerp(from.x, x, k), from.y, THREE.MathUtils.lerp(from.z, z, k));
        if (k < 1) requestAnimationFrame(step);
        else { p.targetYaw = Math.PI / 2; p.playScripted('Idle', { fade: 0.3, loop: true }); res(); }
      };
      step();
    });
  }

  async _ending() {
    const g = this.game, ui = g.ui;
    Flags.set('scene1.done');
    g.input.enabled = false;
    g.cutscene = true;
    g.renderer.grade.uniforms.uLetterbox.value = 1;
    g.sound.startTheme(0.8);
    await ui.fadeTo(1, 2.5);
    g.ui.show(g.ui.hud, false);
    g.ui.show(g.ui.end, true);
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    const inCar = Math.abs(p.pos.x) < 9 && p.pos.z < CAR_Z + 1.45;
    this._fadeTo(this.frontWall, inCar ? 0 : 1, dt);
    this._fadeTo(this.door, inCar ? 0 : 1, dt);
    g.snow.points.visible = g.snowNear.points.visible = !inCar;
    // train motion: rocking + lights sweeping past the windows
    if (this.trainMoving) {
      const t = g.time;
      this.car.position.y = CAR_Y + Math.sin(t * 9) * 0.008;
      this.car.rotation.z = Math.sin(t * 1.3) * 0.004;
      const ph = (t * 0.55) % 1;
      this.passing.position.x = 14 - ph * 30;
      this.passing.intensity = 7 * Math.sin(ph * Math.PI);
    } else {
      this.car.position.y = CAR_Y;
      this.car.rotation.z = 0;
      this.passing.intensity = 0;
    }
    // leaving the train
    if (Flags.has('intro.done') && !Flags.has('left.train') && p.pos.z > -2.2) {
      Flags.set('left.train');
      g.ui.setObjective('obj.exit');
      g.checkpoint('platform');
      g.sound.loop('wind', 0.42, 2.5, { buffer: 'wind' });
    }
    if (p.pos.z > -1.0) Flags.set('left.train.wide');
    // beyond the gate: the voice, then the end of the scene
    if (Flags.has('power.on') && !Flags.has('heard.call') && p.pos.z < GATE.z - 1.5) {
      Flags.set('heard.call');
      g.sound.play('call', { vol: 0.35 });
      g.ui.say('st.call', { speaker: 'speaker.child', style: 'memory', dur: 2.6 }).then(() => g.ui.say('st.who', { speaker: 'speaker.adam' }));
      g.ui.setObjective('obj.voice');
    }
    if (Flags.has('heard.call') && !Flags.has('scene1.done') && p.pos.z < GATE.z - 11) this._ending();
  }

  /** 0..1 exposure to the cold (outside the carriage, away from shelter). */
  isExposed(pos) {
    if (Math.abs(pos.x) < 9 && pos.z < CAR_Z + 1.5) return 0;
    if (pos.x > 14 && pos.x < 32 && pos.z < 1.8) return 0.6; // under the canopy
    return 1;
  }

  warmth(pos) {
    let w = 0;
    if (Flags.has('gen.on')) w = Math.max(w, 1 - Math.hypot(pos.x - GEN.x, pos.z - GEN.z) / 3);
    for (const l of [...this.lamps, ...this.canopyLights]) if (l.on && l.level > 0.5) w = Math.max(w, 0.6 * (1 - Math.hypot(pos.x - l.pos.x, pos.z - l.pos.z) / 3.5));
    return Math.max(0, w);
  }
}
