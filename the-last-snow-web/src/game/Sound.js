/**
 * Procedural audio (WebAudio). Every sound is synthesised at start-up, so the game works
 * fully offline with no audio files. These are prototype sounds: the docs list the
 * recorded SFX / music that should replace them.
 */
const SR = 44100;

function buf(ctx, seconds, fn, channels = 1) {
  const n = Math.floor(seconds * SR);
  const b = ctx.createBuffer(channels, n, SR);
  for (let c = 0; c < channels; c++) {
    const d = b.getChannelData(c);
    fn(d, n, c);
  }
  return b;
}

function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

function lowpass(d, k) { let y = 0; for (let i = 0; i < d.length; i++) { y += k * (d[i] - y); d[i] = y; } }
function highpass(d, k) { let y = 0, x0 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = k * (y + x - x0); x0 = x; d[i] = y; } }
function normalize(d, peak = 0.9) { let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; }
function fadeEdges(d, a = 0.005, r = 0.02) {
  const na = Math.floor(a * SR), nr = Math.floor(r * SR);
  for (let i = 0; i < na && i < d.length; i++) d[i] *= i / na;
  for (let i = 0; i < nr && i < d.length; i++) d[d.length - 1 - i] *= i / nr;
}
/** Crossfade the tail into the head so the buffer loops seamlessly. */
function loopify(d, seconds = 0.25) {
  const n = Math.floor(seconds * SR);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    d[i] = d[i] * t + d[d.length - n + i] * (1 - t);
  }
  return d.subarray ? d : d;
}

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.loops = {};
    this.listenerX = 0;
    this.volume = 0.9;
  }

  /** Must be called from a user gesture (mobile autoplay policy). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    // gentle "room" so everything sits in the same cold space
    this.verb = ctx.createConvolver();
    this.verb.buffer = buf(ctx, 2.2, (d, n, c) => { const r = rnd(7 + c); for (let i = 0; i < n; i++) d[i] = r() * Math.pow(1 - i / n, 3.2); }, 2);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
    this.verb.connect(this.verbGain).connect(this.master);
    this.comp = ctx.createDynamicsCompressor();
    this.master.connect(this.comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master); this.musicBus.connect(this.verb);
    this._build();
  }

  _build() {
    const ctx = this.ctx, B = this.buffers;
    // Wind: band-limited noise with slow gusts
    B.wind = buf(ctx, 8, (d, n, c) => {
      const r = rnd(11 + c); let y = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        y += 0.02 * (r() - y); y2 += 0.3 * (y - y2);
        const gust = 0.55 + 0.3 * Math.sin(t * 0.7 + c) + 0.15 * Math.sin(t * 2.3 + 1.3 * c);
        d[i] = (y2 * 6 + r() * 0.015) * gust;
      }
      normalize(d, 0.6); loopify(d, 0.5);
    }, 2);
    // Train: low rumble + wheel clacks (two pairs per loop)
    B.train = buf(ctx, 2.4, (d, n) => {
      const r = rnd(21); let y = 0;
      for (let i = 0; i < n; i++) { y += 0.01 * (r() - y); d[i] = y * 9 + Math.sin(i / SR * 2 * Math.PI * 43) * 0.05; }
      for (const t0 of [0.1, 0.32, 1.3, 1.52]) {
        const s = Math.floor(t0 * SR);
        for (let i = 0; i < 0.09 * SR; i++) {
          const e = Math.exp(-i / (0.012 * SR));
          d[s + i] += (r() * 0.5 + Math.sin(i / SR * 2 * Math.PI * 180) * 0.6) * e * 0.8;
        }
      }
      normalize(d, 0.7); loopify(d, 0.05);
    });
    B.brake = buf(ctx, 3.5, (d, n) => {
      const r = rnd(31); let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR, f = 2400 - 900 * (t / 3.5) + 60 * Math.sin(t * 37);
        ph += f / SR;
        const env = Math.min(1, t * 4) * (1 - t / 3.5);
        d[i] = (Math.sin(2 * Math.PI * ph) * 0.35 + r() * 0.25) * env;
      }
      highpass(d, 0.95); normalize(d, 0.55); fadeEdges(d);
    });
    // Station chime (ding-dong) for the announcement
    B.chime = buf(ctx, 2.6, (d, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const a = t < 1.1 ? Math.exp(-t * 2.2) * Math.sin(2 * Math.PI * 659 * t) + 0.3 * Math.exp(-t * 3) * Math.sin(2 * Math.PI * 1318 * t) : 0;
        const t2 = t - 0.7;
        const b = t2 > 0 ? Math.exp(-t2 * 1.8) * Math.sin(2 * Math.PI * 523 * t2) + 0.3 * Math.exp(-t2 * 3) * Math.sin(2 * Math.PI * 1046 * t2) : 0;
        d[i] = (a + b) * 0.5;
      }
      fadeEdges(d);
    });
    // Static / radio crackle under the PA voice
    B.static = buf(ctx, 2.5, (d, n) => {
      const r = rnd(41);
      for (let i = 0; i < n; i++) d[i] = r() * (0.15 + 0.15 * (Math.sin(i / SR * 40) > 0.6 ? 1 : 0));
      highpass(d, 0.7); fadeEdges(d, 0.05, 0.3);
    });
    // Footsteps
    for (let k = 0; k < 4; k++) {
      B['step_snow' + k] = buf(ctx, 0.22, (d, n) => {
        const r = rnd(51 + k);
        for (let i = 0; i < n; i++) {
          const t = i / SR, env = Math.exp(-t * 22) * (1 - Math.exp(-t * 400));
          d[i] = r() * env * (0.6 + 0.4 * (r() > 0.6 ? 1 : 0));
        }
        lowpass(d, 0.25); normalize(d, 0.5); fadeEdges(d);
      });
      B['step_wood' + k] = buf(ctx, 0.18, (d, n) => {
        const r = rnd(61 + k);
        for (let i = 0; i < n; i++) {
          const t = i / SR, env = Math.exp(-t * 35);
          d[i] = (Math.sin(2 * Math.PI * (110 + k * 9) * t) * 0.7 + r() * 0.3) * env;
        }
        normalize(d, 0.45); fadeEdges(d);
      });
    }
    B.door_slide = buf(ctx, 1.4, (d, n) => {
      const r = rnd(71); let y = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; y += 0.05 * (r() - y); d[i] = y * 6 * Math.sin(Math.PI * t / 1.4) + (t > 1.25 ? r() * Math.exp(-(t - 1.25) * 40) : 0); }
      normalize(d, 0.6); fadeEdges(d);
    });
    B.thud = buf(ctx, 0.6, (d, n) => {
      const r = rnd(81);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * (70 - 30 * t) * t) + r() * 0.3) * Math.exp(-t * 9); }
      normalize(d, 0.8); fadeEdges(d);
    });
    B.clank = buf(ctx, 1.2, (d, n) => {
      const r = rnd(91);
      const fs = [523, 1187, 1730, 2611];
      for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; fs.forEach((f, j) => { v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (4 + j * 3)) / (j + 1); }); d[i] = v * 0.6 + r() * Math.exp(-t * 60) * 0.5; }
      normalize(d, 0.7); fadeEdges(d);
    });
    B.creak = buf(ctx, 1.6, (d, n) => {
      let ph = 0; const r = rnd(101);
      for (let i = 0; i < n; i++) { const t = i / SR, f = 180 + 90 * Math.sin(t * 5) + 40 * Math.sin(t * 23); ph += f / SR; d[i] = ((ph % 1) - 0.5) * Math.sin(Math.PI * t / 1.6) * (0.6 + 0.4 * r()); }
      lowpass(d, 0.3); normalize(d, 0.5); fadeEdges(d);
    });
    B.lever = buf(ctx, 0.5, (d, n) => {
      const r = rnd(111);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = r() * Math.exp(-t * 30) + (t > 0.18 ? Math.sin(2 * Math.PI * 300 * t) * Math.exp(-(t - 0.18) * 25) : 0); }
      normalize(d, 0.7); fadeEdges(d);
    });
    B.spark = buf(ctx, 0.8, (d, n) => {
      const r = rnd(121);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = r() * (r() > 0.7 ? 1 : 0.1) * Math.exp(-t * 5); }
      highpass(d, 0.8); normalize(d, 0.5); fadeEdges(d);
    });
    B.buzz = buf(ctx, 1.0, (d, n) => {
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 100 * t) + 0.5 * Math.sin(2 * Math.PI * 200 * t) + 0.3 * Math.sign(Math.sin(2 * Math.PI * 50 * t))) * 0.2; }
      loopify(d, 0.02);
    });
    B.gen_cough = buf(ctx, 2.2, (d, n) => {
      const r = rnd(131); let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const pulse = t < 1.2 ? Math.max(0, Math.sin(2 * Math.PI * (4 + 6 * t) * t)) ** 4 : Math.max(0, Math.sin(2 * Math.PI * 14 * t)) ** 2;
        y += 0.08 * (r() - y);
        d[i] = (y * 5 + Math.sin(2 * Math.PI * 45 * t) * 0.4) * pulse * Math.min(1, t * 3);
      }
      normalize(d, 0.8); fadeEdges(d);
    });
    B.gen_hum = buf(ctx, 1.0, (d, n) => {
      const r = rnd(141); let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR; y += 0.06 * (r() - y);
        d[i] = (Math.sin(2 * Math.PI * 50 * t) * 0.5 + Math.sin(2 * Math.PI * 100 * t) * 0.25 + y * 2) * (0.75 + 0.25 * Math.max(0, Math.sin(2 * Math.PI * 14 * t)) ** 2);
      }
      normalize(d, 0.6); loopify(d, 0.02);
    });
    B.pickup = buf(ctx, 0.7, (d, n) => {
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 587 * t) * Math.exp(-t * 6) + (t > 0.09 ? Math.sin(2 * Math.PI * 880 * (t - 0.09)) * Math.exp(-(t - 0.09) * 6) : 0)) * 0.4; }
      fadeEdges(d);
    });
    B.cloth = buf(ctx, 0.6, (d, n) => {
      const r = rnd(151); let y = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; y += 0.2 * (r() - y); d[i] = y * Math.sin(Math.PI * t / 0.6); }
      normalize(d, 0.5); fadeEdges(d);
    });
    B.whoosh = buf(ctx, 2.5, (d, n) => {
      const r = rnd(161); let y = 0;
      for (let i = 0; i < n; i++) { const t = i / SR, k = 0.02 + 0.2 * Math.sin(Math.PI * t / 2.5); y += k * (r() - y); d[i] = y * Math.sin(Math.PI * t / 2.5) ** 2; }
      normalize(d, 0.6); fadeEdges(d);
    });
    // Distant child's voice: two soft falling tones ("A-dam"), breathy and far away
    B.call = buf(ctx, 1.8, (d, n) => {
      const r = rnd(171);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = t < 0.45 ? 520 : 440 - 20 * (t - 0.45);
        const env = t < 0.45 ? Math.sin(Math.PI * t / 0.45) : (t < 1.5 ? Math.sin(Math.PI * (t - 0.45) / 1.05) : 0);
        const vib = 1 + 0.012 * Math.sin(t * 2 * Math.PI * 5.5);
        d[i] = (Math.sin(2 * Math.PI * f * vib * t) * 0.6 + Math.sin(4 * Math.PI * f * vib * t) * 0.2 + r() * 0.08) * env;
      }
      lowpass(d, 0.3); normalize(d, 0.5); fadeEdges(d);
    });
    B.heartbeat = buf(ctx, 1.0, (d, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const a = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 18);
        const t2 = t - 0.28;
        const b = t2 > 0 ? Math.sin(2 * Math.PI * 50 * t2) * Math.exp(-t2 * 16) * 0.7 : 0;
        d[i] = (a + b) * 0.9;
      }
    });
    B.flash = buf(ctx, 0.12, (d, n) => {
      const r = rnd(181);
      for (let i = 0; i < n; i++) d[i] = r() * Math.exp(-i / SR * 60) * 0.6;
      fadeEdges(d, 0.001, 0.01);
    });
  }

  /** Piano-like tone, cached per midi note. */
  _note(m) {
    const k = 'n' + m;
    if (!this.buffers[k]) {
      const f = NOTE(m);
      this.buffers[k] = buf(this.ctx, 4.0, (d, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / SR;
          let v = 0;
          for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t * (1 + 0.0004 * h * h)) * Math.exp(-t * (0.9 + h * 0.7)) / (h * h * 0.6 + 0.4);
          d[i] = v * (1 - Math.exp(-t * 300)) * 0.35;
        }
        fadeEdges(d, 0.001, 0.2);
      });
    }
    return this.buffers[k];
  }

  _src(name, { vol = 1, rate = 1, x = null, wet = 0.25, loop = false, bus = null } = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.buffers[name];
    s.playbackRate.value = rate;
    s.loop = loop;
    const g = ctx.createGain();
    g.gain.value = vol;
    let node = s.connect(g);
    if (x !== null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const dx = x - this.listenerX;
      p.pan.value = Math.max(-0.8, Math.min(0.8, dx / 10));
      g.gain.value = vol / (1 + Math.max(0, Math.abs(dx) - 3) * 0.12);
      node = node.connect(p);
    }
    node.connect(bus || this.master);
    if (wet > 0 && !bus) {
      const wg = ctx.createGain(); wg.gain.value = wet; node.connect(wg).connect(this.verb);
    }
    return { s, g };
  }

  play(name, opts = {}) {
    const n = this._src(name, opts);
    if (n) n.s.start(this.ctx.currentTime + (opts.delay || 0));
    return n;
  }

  step(surface, x) {
    const k = Math.floor(Math.random() * 4);
    this.play((surface === 'wood' ? 'step_wood' : 'step_snow') + k, { vol: surface === 'wood' ? 0.35 : 0.45, rate: 0.9 + Math.random() * 0.2, x, wet: 0.1 });
  }

  /** Named looping layer with smooth volume changes. */
  loop(name, vol, fade = 1.0, opts = {}) {
    if (!this.ctx) return;
    let l = this.loops[name];
    if (!l) {
      const n = this._src(opts.buffer || name, { vol: 0, loop: true, wet: opts.wet ?? 0.15, rate: opts.rate || 1 });
      if (!n) return;
      n.s.start();
      l = this.loops[name] = n;
    }
    const t = this.ctx.currentTime;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setValueAtTime(l.g.gain.value, t);
    l.g.gain.linearRampToValueAtTime(vol, t + Math.max(0.01, fade));
    if (opts.rate) l.s.playbackRate.setTargetAtTime(opts.rate, t, 0.4);
  }

  stopLoop(name, fade = 1.0) {
    const l = this.loops[name];
    if (!l) return;
    this.loop(name, 0, fade);
    l.s.stop(this.ctx.currentTime + fade + 0.05);
    delete this.loops[name];
  }

  /** Slow, sparse piano theme (A minor). Loops until stopped. */
  startTheme(intensity = 1) {
    if (!this.ctx || this._theme) return;
    const seq = [[57, 64, 69], [72], [71], [69], [64], [65, 60], [69], [67], [64], [62, 57], [65], [64], [62], [60], [59, 52], [64]];
    let i = 0;
    const tick = () => {
      if (!this._theme) return;
      const chord = seq[i % seq.length];
      chord.forEach((m, j) => this._playNote(m, (j === 0 && chord.length > 1 ? 0.5 : 0.7) * intensity, j * 0.04));
      i++;
      this._themeTimer = setTimeout(tick, (i % 4 === 0 ? 2600 : 1300));
    };
    this._theme = true;
    tick();
  }

  stopTheme() {
    this._theme = false;
    clearTimeout(this._themeTimer);
  }

  /** Single sad chord for memories / discoveries. */
  sting(notes = [57, 60, 64, 71]) {
    if (!this.ctx) return;
    notes.forEach((m, j) => this._playNote(m, 0.5, j * 0.12));
  }

  _playNote(m, vol, delay) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this._note(m);
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.musicBus);
    s.start(ctx.currentTime + delay);
  }

  setMasterVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
}

export const sound = new Sound();
