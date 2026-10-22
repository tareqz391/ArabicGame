import { t, onLang, getLang } from '../game/i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/** DOM overlay: menus, touch HUD, subtitles, cards. Text is re-rendered on language change. */
export class UI {
  constructor(root) {
    this.root = root;
    this._i18n = [];
    root.innerHTML = '';
    // HUD
    this.hud = el('div', 'hud hidden');
    this.joyZone = el('div', 'joy-zone');
    this.joyBase = el('div', 'joy-base');
    this.joyKnob = el('div', 'joy-knob');
    this.joyBase.appendChild(this.joyKnob);
    this.joyZone.appendChild(this.joyBase);
    this.hud.appendChild(this.joyZone);
    const btns = el('div', 'buttons');
    this.buttons = {};
    const mk = (name, key, icon) => {
      const b = el('div', `btn btn-${name}`);
      b.innerHTML = `<span class="ico">${icon}</span><span class="lbl"></span>`;
      this._label(b.querySelector('.lbl'), key);
      btns.appendChild(b);
      this.buttons[name] = b;
      return b;
    };
    mk('light', 'btn.light', '<svg viewBox="0 0 24 24"><path d="M9 2h6l-1 7h3l-6 13 1-9H8z" fill="currentColor"/></svg>');
    mk('crouch', 'btn.crouch', '<svg viewBox="0 0 24 24"><path d="M5 18h14v2H5zM12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-3 6h6l2 5h-3l-1-2-1 2H8z" fill="currentColor"/></svg>');
    mk('act', 'btn.act', '<svg viewBox="0 0 24 24"><path d="M8 11V5a1.5 1.5 0 0 1 3 0v5h1V3.5a1.5 1.5 0 0 1 3 0V10h1V5.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14a1.5 1.5 0 0 1 2.4-1.8z" fill="currentColor"/></svg>');
    mk('jump', 'btn.jump', '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="currentColor"/></svg>');
    this.hud.appendChild(btns);
    this.pauseBtn = el('div', 'pause-btn', '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor"/></svg>');
    this.hud.appendChild(this.pauseBtn);
    this.buttons.pause = this.pauseBtn;
    this.objective = el('div', 'objective');
    this.hud.appendChild(this.objective);
    this.saveIcon = el('div', 'save-icon');
    this._label(this.saveIcon, 'saved');
    this.hud.appendChild(this.saveIcon);
    root.appendChild(this.hud);

    // subtitles + cards
    this.subtitle = el('div', 'subtitle');
    root.appendChild(this.subtitle);
    this.prompt = el('div', 'world-prompt');
    root.appendChild(this.prompt);
    this.titleCard = el('div', 'title-card');
    root.appendChild(this.titleCard);
    this.fade = el('div', 'fade');
    root.appendChild(this.fade);
    this.photo = el('div', 'photo hidden');
    this.photo.innerHTML = `<div class="photo-card"><div class="photo-front"><canvas width="560" height="400"></canvas><div class="photo-cap"></div></div><div class="photo-back"><p class="photo-text"></p></div></div><div class="photo-hint"></div>`;
    root.appendChild(this.photo);
    this._label($('.photo-cap', this.photo), 'photo.name');
    this._label($('.photo-text', this.photo), 'photo.back');
    this._label($('.photo-hint', this.photo), 'photo.tap');

    // menu
    this.menu = el('div', 'menu hidden');
    this.menu.innerHTML = `
      <div class="menu-inner">
        <h1 class="logo"><span class="logo-en">THE LAST SNOW</span><span class="logo-ar">الثلج الأخير</span></h1>
        <div class="menu-buttons">
          <button data-act="new"></button>
          <button data-act="continue"></button>
          <button data-act="lang"></button>
          <button data-act="quality"></button>
        </div>
        <p class="menu-note"></p>
      </div>`;
    root.appendChild(this.menu);
    const mb = this.menu.querySelectorAll('button');
    this._label(mb[0], 'menu.new');
    this._label(mb[1], 'menu.continue');
    this._label(mb[2], 'menu.lang');
    this._label($('.menu-note', this.menu), 'menu.demo');
    this.menuButtons = { new: mb[0], continue: mb[1], lang: mb[2], quality: mb[3] };

    // pause
    this.pause = el('div', 'pause hidden');
    this.pause.innerHTML = `<div class="menu-inner small"><h2></h2><div class="menu-buttons"><button data-act="resume"></button><button data-act="fps"></button><button data-act="lang"></button><button data-act="menu"></button></div></div>`;
    root.appendChild(this.pause);
    const pb = this.pause.querySelectorAll('button');
    this._label($('h2', this.pause), 'pause.title');
    this._label(pb[0], 'pause.resume');
    this._label(pb[2], 'menu.lang');
    this._label(pb[3], 'pause.menu');
    this.pauseButtons = { resume: pb[0], fps: pb[1], lang: pb[2], menu: pb[3] };

    // end card
    this.end = el('div', 'end hidden');
    this.end.innerHTML = `<div class="menu-inner"><h2></h2><p></p><div class="menu-buttons"><button></button></div></div>`;
    root.appendChild(this.end);
    this._label($('h2', this.end), 'end.title');
    this._label($('p', this.end), 'end.next');
    this._label($('button', this.end), 'end.menu');
    this.endButton = $('button', this.end);

    // loading + rotate
    this.loading = el('div', 'loading');
    this.loading.innerHTML = `<div class="logo"><span class="logo-en">THE LAST SNOW</span><span class="logo-ar">الثلج الأخير</span></div><div class="bar"><i></i></div><div class="lbl"></div>`;
    root.appendChild(this.loading);
    this._label($('.lbl', this.loading), 'loading');
    this.rotate = el('div', 'rotate');
    this.rotate.innerHTML = `<svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 40a18 18 0 0 1-14 14" fill="none" stroke="currentColor" stroke-width="3"/></svg><p></p>`;
    this._label($('p', this.rotate), 'rotate');
    root.appendChild(this.rotate);

    onLang(() => this.refresh());
    this.refresh();
  }

  _label(node, key) { this._i18n.push([node, key]); node.textContent = t(key); }

  refresh() {
    for (const [n, k] of this._i18n) n.textContent = t(k);
    if (this._subKey) this._renderSub();
    if (this._objKey) this.objective.textContent = t(this._objKey);
    if (this._actKey !== undefined) this.setActLabel(this._actKey);
    document.body.classList.toggle('rtl', getLang() === 'ar');
  }

  setProgress(p) { $('.bar i', this.loading).style.width = `${Math.round(p * 100)}%`; }
  hideLoading() { this.loading.classList.add('gone'); setTimeout(() => this.loading.remove(), 900); }

  show(node, on = true) { node.classList.toggle('hidden', !on); }

  setActLabel(key) {
    this._actKey = key;
    const b = this.buttons.act;
    b.classList.toggle('ready', !!key);
    b.querySelector('.lbl').textContent = key ? t(key) : t('btn.act');
  }

  setObjective(key) {
    this._objKey = key;
    this.objective.classList.remove('flash');
    void this.objective.offsetWidth;
    if (key) this.objective.classList.add('flash');
    this.objective.textContent = key ? t(key) : '';
  }

  flashSaved() {
    this.saveIcon.classList.remove('on');
    void this.saveIcon.offsetWidth;
    this.saveIcon.classList.add('on');
  }

  /** Subtitle with optional speaker; resolves after `dur` seconds (or when tapped). */
  say(key, { speaker = null, dur = null, style = '' } = {}) {
    this._subKey = key;
    this._subSpeaker = speaker;
    this._subStyle = style;
    this._renderSub();
    const text = t(key);
    const d = dur ?? Math.min(6, 1.6 + text.length * 0.055);
    return new Promise((res) => {
      clearTimeout(this._subTimer);
      const done = () => { window.removeEventListener('pointerdown', skip); res(); };
      const skip = (e) => { if (e.target.closest('.btn,.joy-zone,.pause-btn')) return; clearTimeout(this._subTimer); this.clearSub(); done(); };
      setTimeout(() => window.addEventListener('pointerdown', skip), 400);
      this._subTimer = setTimeout(() => { this.clearSub(); done(); }, d * 1000);
    });
  }

  _renderSub() {
    const sp = this._subSpeaker ? `<span class="speaker">${t(this._subSpeaker)}</span>` : '';
    this.subtitle.innerHTML = `${sp}<span class="line ${this._subStyle}">${t(this._subKey)}</span>`;
    this.subtitle.classList.add('on');
  }

  clearSub() {
    this._subKey = null;
    this.subtitle.classList.remove('on');
  }

  async title(key, dur = 3.5) {
    this.titleCard.textContent = t(key);
    this.titleCard.classList.add('on');
    await new Promise((r) => setTimeout(r, dur * 1000));
    this.titleCard.classList.remove('on');
    await new Promise((r) => setTimeout(r, 900));
  }

  fadeTo(alpha, seconds = 1) {
    this.fade.style.transition = `opacity ${seconds}s ease`;
    this.fade.style.opacity = alpha;
    return new Promise((r) => setTimeout(r, seconds * 1000));
  }

  showPrompt(text, x, y) {
    if (!text) { this.prompt.classList.remove('on'); return; }
    this.prompt.textContent = text;
    this.prompt.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    this.prompt.classList.add('on');
  }

  /** The old photo from Adam's pocket: front (drawn), then flip to the handwritten back. */
  showPhoto() {
    const cv = $('canvas', this.photo);
    drawPhoto(cv);
    this.photo.classList.remove('hidden', 'flipped');
    return new Promise((res) => {
      let stage = 0;
      const onTap = () => {
        stage++;
        if (stage === 1) this.photo.classList.add('flipped');
        else { this.photo.removeEventListener('pointerdown', onTap); this.photo.classList.add('hidden'); res(); }
      };
      setTimeout(() => this.photo.addEventListener('pointerdown', onTap), 600);
    });
  }
}

/** Sepia snapshot: two brothers in front of a small station, winter 1998. */
function drawPhoto(cv) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d9c6a3'); sky.addColorStop(1, '#a88e67');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // mountains + station silhouette
  g.fillStyle = '#b8a07a';
  g.beginPath(); g.moveTo(0, 210); g.lineTo(90, 120); g.lineTo(170, 190); g.lineTo(260, 100); g.lineTo(380, 200); g.lineTo(470, 130); g.lineTo(560, 200); g.lineTo(560, 400); g.lineTo(0, 400); g.fill();
  g.fillStyle = '#7d6748';
  g.fillRect(300, 170, 230, 120);
  g.beginPath(); g.moveTo(290, 172); g.lineTo(415, 110); g.lineTo(540, 172); g.fill();
  g.fillStyle = '#e8d7b0'; g.fillRect(330, 205, 26, 40); g.fillRect(380, 205, 26, 40); g.fillRect(470, 205, 26, 40);
  g.fillStyle = '#d8c7a2'; g.fillRect(0, 290, W, 110);
  // two figures: older brother (red scarf) and small brother
  const fig = (x, y, s, scarf) => {
    g.fillStyle = '#3d2f22';
    g.beginPath(); g.ellipse(x, y, 16 * s, 18 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 26 * s, y + 20 * s); g.lineTo(x + 26 * s, y + 20 * s); g.lineTo(x + 34 * s, y + 120 * s); g.lineTo(x - 34 * s, y + 120 * s); g.fill();
    g.fillRect(x - 18 * s, y + 118 * s, 12 * s, 40 * s); g.fillRect(x + 6 * s, y + 118 * s, 12 * s, 40 * s);
    if (scarf) { g.fillStyle = '#8f2a1e'; g.fillRect(x - 20 * s, y + 18 * s, 40 * s, 10 * s); g.fillRect(x + 4 * s, y + 24 * s, 9 * s, 34 * s); }
  };
  fig(205, 160, 1.15, true);
  fig(270, 215, 0.72, false);
  // grain, scratches, vignette
  const id = g.getImageData(0, 0, W, H);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,25,10,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,245,220,0.35)'; g.lineWidth = 1;
  for (let k = 0; k < 6; k++) { g.beginPath(); const x = Math.random() * W; g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 30, H); g.stroke(); }
}
