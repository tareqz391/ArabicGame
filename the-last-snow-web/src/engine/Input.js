/**
 * Unified input: on-screen touch controls (virtual joystick + buttons) and keyboard.
 * Game code reads `input.move` (x: right, y: into the scene) and the button states.
 */
export class Input {
  constructor(hud) {
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.held = {};
    this.pressed = {};
    this._keys = {};
    this.enabled = true;
    this.touchActive = false;
    this._joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.hud = hud;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._keys[e.code] = true;
      const map = { Space: 'jump', KeyE: 'act', Enter: 'act', KeyC: 'crouch', ControlLeft: 'crouch', KeyF: 'light', Escape: 'pause', KeyP: 'pause' };
      if (map[e.code]) this._press(map[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      this._keys[e.code] = false;
      const map = { Space: 'jump', KeyE: 'act', Enter: 'act', KeyC: 'crouch', ControlLeft: 'crouch', KeyF: 'light' };
      if (map[e.code]) this.held[map[e.code]] = false;
    });
    if (hud) this._bindTouch(hud);
  }

  _press(name) {
    this.pressed[name] = true;
    this.held[name] = true;
  }

  _bindTouch(hud) {
    const zone = hud.joyZone, base = hud.joyBase, knob = hud.joyKnob;
    const R = 60;
    const setKnob = () => {
      knob.style.transform = `translate(${this._joy.x * R}px, ${this._joy.y * R}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this._joy.id !== null) return;
      this.touchActive = true;
      zone.setPointerCapture(e.pointerId);
      this._joy.id = e.pointerId;
      const zr = zone.getBoundingClientRect();
      this._joy.ox = e.clientX;
      this._joy.oy = e.clientY;
      base.style.left = `${e.clientX - zr.left}px`;
      base.style.top = `${e.clientY - zr.top}px`;
      base.classList.add('active');
      e.preventDefault();
    });
    const moveJ = (e) => {
      if (e.pointerId !== this._joy.id) return;
      let dx = (e.clientX - this._joy.ox) / R, dy = (e.clientY - this._joy.oy) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this._joy.x = dx; this._joy.y = dy;
      setKnob();
      e.preventDefault();
    };
    const endJ = (e) => {
      if (e.pointerId !== this._joy.id) return;
      this._joy.id = null; this._joy.x = 0; this._joy.y = 0;
      setKnob();
      base.classList.remove('active');
    };
    zone.addEventListener('pointermove', moveJ);
    zone.addEventListener('pointerup', endJ);
    zone.addEventListener('pointercancel', endJ);

    for (const [name, el] of Object.entries(hud.buttons)) {
      el.addEventListener('pointerdown', (e) => {
        this.touchActive = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('down');
        this._press(name);
        if (navigator.vibrate && name !== 'pause') navigator.vibrate(8);
        e.preventDefault();
      });
      const up = () => { el.classList.remove('down'); this.held[name] = false; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }
  }

  /** Call once per frame before game logic. */
  update() {
    const k = this._keys;
    let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    let run = !!(k.ShiftLeft || k.ShiftRight);
    if (this._joy.id !== null) {
      // screen up = into the scene
      x = this._joy.x; y = -this._joy.y;
      const mag = Math.hypot(x, y);
      run = mag > 0.85;
      // dead zone + reduce accidental depth drift while walking sideways
      if (mag < 0.18) { x = 0; y = 0; }
      if (Math.abs(y) < 0.35 * Math.abs(x)) y = 0;
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = this.enabled ? x : 0;
    this.move.y = this.enabled ? y : 0;
    this.run = this.enabled && run;
  }

  /** Consume a one-frame press. */
  take(name) {
    const p = this.pressed[name];
    this.pressed[name] = false;
    return !!p && (this.enabled || name === 'pause');
  }

  endFrame() {
    for (const k in this.pressed) this.pressed[k] = false;
  }
}
