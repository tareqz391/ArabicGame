/* أدوات مشتركة بين واجهة الزبون ولوحة التحكم */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const Store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
  del(key) { localStorage.removeItem(key); },
};

let SETTINGS = { appName: 'طلباتي', currency: 'د.أ', taxPercent: 0 };

function money(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(SETTINGS.currency)}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS = {
  pending: { label: 'بانتظار التأكيد', icon: '⏳', color: 'warn' },
  accepted: { label: 'تم التأكيد', icon: '✅', color: 'info' },
  preparing: { label: 'قيد التحضير', icon: '👨‍🍳', color: 'info' },
  on_the_way: { label: 'في الطريق', icon: '🛵', color: 'primary' },
  delivered: { label: 'تم التوصيل', icon: '🎉', color: 'ok' },
  cancelled: { label: 'ملغي', icon: '❌', color: 'bad' },
};
const STATUS_FLOW = ['pending', 'accepted', 'preparing', 'on_the_way', 'delivered'];

function statusBadge(s) {
  const st = STATUS[s] || { label: s, icon: '', color: '' };
  return `<span class="badge ${st.color}">${st.icon} ${st.label}</span>`;
}

function stars(rating) {
  const r = Math.round(rating);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

/** صورة أو أيقونة بديلة عند عدم وجود صورة */
function pic(url, icon = '🍽️', cls = '') {
  const img = url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="pic ${cls}"><span>${esc(icon)}</span>${img}</div>`;
}

// ------------------------------------------------------------ API
function authToken(scope) { return Store.get(`${scope}_token`, null); }

function makeApi(scope) {
  return async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    const token = authToken(scope);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('تعذر الاتصال بالخادم، تحقق من الإنترنت');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'حدث خطأ غير متوقع');
      err.status = res.status;
      throw err;
    }
    return data;
  };
}

// ------------------------------------------------------------ تنبيهات ونوافذ
function toast(msg, type = 'ok') {
  let wrap = $('#toasts');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 2800);
  setTimeout(() => el.remove(), 3300);
}

function openModal(html, { wide = false } = {}) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog"><button class="modal-x" aria-label="إغلاق">✕</button>${html}</div>`;
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('.modal-x')) closeModal(); });
  document.body.appendChild(back);
  document.body.classList.add('no-scroll');
  return back.querySelector('.modal');
}
function closeModal() {
  $$('.modal-back').forEach((m) => m.remove());
  document.body.classList.remove('no-scroll');
}

function confirmBox(msg, { ok = 'تأكيد', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = openModal(`<p class="confirm-msg">${esc(msg)}</p>
      <div class="row end"><button class="btn ghost" data-v="0">إلغاء</button><button class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(ok)}</button></div>`);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      closeModal();
      resolve(b.dataset.v === '1');
    });
  });
}

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

/** يصغّر الصورة قبل رفعها لتوفير المساحة */
function fileToDataUrl(file, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('الملف ليس صورة'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذرت قراءة الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذرت قراءة الصورة'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* الصوت غير مدعوم */ }
}

/** موجّه بسيط يعتمد على # في الرابط */
function createRouter(routes, onNotFound) {
  async function run() {
    const hash = location.hash.slice(1) || '/';
    for (const [pattern, handler] of routes) {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      const m = re.exec(hash);
      if (m) {
        const params = {};
        keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return handler(params);
      }
    }
    return onNotFound();
  }
  return run;
}
