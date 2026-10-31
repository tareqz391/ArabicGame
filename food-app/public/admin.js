/* لوحة تحكم المدير */
'use strict';

const api = makeApi('admin');
const root = $('#root');
let me = null;
let main = null;
let restaurantsCache = [];
let seenPending = null;
let currentPage = '';
const orderFilter = { status: '', q: '', restaurantId: '' };

const NAV = [
  ['dashboard', '#/', '📊', 'لوحة التحكم'],
  ['orders', '#/orders', '🧾', 'الطلبات'],
  ['restaurants', '#/restaurants', '🏪', 'المطاعم والقوائم'],
  ['categories', '#/categories', '🗂️', 'التصنيفات'],
  ['coupons', '#/coupons', '🎟️', 'كوبونات الخصم'],
  ['users', '#/users', '👥', 'المستخدمون'],
  ['settings', '#/settings', '⚙️', 'الإعدادات'],
];

// ------------------------------------------------------------ تسجيل الدخول
function loginScreen() {
  root.innerHTML = `
    <div class="login-wrap"><div class="card" style="width:100%;max-width:400px">
      <h1 class="center">🛠️ لوحة التحكم</h1>
      <p class="center muted">سجّل الدخول بحساب المدير</p>
      <form id="f">
        <label><span>البريد الإلكتروني</span><input name="email" type="email" required></label>
        <label><span>كلمة المرور</span><input name="password" type="password" required></label>
        <button class="btn block">دخول</button>
      </form>
      <p class="center small"><a href="/" class="muted">← العودة لتطبيق الزبائن</a></p>
    </div></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { token, user } = await api('/api/auth/login', { method: 'POST', body: formData(e.target) });
      if (user.role !== 'admin') return toast('هذا الحساب ليس حساب مدير', 'bad');
      Store.set('admin_token', token);
      me = user;
      shell();
    } catch (err) { toast(err.message, 'bad'); }
  });
}

function shell() {
  root.innerHTML = `
    <div class="admin">
      <aside class="side" id="side">
        <a href="#/" class="logo">🍔 ${esc(SETTINGS.appName)}</a>
        ${NAV.map(([k, h, i, l]) => `<a href="${h}" data-nav="${k}">${i} ${l}${k === 'orders' ? '<span class="count hidden" id="pending-count"></span>' : ''}</a>`).join('')}
        <hr style="border-color:#333">
        <a href="/" target="_blank">📱 تطبيق الزبائن</a>
        <a href="javascript:void 0" id="logout">🚪 تسجيل الخروج</a>
        <div class="small muted" style="padding:10px 12px">${esc(me.name)}<br>${esc(me.email)}</div>
      </aside>
      <div class="admin-main" id="main"></div>
    </div>`;
  main = $('#main');
  $('#logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
    Store.del('admin_token');
    location.reload();
  });
  $('#side').addEventListener('click', (e) => { if (e.target.closest('a')) $('#side').classList.remove('open'); });
  router();
  checkNewOrders();
  setInterval(checkNewOrders, 10000);
}

function head(title, actions = '') {
  return `<div class="admin-head"><div class="row"><button class="btn ghost sm menu-btn" onclick="$('#side').classList.toggle('open')">☰</button><h1>${title}</h1></div><div class="row">${actions}</div></div>`;
}
function setNav(k) {
  currentPage = k;
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === k));
}
function loading() { main.innerHTML = '<div class="loader">جاري التحميل...</div>'; }
function showError(e) {
  if (e.status === 401 || e.status === 403) { Store.del('admin_token'); return loginScreen(); }
  main.innerHTML = `<div class="empty"><span class="big">😕</span>${esc(e.message)}</div>`;
}

/** متابعة الطلبات الجديدة وتنبيه المدير بصوت */
async function checkNewOrders() {
  try {
    const pending = await api('/api/admin/orders?status=pending');
    const badge = $('#pending-count');
    if (badge) { badge.textContent = pending.length; badge.classList.toggle('hidden', !pending.length); }
    document.title = (pending.length ? `(${pending.length}) ` : '') + 'لوحة التحكم';
    const ids = new Set(pending.map((o) => o.id));
    if (seenPending) {
      const fresh = pending.filter((o) => !seenPending.has(o.id));
      if (fresh.length) {
        beep();
        toast(`🔔 طلب جديد #${fresh[0].number} من ${fresh[0].userName}`, 'info');
        if (currentPage === 'orders' && !$('.modal-back')) pageOrders(true);
        if (currentPage === 'dashboard' && !$('.modal-back')) pageDashboard();
      }
    }
    seenPending = ids;
  } catch { /* تجاهل أخطاء الشبكة المؤقتة */ }
}

// ------------------------------------------------------------ لوحة التحكم
async function pageDashboard() {
  setNav('dashboard');
  loading();
  let s;
  try { s = await api('/api/admin/stats'); } catch (e) { return showError(e); }
  const maxRev = Math.max(1, ...s.days.map((d) => d.revenue));
  const stat = (ic, label, val) => `<div class="card stat"><div class="ic">${ic}</div><div><span class="muted small">${label}</span><b>${val}</b></div></div>`;
  main.innerHTML = `
    ${head('📊 لوحة التحكم', '<a href="#/orders" class="btn">إدارة الطلبات</a>')}
    <div class="stats">
      ${stat('🧾', 'طلبات اليوم', s.todayOrders)}
      ${stat('💰', 'مبيعات اليوم', money(s.todayRevenue))}
      ${stat('⏳', 'بانتظار التأكيد', s.byStatus.pending)}
      ${stat('📦', 'إجمالي الطلبات', s.orders)}
      ${stat('💵', 'إيرادات (طلبات موصلة)', money(s.revenue))}
      ${stat('🛒', 'متوسط قيمة الطلب', money(s.avgOrder))}
      ${stat('🏪', 'المطاعم (المفتوحة)', `${s.restaurants} (${s.openRestaurants})`)}
      ${stat('👥', 'الزبائن', s.customers)}
    </div>
    <div class="dash-grid">
      <div class="card"><h3>المبيعات آخر 7 أيام</h3>
        <div class="bars">${s.days.map((d) => `<div class="bar" title="${d.orders} طلب"><span>${d.revenue}</span>
          <i style="height:${(d.revenue / maxRev) * 130}px"></i><span>${new Date(d.date).toLocaleDateString('ar-EG', { weekday: 'short' })}</span></div>`).join('')}</div></div>
      <div class="card"><h3>حالة الطلبات</h3>
        ${Object.entries(s.byStatus).map(([k, v]) => `<div class="list-row">${statusBadge(k)}<b>${v}</b></div>`).join('')}</div>
    </div>
    <div class="dash-grid">
      <div class="card"><h3>أحدث الطلبات</h3>
        ${s.recent.length ? `<div class="table-wrap"><table><tr><th>#</th><th>الزبون</th><th>المطعم</th><th>الإجمالي</th><th>الحالة</th><th>الوقت</th></tr>
        ${s.recent.map((o) => `<tr><td>${o.number}</td><td>${esc(o.userName)}</td><td>${esc(o.restaurantName)}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td class="small muted">${fmtDate(o.createdAt)}</td></tr>`).join('')}</table></div>` : '<p class="muted">لا توجد طلبات بعد</p>'}</div>
      <div>
        <div class="card" style="margin-bottom:16px"><h3>🏆 أكثر المطاعم طلباً</h3>
          ${s.topRestaurants.map((x) => `<div class="list-row"><span>${esc(x.name)}</span><b>${x.count}</b></div>`).join('') || '<p class="muted">—</p>'}</div>
        <div class="card"><h3>🔥 أكثر الأصناف مبيعاً</h3>
          ${s.topItems.map((x) => `<div class="list-row"><span>${esc(x.name)}</span><b>${x.count}</b></div>`).join('') || '<p class="muted">—</p>'}</div>
      </div>
    </div>`;
}

// ------------------------------------------------------------ الطلبات
async function pageOrders(silent = false) {
  setNav('orders');
  if (!silent) loading();
  let list;
  try {
    const qs = new URLSearchParams(Object.entries(orderFilter).filter(([, v]) => v)).toString();
    [list, restaurantsCache] = await Promise.all([api(`/api/admin/orders?${qs}`), api('/api/admin/restaurants')]);
  } catch (e) { return showError(e); }

  const next = { pending: 'accepted', accepted: 'preparing', preparing: 'on_the_way', on_the_way: 'delivered' };
  const nextLabel = { pending: '✅ قبول الطلب', accepted: '👨‍🍳 بدء التحضير', preparing: '🛵 خرج للتوصيل', on_the_way: '🎉 تم التوصيل' };

  main.innerHTML = `
    ${head('🧾 الطلبات', '<button class="btn ghost sm" id="refresh">🔄 تحديث</button>')}
    <div class="tabs">
      <button class="chip ${orderFilter.status ? '' : 'active'}" data-st="">الكل</button>
      ${Object.keys(STATUS).map((k) => `<button class="chip ${orderFilter.status === k ? 'active' : ''}" data-st="${k}">${STATUS[k].icon} ${STATUS[k].label}</button>`).join('')}
    </div>
    <div class="row" style="margin-bottom:14px">
      <input id="oq" class="grow" placeholder="بحث برقم الطلب أو اسم الزبون أو الهاتف" value="${esc(orderFilter.q)}" style="max-width:360px">
      <select id="ors" style="max-width:220px"><option value="">كل المطاعم</option>
        ${restaurantsCache.map((r) => `<option value="${r.id}" ${orderFilter.restaurantId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    </div>
    ${list.length ? `<div class="admin-orders">${list.map((o) => `
      <div class="card a-order ${o.status === 'pending' ? 'new' : ''}">
        <div class="row between"><h3 style="margin:0">#${o.number}</h3>${statusBadge(o.status)}</div>
        <div class="muted small">${fmtDate(o.createdAt)}</div>
        <div style="margin-top:6px"><b>🏪 ${esc(o.restaurantName)}</b></div>
        <div>👤 ${esc(o.userName)} · <a href="tel:${esc(o.phone)}" style="color:var(--info)">${esc(o.phone)}</a></div>
        <div class="small">📍 ${esc(o.address)}</div>
        <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}${i.extras.length ? ` <span class="muted">(+ ${i.extras.map((e) => esc(e.name)).join('، ')})</span>` : ''}${i.note ? ` <span class="muted">📝 ${esc(i.note)}</span>` : ''}</li>`).join('')}</ul>
        ${o.notes ? `<div class="small" style="background:#fffbe6;padding:6px 10px;border-radius:8px">📝 ${esc(o.notes)}</div>` : ''}
        <div class="row between" style="margin:8px 0">
          <span>${o.paymentMethod === 'card' ? '💳 بطاقة' : '💵 نقداً'} ${o.couponCode ? `<span class="badge primary">${esc(o.couponCode)}</span>` : ''}</span>
          <b class="price">${money(o.total)}</b></div>
        ${o.status === 'cancelled' ? `<div class="small muted">سبب الإلغاء: ${esc(o.cancelReason)}</div>` : ''}
        ${o.review ? `<div class="small"><span class="rating">${stars(o.review.rating)}</span> ${esc(o.review.comment)}</div>` : ''}
        <div class="row">
          ${next[o.status] ? `<button class="btn sm grow" data-set="${o.id}" data-to="${next[o.status]}">${nextLabel[o.status]}</button>` : ''}
          ${!['cancelled', 'delivered'].includes(o.status) ? `<button class="btn danger sm" data-cancel="${o.id}">إلغاء</button>` : ''}
          <button class="btn ghost sm" data-print="${o.id}">🖨</button>
        </div>
      </div>`).join('')}</div>` : '<div class="empty"><span class="big">📭</span>لا توجد طلبات</div>'}`;

  $('#refresh').addEventListener('click', () => pageOrders());
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]');
    if (b) { orderFilter.status = b.dataset.st; pageOrders(); }
  });
  let t;
  $('#oq').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { orderFilter.q = e.target.value; pageOrders(true).then(() => { const i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 400);
  });
  $('#ors').addEventListener('change', (e) => { orderFilter.restaurantId = e.target.value; pageOrders(); });

  main.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => setStatus(b.dataset.set, b.dataset.to)));
  main.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
    const m = openModal(`<h3>إلغاء الطلب</h3><form id="cf">
      <label><span>سبب الإلغاء</span><select name="reason">
        <option>المطعم مشغول حالياً</option><option>أحد الأصناف غير متوفر</option><option>العنوان خارج منطقة التوصيل</option>
        <option>تعذر التواصل مع الزبون</option><option>طلب الزبون الإلغاء</option></select></label>
      <button class="btn danger block">تأكيد الإلغاء</button></form>`);
    $('#cf', m).addEventListener('submit', (e) => { e.preventDefault(); closeModal(); setStatus(b.dataset.cancel, 'cancelled', formData(e.target).reason); });
  }));
  main.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => printOrder(list.find((o) => o.id === b.dataset.print))));
}

async function setStatus(id, status, reason) {
  try {
    await api(`/api/admin/orders/${id}/status`, { method: 'PUT', body: { status, reason } });
    toast(`تم تحديث الحالة: ${STATUS[status].label}`);
    pageOrders(true);
    checkNewOrders();
  } catch (e) { toast(e.message, 'bad'); }
}

function printOrder(o) {
  const w = window.open('', '_blank', 'width=380,height=600');
  if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 'bad');
  w.document.write(`<html dir="rtl"><head><title>طلب #${o.number}</title><style>body{font-family:Tahoma;font-size:13px;padding:10px}td{padding:3px 0}hr{border:0;border-top:1px dashed #000}</style></head><body>
    <h2 style="text-align:center;margin:0">${esc(SETTINGS.appName)}</h2><p style="text-align:center">${esc(o.restaurantName)}<br>طلب #${o.number}<br>${fmtDate(o.createdAt)}</p><hr>
    <table width="100%">${o.items.map((i) => `<tr><td>${i.qty} × ${esc(i.name)}${i.extras.length ? '<br><small>+ ' + i.extras.map((e) => esc(e.name)).join('، ') + '</small>' : ''}${i.note ? '<br><small>' + esc(i.note) + '</small>' : ''}</td><td align="left">${money(i.lineTotal)}</td></tr>`).join('')}</table><hr>
    <table width="100%"><tr><td>المجموع</td><td align="left">${money(o.subtotal)}</td></tr>
    ${o.discount ? `<tr><td>الخصم</td><td align="left">-${money(o.discount)}</td></tr>` : ''}
    <tr><td>التوصيل</td><td align="left">${money(o.deliveryFee)}</td></tr>
    ${o.tax ? `<tr><td>الضريبة</td><td align="left">${money(o.tax)}</td></tr>` : ''}
    <tr><td><b>الإجمالي</b></td><td align="left"><b>${money(o.total)}</b></td></tr></table><hr>
    <p>${esc(o.userName)}<br>${esc(o.phone)}<br>${esc(o.address)}<br>${o.paymentMethod === 'card' ? 'مدفوع بالبطاقة' : 'الدفع نقداً عند الاستلام'}</p>
    ${o.notes ? `<p>ملاحظات: ${esc(o.notes)}</p>` : ''}<script>window.print()<\/script></body></html>`);
  w.document.close();
}

// ------------------------------------------------------------ رفع الصور
function imageField(name, value, icon = '🍽️') {
  return `<div class="img-field" data-img="${name}">
    ${pic(value, icon)}
    <div class="grow">
      <input type="hidden" name="${name}" value="${esc(value)}">
      <div class="row">
        <label class="btn light sm" style="margin:0">📷 رفع صورة<input type="file" accept="image/*" hidden></label>
        <button type="button" class="btn ghost sm" data-clear>إزالة</button>
      </div>
      <input type="url" placeholder="أو الصق رابط صورة" data-url style="margin-top:6px" value="${value && value.startsWith('http') ? esc(value) : ''}">
    </div></div>`;
}

function bindImageFields(scope) {
  $$('[data-img]', scope).forEach((box) => {
    const hidden = $('input[type=hidden]', box);
    const setVal = (v) => {
      hidden.value = v;
      const old = $('.pic', box);
      old.outerHTML = pic(v, $('.pic span', box).textContent);
    };
    $('input[type=file]', box).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        toast('جاري رفع الصورة...', 'info');
        const dataUrl = await fileToDataUrl(file);
        const { url } = await api('/api/admin/upload', { method: 'POST', body: { dataUrl } });
        setVal(url);
        toast('تم رفع الصورة');
      } catch (err) { toast(err.message, 'bad'); }
    });
    $('[data-url]', box).addEventListener('change', (e) => setVal(e.target.value.trim()));
    $('[data-clear]', box).addEventListener('click', () => { setVal(''); $('[data-url]', box).value = ''; });
  });
}

// ------------------------------------------------------------ المطاعم
async function pageRestaurants() {
  setNav('restaurants');
  loading();
  let cats;
  try { [restaurantsCache, cats] = await Promise.all([api('/api/admin/restaurants'), api('/api/admin/categories')]); } catch (e) { return showError(e); }
  main.innerHTML = `
    ${head('🏪 المطاعم', '<button class="btn" id="add">+ إضافة مطعم</button>')}
    ${restaurantsCache.length ? `<div class="card table-wrap" style="padding:0"><table>
      <tr><th></th><th>المطعم</th><th>التصنيف</th><th>الأصناف</th><th>الطلبات</th><th>التقييم</th><th>مفتوح</th><th>ظاهر</th><th></th></tr>
      ${restaurantsCache.map((r) => `<tr>
        <td>${pic(r.image, r.categoryIcon)}</td>
        <td><b>${esc(r.name)}</b><div class="small muted">توصيل ${money(r.deliveryFee)} · حد أدنى ${money(r.minOrder)} · ${esc(r.deliveryTime)} د</div>
          ${r.openNow ? '<span class="badge ok">يستقبل طلبات الآن</span>' : '<span class="badge bad">لا يستقبل طلبات</span>'}</td>
        <td>${esc(r.categoryName) || '—'}</td>
        <td>${r.itemsCount}</td>
        <td>${r.ordersCount}</td>
        <td>${r.ratingCount ? `<span class="rating">★ ${r.rating.toFixed(1)}</span> (${r.ratingCount})` : '—'}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="isOpen" data-id="${r.id}" ${r.isOpen ? 'checked' : ''}><i></i></label></td>
        <td><label class="switch"><input type="checkbox" data-toggle="active" data-id="${r.id}" ${r.active ? 'checked' : ''}><i></i></label></td>
        <td style="white-space:nowrap">
          <a href="#/restaurants/${r.id}" class="btn light sm">📋 القائمة</a>
          <button class="btn ghost sm" data-edit="${r.id}">✏️</button>
          <button class="btn ghost sm" data-del="${r.id}">🗑</button></td>
      </tr>`).join('')}</table></div>` : '<div class="empty"><span class="big">🏪</span>لا توجد مطاعم. ابدأ بإضافة أول مطعم!</div>'}`;

  $('#add').addEventListener('click', () => restaurantForm(null, cats));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => restaurantForm(restaurantsCache.find((r) => r.id === b.dataset.edit), cats)));
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const r = restaurantsCache.find((x) => x.id === b.dataset.del);
    if (!(await confirmBox(`حذف مطعم "${r.name}" وكل أصناف قائمته؟ لا يمكن التراجع.`, { ok: 'حذف', danger: true }))) return;
    try { await api(`/api/admin/restaurants/${r.id}`, { method: 'DELETE' }); toast('تم حذف المطعم'); pageRestaurants(); } catch (e) { toast(e.message, 'bad'); }
  }));
  main.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', async () => {
    try {
      await api(`/api/admin/restaurants/${c.dataset.id}`, { method: 'PUT', body: { [c.dataset.toggle]: c.checked } });
      toast('تم التحديث');
      pageRestaurants();
    } catch (e) { toast(e.message, 'bad'); c.checked = !c.checked; }
  }));
}

function restaurantForm(r, cats) {
  const v = r || { isOpen: true, active: true, deliveryFee: 1, minOrder: 0, deliveryTime: '30-45', openTime: '10:00', closeTime: '23:00' };
  const m = openModal(`
    <h2>${r ? 'تعديل مطعم' : 'إضافة مطعم جديد'}</h2>
    <form id="rf">
      ${imageField('image', v.image || '', '🏪')}
      <label><span>اسم المطعم *</span><input name="name" required value="${esc(v.name)}"></label>
      <label><span>الوصف</span><textarea name="description">${esc(v.description)}</textarea></label>
      <div class="grid2">
        <label><span>التصنيف</span><select name="categoryId"><option value="">بدون تصنيف</option>
          ${cats.map((c) => `<option value="${c.id}" ${v.categoryId === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></label>
        <label><span>رقم هاتف المطعم</span><input name="phone" value="${esc(v.phone)}"></label>
        <label><span>رسوم التوصيل (${esc(SETTINGS.currency)})</span><input name="deliveryFee" type="number" step="0.01" min="0" value="${v.deliveryFee}"></label>
        <label><span>الحد الأدنى للطلب (${esc(SETTINGS.currency)})</span><input name="minOrder" type="number" step="0.01" min="0" value="${v.minOrder}"></label>
        <label><span>مدة التوصيل (دقيقة)</span><input name="deliveryTime" placeholder="30-45" value="${esc(v.deliveryTime)}"></label>
        <label><span>العنوان</span><input name="address" value="${esc(v.address)}"></label>
        <label><span>يفتح الساعة</span><input name="openTime" type="time" value="${esc(v.openTime)}"></label>
        <label><span>يغلق الساعة</span><input name="closeTime" type="time" value="${esc(v.closeTime)}"></label>
      </div>
      <p class="small muted">اجعل وقت الفتح = وقت الإغلاق ليعمل المطعم 24 ساعة.</p>
      <label class="check"><input type="checkbox" name="isOpen" ${v.isOpen ? 'checked' : ''}> المطعم يستقبل طلبات</label>
      <label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> ظاهر للزبائن في التطبيق</label>
      <button class="btn block">${r ? 'حفظ التعديلات' : 'إضافة المطعم'}</button>
    </form>`, { wide: true });
  bindImageFields(m);
  $('#rf', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const saved = await api(r ? `/api/admin/restaurants/${r.id}` : '/api/admin/restaurants', { method: r ? 'PUT' : 'POST', body: formData(e.target) });
      closeModal();
      toast(r ? 'تم حفظ التعديلات' : 'تمت إضافة المطعم 🎉');
      if (!r) location.hash = `#/restaurants/${saved.id}`; else pageRestaurants();
    } catch (err) { toast(err.message, 'bad'); }
  });
}

// ------------------------------------------------------------ قائمة الطعام
async function pageMenu({ id }) {
  setNav('restaurants');
  loading();
  let data;
  try { data = await api(`/api/admin/restaurants/${id}/items`); } catch (e) { return showError(e); }
  const { restaurant: r, items } = data;
  const sections = [...new Set(items.map((i) => i.section))];
  main.innerHTML = `
    ${head(`📋 قائمة ${esc(r.name)}`, `<a href="#/restaurants" class="btn ghost">← المطاعم</a><button class="btn" id="add">+ إضافة صنف</button>`)}
    ${sections.map((s) => `<div class="card table-wrap" style="padding:0;margin-bottom:16px">
      <h3 style="padding:14px 16px 0">${esc(s)}</h3>
      <table><tr><th></th><th>الصنف</th><th>السعر</th><th>الإضافات</th><th>متوفر</th><th>مميز</th><th></th></tr>
      ${items.filter((i) => i.section === s).map((i) => `<tr>
        <td>${pic(i.image, r.categoryIcon)}</td>
        <td><b>${esc(i.name)}</b><div class="small muted">${esc(i.description)}</div></td>
        <td class="price">${money(i.price)}</td>
        <td class="small">${i.extras.length ? i.extras.map((e) => `${esc(e.name)} (+${e.price})`).join('<br>') : '—'}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="available" data-id="${i.id}" ${i.available ? 'checked' : ''}><i></i></label></td>
        <td><label class="switch"><input type="checkbox" data-toggle="popular" data-id="${i.id}" ${i.popular ? 'checked' : ''}><i></i></label></td>
        <td style="white-space:nowrap"><button class="btn ghost sm" data-edit="${i.id}">✏️</button><button class="btn ghost sm" data-del="${i.id}">🗑</button></td>
      </tr>`).join('')}</table></div>`).join('')}
    ${items.length ? '' : '<div class="empty"><span class="big">📋</span>القائمة فارغة. أضف أول صنف!</div>'}`;

  $('#add').addEventListener('click', () => itemForm(r, null, sections));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => itemForm(r, items.find((i) => i.id === b.dataset.edit), sections)));
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const it = items.find((i) => i.id === b.dataset.del);
    if (!(await confirmBox(`حذف "${it.name}"؟`, { ok: 'حذف', danger: true }))) return;
    try { await api(`/api/admin/items/${it.id}`, { method: 'DELETE' }); toast('تم الحذف'); pageMenu({ id }); } catch (e) { toast(e.message, 'bad'); }
  }));
  main.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', async () => {
    try { await api(`/api/admin/items/${c.dataset.id}`, { method: 'PUT', body: { [c.dataset.toggle]: c.checked } }); toast('تم التحديث'); } catch (e) { toast(e.message, 'bad'); c.checked = !c.checked; }
  }));
}

function itemForm(r, it, sections) {
  const v = it || { available: true, popular: false, extras: [], section: sections[0] || '' };
  const extraRow = (e = { name: '', price: '' }) => `<div class="row" data-extra>
    <input placeholder="اسم الإضافة (مثلاً: جبنة إضافية)" value="${esc(e.name)}" data-en class="grow">
    <input type="number" step="0.01" min="0" placeholder="السعر" value="${esc(e.price)}" data-ep style="width:100px">
    <button type="button" class="btn ghost sm" data-rm>✕</button></div>`;
  const m = openModal(`
    <h2>${it ? 'تعديل صنف' : 'إضافة صنف جديد'}</h2>
    <form id="if">
      ${imageField('image', v.image || '', r.categoryIcon)}
      <label><span>اسم الصنف *</span><input name="name" required value="${esc(v.name)}"></label>
      <label><span>الوصف / المكونات</span><textarea name="description">${esc(v.description)}</textarea></label>
      <div class="grid2">
        <label><span>السعر (${esc(SETTINGS.currency)}) *</span><input name="price" type="number" step="0.01" min="0" required value="${v.price ?? ''}"></label>
        <label><span>القسم في القائمة</span><input name="section" list="secs" placeholder="مثلاً: الوجبات، المشروبات" value="${esc(v.section)}">
          <datalist id="secs">${sections.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
      </div>
      <h4>الإضافات والخيارات</h4>
      <div class="extras-editor" id="extras">${v.extras.map(extraRow).join('')}</div>
      <button type="button" class="btn light sm" id="add-extra" style="margin-bottom:14px">+ إضافة خيار</button>
      <label class="check"><input type="checkbox" name="available" ${v.available ? 'checked' : ''}> متوفر للطلب</label>
      <label class="check"><input type="checkbox" name="popular" ${v.popular ? 'checked' : ''}> 🔥 صنف مميز (يظهر في الأعلى)</label>
      <button class="btn block">${it ? 'حفظ التعديلات' : 'إضافة الصنف'}</button>
    </form>`, { wide: true });
  bindImageFields(m);
  $('#add-extra', m).addEventListener('click', () => $('#extras', m).insertAdjacentHTML('beforeend', extraRow()));
  $('#extras', m).addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) e.target.closest('[data-extra]').remove(); });
  $('#if', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = formData(e.target);
    body.extras = $$('[data-extra]', m).map((row) => ({ name: $('[data-en]', row).value.trim(), price: Number($('[data-ep]', row).value) || 0 })).filter((x) => x.name);
    try {
      await api(it ? `/api/admin/items/${it.id}` : `/api/admin/restaurants/${r.id}/items`, { method: it ? 'PUT' : 'POST', body });
      closeModal();
      toast(it ? 'تم حفظ التعديلات' : 'تمت إضافة الصنف');
      pageMenu({ id: r.id });
    } catch (err) { toast(err.message, 'bad'); }
  });
}

// ------------------------------------------------------------ التصنيفات
async function pageCategories() {
  setNav('categories');
  loading();
  let cats;
  try { cats = await api('/api/admin/categories'); } catch (e) { return showError(e); }
  main.innerHTML = `
    ${head('🗂️ تصنيفات المطاعم', '<button class="btn" id="add">+ إضافة تصنيف</button>')}
    <div class="card table-wrap" style="padding:0"><table>
      <tr><th>الأيقونة</th><th>الاسم</th><th>الترتيب</th><th>عدد المطاعم</th><th></th></tr>
      ${cats.map((c) => `<tr><td style="font-size:26px">${esc(c.icon)}</td><td><b>${esc(c.name)}</b></td><td>${c.order}</td><td>${c.restaurantsCount}</td>
        <td><button class="btn ghost sm" data-edit="${c.id}">✏️</button><button class="btn ghost sm" data-del="${c.id}">🗑</button></td></tr>`).join('')}
    </table></div>`;
  const form = (c) => {
    const m = openModal(`<h2>${c ? 'تعديل تصنيف' : 'تصنيف جديد'}</h2><form id="cf">
      <label><span>الاسم</span><input name="name" required value="${esc(c ? c.name : '')}"></label>
      <div class="grid2"><label><span>أيقونة (إيموجي)</span><input name="icon" value="${esc(c ? c.icon : '🍽️')}"></label>
      <label><span>الترتيب</span><input name="order" type="number" value="${c ? c.order : cats.length}"></label></div>
      <button class="btn block">حفظ</button></form>`);
    $('#cf', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api(c ? `/api/admin/categories/${c.id}` : '/api/admin/categories', { method: c ? 'PUT' : 'POST', body: formData(e.target) }); closeModal(); toast('تم الحفظ'); pageCategories(); } catch (err) { toast(err.message, 'bad'); }
    });
  };
  $('#add').addEventListener('click', () => form(null));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => form(cats.find((c) => c.id === b.dataset.edit))));
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('حذف هذا التصنيف؟ ستبقى المطاعم بدون تصنيف.', { ok: 'حذف', danger: true }))) return;
    try { await api(`/api/admin/categories/${b.dataset.del}`, { method: 'DELETE' }); toast('تم الحذف'); pageCategories(); } catch (e) { toast(e.message, 'bad'); }
  }));
}

// ------------------------------------------------------------ الكوبونات
const COUPON_TYPES = { percent: 'نسبة مئوية %', fixed: 'مبلغ ثابت', free_delivery: 'توصيل مجاني' };

async function pageCoupons() {
  setNav('coupons');
  loading();
  let list;
  try { [list, restaurantsCache] = await Promise.all([api('/api/admin/coupons'), api('/api/admin/restaurants')]); } catch (e) { return showError(e); }
  const restName = (id) => (restaurantsCache.find((r) => r.id === id) || {}).name || 'كل المطاعم';
  const valueText = (c) => (c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` (حتى ${money(c.maxDiscount)})` : ''}` : c.type === 'fixed' ? money(c.value) : '🛵');
  main.innerHTML = `
    ${head('🎟️ كوبونات الخصم', '<button class="btn" id="add">+ كوبون جديد</button>')}
    ${list.length ? `<div class="card table-wrap" style="padding:0"><table>
      <tr><th>الكود</th><th>النوع</th><th>القيمة</th><th>الحد الأدنى</th><th>الاستخدام</th><th>ينتهي</th><th>المطعم</th><th>فعّال</th><th></th></tr>
      ${list.map((c) => `<tr>
        <td><b style="font-family:monospace;font-size:15px">${esc(c.code)}</b></td>
        <td>${COUPON_TYPES[c.type]}</td><td>${valueText(c)}</td><td>${money(c.minOrder)}</td>
        <td>${c.used}${c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
        <td>${c.expiresAt || '—'}</td><td>${esc(restName(c.restaurantId))}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="${c.id}" ${c.active ? 'checked' : ''}><i></i></label></td>
        <td><button class="btn ghost sm" data-edit="${c.id}">✏️</button><button class="btn ghost sm" data-del="${c.id}">🗑</button></td>
      </tr>`).join('')}</table></div>` : '<div class="empty"><span class="big">🎟️</span>لا توجد كوبونات</div>'}`;

  const form = (c) => {
    const v = c || { type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, active: true, expiresAt: '', restaurantId: '' };
    const m = openModal(`<h2>${c ? 'تعديل كوبون' : 'كوبون جديد'}</h2><form id="cf">
      <div class="grid2">
        <label><span>الكود</span><input name="code" required value="${esc(v.code)}" style="text-transform:uppercase"></label>
        <label><span>النوع</span><select name="type">${Object.entries(COUPON_TYPES).map(([k, l]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label><span>قيمة الخصم</span><input name="value" type="number" step="0.01" min="0" value="${v.value}"></label>
        <label><span>أقصى خصم (0 = بلا حد)</span><input name="maxDiscount" type="number" step="0.01" min="0" value="${v.maxDiscount}"></label>
        <label><span>الحد الأدنى للطلب</span><input name="minOrder" type="number" step="0.01" min="0" value="${v.minOrder}"></label>
        <label><span>عدد مرات الاستخدام (0 = غير محدود)</span><input name="usageLimit" type="number" min="0" value="${v.usageLimit}"></label>
        <label><span>تاريخ الانتهاء</span><input name="expiresAt" type="date" value="${esc(v.expiresAt)}"></label>
        <label><span>خاص بمطعم</span><select name="restaurantId"><option value="">كل المطاعم</option>
          ${restaurantsCache.map((r) => `<option value="${r.id}" ${v.restaurantId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      </div>
      <label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> فعّال</label>
      <button class="btn block">حفظ</button></form>`, { wide: true });
    $('#cf', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api(c ? `/api/admin/coupons/${c.id}` : '/api/admin/coupons', { method: c ? 'PUT' : 'POST', body: formData(e.target) }); closeModal(); toast('تم الحفظ'); pageCoupons(); } catch (err) { toast(err.message, 'bad'); }
    });
  };
  $('#add').addEventListener('click', () => form(null));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => form(list.find((c) => c.id === b.dataset.edit))));
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('حذف هذا الكوبون؟', { ok: 'حذف', danger: true }))) return;
    try { await api(`/api/admin/coupons/${b.dataset.del}`, { method: 'DELETE' }); toast('تم الحذف'); pageCoupons(); } catch (e) { toast(e.message, 'bad'); }
  }));
  main.querySelectorAll('[data-toggle]').forEach((ch) => ch.addEventListener('change', async () => {
    try { await api(`/api/admin/coupons/${ch.dataset.toggle}`, { method: 'PUT', body: { active: ch.checked } }); toast('تم التحديث'); } catch (e) { toast(e.message, 'bad'); ch.checked = !ch.checked; }
  }));
}

// ------------------------------------------------------------ المستخدمون
async function pageUsers() {
  setNav('users');
  loading();
  let list;
  try { list = await api('/api/admin/users'); } catch (e) { return showError(e); }
  main.innerHTML = `
    ${head('👥 المستخدمون', `<input id="uq" placeholder="بحث..." style="width:220px">`)}
    <div class="card table-wrap" style="padding:0"><table id="ut">
      <tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الطلبات</th><th>المشتريات</th><th>تاريخ التسجيل</th><th>الدور</th><th>الحالة</th></tr>
      ${list.map((u) => `<tr data-s="${esc((u.name + ' ' + u.email + ' ' + u.phone).toLowerCase())}">
        <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td>
        <td>${u.ordersCount}</td><td>${money(u.spent)}</td><td class="small">${new Date(u.createdAt).toLocaleDateString('ar-EG')}</td>
        <td>${u.id === me.id ? '<span class="badge primary">أنت (مدير)</span>' : `<select data-role="${u.id}" style="width:auto;padding:4px 8px">
          <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>زبون</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>مدير</option></select>`}</td>
        <td>${u.id === me.id ? '' : `<button class="btn sm ${u.blocked ? 'ok' : 'danger'}" data-block="${u.id}" data-v="${!u.blocked}">${u.blocked ? 'إلغاء الحظر' : 'حظر'}</button>`}</td>
      </tr>`).join('')}</table></div>`;
  $('#uq').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#ut tr[data-s]').forEach((tr) => { tr.style.display = tr.dataset.s.includes(q) ? '' : 'none'; });
  });
  const update = async (id, body) => {
    try { await api(`/api/admin/users/${id}`, { method: 'PUT', body }); toast('تم التحديث'); pageUsers(); } catch (e) { toast(e.message, 'bad'); }
  };
  main.querySelectorAll('[data-role]').forEach((s) => s.addEventListener('change', () => update(s.dataset.role, { role: s.value })));
  main.querySelectorAll('[data-block]').forEach((b) => b.addEventListener('click', () => update(b.dataset.block, { blocked: b.dataset.v === 'true' })));
}

// ------------------------------------------------------------ الإعدادات
function pageSettings() {
  setNav('settings');
  main.innerHTML = `
    ${head('⚙️ الإعدادات')}
    <div class="dash-grid">
      <form class="card" id="sf">
        <h3>إعدادات التطبيق</h3>
        <label><span>اسم التطبيق</span><input name="appName" required value="${esc(SETTINGS.appName)}"></label>
        <div class="grid2">
          <label><span>العملة</span><input name="currency" required value="${esc(SETTINGS.currency)}" placeholder="د.أ / ر.س / ج.م / $"></label>
          <label><span>نسبة الضريبة %</span><input name="taxPercent" type="number" step="0.01" min="0" max="100" value="${SETTINGS.taxPercent}"></label>
        </div>
        <label><span>رقم خدمة العملاء</span><input name="supportPhone" value="${esc(SETTINGS.supportPhone || '')}"></label>
        <button class="btn">حفظ الإعدادات</button>
      </form>
      <form class="card" id="pw">
        <h3>🔒 تغيير كلمة مرور المدير</h3>
        <label><span>كلمة المرور الحالية</span><input type="password" name="current" required></label>
        <label><span>كلمة المرور الجديدة</span><input type="password" name="next" minlength="6" required></label>
        <button class="btn">تغيير</button>
      </form>
    </div>`;
  $('#sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { SETTINGS = await api('/api/admin/settings', { method: 'PUT', body: formData(e.target) }); toast('تم حفظ الإعدادات'); } catch (err) { toast(err.message, 'bad'); }
  });
  $('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/me/password', { method: 'PUT', body: formData(e.target) }); e.target.reset(); toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message, 'bad'); }
  });
}

// ------------------------------------------------------------ التشغيل
const routeTable = createRouter([
  ['/', pageDashboard],
  ['/orders', () => pageOrders()],
  ['/restaurants', pageRestaurants],
  ['/restaurants/:id', pageMenu],
  ['/categories', pageCategories],
  ['/coupons', pageCoupons],
  ['/users', pageUsers],
  ['/settings', pageSettings],
], () => { location.hash = '#/'; });

function router() {
  if (!main) return;
  closeModal();
  routeTable();
}
window.addEventListener('hashchange', router);

(async function init() {
  try { SETTINGS = await api('/api/settings'); } catch { /* افتراضي */ }
  if (!authToken('admin')) return loginScreen();
  try {
    me = await api('/api/me');
    if (me.role !== 'admin') throw new Error();
    shell();
  } catch {
    Store.del('admin_token');
    loginScreen();
  }
})();
