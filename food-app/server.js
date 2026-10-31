'use strict';
/**
 * تطبيق طلبات الطعام - الخادم
 * خادم Node.js بدون أي مكتبات خارجية. البيانات تحفظ في data/db.json
 * التشغيل: node server.js  ثم افتح http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 8 * 1024 * 1024;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- كلمات المرور
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(String(pw), salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- قاعدة البيانات
function seed() {
  const cats = [
    ['برغر', '🍔'], ['بيتزا', '🍕'], ['شاورما', '🌯'], ['مشاوي', '🍢'],
    ['حلويات', '🍰'], ['مشروبات', '🥤'], ['صحي', '🥗'], ['فطور', '🍳'],
  ].map(([name, icon], i) => ({ id: newId(), name, icon, order: i }));
  const cat = (n) => cats.find((c) => c.name === n).id;

  const db = {
    settings: { appName: 'طلباتي', currency: 'د.أ', taxPercent: 0, supportPhone: '' },
    seq: 1000,
    categories: cats,
    users: [{
      id: newId(), name: 'المدير', email: 'admin@food.com', phone: '',
      passwordHash: hashPassword('admin123'), role: 'admin', blocked: false,
      addresses: [], favorites: [], createdAt: nowIso(),
    }],
    sessions: {},
    restaurants: [],
    items: [],
    orders: [],
    coupons: [
      { id: newId(), code: 'WELCOME10', type: 'percent', value: 10, minOrder: 5, maxDiscount: 3, usageLimit: 0, used: 0, expiresAt: '', restaurantId: '', active: true, createdAt: nowIso() },
      { id: newId(), code: 'FREEDEL', type: 'free_delivery', value: 0, minOrder: 10, maxDiscount: 0, usageLimit: 100, used: 0, expiresAt: '', restaurantId: '', active: true, createdAt: nowIso() },
    ],
  };

  const add = (r, items) => {
    const rest = {
      id: newId(), image: '', address: '', phone: '', isOpen: true, active: true,
      openTime: '00:00', closeTime: '00:00', createdAt: nowIso(), ...r,
    };
    db.restaurants.push(rest);
    for (const it of items) {
      db.items.push({
        id: newId(), restaurantId: rest.id, description: '', image: '', available: true,
        popular: false, extras: [], createdAt: nowIso(), ...it,
      });
    }
  };

  add({ name: 'برغر هاوس', description: 'برغر لحم مشوي على الفحم بخبز طازج يومياً', categoryId: cat('برغر'), deliveryFee: 1, minOrder: 4, deliveryTime: '25-35' }, [
    { name: 'كلاسيك برغر', description: 'لحم بقري 150غ، جبنة شيدر، خس، طماطم، صوص خاص', price: 4.5, section: 'البرغر', popular: true, extras: [{ name: 'جبنة إضافية', price: 0.5 }, { name: 'لحم إضافي', price: 1.5 }, { name: 'بيكون بقري', price: 1 }] },
    { name: 'تشيكن برغر', description: 'صدر دجاج مقرمش مع مايونيز وخس', price: 4, section: 'البرغر', extras: [{ name: 'جبنة إضافية', price: 0.5 }, { name: 'هالبينو', price: 0.3 }] },
    { name: 'دبل سماش', description: 'قطعتين لحم سماش مع جبنة أمريكية وبصل مكرمل', price: 6, section: 'البرغر', popular: true, extras: [{ name: 'جبنة إضافية', price: 0.5 }] },
    { name: 'بطاطا مقلية', description: 'بطاطا ذهبية مقرمشة', price: 1.5, section: 'المقبلات', extras: [{ name: 'حجم كبير', price: 0.75 }, { name: 'صوص جبنة', price: 0.5 }] },
    { name: 'حلقات البصل', price: 2, section: 'المقبلات' },
    { name: 'كولا', price: 0.75, section: 'المشروبات' },
    { name: 'عصير برتقال طبيعي', price: 1.5, section: 'المشروبات' },
  ]);
  add({ name: 'بيتزا نابولي', description: 'بيتزا إيطالية على الحطب', categoryId: cat('بيتزا'), deliveryFee: 1.5, minOrder: 6, deliveryTime: '35-45' }, [
    { name: 'مارغريتا', description: 'صوص طماطم، موزاريلا، ريحان', price: 6, section: 'البيتزا', popular: true, extras: [{ name: 'حجم كبير', price: 2 }, { name: 'أطراف بالجبنة', price: 1.5 }] },
    { name: 'بيبروني', description: 'بيبروني بقري مع موزاريلا', price: 7.5, section: 'البيتزا', extras: [{ name: 'حجم كبير', price: 2 }, { name: 'أطراف بالجبنة', price: 1.5 }] },
    { name: 'خضار', description: 'فلفل، زيتون، فطر، بصل، طماطم', price: 6.5, section: 'البيتزا', extras: [{ name: 'حجم كبير', price: 2 }] },
    { name: 'خبز بالثوم', price: 2, section: 'المقبلات' },
    { name: 'سلطة سيزر', price: 3, section: 'المقبلات' },
  ]);
  add({ name: 'شاورما الشام', description: 'شاورما دجاج ولحمة على الأصول', categoryId: cat('شاورما'), deliveryFee: 0.75, minOrder: 3, deliveryTime: '20-30' }, [
    { name: 'سندويش شاورما دجاج', price: 1.5, section: 'السندويشات', popular: true, extras: [{ name: 'خبز صاج', price: 0.25 }, { name: 'ثومية إضافية', price: 0.2 }] },
    { name: 'سندويش شاورما لحمة', price: 2, section: 'السندويشات', extras: [{ name: 'خبز صاج', price: 0.25 }, { name: 'طحينة إضافية', price: 0.2 }] },
    { name: 'وجبة شاورما عربي', description: 'شاورما مقطعة مع بطاطا وثومية ومخلل', price: 4.5, section: 'الوجبات', popular: true, extras: [{ name: 'دبل', price: 2 }] },
    { name: 'صحن شاورما', price: 5, section: 'الوجبات' },
    { name: 'عيران', price: 0.5, section: 'المشروبات' },
  ]);
  add({ name: 'حلويات الكنافة', description: 'كنافة نابلسية وحلويات عربية', categoryId: cat('حلويات'), deliveryFee: 1, minOrder: 3, deliveryTime: '30-40' }, [
    { name: 'كنافة ناعمة', description: 'ربع كيلو', price: 3, section: 'الكنافة', popular: true, extras: [{ name: 'نصف كيلو', price: 3 }, { name: 'فستق حلبي', price: 0.75 }] },
    { name: 'كنافة خشنة', description: 'ربع كيلو', price: 3, section: 'الكنافة' },
    { name: 'بقلاوة مشكلة', description: 'ربع كيلو', price: 4, section: 'حلويات عربية' },
    { name: 'قهوة عربية', price: 1, section: 'المشروبات' },
  ]);
  add({ name: 'جرين بول', description: 'سلطات وأطباق صحية قليلة السعرات', categoryId: cat('صحي'), deliveryFee: 1.25, minOrder: 5, deliveryTime: '25-40', isOpen: false }, [
    { name: 'سلطة كينوا', price: 4.5, section: 'السلطات', extras: [{ name: 'صدر دجاج مشوي', price: 1.5 }] },
    { name: 'بول سلمون', price: 7, section: 'البولات', popular: true },
    { name: 'سموذي أخضر', price: 2.5, section: 'المشروبات' },
  ]);
  return db;
}

let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  db = seed();
  save();
  console.log('تم إنشاء قاعدة بيانات جديدة. حساب المدير: admin@food.com / admin123');
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

// ---------------------------------------------------------------- أدوات مساعدة
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new HttpError(status, msg); };

function str(v, { max = 500, required = false, label = 'الحقل' } = {}) {
  const s = v == null ? '' : String(v).trim();
  if (required && !s) fail(400, `${label} مطلوب`);
  if (s.length > max) fail(400, `${label} طويل جداً`);
  return s;
}
function num(v, { min = 0, max = 1e9, label = 'القيمة', int = false } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) fail(400, `${label} غير صحيحة`);
  return n;
}
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
const timeStr = (v) => {
  const s = str(v, { max: 5 });
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(400, 'صيغة الوقت غير صحيحة');
  return s;
};
const imageStr = (v) => {
  const s = str(v, { max: 1000 });
  if (s && !/^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/.test(s)) fail(400, 'رابط الصورة غير صحيح');
  return s;
};

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  blocked: !!u.blocked, addresses: u.addresses || [], favorites: u.favorites || [], createdAt: u.createdAt,
});

function toMinutes(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; }
function isOpenNow(r) {
  if (!r.isOpen || !r.active) return false;
  if (!r.openTime || !r.closeTime || r.openTime === r.closeTime) return true;
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  const o = toMinutes(r.openTime);
  const c = toMinutes(r.closeTime);
  return o < c ? m >= o && m < c : m >= o || m < c;
}

function reviewsFor(restaurantId) {
  return db.orders
    .filter((o) => o.restaurantId === restaurantId && o.review)
    .map((o) => ({ userName: o.userName, rating: o.review.rating, comment: o.review.comment, at: o.review.at }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

function restaurantView(r) {
  const reviews = reviewsFor(r.id);
  const rating = reviews.length ? round2(reviews.reduce((s, x) => s + x.rating, 0) / reviews.length) : 0;
  const c = db.categories.find((x) => x.id === r.categoryId);
  return {
    ...r, rating, ratingCount: reviews.length, openNow: isOpenNow(r),
    categoryName: c ? c.name : '', categoryIcon: c ? c.icon : '🍽️',
    ordersCount: db.orders.filter((o) => o.restaurantId === r.id && o.status !== 'cancelled').length,
  };
}

function findCoupon(code) {
  const c = String(code || '').trim().toUpperCase();
  return c ? db.coupons.find((x) => x.code === c) : null;
}
/** يحسب قيمة الخصم أو يرمي خطأ يشرح سبب رفض الكوبون */
function applyCoupon(code, subtotal, restaurant) {
  const c = findCoupon(code);
  if (!c || !c.active) fail(400, 'كود الخصم غير صحيح');
  if (c.expiresAt && new Date(c.expiresAt + 'T23:59:59') < new Date()) fail(400, 'كود الخصم منتهي الصلاحية');
  if (c.usageLimit && c.used >= c.usageLimit) fail(400, 'تم استنفاد عدد مرات استخدام هذا الكود');
  if (c.restaurantId && c.restaurantId !== restaurant.id) fail(400, 'هذا الكود غير صالح لهذا المطعم');
  if (subtotal < c.minOrder) fail(400, `الحد الأدنى لاستخدام هذا الكود ${c.minOrder} ${db.settings.currency}`);
  let discount = 0;
  let freeDelivery = false;
  if (c.type === 'percent') {
    discount = (subtotal * c.value) / 100;
    if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  } else if (c.type === 'fixed') {
    discount = Math.min(c.value, subtotal);
  } else if (c.type === 'free_delivery') {
    freeDelivery = true;
  }
  return { coupon: c, discount: round2(discount), freeDelivery };
}

const STATUSES = ['pending', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

// ---------------------------------------------------------------- الموجّه
const routes = [];
function route(method, pattern, access, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, access, handler });
}

function getSession(req) {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = db.sessions[m[1]];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) { delete db.sessions[m[1]]; return null; }
  const user = db.users.find((u) => u.id === s.userId);
  if (!user || user.blocked) return null;
  return { token: m[1], user };
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { userId: user.id, createdAt: Date.now() };
  return token;
}

// ---------------------------------------------------------------- واجهة عامة + المصادقة
route('GET', '/api/settings', 'public', () => db.settings);

route('POST', '/api/auth/register', 'public', ({ body }) => {
  const name = str(body.name, { required: true, max: 80, label: 'الاسم' });
  const email = str(body.email, { required: true, max: 120, label: 'البريد الإلكتروني' }).toLowerCase();
  const phone = str(body.phone, { required: true, max: 20, label: 'رقم الهاتف' });
  const password = String(body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'البريد الإلكتروني غير صحيح');
  if (password.length < 6) fail(400, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (db.users.some((u) => u.email === email)) fail(409, 'هذا البريد مسجل مسبقاً');
  const user = {
    id: newId(), name, email, phone, passwordHash: hashPassword(password), role: 'customer',
    blocked: false, addresses: [], favorites: [], createdAt: nowIso(),
  };
  db.users.push(user);
  const token = createSession(user);
  save();
  return { token, user: publicUser(user) };
});

route('POST', '/api/auth/login', 'public', ({ body }) => {
  const email = str(body.email).toLowerCase();
  const user = db.users.find((u) => u.email === email);
  if (!user || !verifyPassword(body.password, user.passwordHash)) fail(401, 'البريد أو كلمة المرور غير صحيحة');
  if (user.blocked) fail(403, 'تم إيقاف هذا الحساب، تواصل مع الدعم');
  const token = createSession(user);
  save();
  return { token, user: publicUser(user) };
});

route('POST', '/api/auth/logout', 'user', ({ session }) => {
  delete db.sessions[session.token];
  save();
  return { ok: true };
});

route('GET', '/api/me', 'user', ({ user }) => publicUser(user));

route('PUT', '/api/me', 'user', ({ user, body }) => {
  if (body.name !== undefined) user.name = str(body.name, { required: true, max: 80, label: 'الاسم' });
  if (body.phone !== undefined) user.phone = str(body.phone, { required: true, max: 20, label: 'رقم الهاتف' });
  if (body.addresses !== undefined) {
    if (!Array.isArray(body.addresses) || body.addresses.length > 10) fail(400, 'العناوين غير صحيحة');
    user.addresses = body.addresses.map((a) => ({
      id: a.id || newId(),
      label: str(a.label, { max: 40, label: 'اسم العنوان' }) || 'عنوان',
      details: str(a.details, { required: true, max: 300, label: 'تفاصيل العنوان' }),
    }));
  }
  save();
  return publicUser(user);
});

route('PUT', '/api/me/password', 'user', ({ user, body }) => {
  if (!verifyPassword(body.current, user.passwordHash)) fail(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(body.next || '').length < 6) fail(400, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
  user.passwordHash = hashPassword(body.next);
  save();
  return { ok: true };
});

route('POST', '/api/favorites/:id', 'user', ({ user, params }) => {
  if (!db.restaurants.some((r) => r.id === params.id)) fail(404, 'المطعم غير موجود');
  user.favorites = user.favorites || [];
  const i = user.favorites.indexOf(params.id);
  if (i >= 0) user.favorites.splice(i, 1); else user.favorites.push(params.id);
  save();
  return { favorites: user.favorites };
});

route('GET', '/api/categories', 'public', () => [...db.categories].sort((a, b) => a.order - b.order));

route('GET', '/api/restaurants', 'public', () =>
  db.restaurants.filter((r) => r.active).map(restaurantView));

route('GET', '/api/restaurants/:id', 'public', ({ params }) => {
  const r = db.restaurants.find((x) => x.id === params.id && x.active);
  if (!r) fail(404, 'المطعم غير موجود');
  return {
    restaurant: restaurantView(r),
    items: db.items.filter((i) => i.restaurantId === r.id),
    reviews: reviewsFor(r.id).slice(0, 50),
  };
});

route('POST', '/api/coupons/validate', 'public', ({ body }) => {
  const r = db.restaurants.find((x) => x.id === body.restaurantId);
  if (!r) fail(404, 'المطعم غير موجود');
  const { coupon, discount, freeDelivery } = applyCoupon(body.code, num(body.subtotal, { label: 'المجموع' }), r);
  return { code: coupon.code, type: coupon.type, discount, freeDelivery };
});

// ---------------------------------------------------------------- الطلبات (الزبون)
route('POST', '/api/orders', 'user', ({ user, body }) => {
  const r = db.restaurants.find((x) => x.id === body.restaurantId && x.active);
  if (!r) fail(404, 'المطعم غير موجود');
  if (!isOpenNow(r)) fail(400, 'المطعم مغلق حالياً ولا يستقبل طلبات');
  if (!Array.isArray(body.items) || !body.items.length) fail(400, 'السلة فارغة');
  if (body.items.length > 50) fail(400, 'عدد الأصناف كبير جداً');

  const lines = body.items.map((line) => {
    const item = db.items.find((i) => i.id === line.itemId && i.restaurantId === r.id);
    if (!item) fail(400, 'أحد الأصناف لم يعد متوفراً، حدّث السلة');
    if (!item.available) fail(400, `الصنف "${item.name}" غير متوفر حالياً`);
    const qty = num(line.qty, { min: 1, max: 50, int: true, label: 'الكمية' });
    const extras = (Array.isArray(line.extras) ? line.extras : []).map((name) => {
      const e = (item.extras || []).find((x) => x.name === name);
      if (!e) fail(400, `الإضافة "${name}" غير متوفرة`);
      return { name: e.name, price: e.price };
    });
    const unit = item.price + extras.reduce((s, e) => s + e.price, 0);
    return {
      itemId: item.id, name: item.name, price: item.price, extras, qty,
      note: str(line.note, { max: 200 }), unitPrice: round2(unit), lineTotal: round2(unit * qty),
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  if (subtotal < r.minOrder) fail(400, `الحد الأدنى للطلب من هذا المطعم ${r.minOrder} ${db.settings.currency}`);

  let deliveryFee = r.deliveryFee;
  let discount = 0;
  let coupon = null;
  if (body.couponCode) {
    const res = applyCoupon(body.couponCode, subtotal, r);
    coupon = res.coupon;
    discount = res.discount;
    if (res.freeDelivery) deliveryFee = 0;
  }
  const tax = round2(((subtotal - discount) * (Number(db.settings.taxPercent) || 0)) / 100);
  const total = round2(subtotal - discount + deliveryFee + tax);

  const address = str(body.address, { required: true, max: 300, label: 'العنوان' });
  const phone = str(body.phone, { required: true, max: 20, label: 'رقم الهاتف' });
  const paymentMethod = body.paymentMethod === 'card' ? 'card' : 'cash';

  if (coupon) coupon.used = (coupon.used || 0) + 1;
  db.seq += 1;
  const order = {
    id: newId(), number: db.seq, userId: user.id, userName: user.name,
    restaurantId: r.id, restaurantName: r.name, items: lines,
    subtotal, deliveryFee, discount, tax, total, couponCode: coupon ? coupon.code : '',
    address, phone, paymentMethod, paymentStatus: paymentMethod === 'card' ? 'paid' : 'unpaid',
    notes: str(body.notes, { max: 300 }), status: 'pending',
    statusHistory: [{ status: 'pending', at: nowIso() }], cancelReason: '',
    review: null, createdAt: nowIso(),
  };
  db.orders.push(order);

  // حفظ العنوان في حساب المستخدم إذا كان جديداً
  user.addresses = user.addresses || [];
  if (body.saveAddress && !user.addresses.some((a) => a.details === address) && user.addresses.length < 10) {
    user.addresses.push({ id: newId(), label: str(body.addressLabel, { max: 40 }) || 'عنوان', details: address });
  }
  if (!user.phone) user.phone = phone;
  save();
  return order;
});

route('GET', '/api/orders', 'user', ({ user }) =>
  db.orders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

function getOwnOrder(user, id) {
  const o = db.orders.find((x) => x.id === id);
  if (!o || (o.userId !== user.id && user.role !== 'admin')) fail(404, 'الطلب غير موجود');
  return o;
}

route('GET', '/api/orders/:id', 'user', ({ user, params }) => {
  const o = getOwnOrder(user, params.id);
  const r = db.restaurants.find((x) => x.id === o.restaurantId);
  return { ...o, restaurantPhone: r ? r.phone : '' };
});

route('POST', '/api/orders/:id/cancel', 'user', ({ user, params }) => {
  const o = getOwnOrder(user, params.id);
  if (o.status !== 'pending') fail(400, 'لا يمكن إلغاء الطلب بعد تأكيده من المطعم');
  o.status = 'cancelled';
  o.cancelReason = 'ألغاه الزبون';
  o.statusHistory.push({ status: 'cancelled', at: nowIso() });
  const c = findCoupon(o.couponCode);
  if (c && c.used > 0) c.used -= 1;
  if (o.paymentStatus === 'paid') o.paymentStatus = 'refunded';
  save();
  return o;
});

route('POST', '/api/orders/:id/review', 'user', ({ user, params, body }) => {
  const o = getOwnOrder(user, params.id);
  if (o.userId !== user.id) fail(403, 'غير مسموح');
  if (o.status !== 'delivered') fail(400, 'يمكنك التقييم بعد توصيل الطلب');
  if (o.review) fail(400, 'تم تقييم هذا الطلب مسبقاً');
  o.review = {
    rating: num(body.rating, { min: 1, max: 5, int: true, label: 'التقييم' }),
    comment: str(body.comment, { max: 500 }), at: nowIso(),
  };
  save();
  return o;
});

// ---------------------------------------------------------------- لوحة التحكم
route('GET', '/api/admin/stats', 'admin', () => {
  const today = new Date().toDateString();
  const valid = db.orders.filter((o) => o.status !== 'cancelled');
  const delivered = db.orders.filter((o) => o.status === 'delivered');
  const todayOrders = valid.filter((o) => new Date(o.createdAt).toDateString() === today);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, db.orders.filter((o) => o.status === s).length]));

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    const list = valid.filter((o) => new Date(o.createdAt).toDateString() === ds);
    days.push({ date: d.toISOString().slice(0, 10), orders: list.length, revenue: round2(list.reduce((s, o) => s + o.total, 0)) });
  }

  const restCount = {};
  const itemCount = {};
  for (const o of valid) {
    restCount[o.restaurantName] = (restCount[o.restaurantName] || 0) + 1;
    for (const l of o.items) itemCount[l.name] = (itemCount[l.name] || 0) + l.qty;
  }
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  return {
    restaurants: db.restaurants.length,
    openRestaurants: db.restaurants.filter(isOpenNow).length,
    customers: db.users.filter((u) => u.role === 'customer').length,
    orders: db.orders.length,
    revenue: round2(delivered.reduce((s, o) => s + o.total, 0)),
    todayOrders: todayOrders.length,
    todayRevenue: round2(todayOrders.reduce((s, o) => s + o.total, 0)),
    avgOrder: valid.length ? round2(valid.reduce((s, o) => s + o.total, 0) / valid.length) : 0,
    byStatus, days, topRestaurants: top(restCount), topItems: top(itemCount),
    recent: [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  };
});

// المطاعم
function restaurantInput(body, existing = {}) {
  const categoryId = str(body.categoryId, { max: 60 });
  if (categoryId && !db.categories.some((c) => c.id === categoryId)) fail(400, 'التصنيف غير موجود');
  return {
    ...existing,
    name: str(body.name, { required: true, max: 80, label: 'اسم المطعم' }),
    description: str(body.description, { max: 500 }),
    categoryId,
    image: imageStr(body.image),
    address: str(body.address, { max: 200 }),
    phone: str(body.phone, { max: 20 }),
    deliveryFee: num(body.deliveryFee || 0, { label: 'رسوم التوصيل' }),
    minOrder: num(body.minOrder || 0, { label: 'الحد الأدنى للطلب' }),
    deliveryTime: str(body.deliveryTime, { max: 20 }) || '30-45',
    openTime: timeStr(body.openTime),
    closeTime: timeStr(body.closeTime),
    isOpen: bool(body.isOpen),
    active: bool(body.active),
  };
}

route('GET', '/api/admin/restaurants', 'admin', () =>
  db.restaurants.map((r) => ({ ...restaurantView(r), itemsCount: db.items.filter((i) => i.restaurantId === r.id).length })));

route('POST', '/api/admin/restaurants', 'admin', ({ body }) => {
  const r = restaurantInput(body, { id: newId(), createdAt: nowIso() });
  db.restaurants.push(r);
  save();
  return r;
});

const findRestaurant = (id) => db.restaurants.find((r) => r.id === id) || fail(404, 'المطعم غير موجود');

route('PUT', '/api/admin/restaurants/:id', 'admin', ({ params, body }) => {
  const r = findRestaurant(params.id);
  Object.assign(r, restaurantInput({ ...r, ...body }, r));
  save();
  return r;
});

route('DELETE', '/api/admin/restaurants/:id', 'admin', ({ params }) => {
  findRestaurant(params.id);
  db.restaurants = db.restaurants.filter((r) => r.id !== params.id);
  db.items = db.items.filter((i) => i.restaurantId !== params.id);
  for (const u of db.users) u.favorites = (u.favorites || []).filter((f) => f !== params.id);
  save();
  return { ok: true };
});

// أصناف القائمة
function itemInput(body, existing = {}) {
  const extras = Array.isArray(body.extras) ? body.extras : [];
  if (extras.length > 30) fail(400, 'عدد الإضافات كبير جداً');
  return {
    ...existing,
    name: str(body.name, { required: true, max: 80, label: 'اسم الصنف' }),
    description: str(body.description, { max: 500 }),
    price: num(body.price, { label: 'السعر' }),
    section: str(body.section, { max: 50 }) || 'القائمة',
    image: imageStr(body.image),
    available: bool(body.available),
    popular: bool(body.popular),
    extras: extras
      .filter((e) => e && String(e.name || '').trim())
      .map((e) => ({ name: str(e.name, { max: 60, label: 'اسم الإضافة' }), price: num(e.price || 0, { label: 'سعر الإضافة' }) })),
  };
}

route('GET', '/api/admin/restaurants/:id/items', 'admin', ({ params }) => {
  const r = findRestaurant(params.id);
  return { restaurant: restaurantView(r), items: db.items.filter((i) => i.restaurantId === r.id) };
});

route('POST', '/api/admin/restaurants/:id/items', 'admin', ({ params, body }) => {
  const r = findRestaurant(params.id);
  const item = itemInput(body, { id: newId(), restaurantId: r.id, createdAt: nowIso() });
  db.items.push(item);
  save();
  return item;
});

const findItem = (id) => db.items.find((i) => i.id === id) || fail(404, 'الصنف غير موجود');

route('PUT', '/api/admin/items/:id', 'admin', ({ params, body }) => {
  const it = findItem(params.id);
  Object.assign(it, itemInput({ ...it, ...body }, it));
  save();
  return it;
});

route('DELETE', '/api/admin/items/:id', 'admin', ({ params }) => {
  findItem(params.id);
  db.items = db.items.filter((i) => i.id !== params.id);
  save();
  return { ok: true };
});

// الطلبات
route('GET', '/api/admin/orders', 'admin', ({ query }) => {
  let list = [...db.orders];
  if (query.get('status')) list = list.filter((o) => o.status === query.get('status'));
  if (query.get('restaurantId')) list = list.filter((o) => o.restaurantId === query.get('restaurantId'));
  const q = (query.get('q') || '').trim();
  if (q) list = list.filter((o) => String(o.number).includes(q) || o.userName.includes(q) || o.phone.includes(q) || o.restaurantName.includes(q));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
});

route('PUT', '/api/admin/orders/:id/status', 'admin', ({ params, body }) => {
  const o = db.orders.find((x) => x.id === params.id) || fail(404, 'الطلب غير موجود');
  const status = body.status;
  if (!STATUSES.includes(status)) fail(400, 'الحالة غير صحيحة');
  if (o.status === status) return o;
  if (o.status === 'cancelled') fail(400, 'لا يمكن تعديل طلب ملغي');
  if (o.status === 'delivered' && status !== 'cancelled') fail(400, 'الطلب تم توصيله مسبقاً');
  o.status = status;
  o.statusHistory.push({ status, at: nowIso() });
  if (status === 'cancelled') {
    o.cancelReason = str(body.reason, { max: 200 }) || 'ألغاه المطعم';
    const c = findCoupon(o.couponCode);
    if (c && c.used > 0) c.used -= 1;
    if (o.paymentStatus === 'paid') o.paymentStatus = 'refunded';
  }
  if (status === 'delivered' && o.paymentMethod === 'cash') o.paymentStatus = 'paid';
  save();
  return o;
});

// التصنيفات
route('GET', '/api/admin/categories', 'admin', () =>
  [...db.categories].sort((a, b) => a.order - b.order).map((c) => ({ ...c, restaurantsCount: db.restaurants.filter((r) => r.categoryId === c.id).length })));

route('POST', '/api/admin/categories', 'admin', ({ body }) => {
  const c = {
    id: newId(), name: str(body.name, { required: true, max: 40, label: 'اسم التصنيف' }),
    icon: str(body.icon, { max: 8 }) || '🍽️', order: num(body.order || db.categories.length, { label: 'الترتيب' }),
  };
  db.categories.push(c);
  save();
  return c;
});

route('PUT', '/api/admin/categories/:id', 'admin', ({ params, body }) => {
  const c = db.categories.find((x) => x.id === params.id) || fail(404, 'التصنيف غير موجود');
  c.name = str(body.name, { required: true, max: 40, label: 'اسم التصنيف' });
  c.icon = str(body.icon, { max: 8 }) || '🍽️';
  c.order = num(body.order || 0, { label: 'الترتيب' });
  save();
  return c;
});

route('DELETE', '/api/admin/categories/:id', 'admin', ({ params }) => {
  db.categories = db.categories.filter((c) => c.id !== params.id);
  for (const r of db.restaurants) if (r.categoryId === params.id) r.categoryId = '';
  save();
  return { ok: true };
});

// الكوبونات
function couponInput(body, existing = {}) {
  const code = str(body.code, { required: true, max: 30, label: 'الكود' }).toUpperCase().replace(/\s+/g, '');
  if (db.coupons.some((c) => c.code === code && c.id !== existing.id)) fail(409, 'هذا الكود موجود مسبقاً');
  const type = ['percent', 'fixed', 'free_delivery'].includes(body.type) ? body.type : fail(400, 'نوع الخصم غير صحيح');
  const expiresAt = str(body.expiresAt, { max: 10 });
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) fail(400, 'تاريخ الانتهاء غير صحيح');
  const restaurantId = str(body.restaurantId, { max: 60 });
  if (restaurantId) findRestaurant(restaurantId);
  return {
    used: 0, ...existing, code, type,
    value: type === 'free_delivery' ? 0 : num(body.value, { min: 0, max: type === 'percent' ? 100 : 1e6, label: 'قيمة الخصم' }),
    minOrder: num(body.minOrder || 0, { label: 'الحد الأدنى' }),
    maxDiscount: num(body.maxDiscount || 0, { label: 'أقصى خصم' }),
    usageLimit: num(body.usageLimit || 0, { int: true, label: 'عدد مرات الاستخدام' }),
    expiresAt, restaurantId, active: bool(body.active),
  };
}

route('GET', '/api/admin/coupons', 'admin', () => db.coupons);
route('POST', '/api/admin/coupons', 'admin', ({ body }) => {
  const c = couponInput(body, { id: newId(), createdAt: nowIso() });
  db.coupons.push(c);
  save();
  return c;
});
route('PUT', '/api/admin/coupons/:id', 'admin', ({ params, body }) => {
  const c = db.coupons.find((x) => x.id === params.id) || fail(404, 'الكوبون غير موجود');
  Object.assign(c, couponInput({ ...c, ...body }, c));
  save();
  return c;
});
route('DELETE', '/api/admin/coupons/:id', 'admin', ({ params }) => {
  db.coupons = db.coupons.filter((c) => c.id !== params.id);
  save();
  return { ok: true };
});

// المستخدمون
route('GET', '/api/admin/users', 'admin', () => db.users.map((u) => {
  const orders = db.orders.filter((o) => o.userId === u.id && o.status !== 'cancelled');
  return { ...publicUser(u), ordersCount: orders.length, spent: round2(orders.reduce((s, o) => s + o.total, 0)) };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

route('PUT', '/api/admin/users/:id', 'admin', ({ user, params, body }) => {
  const u = db.users.find((x) => x.id === params.id) || fail(404, 'المستخدم غير موجود');
  if (u.id === user.id) fail(400, 'لا يمكنك تعديل حسابك من هنا');
  if (body.blocked !== undefined) {
    u.blocked = bool(body.blocked);
    if (u.blocked) for (const [t, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[t];
  }
  if (body.role !== undefined) u.role = body.role === 'admin' ? 'admin' : 'customer';
  save();
  return publicUser(u);
});

// الإعدادات
route('PUT', '/api/admin/settings', 'admin', ({ body }) => {
  db.settings = {
    appName: str(body.appName, { required: true, max: 40, label: 'اسم التطبيق' }),
    currency: str(body.currency, { required: true, max: 10, label: 'العملة' }),
    taxPercent: num(body.taxPercent || 0, { max: 100, label: 'نسبة الضريبة' }),
    supportPhone: str(body.supportPhone, { max: 20 }),
  };
  save();
  return db.settings;
});

// رفع الصور (Data URL بصيغة base64)
route('POST', '/api/admin/upload', 'admin', ({ body }) => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
  if (!m) fail(400, 'صيغة الصورة غير مدعومة');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) fail(400, 'حجم الصورة كبير جداً (الحد 5 ميغا)');
  const name = `${newId()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { url: `/uploads/${name}` };
});

// ---------------------------------------------------------------- خادم HTTP
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'حجم الطلب كبير جداً')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'بيانات غير صالحة')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  let base = PUBLIC_DIR;
  let rel = pathname;
  if (pathname === '/') rel = '/index.html';
  else if (pathname === '/admin' || pathname === '/admin/') rel = '/admin.html';
  else if (pathname.startsWith('/uploads/')) { base = UPLOAD_DIR; rel = pathname.slice('/uploads'.length); }
  let file;
  try { file = path.join(base, decodeURIComponent(rel)); } catch { file = ''; }
  if (!file || !file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('غير موجود'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.html' || ext === '.js' || ext === '.webmanifest') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(res, url.pathname);
  }
  try {
    let matched = null;
    let params = {};
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(url.pathname);
      if (m) { matched = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
    }
    if (!matched) fail(404, 'المسار غير موجود');
    const session = getSession(req);
    if (matched.access !== 'public' && !session) fail(401, 'يجب تسجيل الدخول');
    if (matched.access === 'admin' && session.user.role !== 'admin') fail(403, 'هذه الصفحة للمدير فقط');
    const body = req.method === 'GET' ? {} : await readBody(req);
    const result = await matched.handler({ req, body, params, query: url.searchParams, session, user: session && session.user });
    sendJson(res, 200, result);
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    sendJson(res, 500, { error: 'حدث خطأ في الخادم' });
  }
});

server.listen(PORT, () => {
  console.log(`🍔 التطبيق يعمل على:  http://localhost:${PORT}`);
  console.log(`🛠️  لوحة التحكم:      http://localhost:${PORT}/admin`);
});
