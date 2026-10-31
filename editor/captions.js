/* =====================================================================
   الترجمة التلقائية — تحويل الكلام إلى ترجمة متحركة كلمة بكلمة
   تعمل محلياً عبر Whisper داخل المتصفح، أو سحابياً عبر مفتاح API
   ===================================================================== */
'use strict';

const CAP_LANGS = [
  ['', '🌐 كشف تلقائي'], ['ar', 'العربية'], ['en', 'English'], ['fr', 'Français'], ['tr', 'Türkçe'],
  ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['ru', 'Русский'],
  ['fa', 'فارسی'], ['ur', 'اردو'], ['hi', 'हिन्दी'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'],
  ['nl', 'Nederlands'], ['sv', 'Svenska'], ['he', 'עברית'], ['bn', 'বাংলা'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'],
];
const CAP_MODELS = [
  ['turbo', 'دقة قصوى — Whisper Large v3 Turbo (تحميل ≈ 1 جيجا لأول مرة)'],
  ['small', 'دقة متوسطة — Whisper Small (≈ 250 ميغا)'],
  ['base', 'سريع — Whisper Base (≈ 80 ميغا)'],
];
const CAP_PROVIDERS = {
  groq: { name: 'Groq — Whisper Large v3 (سريع جداً، له باقة مجانية)', url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3', keyUrl: 'https://console.groq.com/keys' },
  openai: { name: 'OpenAI — Whisper', url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1', keyUrl: 'https://platform.openai.com/api-keys' },
};
// أشكال جاهزة لكل نمط ترجمة (الأحجام مبنية على دقة 1080)
const CAP_LOOKS = {
  karaoke: { text: { font: 'Cairo', size: 76, bold: true, color: '#ffffff', stroke: '#000000', strokeWidth: 9, shadow: true, glow: false, bgOpacity: 0 }, hl: '#facc15' },
  highlight: { text: { font: 'Cairo', size: 72, bold: true, color: '#ffffff', stroke: '#000000', strokeWidth: 0, shadow: true, glow: false, bgOpacity: 0 }, hl: '#7c3aed' },
  pop: { text: { font: 'Lalezar', size: 90, bold: false, color: '#ffffff', stroke: '#000000', strokeWidth: 10, shadow: true, glow: false, bgOpacity: 0 }, hl: '#22d3ee' },
  focus: { text: { font: 'Tajawal', size: 74, bold: true, color: '#ffffff', stroke: '#000000', strokeWidth: 6, shadow: true, glow: false, bgOpacity: 0 }, hl: '#4ade80' },
  plain: { text: { font: 'Tajawal', size: 58, bold: true, color: '#ffffff', stroke: '#000000', strokeWidth: 0, shadow: false, glow: false, bg: '#000000', bgOpacity: 0.6 }, hl: '#ffffff' },
};
// عبارات يخترعها Whisper أحياناً على المقاطع الصامتة
const HALLUCINATIONS = [/ترجمة نانسي قنقر/, /نانسي قنقر/, /Amara\.org/i, /^\s*\[?(موسيقى|music)\]?\s*$/i, /اشتركوا في القناة/];

const CAP_SR = 16000;
const capState = { busy: false, cancel: false };
let capWorker = null, capWorkerModel = '', capWorkerReady = null, capReqId = 0;
const capPending = new Map();

function capSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('montage_caption_settings') || '{}'); } catch (_) {}
  return Object.assign({ engine: 'local', model: 'turbo', provider: 'groq', keys: {}, lang: '', words: 4, style: 'karaoke', range: 'all' }, s);
}
function saveCapSettings(s) { try { localStorage.setItem('montage_caption_settings', JSON.stringify(s)); } catch (_) {} }

/* ---------------- الواجهة ---------------- */
function buildCaptionsUI() {
  const s = capSettings();
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('');
  $('#tab-captions').innerHTML = `
    <div class="cap-hero">🎤 <b>ترجمة تلقائية ذكية</b><br><span class="muted small">يسمع الفيديو ويكتب الكلام كما نُطق، ويضعه ترجمة متحركة كلمة بكلمة.</span></div>
    <div class="cap-form">
      <div class="field"><label>لغة الكلام</label><select id="capLang">${opt(CAP_LANGS, s.lang)}</select>
        <span class="muted small">تحديد اللغة بدل «الكشف التلقائي» يرفع الدقة.</span></div>
      <div class="field"><label>محرك التعرف</label>
        <select id="capEngine">
          <option value="local" ${s.engine === 'local' ? 'selected' : ''}>💻 داخل المتصفح — مجاني وخاص</option>
          <option value="cloud" ${s.engine === 'cloud' ? 'selected' : ''}>☁️ سحابي — مفتاح API (أسرع)</option>
        </select></div>
      <div id="capLocalBox" class="field"><label>النموذج</label><select id="capModel">${opt(CAP_MODELS, s.model)}</select>
        <span class="muted small">يُحمَّل مرة واحدة ثم يُحفظ في المتصفح. يُفضّل Chrome أو Edge (WebGPU) للسرعة.</span></div>
      <div id="capCloudBox" class="field">
        <label>المزوّد</label><select id="capProvider">${Object.entries(CAP_PROVIDERS).map(([k, p]) => `<option value="${k}" ${k === s.provider ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
        <label style="margin-top:6px">مفتاح API</label><input type="password" id="capKey" placeholder="ألصق المفتاح هنا" dir="ltr" autocomplete="off">
        <span class="muted small">يُحفظ في متصفحك فقط. <a id="capKeyLink" target="_blank" rel="noopener">احصل على مفتاح</a></span>
      </div>
      <div class="field"><label>النطاق</label><select id="capRange">
          <option value="all" ${s.range === 'all' ? 'selected' : ''}>المشروع كاملاً</option>
          <option value="sel" ${s.range === 'sel' ? 'selected' : ''}>المقطع المحدد فقط</option></select></div>
      <div class="field"><label>عدد الكلمات في كل سطر</label><div class="range-row"><input type="range" id="capWords" min="1" max="10" value="${s.words}"><output id="capWordsOut">${s.words}</output></div></div>
      <div class="field"><label>شكل الترجمة</label><div class="cap-styles" id="capStyles">
        ${CAPTION_STYLES.map(([k, l]) => `<button class="cap-style ${k === s.style ? 'active' : ''}" data-style="${k}"><span class="cs-demo cs-${k}"><i>كلمة</i> <i>تتحرك</i> <i>هنا</i></span><small>${l.split(' — ')[0]}</small></button>`).join('')}
      </div></div>
      <button class="import-btn cap-go" id="capGo">🎤 إنشاء الترجمة</button>
      <div id="capProgress" class="cap-progress" hidden>
        <div class="progress"><div id="capBar"></div></div>
        <div id="capStatus" class="small"></div>
        <button class="mini-btn danger" id="capCancel">إيقاف</button>
      </div>
      <div class="cap-tools">
        <button class="mini-btn" id="capExportSrt">⬇️ تصدير SRT</button>
        <label class="mini-btn">⬆️ استيراد SRT<input type="file" id="capImportSrt" accept=".srt,.vtt,text/plain" hidden></label>
        <button class="mini-btn danger" id="capClear">🗑 حذف الترجمة</button>
      </div>
    </div>`;
  const key = $('#capKey');
  const syncEngine = () => {
    const st = capSettings();
    const cloud = $('#capEngine').value === 'cloud';
    $('#capLocalBox').hidden = cloud;
    $('#capCloudBox').hidden = !cloud;
    const prov = CAP_PROVIDERS[$('#capProvider').value];
    $('#capKeyLink').href = prov.keyUrl;
    key.value = st.keys[$('#capProvider').value] || '';
  };
  const persist = () => {
    const st = capSettings();
    st.engine = $('#capEngine').value;
    st.model = $('#capModel').value;
    st.provider = $('#capProvider').value;
    st.lang = $('#capLang').value;
    st.words = +$('#capWords').value;
    st.range = $('#capRange').value;
    st.style = $('#capStyles .active').dataset.style;
    saveCapSettings(st);
  };
  ['#capEngine', '#capProvider'].forEach((id) => $(id).addEventListener('change', () => { persist(); syncEngine(); }));
  ['#capModel', '#capLang', '#capRange'].forEach((id) => $(id).addEventListener('change', persist));
  $('#capWords').addEventListener('input', (e) => { $('#capWordsOut').textContent = e.target.value; persist(); });
  key.addEventListener('input', () => { const st = capSettings(); st.keys[$('#capProvider').value] = key.value.trim(); saveCapSettings(st); });
  $('#capStyles').addEventListener('click', (e) => {
    const b = e.target.closest('.cap-style');
    if (!b) return;
    $$('#capStyles .cap-style').forEach((x) => x.classList.toggle('active', x === b));
    persist();
    restyleCaptions(b.dataset.style);
  });
  $('#capGo').addEventListener('click', runCaptions);
  $('#capCancel').addEventListener('click', () => { capState.cancel = true; killWorker(); setCapStatus('جارٍ الإيقاف…'); });
  $('#capExportSrt').addEventListener('click', exportSrt);
  $('#capImportSrt').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importSrt(await f.text()); });
  $('#capClear').addEventListener('click', clearCaptions);
  syncEngine();
}
function setCapStatus(text, p) {
  $('#capStatus').textContent = text;
  if (p != null) $('#capBar').style.width = (clamp(p, 0, 1) * 100).toFixed(1) + '%';
}

/* ---------------- استخراج الصوت ---------------- */
async function decodeAt16k(m) {
  const buf = await m.blob.arrayBuffer();
  const tmp = new OfflineAudioContext(1, CAP_SR, CAP_SR);
  return await tmp.decodeAudioData(buf);
}
// يمزج كل الأصوات المسموعة في النطاق كما تُسمع في الخط الزمني، بتردد 16kHz أحادي
async function renderTimelineAudio(from, to) {
  const len = Math.max(1, Math.ceil((to - from) * CAP_SR));
  const off = new OfflineAudioContext(1, len, CAP_SR);
  const cache = new Map();
  let used = 0;
  for (const c of project.clips) {
    if (!hasSource(c) || c.muted || c.volume <= 0) continue;
    const tr = getTrack(c.trackId);
    if (!tr || tr.muted) continue;
    const cs = Math.max(c.start, from), ce = Math.min(c.start + c.duration, to);
    if (ce <= cs) continue;
    const m = media.get(c.mediaId);
    if (!m) continue;
    let ab = cache.get(m.id);
    if (ab === undefined) {
      try { ab = await decodeAt16k(m); } catch (e) { ab = null; }
      cache.set(m.id, ab);
    }
    if (!ab) continue;
    const src = off.createBufferSource();
    src.buffer = ab;
    src.playbackRate.value = c.speed;
    const g = off.createGain();
    g.gain.value = Math.max(0.3, Math.min(1.5, c.volume));
    src.connect(g).connect(off.destination);
    src.start(cs - from, c.offset + (cs - c.start) * c.speed, (ce - cs) * c.speed);
    used++;
  }
  if (!used) return null;
  const out = await off.startRendering();
  const data = out.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
  if (peak > 0.0001 && peak < 0.9) { const k = 0.9 / peak; for (let i = 0; i < data.length; i++) data[i] *= k; }
  return data;
}
// تقسيم الصوت عند لحظات الصمت حتى لا تنقطع كلمة في المنتصف
function splitAtSilence(samples, maxLen, minLen) {
  const out = [];
  const frame = Math.floor(CAP_SR * 0.05);
  let start = 0;
  const N = samples.length;
  while (N - start > maxLen * CAP_SR) {
    let best = start + maxLen * CAP_SR - frame, bestE = Infinity;
    for (let p = start + minLen * CAP_SR; p < start + maxLen * CAP_SR - frame; p += frame) {
      let e = 0;
      for (let j = p; j < p + frame; j++) e += samples[j] * samples[j];
      if (e < bestE) { bestE = e; best = p; }
    }
    const cut = Math.floor(best + frame / 2);
    out.push([start, cut]);
    start = cut;
  }
  out.push([start, N]);
  return out;
}
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 4)); };

/* ---------------- المحرك المحلي ---------------- */
function killWorker() {
  if (capWorker) capWorker.terminate();
  capWorker = null; capWorkerModel = ''; capWorkerReady = null;
  for (const p of capPending.values()) p.rej(new Error('cancelled'));
  capPending.clear();
}
function getWorker(model, onProgress) {
  if (capWorker && capWorkerModel === model) return capWorkerReady;
  killWorker();
  capWorker = new Worker('whisper-worker.js?v=3', { type: 'module' });
  capWorkerModel = model;
  capWorkerReady = new Promise((res, rej) => {
    capWorker.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'progress') onProgress(d);
      else if (d.type === 'ready') res(d);
      else if (d.type === 'result') { const p = capPending.get(d.id); if (p) { capPending.delete(d.id); p.res(d); } }
      else if (d.type === 'error') {
        if (d.id != null && capPending.has(d.id)) { const p = capPending.get(d.id); capPending.delete(d.id); p.rej(new Error(d.message)); }
        else rej(new Error(d.message));
      }
    };
    capWorker.onerror = (e) => { e.preventDefault && e.preventDefault(); rej(new Error('تعذر تحميل محرك الذكاء الاصطناعي — تأكد من اتصالك بالإنترنت (يلزم أول مرة فقط) واستخدم Chrome أو Edge')); };
  });
  capWorkerReady.catch(() => killWorker());
  capWorker.postMessage({ type: 'load', model });
  return capWorkerReady;
}
function workerTranscribe(audio, language) {
  return new Promise((res, rej) => {
    const id = ++capReqId;
    capPending.set(id, { res, rej });
    capWorker.postMessage({ type: 'transcribe', id, audio, language }, [audio.buffer]);
  });
}

/* ---------------- المحرك السحابي ---------------- */
function encodeWav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, CAP_SR, true); v.setUint32(28, CAP_SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, clamp(samples[i], -1, 1) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}
async function cloudTranscribe(samples, language, provKey, apiKey) {
  const prov = CAP_PROVIDERS[provKey];
  const fd = new FormData();
  fd.append('file', encodeWav(samples), 'audio.wav');
  fd.append('model', prov.model);
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('timestamp_granularities[]', 'segment');
  fd.append('temperature', '0');
  if (language) fd.append('language', language);
  let r;
  try {
    r = await fetch(prov.url, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: fd });
  } catch (e) {
    throw new Error('تعذر الاتصال بالخدمة — تحقق من الإنترنت');
  }
  if (!r.ok) {
    let msg = '';
    try { const j = await r.json(); msg = (j.error && j.error.message) || ''; } catch (_) {}
    if (r.status === 401) throw new Error('مفتاح API غير صحيح');
    if (r.status === 429) throw new Error('تجاوزت حد الاستخدام عند المزوّد، حاول لاحقاً');
    throw new Error(`خطأ من الخدمة (${r.status}) ${msg}`);
  }
  const j = await r.json();
  if (Array.isArray(j.words) && j.words.length) {
    return { chunks: j.words.map((w) => ({ text: w.word, start: w.start, end: w.end })), segments: false };
  }
  return { chunks: (j.segments || []).map((s) => ({ text: s.text, start: s.start, end: s.end })), segments: true };
}

/* ---------------- معالجة الكلمات ---------------- */
// يحوّل نتيجة المحرك إلى كلمات بتوقيت مطلق على الخط الزمني
function toWords(res, base, chunkDur) {
  const words = [];
  const chunks = res.chunks.filter((c) => c.text && c.text.trim() && !HALLUCINATIONS.some((r) => r.test(c.text)));
  if (res.segments) {
    // توقيت الجمل فقط: نوزّع الكلمات داخل الجملة حسب طولها
    for (const seg of chunks) {
      const s = seg.start != null ? seg.start : 0;
      const e = seg.end != null ? seg.end : Math.min(chunkDur, s + 3);
      const toks = seg.text.trim().split(/\s+/).filter(Boolean);
      const total = toks.reduce((a, t) => a + t.length + 1, 0) || 1;
      let acc = 0;
      for (const t of toks) {
        const ws = s + ((e - s) * acc) / total;
        acc += t.length + 1;
        words.push({ text: t, start: base + ws, end: base + s + ((e - s) * acc) / total });
      }
    }
  } else {
    for (const c of chunks) {
      const s = c.start != null ? c.start : (words.length ? words[words.length - 1].end - base : 0);
      const e = c.end != null ? c.end : s + 0.35;
      for (const t of c.text.trim().split(/\s+/).filter(Boolean)) words.push({ text: t, start: base + s, end: base + Math.max(e, s + 0.08) });
    }
  }
  // دمج علامات الترقيم المنفصلة مع الكلمة السابقة
  const out = [];
  for (const w of words) {
    if (out.length && /^[\p{P}\p{S}]+$/u.test(w.text)) { out[out.length - 1].text += w.text; out[out.length - 1].end = Math.max(out[out.length - 1].end, w.end); continue; }
    out.push(w);
  }
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].start;
  return out;
}
function groupLines(words, maxWords) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const chars = cur.reduce((a, x) => a + x.text.length + 1, 0);
      if (cur.length >= maxWords || w.start - prev.end > 0.7 || /[.!?؟。！？]$/.test(prev.text) ||
          (cur.length >= 2 && /[,،؛;:]$/.test(prev.text)) || chars + w.text.length > maxWords * 10) {
        lines.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
function captionTrack() {
  let tr = project.tracks.find((t) => t.captions);
  if (!tr) {
    tr = { id: uid('t'), kind: 'visual', name: 'الترجمة', hidden: false, muted: false, locked: false, captions: true };
    project.tracks.unshift(tr);
  }
  if (tr.locked) tr.locked = false;
  return tr;
}
function captionLook(style) {
  const look = CAP_LOOKS[style] || CAP_LOOKS.karaoke;
  const k = Math.min(project.width, project.height) / 1080;
  const text = { ...DEFAULT_TEXT, ...look.text };
  text.size = Math.round(text.size * k);
  text.strokeWidth = Math.round(text.strokeWidth * k);
  const portrait = project.height > project.width;
  return { text, caption: { style, hl: look.hl }, y: portrait ? 0.2 : 0.34 };
}
function buildCaptionClips(lines, from, to, style) {
  const tr = captionTrack();
  // استبدال الترجمة القديمة داخل النطاق نفسه
  project.clips = project.clips.filter((c) => !(c.trackId === tr.id && c.words && c.start < to && c.start + c.duration > from));
  const group = uid('g');
  const look = captionLook(style);
  lines.forEach((ln, i) => {
    const start = ln[0].start;
    let end = Math.max(ln[ln.length - 1].end, start + 0.4);
    const next = lines[i + 1];
    if (next) { if (next[0].start - end < 0.5) end = next[0].start; end = Math.min(end, next[0].start); }
    end = Math.max(end, start + 0.2);
    const words = ln.map((w) => ({ text: w.text, start: round(w.start - start, 3), end: round(Math.min(w.end, end) - start, 3) }));
    const c = makeClip('text', tr.id, start, end - start, {
      text: { ...deepClone(look.text), content: words.map((w) => w.text).join(' ') },
      caption: { ...look.caption }, y: look.y, words, captionGroup: group, offset: 0,
    });
    project.clips.push(c);
  });
  return lines.length;
}

/* ---------------- التشغيل الرئيسي ---------------- */
async function runCaptions() {
  if (capState.busy) return;
  const s = capSettings();
  let from = 0, to = projectEnd();
  if (s.range === 'sel') {
    const c = getSelected();
    if (!c) return toast('اختر مقطعاً من الخط الزمني أولاً، أو اجعل النطاق «المشروع كاملاً»', 'error');
    from = c.start; to = c.start + c.duration;
  }
  if (to - from <= 0.2) return toast('لا يوجد صوت في الخط الزمني — أضف فيديو أو صوتاً أولاً', 'error');
  const apiKey = (s.keys[s.provider] || '').trim();
  if (s.engine === 'cloud' && !apiKey) return toast('ألصق مفتاح API أولاً', 'error');
  pause();
  capState.busy = true;
  capState.cancel = false;
  $('#capGo').disabled = true;
  $('#capProgress').hidden = false;
  $('#capCancel').hidden = false;
  setCapStatus('استخراج الصوت من الخط الزمني…', 0.02);
  try {
    const audio = await renderTimelineAudio(from, to);
    if (!audio) throw new Error('لا يوجد صوت مسموع في النطاق المحدد (تحقق من الكتم)');
    let engineLabel = '';
    if (s.engine === 'local' && !window.__captionMock) {
      setCapStatus('تجهيز نموذج الذكاء الاصطناعي…', 0.04);
      const info = await getWorker(s.model, (p) => {
        if (p.total) setCapStatus(`تحميل النموذج (مرة واحدة فقط): ${(p.loaded / 1048576).toFixed(0)} / ${(p.total / 1048576).toFixed(0)} ميغا`, 0.04 + 0.36 * (p.loaded / p.total));
      });
      engineLabel = info.device === 'webgpu' ? 'كرت الشاشة (WebGPU)' : 'المعالج';
    }
    const cloud = s.engine === 'cloud';
    const parts = splitAtSilence(audio, cloud ? 540 : 28, cloud ? 400 : 16);
    const allWords = [];
    for (let i = 0; i < parts.length; i++) {
      if (capState.cancel) throw new Error('cancelled');
      const [a, b] = parts[i];
      const seg = audio.slice(a, b);
      setCapStatus(`جارٍ التعرف على الكلام${engineLabel ? ' عبر ' + engineLabel : ''}… ${fmtShort(a / CAP_SR)} / ${fmtShort(audio.length / CAP_SR)}`, 0.4 + 0.58 * (i / parts.length));
      if (rms(seg) < 0.004) continue; // صمت
      let res;
      if (window.__captionMock) res = await window.__captionMock(seg, s.lang, from + a / CAP_SR);
      else if (cloud) res = await cloudTranscribe(seg, s.lang, s.provider, apiKey);
      else res = await workerTranscribe(seg, s.lang);
      allWords.push(...toWords(res, from + a / CAP_SR, (b - a) / CAP_SR));
    }
    if (!allWords.length) throw new Error('لم يتم العثور على كلام واضح في الصوت');
    checkpoint();
    const n = buildCaptionClips(groupLines(allWords, s.words), from, to, s.style);
    state.selectedId = null;
    changed();
    setCapStatus(`✓ تمت الترجمة: ${allWords.length} كلمة في ${n} سطر`, 1);
    toast(`تم إنشاء الترجمة (${n} سطر) — راجعها وصحّح أي كلمة بالنقر عليها`, 'success');
  } catch (e) {
    if (e.message === 'cancelled') { setCapStatus('تم الإيقاف', 0); toast('تم إيقاف الترجمة'); }
    else { setCapStatus('⚠ ' + e.message, 0); toast(e.message, 'error'); }
  } finally {
    capState.busy = false;
    $('#capGo').disabled = false;
    $('#capCancel').hidden = true;
  }
}

/* ---------------- أدوات إضافية ---------------- */
function restyleCaptions(style) {
  const clips = project.clips.filter((c) => c.words);
  if (!clips.length) return;
  checkpoint();
  const look = captionLook(style);
  for (const c of clips) {
    c.text = { ...deepClone(look.text), content: c.text.content };
    c.caption = { ...look.caption };
  }
  changed();
}
function clearCaptions() {
  const n = project.clips.filter((c) => c.words).length;
  if (!n) return toast('لا توجد ترجمة لحذفها');
  if (!confirm(`حذف ${n} سطر ترجمة؟`)) return;
  checkpoint();
  project.clips = project.clips.filter((c) => !c.words);
  if (state.selectedId && !getClip(state.selectedId)) state.selectedId = null;
  changed();
}
const srtTime = (t) => {
  const ms = Math.round(Math.max(0, t) * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms % 1000).padStart(3, '0')}`;
};
function exportSrt() {
  const clips = project.clips.filter((c) => c.words || (c.type === 'text' && getTrack(c.trackId)?.captions)).sort((a, b) => a.start - b.start);
  if (!clips.length) return toast('لا توجد ترجمة لتصديرها', 'error');
  const body = clips.map((c, i) => {
    const txt = c.words ? captionWords(c).map((w) => w.text).join(' ') : c.text.content;
    return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.duration)}\n${txt}\n`;
  }).join('\n');
  downloadBlob(new Blob(['﻿' + body], { type: 'text/plain;charset=utf-8' }), `${safeName(project.name)}.srt`);
}
function importSrt(text) {
  const parseT = (s) => { const m = s.trim().match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/); return m ? (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + +('0.' + m[4]) : null; };
  const cues = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    const s = parseT(a), e = parseT(b);
    const txt = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (s != null && e != null && e > s && txt) cues.push({ s, e, txt });
  }
  if (!cues.length) return toast('الملف لا يحتوي ترجمة صالحة', 'error');
  const lines = cues.map((c) => {
    const toks = c.txt.split(/\s+/);
    const total = toks.reduce((a, t) => a + t.length + 1, 0);
    let acc = 0;
    return toks.map((t) => { const st = c.s + ((c.e - c.s) * acc) / total; acc += t.length + 1; return { text: t, start: st, end: c.s + ((c.e - c.s) * acc) / total }; });
  });
  checkpoint();
  buildCaptionClips(lines, cues[0].s, cues[cues.length - 1].e, capSettings().style);
  changed();
  toast(`تم استيراد ${cues.length} سطر ترجمة`, 'success');
}

try {
  if (typeof CAPTION_STYLES === 'undefined' || typeof drawCaption === 'undefined') throw new Error('stale app.js');
  buildCaptionsUI();
} catch (e) {
  console.error(e);
  const box = document.getElementById('tab-captions');
  if (box) box.innerHTML = '<div class="cap-hero">⚠️ لم يتم تحميل أداة الترجمة بشكل كامل.<br><span class="small">اضغط <b>Ctrl + Shift + R</b> (أو Ctrl + F5) لتحديث الصفحة بالكامل.</span><br><span class="muted small">' + String(e && e.message || e).replace(/</g, '&lt;') + '</span></div>';
}
Object.assign(window.__studio || {}, { runCaptions, exportSrt, importSrt, groupLines, toWords });
