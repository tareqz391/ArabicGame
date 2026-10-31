/* =====================================================================
   استوديو المونتاج — محرر فيديو متكامل يعمل بالكامل داخل المتصفح
   ===================================================================== */
'use strict';

/* ============================ أدوات عامة ============================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const pad2 = (n) => String(n).padStart(2, '0');
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isArabic = (s) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s || '');
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let c = o;
  for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null) c[ks[i]] = {}; c = c[ks[i]]; }
  c[ks[ks.length - 1]] = v;
}
function fmtTime(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t % 1) * 100);
  return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}
function fmtShort(t) {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('hide'), 2600);
  setTimeout(() => el.remove(), 3000);
}
function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const safeName = (s) => (s || 'project').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project';

/* ============================ قاعدة البيانات (IndexedDB) ============================ */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open('montage-studio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  _req(mode, fn) {
    return new Promise((res, rej) => {
      if (!this.db) return res(null);
      const store = this.db.transaction('media', mode).objectStore('media');
      const r = fn(store);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  put(rec) { return this._req('readwrite', (s) => s.put(rec)); },
  get(id) { return this._req('readonly', (s) => s.get(id)); },
  del(id) { return this._req('readwrite', (s) => s.delete(id)); },
  clear() { return this._req('readwrite', (s) => s.clear()); },
};

/* ============================ ثوابت ============================ */
const LS_KEY = 'montage_studio_project_v1';
const TRACK_H = { visual: 64, audio: 52 };
const PEAK_RATE = 50; // قمم الموجة الصوتية لكل ثانية
const DEFAULT_FILTERS = { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0 };
const DEFAULT_TEXT = {
  content: 'نص', font: 'Cairo', size: 96, bold: true, italic: false, color: '#ffffff', align: 'center',
  stroke: '#000000', strokeWidth: 0, shadow: true, glow: false, bg: '#000000', bgOpacity: 0, lineHeight: 1.3,
};
const FONTS = [
  ['Cairo', 'القاهرة — Cairo'], ['Tajawal', 'تجوال — Tajawal'], ['Amiri', 'أميري — Amiri'],
  ['Reem Kufi', 'ريم كوفي — Reem Kufi'], ['Lalezar', 'لاله‌زار — Lalezar'], ['Changa', 'شانغا — Changa'],
  ['Aref Ruqaa', 'عارف رقعة — Aref Ruqaa'], ['Arial', 'Arial'], ['Georgia', 'Georgia'], ['Courier New', 'Courier New'],
];
const ANIMS = [
  ['none', 'بدون'], ['fade', 'تلاشي'], ['slide-left', 'انزلاق لليسار'], ['slide-right', 'انزلاق لليمين'],
  ['slide-up', 'انزلاق للأعلى'], ['slide-down', 'انزلاق للأسفل'], ['zoom-in', 'تكبير'], ['zoom-out', 'تصغير'],
  ['spin', 'دوران'], ['blur', 'ضبابية'], ['typewriter', 'آلة كاتبة (للنصوص)'],
];
const FILTER_PRESETS = [
  ['أصلي', {}],
  ['أبيض وأسود', { grayscale: 100, contrast: 110 }],
  ['قديم', { sepia: 70, contrast: 90, brightness: 105, saturate: 80 }],
  ['دافئ', { sepia: 25, saturate: 125, brightness: 103 }],
  ['بارد', { saturate: 85, hue: -12, brightness: 102, contrast: 105 }],
  ['سينمائي', { contrast: 125, saturate: 85, brightness: 95 }],
  ['حيوي', { saturate: 165, contrast: 110 }],
  ['باهت', { contrast: 80, saturate: 70, brightness: 110 }],
  ['درامي', { contrast: 150, grayscale: 30, brightness: 90 }],
  ['حلم', { blur: 2, brightness: 110, saturate: 120 }],
  ['سلبي', { invert: 100 }],
];
const RESOLUTIONS = [
  ['1920x1080', 'أفقي 16:9 — 1080p'], ['1280x720', 'أفقي 16:9 — 720p'], ['3840x2160', 'أفقي 16:9 — 4K'],
  ['1080x1920', 'عمودي 9:16 — ريلز/تيك توك'], ['1080x1080', 'مربع 1:1 — إنستغرام'], ['1080x1350', 'عمودي 4:5 — منشور'],
  ['2560x1080', 'سينمائي 21:9'],
];
const TEXT_PRESETS = [
  { name: 'عنوان رئيسي', text: { content: 'عنوان رئيسي', font: 'Cairo', size: 140, bold: true }, animIn: 'zoom-in', animOut: 'fade' },
  { name: 'عنوان فرعي', text: { content: 'عنوان فرعي', font: 'Tajawal', size: 80, bold: false, color: '#e2e8f0' }, y: 0.12, animIn: 'slide-up', animOut: 'fade' },
  { name: 'ترجمة سفلية', text: { content: 'اكتب الترجمة هنا', font: 'Tajawal', size: 56, bold: true, bgOpacity: 0.6, shadow: false }, y: 0.38, animIn: 'fade', animOut: 'fade' },
  { name: 'نص بإطار', text: { content: 'نص بإطار', font: 'Lalezar', size: 130, bold: false, color: '#facc15', strokeWidth: 12 }, animIn: 'spin', animOut: 'zoom-out' },
  { name: 'نيون متوهج', text: { content: 'نيون', font: 'Reem Kufi', size: 140, color: '#22d3ee', glow: true, shadow: false }, animIn: 'fade', animOut: 'blur' },
  { name: 'خط عربي', text: { content: 'بسم الله الرحمن الرحيم', font: 'Aref Ruqaa', size: 110, color: '#fde68a' }, animIn: 'blur', animOut: 'fade' },
  { name: 'آلة كاتبة', text: { content: 'نص يظهر حرفاً حرفاً...', font: 'Changa', size: 72, bold: false }, animIn: 'typewriter', animInDur: 2 },
  { name: 'شريط أخبار', text: { content: 'عاجل: اكتب الخبر هنا', font: 'Cairo', size: 52, bold: true, bg: '#dc2626', bgOpacity: 1, shadow: false }, y: 0.4, animIn: 'slide-left', animOut: 'slide-left' },
];
const COLOR_PRESETS = ['#000000', '#ffffff', '#0f172a', '#1e3a8a', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#facc15', '#16a34a', '#0891b2', '#065f46', '#78350f', '#334155', '#f5f5dc'];

/* ============================ الحالة ============================ */
function newProject() {
  const tr = (kind, name) => ({ id: uid('t'), kind, name, hidden: false, muted: false, locked: false });
  return {
    version: 1, name: 'مشروع جديد', width: 1920, height: 1080, fps: 30, background: '#000000',
    media: [],
    tracks: [tr('visual', 'نصوص'), tr('visual', 'فيديو 2'), tr('visual', 'فيديو 1'), tr('audio', 'صوت 1'), tr('audio', 'صوت 2')],
    clips: [],
  };
}
function makeClip(type, trackId, start, duration, extra = {}) {
  const c = {
    id: uid('c'), type, trackId, mediaId: null, start, duration, offset: 0, speed: 1, volume: 1, muted: false,
    x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, fit: 'contain', flipH: false, kenBurns: false,
    filters: { ...DEFAULT_FILTERS }, animIn: 'none', animInDur: 0.6, animOut: 'none', animOutDur: 0.6,
    audioFadeIn: 0, audioFadeOut: 0, text: null, color: '#1e293b',
  };
  Object.assign(c, extra);
  c.filters = { ...DEFAULT_FILTERS, ...(extra.filters || {}) };
  if (type === 'text') c.text = { ...DEFAULT_TEXT, ...(extra.text || {}) };
  return c;
}

let project = newProject();
const media = new Map(); // id -> {id,name,type,blob,url,duration,width,height,thumb,img,peaks,hasAudio}
const state = { time: 0, playing: false, selectedId: null, pxPerSec: 60, snap: true, exporting: false, clipboard: null };
let undoStack = [], redoStack = [];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const lanesEl = $('#lanes');
const headersEl = $('#trackHeaders');
const tlScroll = $('#tlScroll');
const tlContent = $('#tlContent');
const rulerCanvas = $('#ruler');
const drawnBoxes = new Map();

const getTrack = (id) => project.tracks.find((t) => t.id === id);
const getClip = (id) => project.clips.find((c) => c.id === id);
const getSelected = () => (state.selectedId ? getClip(state.selectedId) : null);
const projectEnd = () => project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
const trackEnd = (tid) => project.clips.filter((c) => c.trackId === tid).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
const isVisualType = (t) => t === 'video' || t === 'image' || t === 'text' || t === 'color';
const hasSource = (c) => c.type === 'video' || c.type === 'audio';
const compatible = (c, tr) => (c.type === 'audio' ? tr.kind === 'audio' : tr.kind === 'visual');
const isLocked = (c) => { const t = getTrack(c.trackId); return !t || t.locked; };

/* ============================ الصوت (Web Audio) ============================ */
let audioCtx = null, masterGain = null, exportDest = null;
function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    if (audioCtx.createMediaStreamDestination) {
      exportDest = audioCtx.createMediaStreamDestination();
      masterGain.connect(exportDest);
    }
  } catch (e) { audioCtx = null; }
}
function resumeAudio() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}); }

/* عنصر وسائط مستقل لكل مقطع (حتى يمكن استخدام نفس الملف في عدة مقاطع) */
const clipEls = new Map();
function getClipEl(clip) {
  let e = clipEls.get(clip.id);
  if (e && e.mediaId === clip.mediaId) return e;
  if (e) disposeClipEl(clip.id);
  const m = media.get(clip.mediaId);
  if (!m) return null;
  const el = document.createElement(m.type === 'audio' ? 'audio' : 'video');
  el.preload = 'auto';
  el.playsInline = true;
  el.src = m.url;
  e = { el, mediaId: m.id, gain: null, src: null };
  if (audioCtx) {
    try {
      e.src = audioCtx.createMediaElementSource(el);
      e.gain = audioCtx.createGain();
      e.src.connect(e.gain);
      e.gain.connect(masterGain);
    } catch (err) { e.src = e.gain = null; }
  }
  el.addEventListener('seeked', requestRender);
  el.addEventListener('loadeddata', requestRender);
  clipEls.set(clip.id, e);
  return e;
}
function disposeClipEl(id) {
  const e = clipEls.get(id);
  if (!e) return;
  try { e.el.pause(); } catch (_) {}
  try { e.src && e.src.disconnect(); e.gain && e.gain.disconnect(); } catch (_) {}
  e.el.removeAttribute('src');
  try { e.el.load(); } catch (_) {}
  clipEls.delete(id);
}
function cleanupClipEls() {
  const ids = new Set(project.clips.map((c) => c.id));
  for (const id of Array.from(clipEls.keys())) if (!ids.has(id)) disposeClipEl(id);
  for (const c of project.clips) { const e = clipEls.get(c.id); if (e && e.mediaId !== c.mediaId) disposeClipEl(c.id); }
}

function clipVolumeAt(clip, t) {
  const tr = getTrack(clip.trackId);
  if (!tr || clip.muted || tr.muted) return 0;
  let v = clip.volume;
  const local = t - clip.start, rem = clip.duration - local;
  if (clip.audioFadeIn > 0 && local < clip.audioFadeIn) v *= clamp(local / clip.audioFadeIn, 0, 1);
  if (clip.audioFadeOut > 0 && rem < clip.audioFadeOut) v *= clamp(rem / clip.audioFadeOut, 0, 1);
  return v;
}

/* مزامنة عناصر الفيديو/الصوت مع مؤشر الخط الزمني */
function syncMedia() {
  const t = state.time;
  for (const clip of project.clips) {
    if (!hasSource(clip)) continue;
    const active = t >= clip.start && t < clip.start + clip.duration;
    if (!active) {
      const e = clipEls.get(clip.id);
      if (e && !e.el.paused) e.el.pause();
      // تحميل مسبق للمقاطع القادمة
      if (state.playing && clip.start > t && clip.start - t < 1.5) {
        const e2 = getClipEl(clip);
        if (e2 && !e2.el.seeking && Math.abs(e2.el.currentTime - clip.offset) > 0.05) e2.el.currentTime = clip.offset;
      }
      continue;
    }
    const e = getClipEl(clip);
    if (!e) continue;
    const el = e.el;
    const target = clip.offset + (t - clip.start) * clip.speed;
    const vol = clipVolumeAt(clip, t);
    if (e.gain) e.gain.gain.value = vol; else el.volume = clamp(vol, 0, 1);
    if (Math.abs(el.playbackRate - clip.speed) > 0.001) el.playbackRate = clip.speed;
    if (state.playing) {
      if (!el.seeking && Math.abs(el.currentTime - target) > 0.3) el.currentTime = target;
      if (el.paused && !el.ended) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
    }
  }
}

/* ============================ الوسائط ============================ */
function detectType(file) {
  const t = file.type || '';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('image/')) return 'image';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'ogv', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'weba'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image';
  return null;
}
function loadImage(url) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; });
}
function makeThumb(src, w, h) {
  try {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 90;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 160, 90);
    if (w && h) {
      const s = Math.max(160 / w, 90 / h);
      g.drawImage(src, (160 - w * s) / 2, (90 - h * s) / 2, w * s, h * s);
    }
    return c.toDataURL('image/jpeg', 0.7);
  } catch (e) { return ''; }
}
function probeVideo(url) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true;
    let done = false, phase = 'meta', dur = 0;
    const finish = (thumb) => {
      if (done) return; done = true;
      res({ duration: dur, width: v.videoWidth, height: v.videoHeight, thumb: thumb || '' });
      v.removeAttribute('src'); try { v.load(); } catch (_) {}
    };
    const goThumb = () => { phase = 'thumb'; v.currentTime = Math.min(1, dur / 3 || 0); };
    v.onloadedmetadata = () => {
      if (isFinite(v.duration) && v.duration > 0) { dur = v.duration; goThumb(); }
      else { phase = 'dur'; v.currentTime = 1e7; } // ملفات webm بدون مدة معروفة
    };
    v.onseeked = () => {
      if (phase === 'dur') { dur = isFinite(v.duration) ? v.duration : v.currentTime; goThumb(); }
      else if (phase === 'thumb') finish(makeThumb(v, v.videoWidth, v.videoHeight));
    };
    v.onerror = () => finish('');
    setTimeout(() => finish(''), 10000);
    v.src = url;
  });
}
function probeAudio(url) {
  return new Promise((res) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    let done = false, phase = 'meta';
    const finish = (d) => { if (done) return; done = true; res(isFinite(d) ? d : 0); a.removeAttribute('src'); };
    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) finish(a.duration);
      else { phase = 'dur'; a.currentTime = 1e7; }
    };
    a.onseeked = () => { if (phase === 'dur') finish(isFinite(a.duration) ? a.duration : a.currentTime); };
    a.onerror = () => finish(0);
    setTimeout(() => finish(0), 10000);
    a.src = url;
  });
}
async function computePeaks(m) {
  if (m.type === 'image' || !audioCtx || m.blob.size > 400 * 1024 * 1024) return;
  try {
    const buf = await m.blob.arrayBuffer();
    const ab = await audioCtx.decodeAudioData(buf);
    const n = Math.ceil(ab.duration * PEAK_RATE);
    const chans = [];
    for (let i = 0; i < Math.min(2, ab.numberOfChannels); i++) chans.push(ab.getChannelData(i));
    const step = ab.sampleRate / PEAK_RATE;
    const peaks = new Float32Array(n);
    let gmax = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.floor(i * step), e = Math.min(chans[0].length, Math.floor((i + 1) * step));
      let mx = 0;
      for (const ch of chans) for (let j = s; j < e; j += 3) { const v = Math.abs(ch[j]); if (v > mx) mx = v; }
      peaks[i] = mx;
      if (mx > gmax) gmax = mx;
    }
    if (gmax > 0) for (let i = 0; i < n; i++) peaks[i] /= gmax;
    m.peaks = peaks;
    m.hasAudio = gmax > 0.001;
    renderTimeline();
  } catch (e) {
    m.peaks = null; m.hasAudio = false;
  }
}
async function registerMedia(rec) {
  const url = URL.createObjectURL(rec.blob);
  const m = { id: rec.id, name: rec.name, type: rec.type, blob: rec.blob, url, duration: 0, width: 0, height: 0, thumb: '', img: null, peaks: null, hasAudio: false };
  if (m.type === 'image') {
    m.img = await loadImage(url);
    m.width = m.img.naturalWidth || 1000; m.height = m.img.naturalHeight || 1000;
    m.thumb = makeThumb(m.img, m.width, m.height);
  } else if (m.type === 'video') {
    Object.assign(m, await probeVideo(url));
    if (!m.width) throw new Error('video not decodable');
  } else {
    m.duration = await probeAudio(url);
  }
  media.set(m.id, m);
  computePeaks(m);
  return m;
}
async function importFiles(fileList) {
  const files = Array.from(fileList || []);
  const added = [];
  for (const f of files) {
    const type = detectType(f);
    if (!type) { toast(`نوع ملف غير مدعوم: ${f.name}`, 'error'); continue; }
    const id = uid('m');
    const rec = { id, name: f.name, type, blob: f };
    setSaveStatus('جارٍ الاستيراد…');
    try {
      const m = await registerMedia(rec);
      try { await DB.put(rec); } catch (e) { toast('تعذر حفظ الملف محلياً (قد يكون كبيراً جداً)', 'error'); }
      project.media.push({ id, name: f.name, type, duration: m.duration, width: m.width, height: m.height });
      added.push(m);
    } catch (e) {
      toast(`تعذر قراءة الملف: ${f.name}`, 'error');
    }
  }
  renderMediaLibrary();
  saveSoon();
  if (added.length) toast(`تم استيراد ${added.length} ملف`, 'success');
  return added;
}
async function deleteMedia(id) {
  const m = media.get(id);
  if (!m) return;
  const used = project.clips.filter((c) => c.mediaId === id).length;
  if (!confirm(used ? `سيتم حذف "${m.name}" و ${used} مقطع يستخدمه من الخط الزمني. متابعة؟` : `حذف "${m.name}"؟`)) return;
  if (used) checkpoint();
  project.clips = project.clips.filter((c) => c.mediaId !== id);
  project.media = project.media.filter((x) => x.id !== id);
  // نُبقي الملف في الذاكرة حتى تعمل عملية التراجع، ونحذفه من التخزين الدائم
  DB.del(id).catch(() => {});
  if (state.selectedId && !getClip(state.selectedId)) state.selectedId = null;
  cleanupClipEls();
  changed();
  renderMediaLibrary();
}

/* ============================ التراجع والحفظ ============================ */
let burstTimer = null;
function serialize() {
  const { name, width, height, fps, background, tracks, clips } = project;
  return JSON.stringify({ name, width, height, fps, background, tracks, clips });
}
function checkpoint(burst = false) {
  if (burst && burstTimer) {
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => (burstTimer = null), 700);
    return;
  }
  undoStack.push(serialize());
  if (undoStack.length > 150) undoStack.shift();
  redoStack = [];
  if (burst) burstTimer = setTimeout(() => (burstTimer = null), 700);
  updateUndoButtons();
}
function restore(s) {
  const o = JSON.parse(s);
  Object.assign(project, o);
  project.clips = project.clips.filter((c) => !c.mediaId || media.has(c.mediaId));
  // إعادة الوسائط المحذوفة إلى المكتبة إن عادت مقاطعها
  for (const c of project.clips) {
    if (c.mediaId && !project.media.some((x) => x.id === c.mediaId)) {
      const m = media.get(c.mediaId);
      project.media.push({ id: m.id, name: m.name, type: m.type, duration: m.duration, width: m.width, height: m.height });
      DB.put({ id: m.id, name: m.name, type: m.type, blob: m.blob }).catch(() => {});
    }
  }
  if (state.selectedId && !getClip(state.selectedId)) state.selectedId = null;
  cleanupClipEls();
  renderAll();
  saveSoon();
}
function undo() {
  if (!undoStack.length) return;
  clearTimeout(burstTimer); burstTimer = null;
  redoStack.push(serialize());
  restore(undoStack.pop());
  updateUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(serialize());
  restore(redoStack.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  $('#btnUndo').disabled = !undoStack.length;
  $('#btnRedo').disabled = !redoStack.length;
}
let saveTimer = null;
function setSaveStatus(s) { $('#saveStatus').textContent = s; }
function saveSoon() {
  setSaveStatus('جارٍ الحفظ…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}
function saveNow() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(project)); setSaveStatus('✓ محفوظ'); }
  catch (e) { setSaveStatus('⚠ تعذر الحفظ'); }
}
function normalizeClip(c) {
  const base = makeClip(c.type, c.trackId, c.start, c.duration);
  const out = Object.assign(base, c);
  out.filters = { ...DEFAULT_FILTERS, ...(c.filters || {}) };
  if (out.type === 'text') out.text = { ...DEFAULT_TEXT, ...(c.text || {}) };
  return out;
}
async function loadSaved() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (_) {}
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    project = Object.assign(newProject(), p);
    if (!project.tracks.length) project.tracks = newProject().tracks;
    const metas = project.media || [];
    project.media = [];
    for (const meta of metas) {
      try {
        const rec = await DB.get(meta.id);
        if (rec && rec.blob) { await registerMedia(rec); project.media.push(meta); }
      } catch (e) { /* تجاهل الملف التالف */ }
    }
    project.clips = (project.clips || []).filter((c) => (!c.mediaId || media.has(c.mediaId)) && getTrack(c.trackId)).map(normalizeClip);
  } catch (e) {
    project = newProject();
  }
}
async function newProjectAction() {
  if (!confirm('بدء مشروع جديد؟ سيتم حذف المشروع الحالي وجميع ملفاته.')) return;
  pause();
  for (const id of Array.from(clipEls.keys())) disposeClipEl(id);
  for (const m of media.values()) URL.revokeObjectURL(m.url);
  media.clear();
  await DB.clear().catch(() => {});
  project = newProject();
  undoStack = []; redoStack = [];
  state.selectedId = null; state.time = 0;
  renderAll();
  saveNow();
  toast('تم إنشاء مشروع جديد', 'success');
}

/* بعد أي تعديل بنيوي */
function changed(opts = {}) {
  cleanupClipEls();
  renderTimeline();
  if (opts.inspector !== false) renderInspector();
  syncMedia();
  requestRender();
  saveSoon();
  updateUndoButtons();
}

/* ============================ التشغيل ============================ */
let rafId = 0, lastTs = 0, renderQueued = false;
function requestRender() {
  if (renderQueued || state.playing) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function play() {
  if (state.playing) return;
  resumeAudio();
  const end = projectEnd();
  if (end <= 0) { toast('أضف مقاطع إلى الخط الزمني أولاً'); return; }
  if (state.time >= end - 0.01) state.time = 0;
  startPlayback();
}
function startPlayback() {
  state.playing = true;
  lastTs = performance.now();
  updatePlayBtn();
  syncMedia();
  rafId = requestAnimationFrame(loop);
}
function pause() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(rafId);
  syncMedia();
  updatePlayBtn();
  updateTimeUI();
  requestRender();
}
function togglePlay() { state.playing ? pause() : play(); }
function loop(ts) {
  if (!state.playing) return;
  const dt = Math.min(0.25, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;
  state.time += dt;
  const end = state.exporting ? exportRange.to : projectEnd();
  if (state.time >= end) {
    state.time = end;
    render();
    if (state.exporting) { finishExport(); return; }
    pause();
    return;
  }
  syncMedia();
  render();
  updateTimeUI();
  followPlayhead();
  if (state.exporting) updateExportProgress();
  rafId = requestAnimationFrame(loop);
}
function seek(t) {
  state.time = Math.max(0, t);
  if (state.playing) lastTs = performance.now();
  syncMedia();
  updateTimeUI();
  requestRender();
}
function stepFrame(n) { pause(); seek(Math.round((state.time + n / project.fps) * project.fps) / project.fps); }
function updatePlayBtn() { $('#btnPlay').textContent = state.playing ? '❚❚' : '▶'; }

/* ============================ العرض (Canvas) ============================ */
function filterString(f, extraBlur = 0) {
  if (!f) return 'none';
  const p = [];
  if (f.brightness !== 100) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) p.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) p.push(`saturate(${f.saturate}%)`);
  if (f.hue) p.push(`hue-rotate(${f.hue}deg)`);
  const blur = (f.blur || 0) * (project.width / 1920) + extraBlur;
  if (blur > 0.01) p.push(`blur(${blur}px)`);
  if (f.grayscale) p.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) p.push(`sepia(${f.sepia}%)`);
  if (f.invert) p.push(`invert(${f.invert}%)`);
  return p.length ? p.join(' ') : 'none';
}
function computeAnim(clip, t) {
  const W = project.width, H = project.height;
  const local = t - clip.start, rem = clip.duration - local;
  const r = { alpha: clip.opacity, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, reveal: 1 };
  const apply = (type, p, dir) => { // p: 0 = مخفي ← 1 = ظاهر ، dir: 1 دخول / -1 خروج
    const q = 1 - p;
    switch (type) {
      case 'fade': r.alpha *= p; break;
      case 'slide-left': r.dx += dir > 0 ? q * W : -q * W; break;
      case 'slide-right': r.dx += dir > 0 ? -q * W : q * W; break;
      case 'slide-up': r.dy += dir > 0 ? q * H : -q * H; break;
      case 'slide-down': r.dy += dir > 0 ? -q * H : q * H; break;
      case 'zoom-in': r.scale *= 0.4 + 0.6 * p; r.alpha *= p; break;
      case 'zoom-out': r.scale *= 1 + 0.8 * q; r.alpha *= p; break;
      case 'spin': r.rot += q * Math.PI * (dir > 0 ? -1 : 1); r.scale *= 0.2 + 0.8 * p; r.alpha *= p; break;
      case 'blur': r.blur += q * 40 * (W / 1920); r.alpha *= p; break;
      case 'typewriter': if (clip.type === 'text') r.reveal = Math.min(r.reveal, p); else r.alpha *= p; break;
    }
  };
  if (clip.animIn !== 'none' && clip.animInDur > 0 && local < clip.animInDur) {
    const p = clamp(local / clip.animInDur, 0, 1);
    apply(clip.animIn, clip.animIn === 'typewriter' ? p : easeOut(p), 1);
  }
  if (clip.animOut !== 'none' && clip.animOutDur > 0 && rem < clip.animOutDur) {
    const p = clamp(rem / clip.animOutDur, 0, 1);
    apply(clip.animOut, clip.animOut === 'typewriter' ? p : easeOut(p), -1);
  }
  if (clip.kenBurns) r.scale *= 1 + 0.15 * clamp(local / clip.duration, 0, 1);
  return r;
}
const textFont = (tx) => `${tx.italic ? 'italic ' : ''}${tx.bold ? '700' : '400'} ${tx.size}px "${tx.font}", "Cairo", sans-serif`;
function drawText(clip, s, reveal) {
  const tx = clip.text;
  const full = tx.content || '';
  let content = full;
  if (reveal < 1) { const ch = Array.from(full); content = ch.slice(0, Math.ceil(ch.length * reveal)).join(''); }
  ctx.scale(s, s);
  ctx.font = textFont(tx);
  ctx.direction = isArabic(full) ? 'rtl' : 'ltr';
  ctx.textBaseline = 'middle';
  const allLines = full.split('\n');
  const lines = content.split('\n');
  const lh = tx.size * tx.lineHeight;
  const maxW = Math.max(tx.size * 0.5, ...allLines.map((l) => ctx.measureText(l).width));
  const totalH = allLines.length * lh;
  const pad = tx.size * 0.35;
  if (tx.bgOpacity > 0) {
    ctx.save();
    ctx.globalAlpha *= tx.bgOpacity;
    ctx.fillStyle = tx.bg;
    roundRect(ctx, -maxW / 2 - pad, -totalH / 2 - pad * 0.5, maxW + pad * 2, totalH + pad, pad * 0.5);
    ctx.fill();
    ctx.restore();
  }
  let x = 0;
  if (tx.align === 'right') { ctx.textAlign = 'right'; x = maxW / 2; }
  else if (tx.align === 'left') { ctx.textAlign = 'left'; x = -maxW / 2; }
  else ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    const y = -totalH / 2 + lh * (i + 0.5);
    if (tx.glow) { ctx.shadowColor = tx.color; ctx.shadowBlur = tx.size * 0.45; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    else if (tx.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = tx.size * 0.12; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = tx.size * 0.04; }
    if (tx.strokeWidth > 0) {
      ctx.lineWidth = tx.strokeWidth; ctx.strokeStyle = tx.stroke; ctx.lineJoin = 'round';
      ctx.strokeText(line, x, y);
      if (!tx.glow) ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = tx.color;
    ctx.fillText(line, x, y);
    if (tx.glow) ctx.fillText(line, x, y);
  });
  return { w: (maxW + pad * 2) * s, h: (totalH + pad) * s };
}
function drawClip(clip, t) {
  const W = project.width, H = project.height;
  const a = computeAnim(clip, t);
  if (a.alpha <= 0.001) return;
  let src = null, sw = 0, sh = 0;
  if (clip.type === 'video') {
    const e = getClipEl(clip);
    if (!e || e.el.readyState < 2 || !e.el.videoWidth) return;
    src = e.el; sw = e.el.videoWidth; sh = e.el.videoHeight;
  } else if (clip.type === 'image') {
    const m = media.get(clip.mediaId);
    if (!m || !m.img) return;
    src = m.img; sw = m.width; sh = m.height;
  }
  ctx.save();
  ctx.globalAlpha = clamp(a.alpha, 0, 1);
  ctx.filter = filterString(clip.filters, a.blur);
  const cx = W / 2 + clip.x * W + a.dx, cy = H / 2 + clip.y * H + a.dy;
  const rot = (clip.rotation * Math.PI) / 180 + a.rot;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const s = clip.scale * a.scale;
  let bw, bh;
  if (clip.type === 'text') {
    const sz = drawText(clip, s, a.reveal);
    bw = sz.w; bh = sz.h;
  } else if (clip.type === 'color') {
    bw = W * s; bh = H * s;
    ctx.fillStyle = clip.color;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  } else {
    if (clip.fit === 'stretch') { bw = W * s; bh = H * s; }
    else {
      const base = clip.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
      bw = sw * base * s; bh = sh * base * s;
    }
    if (clip.flipH) ctx.scale(-1, 1);
    ctx.drawImage(src, -bw / 2, -bh / 2, bw, bh);
  }
  ctx.restore();
  drawnBoxes.set(clip.id, { cx, cy, w: bw, h: bh, rot });
}
function render(opts = {}) {
  const W = project.width, H = project.height;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; fitCanvas(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.shadowColor = 'transparent';
  ctx.fillStyle = project.background;
  ctx.fillRect(0, 0, W, H);
  drawnBoxes.clear();
  const t = state.time;
  const tracks = project.tracks.filter((tr) => tr.kind === 'visual' && !tr.hidden);
  for (let i = tracks.length - 1; i >= 0; i--) {
    const clips = project.clips
      .filter((c) => c.trackId === tracks[i].id && isVisualType(c.type) && t >= c.start && t < c.start + c.duration)
      .sort((a, b) => a.start - b.start);
    for (const c of clips) drawClip(c, t);
  }
  if (!opts.clean && !state.exporting && !state.playing && state.selectedId) {
    const b = drawnBoxes.get(state.selectedId);
    if (b) {
      ctx.save();
      ctx.translate(b.cx, b.cy); ctx.rotate(b.rot);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2, W / 640);
      ctx.setLineDash([W / 120, W / 200]);
      ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
  }
}
function fitCanvas() {
  const st = $('#previewStage');
  const pad = 16;
  const sw = Math.max(50, st.clientWidth - pad * 2), sh = Math.max(50, st.clientHeight - pad * 2);
  const s = Math.min(sw / project.width, sh / project.height);
  canvas.style.width = Math.floor(project.width * s) + 'px';
  canvas.style.height = Math.floor(project.height * s) + 'px';
}

/* ============================ التفاعل مع المعاينة ============================ */
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * project.width, y: ((e.clientY - r.top) / r.height) * project.height };
}
function boxContains(b, p) {
  const dx = p.x - b.cx, dy = p.y - b.cy;
  const cos = Math.cos(-b.rot), sin = Math.sin(-b.rot);
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
}
function hitTest(p) {
  for (const tr of project.tracks) {
    if (tr.kind !== 'visual' || tr.hidden) continue;
    const clips = project.clips.filter((c) => c.trackId === tr.id && drawnBoxes.has(c.id)).sort((a, b) => b.start - a.start);
    for (const c of clips) if (boxContains(drawnBoxes.get(c.id), p)) return c;
  }
  return null;
}
function initPreviewInteraction() {
  canvas.addEventListener('pointerdown', (e) => {
    if (state.exporting) return;
    if (state.playing) { pause(); render(); }
    const p = canvasPoint(e);
    let c = getSelected();
    if (!(c && drawnBoxes.has(c.id) && boxContains(drawnBoxes.get(c.id), p))) c = hitTest(p);
    if (!c) { select(null); return; }
    if (c.id !== state.selectedId) select(c.id);
    if (isLocked(c)) return;
    const start = { x: c.x, y: c.y, px: p.x, py: p.y };
    let moved = false;
    canvas.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const q = canvasPoint(ev);
      if (!moved) { if (Math.hypot(q.x - p.x, q.y - p.y) < 3) return; checkpoint(); moved = true; }
      let nx = start.x + (q.x - start.px) / project.width;
      let ny = start.y + (q.y - start.py) / project.height;
      if (Math.abs(nx) < 0.012) nx = 0; // التقاط للمنتصف
      if (Math.abs(ny) < 0.012) ny = 0;
      c.x = round(nx, 4); c.y = round(ny, 4);
      requestRender();
      refreshInspectorValues();
    };
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      if (moved) saveSoon();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  });
  canvas.addEventListener('wheel', (e) => {
    const c = getSelected();
    if (!c || !isVisualType(c.type) || isLocked(c)) return;
    e.preventDefault();
    checkpoint(true);
    c.scale = round(clamp(c.scale * (e.deltaY < 0 ? 1.05 : 1 / 1.05), 0.05, 10), 3);
    requestRender();
    refreshInspectorValues();
    saveSoon();
  }, { passive: false });
}

/* ============================ الخط الزمني ============================ */
function renderTimeline() {
  const pps = state.pxPerSec;
  const total = Math.max(projectEnd() + 30, tlScroll.clientWidth / pps + 5);
  tlContent.style.width = Math.ceil(total * pps) + 'px';
  headersEl.innerHTML = '';
  lanesEl.innerHTML = '';
  const visualCount = project.tracks.filter((t) => t.kind === 'visual').length;
  const audioCount = project.tracks.length - visualCount;
  for (const tr of project.tracks) {
    const h = document.createElement('div');
    h.className = `track-header ${tr.kind}${tr.locked ? ' locked' : ''}`;
    h.style.height = TRACK_H[tr.kind] + 'px';
    h.dataset.track = tr.id;
    const canDel = tr.kind === 'visual' ? visualCount > 1 : audioCount > 1;
    h.innerHTML =
      `<span class="tr-icon">${tr.kind === 'audio' ? '🔊' : '🎞️'}</span>` +
      `<span class="tr-name" title="انقر مرتين لإعادة التسمية">${escapeHtml(tr.name)}</span>` +
      `<div class="tr-btns">` +
      (tr.kind === 'visual' ? `<button data-act="hide" class="${tr.hidden ? 'on' : ''}" title="إظهار / إخفاء">${tr.hidden ? '🚫' : '👁'}</button>` : '') +
      `<button data-act="mute" class="${tr.muted ? 'on' : ''}" title="كتم الصوت">${tr.muted ? '🔇' : '🔈'}</button>` +
      `<button data-act="lock" class="${tr.locked ? 'on' : ''}" title="قفل المسار">${tr.locked ? '🔒' : '🔓'}</button>` +
      (canDel ? `<button data-act="del" title="حذف المسار">✕</button>` : '') +
      `</div>`;
    headersEl.appendChild(h);
    const lane = document.createElement('div');
    lane.className = `lane ${tr.kind}${tr.locked ? ' locked' : ''}`;
    lane.style.height = TRACK_H[tr.kind] + 'px';
    lane.dataset.track = tr.id;
    for (const c of project.clips) if (c.trackId === tr.id) lane.appendChild(buildClipEl(c, tr));
    lanesEl.appendChild(lane);
  }
  headersEl.scrollTop = tlScroll.scrollTop;
  updateTimeUI();
}
function positionClipEl(el, c) {
  el.style.left = c.start * state.pxPerSec + 'px';
  el.style.width = Math.max(4, c.duration * state.pxPerSec) + 'px';
}
function buildClipEl(c, tr) {
  const el = document.createElement('div');
  el.className = `clip type-${c.type}${c.id === state.selectedId ? ' selected' : ''}${tr.hidden && c.type !== 'audio' ? ' disabled' : ''}`;
  el.dataset.clip = c.id;
  positionClipEl(el, c);
  const m = media.get(c.mediaId);
  if ((c.type === 'video' || c.type === 'image') && m && m.thumb) {
    const th = document.createElement('div');
    th.className = 'clip-thumbs';
    th.style.backgroundImage = `url(${m.thumb})`;
    el.appendChild(th);
  }
  if (c.type === 'color') el.style.setProperty('--clip-color', c.color);
  if (hasSource(c) && m && m.peaks && (c.type === 'audio' || m.hasAudio)) {
    const cv = document.createElement('canvas');
    cv.className = 'wave';
    el.appendChild(cv);
    drawWave(cv, c, m);
  }
  let label = c.type === 'text' ? (c.text.content || 'نص').split('\n')[0]
    : c.type === 'color' ? 'خلفية ملونة' : m ? m.name : 'ملف مفقود';
  if (c.speed !== 1) label += ` • ${c.speed}x`;
  if (c.muted && hasSource(c)) label = '🔇 ' + label;
  const lb = document.createElement('div');
  lb.className = 'clip-label';
  lb.dir = 'auto';
  lb.textContent = label;
  el.appendChild(lb);
  const fx = [];
  if (c.animIn !== 'none' || c.animOut !== 'none') fx.push('✨');
  if (filterString(c.filters) !== 'none') fx.push('🎨');
  if (fx.length) { const f = document.createElement('div'); f.className = 'clip-fx'; f.textContent = fx.join(''); el.appendChild(f); }
  el.insertAdjacentHTML('beforeend', '<div class="handle handle-l"></div><div class="handle handle-r"></div>');
  return el;
}
function drawWave(cv, c, m) {
  const w = Math.min(8000, Math.max(1, Math.round(c.duration * state.pxPerSec)));
  const h = c.type === 'audio' ? 36 : 20;
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = c.type === 'audio' ? 'rgba(167,243,208,.75)' : 'rgba(255,255,255,.5)';
  const span = c.duration * c.speed;
  const volScale = clamp(c.volume, 0, 2) / 1.2 + 0.15;
  for (let x = 0; x < w; x++) {
    const t0 = c.offset + (x / w) * span, t1 = c.offset + ((x + 1) / w) * span;
    const i0 = Math.floor(t0 * PEAK_RATE), i1 = Math.max(i0 + 1, Math.floor(t1 * PEAK_RATE));
    let mx = 0;
    for (let i = i0; i < i1 && i < m.peaks.length; i++) if (m.peaks[i] > mx) mx = m.peaks[i];
    const bh = Math.max(1, Math.min(h, mx * h * volScale));
    g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}
function drawRuler() {
  const wrap = $('#rulerWrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (rulerCanvas.width !== Math.round(w * dpr) || rulerCanvas.height !== Math.round(h * dpr)) {
    rulerCanvas.width = Math.round(w * dpr);
    rulerCanvas.height = Math.round(h * dpr);
  }
  const g = rulerCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const sl = tlScroll.scrollLeft, pps = state.pxPerSec;
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const major = steps.find((s) => s * pps >= 70) || 600;
  const minor = major / 5;
  g.font = '10px ui-monospace, Consolas, monospace';
  g.textBaseline = 'top';
  const tEnd = (sl + w) / pps;
  for (let i = Math.floor(sl / pps / minor); i * minor <= tEnd; i++) {
    const t = i * minor;
    const x = Math.round(t * pps - sl) + 0.5;
    const isMajor = i % 5 === 0;
    g.strokeStyle = isMajor ? '#64748b' : '#334155';
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, isMajor ? h - 13 : h - 6); g.stroke();
    if (isMajor) {
      g.fillStyle = '#94a3b8';
      const m = Math.floor(t / 60), s = t % 60;
      g.fillText(major < 1 ? `${m}:${pad2(Math.floor(s))}.${Math.round((s % 1) * 10)}` : `${m}:${pad2(Math.round(s))}`, x + 3, 3);
    }
  }
  const end = projectEnd();
  if (end > 0) { // علامة نهاية المشروع
    const ex = end * pps - sl;
    g.fillStyle = 'rgba(124,58,237,.8)';
    g.fillRect(ex - 1, 0, 2, h);
  }
  const px = state.time * pps - sl;
  g.fillStyle = '#ef4444';
  g.beginPath(); g.moveTo(px - 6, h - 12); g.lineTo(px + 6, h - 12); g.lineTo(px, h); g.closePath(); g.fill();
}
function updateTimeUI() {
  $('#timeCur').textContent = fmtTime(state.time);
  $('#timeTotal').textContent = fmtTime(projectEnd());
  $('#playhead').style.transform = `translateX(${state.time * state.pxPerSec}px)`;
  drawRuler();
}
function followPlayhead() {
  const x = state.time * state.pxPerSec;
  const sl = tlScroll.scrollLeft, w = tlScroll.clientWidth;
  if (x > sl + w - 40 || x < sl) tlScroll.scrollLeft = Math.max(0, x - 60);
}
function timeFromClientX(clientX) {
  const r = tlContent.getBoundingClientRect();
  return Math.max(0, (clientX - r.left) / state.pxPerSec);
}
function zoomSliderToPps(v) { return 5 * Math.pow(400 / 5, v / 100); } // 5 → 400 بكسل/ثانية
function ppsToZoomSlider(p) { return (Math.log(p / 5) / Math.log(400 / 5)) * 100; }
function setZoom(pps, anchorClientX) {
  pps = clamp(pps, 5, 400);
  const r = tlScroll.getBoundingClientRect();
  const ax = anchorClientX != null ? anchorClientX - r.left : clamp(state.time * state.pxPerSec - tlScroll.scrollLeft, 0, tlScroll.clientWidth);
  const at = (tlScroll.scrollLeft + ax) / state.pxPerSec;
  state.pxPerSec = pps;
  $('#zoomSlider').value = ppsToZoomSlider(pps);
  renderTimeline();
  tlScroll.scrollLeft = Math.max(0, at * pps - ax);
  drawRuler();
}
function zoomFit() {
  const end = projectEnd();
  if (end <= 0) return setZoom(60);
  setZoom((tlScroll.clientWidth - 40) / end);
  tlScroll.scrollLeft = 0;
  drawRuler();
}
function collectSnapPoints(excludeId) {
  const pts = [0, state.time];
  for (const c of project.clips) if (c.id !== excludeId) pts.push(c.start, c.start + c.duration);
  return pts;
}
function snapTo(edges, pts, thr) {
  let best = null;
  for (const e of edges) for (const p of pts) {
    const d = p - e;
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, point: p };
  }
  return best;
}
function showSnapLine(t) {
  const sl = $('#snapLine');
  if (t == null) { sl.style.display = 'none'; return; }
  sl.style.display = 'block';
  sl.style.transform = `translateX(${t * state.pxPerSec}px)`;
}
function initTimelineInteraction() {
  // سحب / قص المقاطع
  lanesEl.addEventListener('pointerdown', (e) => {
    if (state.exporting || e.button !== 0) return;
    const clipEl = e.target.closest('.clip');
    if (!clipEl) { select(null); seek(timeFromClientX(e.clientX)); return; }
    const c = getClip(clipEl.dataset.clip);
    if (!c) return;
    if (c.id !== state.selectedId) select(c.id);
    if (isLocked(c)) return;
    e.preventDefault();
    const mode = e.target.classList.contains('handle-l') ? 'trim-l' : e.target.classList.contains('handle-r') ? 'trim-r' : 'move';
    const orig = { start: c.start, duration: c.duration, offset: c.offset, speed: c.speed };
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const pts = collectSnapPoints(c.id);
    const thr = 8 / state.pxPerSec;
    const m = media.get(c.mediaId);
    const srcDur = hasSource(c) && m && m.duration ? m.duration : Infinity;
    const onMove = (ev) => {
      if (!moved) {
        if (Math.abs(ev.clientX - sx) < 3 && Math.abs(ev.clientY - sy) < 3) return;
        checkpoint(); moved = true; clipEl.classList.add('dragging');
      }
      const dx = (ev.clientX - sx) / state.pxPerSec;
      let snapAt = null;
      if (mode === 'move') {
        let ns = Math.max(0, orig.start + dx);
        if (state.snap) {
          const r = snapTo([ns, ns + orig.duration], pts, thr);
          if (r) { ns = Math.max(0, ns + r.delta); snapAt = r.point; }
        }
        c.start = ns;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const lane = under && under.closest('.lane');
        if (lane && lane.dataset.track !== c.trackId) {
          const nt = getTrack(lane.dataset.track);
          if (nt && !nt.locked && compatible(c, nt)) { c.trackId = nt.id; lane.appendChild(clipEl); }
        }
      } else if (mode === 'trim-l') {
        const minStart = srcDur === Infinity ? 0 : Math.max(0, orig.start - orig.offset / orig.speed);
        const maxStart = orig.start + orig.duration - 0.1;
        let ns = orig.start + dx;
        if (state.snap) { const r = snapTo([ns], pts, thr); if (r) { ns += r.delta; snapAt = r.point; } }
        ns = clamp(ns, minStart, maxStart);
        c.start = ns;
        c.duration = orig.start + orig.duration - ns;
        if (hasSource(c)) c.offset = Math.max(0, orig.offset + (ns - orig.start) * orig.speed);
      } else {
        const maxEnd = orig.start + (srcDur === Infinity ? Infinity : (srcDur - orig.offset) / orig.speed);
        let ne = orig.start + orig.duration + dx;
        if (state.snap) { const r = snapTo([ne], pts, thr); if (r) { ne += r.delta; snapAt = r.point; } }
        ne = clamp(ne, orig.start + 0.1, maxEnd);
        c.duration = ne - orig.start;
      }
      positionClipEl(clipEl, c);
      showSnapLine(snapAt);
      syncMedia();
      requestRender();
      updateTimeUI();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      showSnapLine(null);
      if (moved) changed();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  lanesEl.addEventListener('dblclick', (e) => {
    const clipEl = e.target.closest('.clip');
    const c = clipEl && getClip(clipEl.dataset.clip);
    if (c && c.type === 'text') { const ta = $('#inspector textarea'); if (ta) { ta.focus(); ta.select(); } }
  });

  // إفلات الوسائط من المكتبة
  lanesEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-media-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    $$('.lane.drop-target').forEach((l) => l.classList.remove('drop-target'));
    const lane = e.target.closest('.lane');
    if (lane) lane.classList.add('drop-target');
  });
  lanesEl.addEventListener('dragleave', (e) => { if (!lanesEl.contains(e.relatedTarget)) $$('.lane.drop-target').forEach((l) => l.classList.remove('drop-target')); });
  lanesEl.addEventListener('drop', (e) => {
    const id = e.dataTransfer.getData('application/x-media-id');
    $$('.lane.drop-target').forEach((l) => l.classList.remove('drop-target'));
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const lane = e.target.closest('.lane');
    addMediaClip(id, { trackId: lane && lane.dataset.track, start: timeFromClientX(e.clientX) });
  });

  // المسطرة: التنقل والسحب
  $('#rulerWrap').addEventListener('pointerdown', (e) => {
    if (state.exporting) return;
    const wrap = $('#rulerWrap');
    const tAt = (cx) => Math.max(0, (cx - wrap.getBoundingClientRect().left + tlScroll.scrollLeft) / state.pxPerSec);
    const wasPlaying = state.playing;
    if (wasPlaying) pause();
    seek(tAt(e.clientX));
    wrap.setPointerCapture(e.pointerId);
    const mv = (ev) => seek(tAt(ev.clientX));
    const up = () => { wrap.removeEventListener('pointermove', mv); wrap.removeEventListener('pointerup', up); if (wasPlaying) play(); };
    wrap.addEventListener('pointermove', mv);
    wrap.addEventListener('pointerup', up);
  });

  tlScroll.addEventListener('scroll', () => { headersEl.scrollTop = tlScroll.scrollTop; drawRuler(); });
  tlScroll.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(state.pxPerSec * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX); }
  }, { passive: false });
  headersEl.addEventListener('wheel', (e) => { tlScroll.scrollTop += e.deltaY; }, { passive: true });

  // أزرار رؤوس المسارات
  headersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = getTrack(btn.closest('.track-header').dataset.track);
    if (!tr) return;
    const act = btn.dataset.act;
    if (act === 'del') {
      const n = project.clips.filter((c) => c.trackId === tr.id).length;
      if (n && !confirm(`حذف المسار "${tr.name}" مع ${n} مقطع؟`)) return;
      checkpoint();
      project.clips = project.clips.filter((c) => c.trackId !== tr.id);
      project.tracks = project.tracks.filter((t) => t.id !== tr.id);
      if (state.selectedId && !getClip(state.selectedId)) state.selectedId = null;
    } else {
      checkpoint();
      if (act === 'hide') tr.hidden = !tr.hidden;
      if (act === 'mute') tr.muted = !tr.muted;
      if (act === 'lock') tr.locked = !tr.locked;
    }
    changed();
  });
  headersEl.addEventListener('dblclick', (e) => {
    const nameEl = e.target.closest('.tr-name');
    if (!nameEl) return;
    const tr = getTrack(nameEl.closest('.track-header').dataset.track);
    nameEl.contentEditable = 'true';
    nameEl.focus();
    document.getSelection().selectAllChildren(nameEl);
    const finish = () => {
      nameEl.contentEditable = 'false';
      const v = nameEl.textContent.trim();
      if (v && v !== tr.name) { checkpoint(); tr.name = v.slice(0, 40); saveSoon(); }
      renderTimeline();
    };
    nameEl.addEventListener('blur', finish, { once: true });
    nameEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); nameEl.blur(); } });
  });

  // تغيير ارتفاع الخط الزمني
  $('#tlResizer').addEventListener('pointerdown', (e) => {
    const r = $('#tlResizer');
    r.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const h = clamp(window.innerHeight - ev.clientY, 150, window.innerHeight * 0.7);
      document.documentElement.style.setProperty('--tl-h', h + 'px');
      fitCanvas(); drawRuler();
    };
    const up = () => { r.removeEventListener('pointermove', mv); r.removeEventListener('pointerup', up); };
    r.addEventListener('pointermove', mv);
    r.addEventListener('pointerup', up);
  });
}

/* ============================ عمليات التحرير ============================ */
function select(id) {
  state.selectedId = id;
  $$('.clip', lanesEl).forEach((el) => el.classList.toggle('selected', el.dataset.clip === id));
  renderInspector();
  requestRender();
}
function pickTrack(kind, preferId, top = false) {
  let tr = preferId && getTrack(preferId);
  if (tr && tr.kind === kind && !tr.locked) return tr;
  const list = project.tracks.filter((t) => t.kind === kind && !t.locked);
  if (!list.length) return null;
  return kind === 'visual' && !top ? list[list.length - 1] : list[0];
}
function addMediaClip(mediaId, opt = {}) {
  const m = media.get(mediaId);
  if (!m) return null;
  const kind = m.type === 'audio' ? 'audio' : 'visual';
  const tr = pickTrack(kind, opt.trackId);
  if (!tr) { toast('لا يوجد مسار متاح (قد تكون المسارات مقفلة)', 'error'); return null; }
  const dur = m.type === 'image' ? 5 : m.duration || 5;
  const start = opt.start != null ? opt.start : trackEnd(tr.id);
  checkpoint();
  const c = makeClip(m.type, tr.id, Math.max(0, start), dur, { mediaId });
  project.clips.push(c);
  state.selectedId = c.id;
  changed();
  return c;
}
function addTextClip(preset) {
  const tr = pickTrack('visual', null, true);
  if (!tr) return toast('لا يوجد مسار متاح', 'error');
  checkpoint();
  const k = Math.min(project.width, project.height) / 1080;
  const text = { ...DEFAULT_TEXT, ...preset.text };
  text.size = Math.round(text.size * k);
  text.strokeWidth = Math.round(text.strokeWidth * k);
  const c = makeClip('text', tr.id, state.time, 4, {
    text, y: preset.y || 0, animIn: preset.animIn || 'none', animOut: preset.animOut || 'none', animInDur: preset.animInDur || 0.6,
  });
  project.clips.push(c);
  state.selectedId = c.id;
  changed();
}
function addColorClip(color) {
  const tr = pickTrack('visual');
  if (!tr) return toast('لا يوجد مسار متاح', 'error');
  checkpoint();
  const c = makeClip('color', tr.id, state.time, 5, { color });
  project.clips.push(c);
  state.selectedId = c.id;
  changed();
}
function splitAtPlayhead() {
  const t = state.time;
  const inside = (c) => t > c.start + 0.02 && t < c.start + c.duration - 0.02;
  const sel = getSelected();
  const targets = sel ? (inside(sel) ? [sel] : []) : project.clips.filter((c) => inside(c) && !isLocked(c));
  if (!targets.length) { toast('ضع مؤشر التشغيل فوق مقطع لتقسيمه'); return; }
  if (targets.some(isLocked)) { toast('المسار مقفل', 'error'); return; }
  checkpoint();
  for (const c of targets) {
    const left = t - c.start;
    const nc = deepClone(c);
    nc.id = uid('c');
    nc.start = t;
    nc.duration = c.duration - left;
    if (hasSource(c)) nc.offset = c.offset + left * c.speed;
    nc.animIn = 'none'; nc.audioFadeIn = 0;
    c.duration = left;
    c.animOut = 'none'; c.audioFadeOut = 0;
    project.clips.push(nc);
  }
  changed();
}
function deleteSelected(ripple = false) {
  const c = getSelected();
  if (!c) return;
  if (isLocked(c)) return toast('المسار مقفل', 'error');
  checkpoint();
  project.clips = project.clips.filter((x) => x.id !== c.id);
  if (ripple) {
    for (const x of project.clips) if (x.trackId === c.trackId && x.start >= c.start + c.duration - 0.001) x.start = Math.max(0, x.start - c.duration);
  }
  state.selectedId = null;
  changed();
}
function duplicateSelected() {
  const c = getSelected();
  if (!c) return;
  checkpoint();
  const nc = deepClone(c);
  nc.id = uid('c');
  nc.start = c.start + c.duration;
  project.clips.push(nc);
  state.selectedId = nc.id;
  changed();
}
function copySelected() {
  const c = getSelected();
  if (!c) return;
  state.clipboard = deepClone(c);
  toast('تم النسخ');
}
function pasteClip() {
  if (!state.clipboard) return;
  const nc = deepClone(state.clipboard);
  if (nc.mediaId && !media.has(nc.mediaId)) return;
  let tr = getTrack(nc.trackId);
  if (!tr || tr.locked) tr = pickTrack(nc.type === 'audio' ? 'audio' : 'visual');
  if (!tr) return;
  checkpoint();
  nc.id = uid('c');
  nc.trackId = tr.id;
  nc.start = state.time;
  project.clips.push(nc);
  state.selectedId = nc.id;
  changed();
}
function addTrack(kind) {
  checkpoint();
  const n = project.tracks.filter((t) => t.kind === kind).length + 1;
  const tr = { id: uid('t'), kind, name: kind === 'audio' ? `صوت ${n}` : `فيديو ${n}`, hidden: false, muted: false, locked: false };
  if (kind === 'visual') project.tracks.unshift(tr); else project.tracks.push(tr);
  changed();
}

/* ============================ لوحة الخصائص ============================ */
const openSections = new Set(['timing', 'text', 'transform', 'filters', 'anim', 'audio', 'project', 'stats', 'color']);
const fmtNum = (v) => String(round(+v, 2));
const UI = {
  section(key, title, body) {
    return `<details class="sec" data-sec="${key}" ${openSections.has(key) ? 'open' : ''}><summary>${title}</summary><div class="sec-body">${body}</div></details>`;
  },
  range(label, prop, val, min, max, step, mul = 1, unit = '') {
    const dv = round(val * mul, 2);
    return `<div class="field"><label>${label}</label><div class="range-row"><input type="range" data-prop="${prop}" data-mul="${mul}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${dv}"><output>${fmtNum(dv)}${unit}</output></div></div>`;
  },
  number(label, prop, val, step = 0.1, min = 0) {
    return `<div class="field"><label>${label}</label><input type="number" data-prop="${prop}" data-num="1" step="${step}" min="${min}" value="${round(val, 2)}" dir="ltr"></div>`;
  },
  color(label, prop, val) {
    return `<div class="field"><label>${label}</label><input type="color" data-prop="${prop}" value="${val}"></div>`;
  },
  check(label, prop, val) {
    return `<label class="check-row"><input type="checkbox" data-prop="${prop}" ${val ? 'checked' : ''}> ${label}</label>`;
  },
  select(label, prop, val, options, num = false) {
    const opts = options.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('');
    return `<div class="field"><label>${label}</label><select data-prop="${prop}" ${num ? 'data-num="1"' : ''}>${opts}</select></div>`;
  },
};
function renderInspector() {
  const box = $('#inspector');
  const c = getSelected();
  if (!c) {
    $('#inspectorTitle').textContent = 'إعدادات المشروع';
    const res = `${project.width}x${project.height}`;
    const resOpts = RESOLUTIONS.some(([v]) => v === res) ? RESOLUTIONS : [[res, `مخصص — ${res}`], ...RESOLUTIONS];
    box.innerHTML =
      UI.section('project', 'المشروع',
        UI.select('الأبعاد ونسبة العرض', '@resolution', res, resOpts) +
        UI.select('معدل الإطارات', 'fps', project.fps, [[24, '24 إطار/ث'], [25, '25 إطار/ث'], [30, '30 إطار/ث'], [60, '60 إطار/ث']], true) +
        UI.color('لون الخلفية', 'background', project.background)) +
      UI.section('stats', 'معلومات',
        `<div class="stats">المدة: <b dir="ltr">${fmtShort(projectEnd())}</b><br>عدد المقاطع: <b>${project.clips.length}</b><br>عدد الملفات: <b>${project.media.length}</b><br>المسارات: <b>${project.tracks.length}</b></div>`) +
      `<p class="muted small" style="padding:0 14px">اختر مقطعاً من الخط الزمني أو المعاينة لتعديل خصائصه.</p>`;
    return;
  }
  const m = media.get(c.mediaId);
  const typeName = { video: 'فيديو', image: 'صورة', audio: 'صوت', text: 'نص', color: 'لون' }[c.type];
  $('#inspectorTitle').textContent = `خصائص ${typeName}`;
  const name = c.type === 'text' ? c.text.content.split('\n')[0] : c.type === 'color' ? 'خلفية ملونة' : m ? m.name : '';
  let html = `<div class="insp-head"><div class="insp-name"><span class="badge">${typeName}</span><span dir="auto">${escapeHtml(name)}</span></div>
    <div class="insp-actions"><button data-action="split">✂️ تقسيم</button><button data-action="dup">⧉ تكرار</button><button data-action="del">🗑 حذف</button></div></div>`;
  html += UI.section('timing', '⏱ التوقيت',
    `<div class="row2">${UI.number('البداية (ث)', 'start', c.start)}${UI.number('المدة (ث)', 'duration', c.duration)}</div>` +
    (hasSource(c) ? `<div class="muted small">بداية القص داخل الملف: <span dir="ltr">${fmtTime(c.offset)}</span></div>` : ''));
  if (c.type === 'text') {
    const tx = c.text;
    html += UI.section('text', '🔤 النص',
      `<div class="field"><label>المحتوى</label><textarea data-prop="text.content" dir="auto">${escapeHtml(tx.content)}</textarea></div>` +
      UI.select('الخط', 'text.font', tx.font, FONTS) +
      UI.range('الحجم', 'text.size', tx.size, 8, 500, 1, 1, 'px') +
      `<div class="row2">${UI.color('اللون', 'text.color', tx.color)}${UI.select('المحاذاة', 'text.align', tx.align, [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']])}</div>` +
      `<div class="chip-row">${UI.check('عريض', 'text.bold', tx.bold)}${UI.check('مائل', 'text.italic', tx.italic)}${UI.check('ظل', 'text.shadow', tx.shadow)}${UI.check('توهج', 'text.glow', tx.glow)}</div>` +
      UI.range('تباعد الأسطر', 'text.lineHeight', tx.lineHeight, 0.8, 3, 0.05) +
      `<div class="row2">${UI.color('لون الإطار', 'text.stroke', tx.stroke)}${UI.range('سُمك الإطار', 'text.strokeWidth', tx.strokeWidth, 0, 40, 1, 1, 'px')}</div>` +
      `<div class="row2">${UI.color('لون الخلفية', 'text.bg', tx.bg)}${UI.range('شفافية الخلفية', 'text.bgOpacity', tx.bgOpacity, 0, 100, 1, 100, '%')}</div>`);
  }
  if (c.type === 'color') html += UI.section('color', '🎨 اللون', UI.color('لون التعبئة', 'color', c.color));
  if (isVisualType(c.type)) {
    html += UI.section('transform', '📐 التحويل',
      UI.range('الموضع الأفقي', 'x', c.x, -100, 100, 0.5, 100, '%') +
      UI.range('الموضع العمودي', 'y', c.y, -100, 100, 0.5, 100, '%') +
      UI.range('الحجم', 'scale', c.scale, 5, 400, 1, 100, '%') +
      UI.range('الدوران', 'rotation', c.rotation, -180, 180, 1, 1, '°') +
      UI.range('الشفافية', 'opacity', c.opacity, 0, 100, 1, 100, '%') +
      (c.type === 'video' || c.type === 'image'
        ? UI.select('الملاءمة', 'fit', c.fit, [['contain', 'احتواء (بدون قص)'], ['cover', 'تعبئة (مع قص)'], ['stretch', 'تمديد']]) +
          `<div class="chip-row">${UI.check('قلب أفقي', 'flipH', c.flipH)}${UI.check('تأثير كين برنز (تكبير بطيء)', 'kenBurns', c.kenBurns)}</div>`
        : '') +
      `<div class="insp-actions"><button class="mini-btn" data-action="reset-transform">↺ إعادة الضبط</button><button class="mini-btn" data-action="center">⊕ توسيط</button></div>`);
    if (c.type !== 'text') {
      const f = c.filters;
      html += UI.section('filters', '🎨 الألوان والفلاتر',
        `<div class="chip-row">${FILTER_PRESETS.map(([n], i) => `<button class="chip" data-action="preset" data-i="${i}">${n}</button>`).join('')}</div>` +
        UI.range('السطوع', 'filters.brightness', f.brightness, 0, 200, 1, 1, '%') +
        UI.range('التباين', 'filters.contrast', f.contrast, 0, 200, 1, 1, '%') +
        UI.range('التشبع', 'filters.saturate', f.saturate, 0, 300, 1, 1, '%') +
        UI.range('تدرج اللون', 'filters.hue', f.hue, -180, 180, 1, 1, '°') +
        UI.range('ضبابية', 'filters.blur', f.blur, 0, 30, 0.5, 1, 'px') +
        UI.range('أبيض وأسود', 'filters.grayscale', f.grayscale, 0, 100, 1, 1, '%') +
        UI.range('بني قديم', 'filters.sepia', f.sepia, 0, 100, 1, 1, '%') +
        UI.range('عكس الألوان', 'filters.invert', f.invert, 0, 100, 1, 1, '%') +
        `<div class="insp-actions"><button class="mini-btn" data-action="reset-filters">↺ إعادة ضبط الفلاتر</button></div>`);
    }
    html += UI.section('anim', '✨ الحركة والانتقالات',
      `<div class="row2">${UI.select('حركة الدخول', 'animIn', c.animIn, ANIMS)}${UI.number('مدتها (ث)', 'animInDur', c.animInDur, 0.1, 0.1)}</div>` +
      `<div class="row2">${UI.select('حركة الخروج', 'animOut', c.animOut, ANIMS)}${UI.number('مدتها (ث)', 'animOutDur', c.animOutDur, 0.1, 0.1)}</div>` +
      `<div class="insp-actions"><button class="mini-btn" data-action="fade-both">تلاشي دخول وخروج</button></div>`);
  }
  if (hasSource(c)) {
    html += UI.section('audio', '🔊 الصوت والسرعة',
      UI.range('مستوى الصوت', 'volume', c.volume, 0, 200, 1, 100, '%') +
      UI.check('كتم صوت المقطع', 'muted', c.muted) +
      `<div class="row2">${UI.number('تلاشي دخول (ث)', 'audioFadeIn', c.audioFadeIn, 0.1)}${UI.number('تلاشي خروج (ث)', 'audioFadeOut', c.audioFadeOut, 0.1)}</div>` +
      UI.select('السرعة', 'speed', c.speed, [[0.25, '0.25x بطيء جداً'], [0.5, '0.5x بطيء'], [0.75, '0.75x'], [1, '1x عادي'], [1.25, '1.25x'], [1.5, '1.5x'], [2, '2x سريع'], [3, '3x'], [4, '4x سريع جداً']], true));
  }
  box.innerHTML = html;
}
function readInput(inp) {
  if (inp.type === 'checkbox') return inp.checked;
  if (inp.type === 'range' || inp.dataset.num) return parseFloat(inp.value) / (parseFloat(inp.dataset.mul) || 1);
  return inp.value;
}
function applyClipProp(c, prop, v) {
  const m = media.get(c.mediaId);
  const src = hasSource(c) && m && m.duration;
  if (typeof v === 'number' && !isFinite(v)) return false;
  switch (prop) {
    case 'speed': {
      v = clamp(v || 1, 0.1, 16);
      const srcLen = c.duration * c.speed;
      c.speed = v;
      c.duration = srcLen / v;
      if (src) c.duration = Math.min(c.duration, (m.duration - c.offset) / v);
      return true;
    }
    case 'duration':
      v = Math.max(0.1, v);
      if (src) v = Math.min(v, (m.duration - c.offset) / c.speed);
      c.duration = v;
      return true;
    case 'start': c.start = Math.max(0, v); return true;
    case 'animInDur': case 'animOutDur': case 'audioFadeIn': case 'audioFadeOut':
      c[prop] = clamp(v, 0, 60); return false;
  }
  setPath(c, prop, v);
  return ['text.content', 'color', 'muted', 'volume', 'animIn', 'animOut'].includes(prop) || prop.startsWith('filters.');
}
function refreshInspectorValues() {
  const c = getSelected();
  const target = c || project;
  $$('#inspector [data-prop]').forEach((inp) => {
    if (inp === document.activeElement || inp.dataset.prop.startsWith('@')) return;
    const v = getPath(target, inp.dataset.prop);
    if (v === undefined) return;
    if (inp.type === 'checkbox') inp.checked = !!v;
    else if (inp.type === 'range' || inp.dataset.num) inp.value = round(v * (parseFloat(inp.dataset.mul) || 1), 2);
    else inp.value = v;
    const out = inp.parentElement.querySelector('output');
    if (out) out.textContent = fmtNum(inp.value) + (inp.dataset.unit || '');
  });
}
function initInspector() {
  const box = $('#inspector');
  const handle = (e) => {
    const inp = e.target.closest('[data-prop]');
    if (!inp) return;
    // حقول الأرقام: نطبّق القيمة عند التأكيد فقط لتجنب القيم الجزئية أثناء الكتابة
    if (inp.type === 'number' && e.type === 'input') return;
    const prop = inp.dataset.prop;
    const v = readInput(inp);
    const out = inp.parentElement.querySelector('output');
    if (out) out.textContent = fmtNum(inp.value) + (inp.dataset.unit || '');
    checkpoint(true);
    const c = getSelected();
    if (!c) {
      if (prop === '@resolution') {
        const [w, h] = v.split('x').map(Number);
        project.width = w; project.height = h;
        render(); fitCanvas();
      } else if (prop === 'fps') project.fps = v;
      else setPath(project, prop, v);
      requestRender(); saveSoon();
      return;
    }
    const tl = applyClipProp(c, prop, v);
    if (tl) { renderTimeline(); syncMedia(); }
    if (inp.type === 'number' || prop === 'speed') refreshInspectorValues();
    if (prop === 'text.content') $('#inspector .insp-name span[dir]').textContent = c.text.content.split('\n')[0];
    requestRender();
    saveSoon();
  };
  box.addEventListener('input', handle);
  box.addEventListener('change', (e) => { if (e.target.type === 'number') handle(e); });
  box.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.dataset && d.dataset.sec) d.open ? openSections.add(d.dataset.sec) : openSections.delete(d.dataset.sec);
  }, true);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const c = getSelected();
    const a = b.dataset.action;
    if (a === 'split') return splitAtPlayhead();
    if (a === 'dup') return duplicateSelected();
    if (a === 'del') return deleteSelected();
    if (!c) return;
    checkpoint();
    if (a === 'reset-transform') Object.assign(c, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, flipH: false });
    if (a === 'center') Object.assign(c, { x: 0, y: 0 });
    if (a === 'reset-filters') c.filters = { ...DEFAULT_FILTERS };
    if (a === 'preset') c.filters = { ...DEFAULT_FILTERS, ...FILTER_PRESETS[+b.dataset.i][1] };
    if (a === 'fade-both') Object.assign(c, { animIn: 'fade', animOut: 'fade', animInDur: 0.6, animOutDur: 0.6 });
    changed();
  });
}

/* ============================ المكتبة ============================ */
function renderMediaLibrary() {
  const grid = $('#mediaGrid');
  grid.innerHTML = '';
  $('#dropHint').hidden = project.media.length > 0;
  for (const meta of project.media) {
    const m = media.get(meta.id);
    if (!m) continue;
    const item = document.createElement('div');
    item.className = 'media-item';
    item.draggable = true;
    item.dataset.media = m.id;
    item.title = 'اسحب إلى الخط الزمني أو انقر مرتين للإضافة';
    const icon = m.type === 'audio' ? '🎵' : m.type === 'image' ? '🖼️' : '🎬';
    item.innerHTML =
      `<div class="mi-thumb">${m.thumb ? `<img src="${m.thumb}" alt="">` : `<span class="mi-icon">${icon}</span>`}` +
      `<span class="mi-badge">${m.type === 'image' ? 'صورة' : fmtShort(m.duration)}</span></div>` +
      `<div class="mi-name" dir="auto">${escapeHtml(m.name)}</div>` +
      `<div class="mi-actions"><button data-act="add" title="إضافة إلى الخط الزمني">➕</button><button data-act="del" title="حذف">🗑</button></div>`;
    grid.appendChild(item);
  }
}
function initLibrary() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $$('.tab-body').forEach((b) => b.classList.toggle('active', b.id === 'tab-' + t.dataset.tab));
  }));
  $('#fileInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    await importFiles(files);
    e.target.value = '';
  });
  const grid = $('#mediaGrid');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('.media-item').dataset.media;
    if (b.dataset.act === 'add') addMediaClip(id);
    else deleteMedia(id);
  });
  grid.addEventListener('dblclick', (e) => {
    const it = e.target.closest('.media-item');
    if (it && !e.target.closest('button')) addMediaClip(it.dataset.media);
  });
  grid.addEventListener('dragstart', (e) => {
    const it = e.target.closest('.media-item');
    if (!it) return;
    e.dataTransfer.setData('application/x-media-id', it.dataset.media);
    e.dataTransfer.effectAllowed = 'copy';
  });
  // أنماط النصوص
  $('#textPresets').innerHTML = TEXT_PRESETS.map((p, i) => {
    const t = { ...DEFAULT_TEXT, ...p.text };
    const style = [
      `font-family:'${t.font}'`, `font-weight:${t.bold ? 700 : 400}`, `color:${t.color}`,
      `font-size:${clamp(t.size / 4, 16, 30)}px`,
      t.glow ? `text-shadow:0 0 10px ${t.color}` : t.shadow ? 'text-shadow:0 2px 4px rgba(0,0,0,.7)' : '',
      t.strokeWidth ? `-webkit-text-stroke:1px ${t.stroke}` : '',
      t.bgOpacity ? `background:${t.bg}` : '',
    ].filter(Boolean).join(';');
    return `<div class="text-preset" data-i="${i}" style="${style}">${escapeHtml(t.content)}<small>${p.name}</small></div>`;
  }).join('');
  $('#textPresets').addEventListener('click', (e) => {
    const p = e.target.closest('.text-preset');
    if (p) addTextClip(TEXT_PRESETS[+p.dataset.i]);
  });
  $('#colorPresets').innerHTML = COLOR_PRESETS.map((c) => `<div class="color-swatch" data-c="${c}" style="background:${c}" title="${c}"></div>`).join('');
  $('#colorPresets').addEventListener('click', (e) => {
    const s = e.target.closest('.color-swatch');
    if (s) addColorClip(s.dataset.c);
  });
  // إفلات الملفات من الجهاز
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; $('#dropOverlay').hidden = false; } });
  window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    $('#dropOverlay').hidden = true;
    const lane = e.target.closest && e.target.closest('.lane');
    const t = lane ? timeFromClientX(e.clientX) : null;
    const added = await importFiles(e.dataTransfer.files);
    if (lane) {
      let at = t;
      for (const m of added) { const c = addMediaClip(m.id, { trackId: lane.dataset.track, start: at }); if (c) at = c.start + c.duration; }
    }
  });
}

/* ============================ التصدير ============================ */
let recorder = null, recChunks = [], exportRange = { from: 0, to: 0 }, exportCancelled = false, exportMime = '';
const EXPORT_FORMATS = [
  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'MP4 (H.264)', 'mp4'],
  ['video/mp4', 'MP4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'WebM (VP9)', 'webm'],
  ['video/webm;codecs=vp8,opus', 'WebM (VP8)', 'webm'],
  ['video/webm', 'WebM', 'webm'],
];
function openExport() {
  if (projectEnd() <= 0) return toast('المشروع فارغ — أضف مقاطع أولاً', 'error');
  if (!canvas.captureStream || !window.MediaRecorder) return toast('متصفحك لا يدعم التصدير. استخدم Chrome أو Edge أو Firefox الحديث.', 'error');
  pause();
  const sel = $('#expFormat');
  const supported = EXPORT_FORMATS.filter(([m]) => MediaRecorder.isTypeSupported(m));
  sel.innerHTML = (supported.length ? supported : [['', 'افتراضي', 'webm']]).map(([m, l]) => `<option value="${m}">${l}</option>`).join('');
  $('#expRes').textContent = `${project.width} × ${project.height} • ${project.fps} fps • ${fmtShort(projectEnd())}`;
  $('#expRange').querySelector('[value=sel]').disabled = !getSelected();
  $('#exportSetup').hidden = false;
  $('#exportProgress').hidden = true;
  $('#exportDone').hidden = true;
  $('#exportModal').hidden = false;
}
async function startExport() {
  const end = projectEnd();
  let from = 0, to = end;
  const sel = getSelected();
  if ($('#expRange').value === 'sel' && sel) { from = sel.start; to = sel.start + sel.duration; }
  resumeAudio();
  exportMime = $('#expFormat').value;
  const stream = canvas.captureStream(project.fps);
  if (exportDest) exportDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  recChunks = [];
  const opts = { videoBitsPerSecond: +$('#expQuality').value, audioBitsPerSecond: 192000 };
  if (exportMime) opts.mimeType = exportMime;
  try { recorder = new MediaRecorder(stream, opts); }
  catch (e) { try { recorder = new MediaRecorder(stream); exportMime = recorder.mimeType; } catch (e2) { toast('تعذر بدء التصدير', 'error'); return; } }
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = onExportStopped;
  exportCancelled = false;
  exportRange = { from, to };
  state.exporting = true;
  $('#exportSetup').hidden = true;
  $('#exportProgress').hidden = false;
  $('#expBar').style.width = '0%';
  $('#expText').textContent = 'جارٍ التحضير…';
  seek(from);
  await waitMediaReady(3000);
  render();
  recorder.start(250);
  startPlayback();
}
function waitMediaReady(timeout) {
  return new Promise((res) => {
    const t0 = performance.now();
    const chk = () => {
      syncMedia();
      const t = state.time;
      const ok = project.clips.filter((c) => hasSource(c) && t >= c.start && t < c.start + c.duration)
        .every((c) => { const e = clipEls.get(c.id); return e && e.el.readyState >= 2 && !e.el.seeking; });
      if (ok || performance.now() - t0 > timeout) res(); else setTimeout(chk, 60);
    };
    chk();
  });
}
function updateExportProgress() {
  const { from, to } = exportRange;
  const p = clamp((state.time - from) / Math.max(0.001, to - from), 0, 1);
  $('#expBar').style.width = (p * 100).toFixed(1) + '%';
  $('#expText').textContent = `${Math.round(p * 100)}% — ${fmtTime(state.time - from)} / ${fmtTime(to - from)}`;
}
function finishExport() {
  state.playing = false;
  cancelAnimationFrame(rafId);
  syncMedia();
  updatePlayBtn();
  updateExportProgress();
  $('#expText').textContent = 'جارٍ إنهاء الملف…';
  setTimeout(() => { if (recorder && recorder.state !== 'inactive') recorder.stop(); }, 300);
}
function cancelExport() {
  exportCancelled = true;
  finishExport();
}
function onExportStopped() {
  state.exporting = false;
  updatePlayBtn();
  requestRender();
  if (exportCancelled) { $('#exportModal').hidden = true; toast('تم إيقاف التصدير'); return; }
  const type = (exportMime || recorder.mimeType || 'video/webm').split(';')[0];
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(recChunks, { type });
  const url = URL.createObjectURL(blob);
  const v = $('#expVideo');
  if (v.src) URL.revokeObjectURL(v.src);
  v.src = url;
  const a = $('#expDownload');
  a.href = url;
  a.download = `${safeName(project.name)}.${ext}`;
  $('#exportProgress').hidden = true;
  $('#exportDone').hidden = false;
  toast(`اكتمل التصدير (${(blob.size / 1048576).toFixed(1)} ميغابايت)`, 'success');
}
function snapshot() {
  pause();
  render({ clean: true });
  canvas.toBlob((b) => { if (b) downloadBlob(b, `${safeName(project.name)}-${fmtTime(state.time).replace(/[:.]/g, '-')}.png`); render(); }, 'image/png');
}

/* ============================ لوحة المفاتيح والأزرار ============================ */
function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (state.exporting) return;
    const tag = e.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (!$('#helpModal').hidden || !$('#exportModal').hidden) {
      if (e.key === 'Escape') { $('#helpModal').hidden = true; if (!state.exporting) $('#exportModal').hidden = true; }
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const code = e.code;
    if (e.key === ' ' || code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (ctrl && code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (ctrl && (code === 'KeyY' || (code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (ctrl && code === 'KeyC') copySelected();
    else if (ctrl && code === 'KeyV') pasteClip();
    else if (ctrl && code === 'KeyD') { e.preventDefault(); duplicateSelected(); }
    else if (!ctrl && code === 'KeyS') splitAtPlayhead();
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(e.shiftKey); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepFrame(e.shiftKey ? -10 : -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepFrame(e.shiftKey ? 10 : 1); }
    else if (e.key === 'Home') { pause(); seek(0); tlScroll.scrollLeft = 0; }
    else if (e.key === 'End') { pause(); seek(projectEnd()); followPlayhead(); }
    else if (code === 'Equal' || code === 'NumpadAdd') setZoom(state.pxPerSec * 1.25);
    else if (code === 'Minus' || code === 'NumpadSubtract') setZoom(state.pxPerSec / 1.25);
    else if (e.key === 'Escape') select(null);
  });
}
function initButtons() {
  $('#btnPlay').onclick = togglePlay;
  $('#btnStart').onclick = () => { pause(); seek(0); tlScroll.scrollLeft = 0; };
  $('#btnEnd').onclick = () => { pause(); seek(projectEnd()); followPlayhead(); };
  $('#btnPrevFrame').onclick = () => stepFrame(-1);
  $('#btnNextFrame').onclick = () => stepFrame(1);
  $('#btnSnapshot').onclick = snapshot;
  $('#btnFullscreen').onclick = () => {
    const st = $('#previewStage');
    if (document.fullscreenElement) document.exitFullscreen(); else if (st.requestFullscreen) st.requestFullscreen();
  };
  $('#masterVol').oninput = (e) => { if (masterGain) masterGain.gain.value = e.target.value / 100; };
  $('#btnSplit').onclick = splitAtPlayhead;
  $('#btnDelete').onclick = () => deleteSelected(false);
  $('#btnRipple').onclick = () => deleteSelected(true);
  $('#btnDuplicate').onclick = duplicateSelected;
  $('#btnAddVisual').onclick = () => addTrack('visual');
  $('#btnAddAudio').onclick = () => addTrack('audio');
  $('#btnSnap').onclick = (e) => { state.snap = !state.snap; e.currentTarget.classList.toggle('active', state.snap); };
  $('#zoomSlider').oninput = (e) => setZoom(zoomSliderToPps(+e.target.value));
  $('#btnZoomIn').onclick = () => setZoom(state.pxPerSec * 1.25);
  $('#btnZoomOut').onclick = () => setZoom(state.pxPerSec / 1.25);
  $('#btnFit').onclick = zoomFit;
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
  $('#btnNew').onclick = newProjectAction;
  $('#btnHelp').onclick = () => { $('#helpModal').hidden = false; };
  $('#btnExport').onclick = openExport;
  $('#btnStartExport').onclick = startExport;
  $('#btnCancelExport').onclick = cancelExport;
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
  $$('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m && !state.exporting) m.hidden = true; }));
  $('#projectName').addEventListener('input', (e) => { project.name = e.target.value; saveSoon(); });
  document.addEventListener('pointerdown', resumeAudio, { capture: true });
  document.addEventListener('keydown', resumeAudio, { capture: true });
  window.addEventListener('resize', () => { fitCanvas(); drawRuler(); });
  if (window.ResizeObserver) new ResizeObserver(() => { fitCanvas(); drawRuler(); }).observe($('#previewStage'));
  window.addEventListener('beforeunload', saveNow);
}

function renderAll() {
  $('#projectName').value = project.name;
  renderMediaLibrary();
  renderTimeline();
  renderInspector();
  fitCanvas();
  syncMedia();
  requestRender();
  updateUndoButtons();
}

/* ============================ البدء ============================ */
async function init() {
  initAudio();
  try { await DB.open(); } catch (e) { toast('التخزين المحلي غير متاح — لن تُحفظ الملفات بعد إغلاق الصفحة', 'error'); }
  initLibrary();
  initInspector();
  initTimelineInteraction();
  initPreviewInteraction();
  initShortcuts();
  initButtons();
  $('#zoomSlider').value = ppsToZoomSlider(state.pxPerSec);
  setSaveStatus('جارٍ التحميل…');
  await loadSaved();
  renderAll();
  setSaveStatus('✓ محفوظ');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
}
init();

// للاختبار الآلي
window.__studio = { get project() { return project; }, media, state, importFiles, addMediaClip, addTextClip, splitAtPlayhead, seek, play, pause, render, undo, redo, TEXT_PRESETS };
