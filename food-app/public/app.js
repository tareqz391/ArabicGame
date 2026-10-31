/* واجهة الزبون */
'use strict';

const api = makeApi('user');
const view = $('#view');
let me = null;
let pollTimer = null;
let categories = [];
const homeState = { q: '', cat: '', sort: 'recommended' };

// ------------------------------------------------------------ السلة
const Cart = {
  get() { return Store.get('cart', null); },
  save(c) {
    if (!c || !c.items.length) Store.del('cart'); else Store.set('cart', c);
    updateCartUi();
  },
  count() { const c = this.get(); return c ? c.items.reduce((s, i) => s + i.qty, 0) : 0; },
  subtotal() { const c = this.get(); return c ? c.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) : 0; },
  async add(restaurant, line) {
    let c = this.get();
    if (c && c.restaurant.id !== restaurant.id) {
      const ok = await confirmBox(`سلتك تحتوي أصنافاً من "${c.restaurant.name}". هل تريد إفراغها والطلب من "${restaurant.name}"؟`, { ok: 'إفراغ السلة' });
      if (!ok) return false;
      c = null;
    }
    if (!c) c = { restaurant: { id: restaurant.id, name: restaurant.name, deliveryFee: restaurant.deliveryFee, minOrder: restaurant.minOrder }, items: [], couponCode: '' };
    const key = line.itemId + '|' + line.extras.map((e) => e.name).sort().join(',') + '|' + line.note;
    const existing = c.items.find((i) => i.key === key);
    if (existing) existing.qty += line.qty; else c.items.push({ ...line, key });
    this.save(c);
    return true;
  },
};

function updateCartUi() {
  const n = Cart.count();
  $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.classList.toggle('hidden', !n); });
  const hash = location.hash || '#/';
  const showBar = n && !/^#\/(cart|checkout)/.test(hash);
  $('#cart-bar-slot').innerHTML = showBar
    ? `<a href="#/cart" class="btn block cart-bar">🛒 عرض السلة (${n}) · ${money(Cart.subtotal())}</a>` : '';
}

function setNav(name) {
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  updateCartUi();
}

function loading() { view.innerHTML = '<div class="loader">جاري التحميل...</div>'; }
function errorView(err) {
  view.innerHTML = `<div class="empty"><span class="big">😕</span><p>${esc(err.message)}</p><button class="btn" onclick="router()">إعادة المحاولة</button></div>`;
}
function requireLogin(target = location.hash) {
  if (me) return true;
  Store.set('after_login', target);
  location.hash = '#/login';
  return false;
}

// ------------------------------------------------------------ الرئيسية
function restaurantCard(r) {
  const fav = me && me.favorites.includes(r.id);
  return `
  <a href="#/r/${r.id}" class="r-card ${r.openNow ? '' : 'closed'}">
    ${pic(r.image, r.categoryIcon)}
    <span class="state">${r.openNow ? '<span class="badge ok">مفتوح</span>' : '<span class="badge bad">مغلق</span>'}</span>
    <button class="fav-btn" data-fav="${r.id}" title="المفضلة">${fav ? '❤️' : '🤍'}</button>
    <div class="body">
      <div class="row between"><h3>${esc(r.name)}</h3>
        ${r.ratingCount ? `<span class="rating">★ ${r.rating.toFixed(1)} <span class="muted small">(${r.ratingCount})</span></span>` : '<span class="badge primary">جديد</span>'}</div>
      <div class="muted small">${esc(r.categoryName)}${r.description ? ' · ' + esc(r.description).slice(0, 50) : ''}</div>
      <div class="r-meta" style="margin-top:6px">
        <span>⏱ ${esc(r.deliveryTime)} د</span>
        <span>🛵 ${r.deliveryFee ? money(r.deliveryFee) : 'توصيل مجاني'}</span>
        <span>الحد الأدنى ${money(r.minOrder)}</span>
      </div>
    </div>
  </a>`;
}

async function toggleFav(id, btn) {
  if (!requireLogin()) return;
  try {
    const { favorites } = await api(`/api/favorites/${id}`, { method: 'POST' });
    me.favorites = favorites;
    const on = favorites.includes(id);
    if (btn) btn.textContent = on ? '❤️' : '🤍';
    toast(on ? 'تمت الإضافة للمفضلة' : 'تمت الإزالة من المفضلة', 'info');
  } catch (e) { toast(e.message, 'bad'); }
}

view.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.dataset.fav, fav); }
});

async function pageHome() {
  setNav('home');
  loading();
  let list;
  try {
    [list, categories] = await Promise.all([api('/api/restaurants'), api('/api/categories')]);
  } catch (e) { return errorView(e); }

  view.innerHTML = `
    <section class="hero">
      <h1>${me ? `أهلاً ${esc(me.name.split(' ')[0])} 👋` : 'جوعان؟ 😋'} شو نفسك تاكل اليوم؟</h1>
      <div class="muted" style="color:#ffe9df">اطلب من أفضل المطاعم القريبة منك وتابع طلبك لحظة بلحظة</div>
      <div class="search">
        <input id="q" placeholder="ابحث عن مطعم أو أكلة..." value="${esc(homeState.q)}">
        <select id="sort">
          <option value="recommended">الأكثر طلباً</option>
          <option value="rating">الأعلى تقييماً</option>
          <option value="fee">أقل رسوم توصيل</option>
          <option value="time">الأسرع توصيلاً</option>
        </select>
      </div>
    </section>
    <div class="chips" id="chips">
      <button class="chip ${homeState.cat ? '' : 'active'}" data-cat="">🍽️ الكل</button>
      ${categories.map((c) => `<button class="chip ${homeState.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.icon)} ${esc(c.name)}</button>`).join('')}
    </div>
    <div id="list"></div>`;
  $('#sort').value = homeState.sort;

  const render = () => {
    const q = homeState.q.trim().toLowerCase();
    let rows = list.filter((r) => (!homeState.cat || r.categoryId === homeState.cat)
      && (!q || r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || r.categoryName.includes(q)));
    const t = (r) => parseInt(r.deliveryTime, 10) || 99;
    const sorters = {
      recommended: (a, b) => b.ordersCount - a.ordersCount,
      rating: (a, b) => b.rating - a.rating,
      fee: (a, b) => a.deliveryFee - b.deliveryFee,
      time: (a, b) => t(a) - t(b),
    };
    rows = rows.sort(sorters[homeState.sort]).sort((a, b) => b.openNow - a.openNow);
    $('#list').innerHTML = rows.length
      ? `<h2>${rows.length} مطعم</h2><div class="r-grid">${rows.map(restaurantCard).join('')}</div>`
      : '<div class="empty"><span class="big">🔍</span>لا توجد مطاعم مطابقة</div>';
  };
  render();
  $('#q').addEventListener('input', (e) => { homeState.q = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { homeState.sort = e.target.value; render(); });
  $('#chips').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (!c) return;
    homeState.cat = c.dataset.cat;
    $$('.chip').forEach((x) => x.classList.toggle('active', x === c));
    render();
  });
}

// ------------------------------------------------------------ صفحة المطعم
async function pageRestaurant({ id }) {
  setNav('home');
  loading();
  let data;
  try { data = await api(`/api/restaurants/${id}`); } catch (e) { return errorView(e); }
  const { restaurant: r, items, reviews } = data;
  const sections = [...new Set(items.map((i) => i.section))];
  const popular = items.filter((i) => i.popular && i.available);
  const fav = me && me.favorites.includes(r.id);

  const itemHtml = (i) => `
    <div class="item ${i.available ? '' : 'na'}" data-item="${i.id}">
      ${pic(i.image, r.categoryIcon)}
      <div class="info">
        <h4>${esc(i.name)} ${i.popular ? '<span class="badge primary">🔥 مميز</span>' : ''}</h4>
        <p>${esc(i.description)}</p>
        <span class="price">${money(i.price)}</span> ${i.available ? '' : '<span class="badge bad">غير متوفر</span>'}
      </div>
      ${i.available ? '<button class="add-btn">+</button>' : ''}
    </div>`;

  view.innerHTML = `
    <div class="r-head">
      ${pic(r.image, r.categoryIcon)}
      <div>
        <div class="row between"><h1>${esc(r.name)}</h1>
          <button class="btn ghost sm" data-fav="${r.id}">${fav ? '❤️' : '🤍'}</button></div>
        <div class="muted">${esc(r.categoryName)} ${r.description ? '· ' + esc(r.description) : ''}</div>
        <div class="r-meta" style="margin-top:8px">
          ${r.ratingCount ? `<span class="rating">★ ${r.rating.toFixed(1)} (${r.ratingCount} تقييم)</span>` : ''}
          <span>⏱ ${esc(r.deliveryTime)} دقيقة</span>
          <span>🛵 ${r.deliveryFee ? money(r.deliveryFee) : 'توصيل مجاني'}</span>
          <span>الحد الأدنى ${money(r.minOrder)}</span>
          ${r.openTime && r.closeTime && r.openTime !== r.closeTime ? `<span>🕘 ${esc(r.openTime)} - ${esc(r.closeTime)}</span>` : '<span>🕘 24 ساعة</span>'}
          ${r.address ? `<span>📍 ${esc(r.address)}</span>` : ''}
        </div>
      </div>
    </div>
    ${r.openNow ? '' : '<div class="closed-note">🔒 المطعم مغلق حالياً، يمكنك تصفح القائمة لكن لا يمكنك الطلب الآن.</div>'}
    <div class="sections-nav"><div class="chips">
      ${popular.length ? '<a class="chip" href="javascript:void 0" data-go="sec-pop">🔥 المميز</a>' : ''}
      ${sections.map((s, i) => `<a class="chip" href="javascript:void 0" data-go="sec-${i}">${esc(s)}</a>`).join('')}
      ${reviews.length ? '<a class="chip" href="javascript:void 0" data-go="sec-reviews">⭐ التقييمات</a>' : ''}
    </div></div>
    ${popular.length ? `<div class="menu-section" id="sec-pop"><h2>🔥 الأكثر طلباً</h2><div class="items">${popular.map(itemHtml).join('')}</div></div>` : ''}
    ${sections.map((s, i) => `<div class="menu-section" id="sec-${i}"><h2>${esc(s)}</h2>
      <div class="items">${items.filter((x) => x.section === s).map(itemHtml).join('')}</div></div>`).join('')}
    ${items.length ? '' : '<div class="empty"><span class="big">📋</span>لا توجد أصناف في القائمة بعد</div>'}
    ${reviews.length ? `<div class="menu-section card" id="sec-reviews"><h2>⭐ آراء الزبائن</h2>
      ${reviews.map((rv) => `<div class="review"><div class="row between"><b>${esc(rv.userName)}</b><span class="rating">${stars(rv.rating)}</span></div>
        ${rv.comment ? `<div>${esc(rv.comment)}</div>` : ''}<div class="muted small">${fmtDate(rv.at)}</div></div>`).join('')}</div>` : ''}`;

  view.querySelector('.sections-nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (a) document.getElementById(a.dataset.go).scrollIntoView({ behavior: 'smooth' });
  });
  view.querySelectorAll('[data-item]').forEach((el) => el.addEventListener('click', () => {
    const item = items.find((i) => i.id === el.dataset.item);
    if (!item.available) return;
    if (!r.openNow) return toast('المطعم مغلق حالياً', 'bad');
    itemModal(r, item);
  }));
}

function itemModal(r, item) {
  let qty = 1;
  const m = openModal(`
    ${item.image ? pic(item.image, r.categoryIcon, 'modal-pic') : ''}
    <h2>${esc(item.name)}</h2>
    <p class="muted">${esc(item.description)}</p>
    <div class="price" style="font-size:18px">${money(item.price)}</div>
    ${item.extras.length ? `<h4 style="margin-top:14px">الإضافات (اختياري)</h4>
      ${item.extras.map((e, i) => `<div class="extra-row"><label class="check"><input type="checkbox" data-extra="${i}"> ${esc(e.name)}</label><span class="muted">+ ${money(e.price)}</span></div>`).join('')}` : ''}
    <label style="margin-top:14px"><span>ملاحظات خاصة</span><textarea id="note" maxlength="200" placeholder="مثلاً: بدون بصل"></textarea></label>
    <div class="row between">
      <div class="qty"><button data-q="1">+</button><span id="qv">1</span><button data-q="-1">−</button></div>
      <button class="btn grow" id="add">أضف للسلة · <span id="tot"></span></button>
    </div>`);
  const extras = () => $$('[data-extra]', m).filter((c) => c.checked).map((c) => item.extras[c.dataset.extra]);
  const unit = () => item.price + extras().reduce((s, e) => s + e.price, 0);
  const refresh = () => { $('#qv', m).textContent = qty; $('#tot', m).innerHTML = money(unit() * qty); };
  refresh();
  m.addEventListener('change', refresh);
  m.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { qty = Math.min(50, Math.max(1, qty + Number(q.dataset.q))); refresh(); }
  });
  $('#add', m).addEventListener('click', async () => {
    const ok = await Cart.add(r, {
      itemId: item.id, name: item.name, image: item.image, extras: extras(),
      note: $('#note', m).value.trim(), qty, unitPrice: Math.round(unit() * 100) / 100,
    });
    closeModal();
    if (ok) toast(`تمت إضافة ${item.name} للسلة 🛒`);
  });
}

// ------------------------------------------------------------ السلة
async function computeTotals(c) {
  const subtotal = Math.round(Cart.subtotal() * 100) / 100;
  let discount = 0;
  let deliveryFee = c.restaurant.deliveryFee;
  let couponError = '';
  if (c.couponCode) {
    try {
      const res = await api('/api/coupons/validate', { method: 'POST', body: { code: c.couponCode, subtotal, restaurantId: c.restaurant.id } });
      discount = res.discount;
      if (res.freeDelivery) deliveryFee = 0;
    } catch (e) { couponError = e.message; }
  }
  const tax = Math.round(((subtotal - discount) * (Number(SETTINGS.taxPercent) || 0))) / 100;
  return { subtotal, discount, deliveryFee, tax, total: subtotal - discount + deliveryFee + tax, couponError };
}

function summaryHtml(t, c) {
  return `<div class="summary">
    <div class="row between"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
    ${t.discount ? `<div class="row between" style="color:var(--ok)"><span>الخصم (${esc(c.couponCode)})</span><span>- ${money(t.discount)}</span></div>` : ''}
    <div class="row between"><span>رسوم التوصيل</span><span>${t.deliveryFee ? money(t.deliveryFee) : '<span style="color:var(--ok)">مجاناً</span>'}</span></div>
    ${t.tax ? `<div class="row between"><span>الضريبة (${esc(SETTINGS.taxPercent)}%)</span><span>${money(t.tax)}</span></div>` : ''}
    <div class="row between total"><span>الإجمالي</span><span>${money(t.total)}</span></div>
  </div>`;
}

async function pageCart() {
  setNav('cart');
  const c = Cart.get();
  if (!c) {
    view.innerHTML = '<div class="empty"><span class="big">🛒</span><h2>سلتك فارغة</h2><p>تصفح المطاعم وأضف ما تشتهيه</p><a href="#/" class="btn">تصفح المطاعم</a></div>';
    return;
  }
  loading();
  const t = await computeTotals(c);
  if (t.couponError) { toast(t.couponError, 'bad'); c.couponCode = ''; Cart.save(c); }
  const short = c.restaurant.minOrder - t.subtotal;

  view.innerHTML = `
    <h1>🛒 سلة المشتريات</h1>
    <div class="two-col">
      <div class="card">
        <div class="row between"><h3>من: <a href="#/r/${c.restaurant.id}" style="color:var(--primary)">${esc(c.restaurant.name)}</a></h3>
          <button class="btn ghost sm" id="clear">🗑 إفراغ السلة</button></div>
        ${c.items.map((i, idx) => `
          <div class="cart-line">
            <div class="grow">
              <b>${esc(i.name)}</b>
              ${i.extras.length ? `<div class="muted small">+ ${i.extras.map((e) => esc(e.name)).join('، ')}</div>` : ''}
              ${i.note ? `<div class="muted small">📝 ${esc(i.note)}</div>` : ''}
              <div class="price">${money(i.unitPrice * i.qty)}</div>
            </div>
            <div class="qty"><button data-q="1" data-i="${idx}">+</button><span>${i.qty}</span><button data-q="-1" data-i="${idx}">${i.qty === 1 ? '🗑' : '−'}</button></div>
          </div>`).join('')}
        <a href="#/r/${c.restaurant.id}" class="btn light sm" style="margin-top:12px">+ إضافة أصناف أخرى</a>
      </div>
      <div class="card">
        <h3>كود الخصم</h3>
        <div class="row" style="flex-wrap:nowrap;margin-bottom:14px">
          <input id="coupon" placeholder="أدخل الكود" value="${esc(c.couponCode)}" ${c.couponCode ? 'disabled' : ''}>
          ${c.couponCode ? '<button class="btn ghost" id="rm-coupon">إزالة</button>' : '<button class="btn light" id="apply">تطبيق</button>'}
        </div>
        ${summaryHtml(t, c)}
        ${short > 0 ? `<div class="closed-note" style="margin-top:12px">أضف ${money(short)} للوصول للحد الأدنى للطلب</div>` : ''}
        <button class="btn block" id="checkout" style="margin-top:14px" ${short > 0 ? 'disabled' : ''}>متابعة الطلب ←</button>
      </div>
    </div>`;

  view.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const cart = Cart.get();
    const line = cart.items[b.dataset.i];
    line.qty += Number(b.dataset.q);
    if (line.qty <= 0) cart.items.splice(b.dataset.i, 1);
    line.qty = Math.min(line.qty, 50);
    Cart.save(cart);
    pageCart();
  }));
  $('#clear').addEventListener('click', async () => {
    if (await confirmBox('هل تريد إفراغ السلة؟', { ok: 'إفراغ', danger: true })) { Cart.save(null); pageCart(); }
  });
  const apply = $('#apply');
  if (apply) apply.addEventListener('click', async () => {
    const code = $('#coupon').value.trim();
    if (!code) return;
    try {
      await api('/api/coupons/validate', { method: 'POST', body: { code, subtotal: t.subtotal, restaurantId: c.restaurant.id } });
      c.couponCode = code.toUpperCase();
      Cart.save(c);
      toast('تم تطبيق كود الخصم 🎉');
      pageCart();
    } catch (e) { toast(e.message, 'bad'); }
  });
  const rm = $('#rm-coupon');
  if (rm) rm.addEventListener('click', () => { c.couponCode = ''; Cart.save(c); pageCart(); });
  $('#checkout').addEventListener('click', () => { if (requireLogin('#/checkout')) location.hash = '#/checkout'; });
}

// ------------------------------------------------------------ إتمام الطلب
async function pageCheckout() {
  setNav('cart');
  if (!requireLogin()) return;
  const c = Cart.get();
  if (!c) { location.hash = '#/cart'; return; }
  loading();
  const t = await computeTotals(c);
  const addrs = me.addresses || [];

  view.innerHTML = `
    <h1>إتمام الطلب</h1>
    <form id="f" class="two-col">
      <div>
        <div class="card" style="margin-bottom:14px">
          <h3>📍 عنوان التوصيل</h3>
          ${addrs.map((a, i) => `<label class="opt"><input type="radio" name="addr" value="${i}" ${i === 0 ? 'checked' : ''}>
            <div><b>${esc(a.label)}</b><div class="muted small">${esc(a.details)}</div></div></label>`).join('')}
          <label class="opt"><input type="radio" name="addr" value="new" ${addrs.length ? '' : 'checked'}> ➕ عنوان جديد</label>
          <div id="new-addr" class="${addrs.length ? 'hidden' : ''}">
            <div class="grid2">
              <label><span>اسم العنوان</span><input name="addressLabel" placeholder="البيت، الشغل..."></label>
              <label class="check" style="margin-top:28px"><input type="checkbox" name="saveAddress" checked> حفظ العنوان لاحقاً</label>
            </div>
            <label><span>العنوان بالتفصيل</span><textarea name="address" placeholder="المدينة، الحي، الشارع، رقم البناية، الطابق..."></textarea></label>
          </div>
          <label><span>📞 رقم الهاتف</span><input name="phone" type="tel" required value="${esc(me.phone)}"></label>
          <label><span>ملاحظات للمطعم أو السائق</span><textarea name="notes" placeholder="اختياري"></textarea></label>
        </div>
        <div class="card">
          <h3>💳 طريقة الدفع</h3>
          <label class="opt"><input type="radio" name="paymentMethod" value="cash" checked> 💵 الدفع نقداً عند الاستلام</label>
          <label class="opt"><input type="radio" name="paymentMethod" value="card"> 💳 بطاقة ائتمان / خصم</label>
          <div id="card-fields" class="hidden">
            <label><span>رقم البطاقة</span><input id="cc" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19"></label>
            <div class="grid2">
              <label><span>تاريخ الانتهاء</span><input id="cc-exp" placeholder="MM/YY" maxlength="5"></label>
              <label><span>CVV</span><input id="cc-cvv" inputmode="numeric" maxlength="4" placeholder="123"></label>
            </div>
            <div class="muted small">⚠️ الدفع الإلكتروني تجريبي — اربطه ببوابة دفع حقيقية قبل الإطلاق.</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>ملخص الطلب · ${esc(c.restaurant.name)}</h3>
        ${c.items.map((i) => `<div class="row between small"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.unitPrice * i.qty)}</span></div>`).join('')}
        <hr style="border:0;border-top:1px solid var(--line)">
        ${summaryHtml(t, c)}
        <button class="btn block" style="margin-top:14px" id="place">تأكيد الطلب · ${money(t.total)}</button>
      </div>
    </form>`;

  const f = $('#f');
  f.addEventListener('change', () => {
    const d = formData(f);
    $('#new-addr').classList.toggle('hidden', d.addr !== 'new');
    $('#card-fields').classList.toggle('hidden', d.paymentMethod !== 'card');
  });
  $('#cc').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim(); });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(f);
    const address = d.addr === 'new' ? d.address.trim() : addrs[d.addr].details;
    if (!address) return toast('الرجاء إدخال العنوان', 'bad');
    if (d.paymentMethod === 'card') {
      const num = $('#cc').value.replace(/\s/g, '');
      if (!/^\d{13,19}$/.test(num) || !/^\d{2}\/\d{2}$/.test($('#cc-exp').value) || !/^\d{3,4}$/.test($('#cc-cvv').value)) {
        return toast('بيانات البطاقة غير صحيحة', 'bad');
      }
    }
    const btn = $('#place');
    btn.disabled = true;
    btn.textContent = 'جاري إرسال الطلب...';
    try {
      const order = await api('/api/orders', {
        method: 'POST',
        body: {
          restaurantId: c.restaurant.id,
          items: c.items.map((i) => ({ itemId: i.itemId, qty: i.qty, extras: i.extras.map((x) => x.name), note: i.note })),
          address, phone: d.phone, notes: d.notes, paymentMethod: d.paymentMethod, couponCode: c.couponCode,
          saveAddress: d.addr === 'new' && d.saveAddress, addressLabel: d.addressLabel,
        },
      });
      Cart.save(null);
      me = await api('/api/me');
      toast('تم إرسال طلبك بنجاح 🎉');
      location.hash = `#/order/${order.id}`;
    } catch (err) {
      toast(err.message, 'bad');
      btn.disabled = false;
      btn.textContent = 'تأكيد الطلب';
    }
  });
}

// ------------------------------------------------------------ الطلبات
async function pageOrders() {
  setNav('orders');
  if (!requireLogin()) return;
  loading();
  let list;
  try { list = await api('/api/orders'); } catch (e) { return errorView(e); }
  if (!list.length) {
    view.innerHTML = '<div class="empty"><span class="big">🧾</span><h2>لا توجد طلبات بعد</h2><a href="#/" class="btn">اطلب الآن</a></div>';
    return;
  }
  view.innerHTML = `<h1>🧾 طلباتي</h1>${list.map((o) => `
    <a href="#/order/${o.id}" class="card order-card">
      <div class="grow">
        <div class="row between"><b>${esc(o.restaurantName)}</b>${statusBadge(o.status)}</div>
        <div class="muted small">طلب #${o.number} · ${fmtDate(o.createdAt)}</div>
        <div class="small">${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join('، ')}</div>
        <div class="row between"><span class="price">${money(o.total)}</span>
          <button class="btn light sm" data-reorder="${o.id}">🔁 إعادة الطلب</button></div>
      </div>
    </a>`).join('')}`;
  view.querySelectorAll('[data-reorder]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    reorder(list.find((o) => o.id === b.dataset.reorder));
  }));
}

async function reorder(o) {
  try {
    const { restaurant: r, items } = await api(`/api/restaurants/${o.restaurantId}`);
    let added = 0;
    for (const line of o.items) {
      const item = items.find((i) => i.id === line.itemId && i.available);
      if (!item) continue;
      const extras = line.extras.map((e) => item.extras.find((x) => x.name === e.name)).filter(Boolean);
      const unit = item.price + extras.reduce((s, e) => s + e.price, 0);
      const ok = await Cart.add(r, { itemId: item.id, name: item.name, image: item.image, extras, note: line.note, qty: line.qty, unitPrice: Math.round(unit * 100) / 100 });
      if (!ok) return;
      added++;
    }
    if (!added) return toast('الأصناف غير متوفرة حالياً', 'bad');
    toast(added < o.items.length ? 'تمت إضافة الأصناف المتوفرة فقط' : 'تمت إضافة الطلب للسلة');
    location.hash = '#/cart';
  } catch (e) { toast(e.message, 'bad'); }
}

async function pageOrder({ id }) {
  setNav('orders');
  if (!requireLogin()) return;
  let first = true;
  const load = async () => {
    let o;
    try { o = await api(`/api/orders/${id}`); } catch (e) { if (first) errorView(e); return; }
    first = false;
    if (!location.hash.includes(id)) return;
    renderOrder(o);
    if (['delivered', 'cancelled'].includes(o.status)) { clearInterval(pollTimer); pollTimer = null; }
  };
  loading();
  await load();
  pollTimer = setInterval(load, 8000);
}

function renderOrder(o) {
  const idx = STATUS_FLOW.indexOf(o.status);
  const when = (s) => { const h = o.statusHistory.find((x) => x.status === s); return h ? new Date(h.at).toLocaleTimeString('ar-EG', { timeStyle: 'short' }) : ''; };
  view.innerHTML = `
    <div class="row between"><h1>طلب #${o.number}</h1>${statusBadge(o.status)}</div>
    <div class="card" style="margin-bottom:14px">
      ${o.status === 'cancelled'
        ? `<div class="empty" style="padding:20px"><span class="big">❌</span><h3>تم إلغاء الطلب</h3><div class="muted">${esc(o.cancelReason)}</div></div>`
        : `<div class="track">${STATUS_FLOW.map((s, i) => `
            <div class="step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
              <div class="dot">${STATUS[s].icon}</div>${STATUS[s].label}<div class="small muted">${when(s)}</div></div>`).join('')}</div>
          ${o.status === 'delivered' ? '<h3 class="center">بالهنا والشفا 😋</h3>' : '<p class="center muted small">يتم تحديث حالة الطلب تلقائياً</p>'}`}
      ${o.status === 'pending' ? '<div class="center"><button class="btn danger sm" id="cancel">إلغاء الطلب</button></div>' : ''}
    </div>
    ${o.status === 'delivered' && !o.review ? `<div class="card center" style="margin-bottom:14px" id="rate-box">
      <h3>كيف كانت تجربتك مع ${esc(o.restaurantName)}؟</h3>
      <div class="star-input" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-s="${n}">★</button>`).join('')}</div>
      <textarea id="rv-comment" placeholder="اكتب رأيك (اختياري)" style="margin:10px 0"></textarea>
      <button class="btn" id="send-review">إرسال التقييم</button></div>` : ''}
    ${o.review ? `<div class="card" style="margin-bottom:14px"><b>تقييمك:</b> <span class="rating">${stars(o.review.rating)}</span>
      ${o.review.comment ? `<div>${esc(o.review.comment)}</div>` : ''}</div>` : ''}
    <div class="two-col">
      <div class="card">
        <h3>${esc(o.restaurantName)}</h3>
        ${o.items.map((i) => `<div class="cart-line"><div class="grow"><b>${i.qty} × ${esc(i.name)}</b>
          ${i.extras.length ? `<div class="muted small">+ ${i.extras.map((e) => esc(e.name)).join('، ')}</div>` : ''}
          ${i.note ? `<div class="muted small">📝 ${esc(i.note)}</div>` : ''}</div><span>${money(i.lineTotal)}</span></div>`).join('')}
        ${summaryHtml(o, o)}
      </div>
      <div class="card">
        <h3>تفاصيل التوصيل</h3>
        <p>📍 ${esc(o.address)}</p>
        <p>📞 ${esc(o.phone)}</p>
        <p>${o.paymentMethod === 'card' ? '💳 بطاقة' : '💵 نقداً عند الاستلام'}
          ${o.paymentStatus === 'paid' ? '<span class="badge ok">مدفوع</span>' : o.paymentStatus === 'refunded' ? '<span class="badge info">مسترد</span>' : '<span class="badge warn">غير مدفوع</span>'}</p>
        ${o.notes ? `<p>📝 ${esc(o.notes)}</p>` : ''}
        <p class="muted small">${fmtDate(o.createdAt)}</p>
        ${o.restaurantPhone ? `<a class="btn ghost block" href="tel:${esc(o.restaurantPhone)}">📞 اتصل بالمطعم</a>` : ''}
        ${SETTINGS.supportPhone ? `<a class="btn ghost block" style="margin-top:8px" href="tel:${esc(SETTINGS.supportPhone)}">🎧 خدمة العملاء</a>` : ''}
      </div>
    </div>`;

  const cancel = $('#cancel');
  if (cancel) cancel.addEventListener('click', async () => {
    if (!(await confirmBox('هل أنت متأكد من إلغاء الطلب؟', { ok: 'نعم، إلغاء', danger: true }))) return;
    try { renderOrder(await api(`/api/orders/${o.id}/cancel`, { method: 'POST' })); toast('تم إلغاء الطلب', 'info'); } catch (e) { toast(e.message, 'bad'); }
  });

  const starsEl = $('#stars');
  if (starsEl) {
    let rating = 0;
    starsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      rating = Number(b.dataset.s);
      $$('button', starsEl).forEach((x) => x.classList.toggle('on', Number(x.dataset.s) <= rating));
    });
    $('#send-review').addEventListener('click', async () => {
      if (!rating) return toast('اختر عدد النجوم', 'bad');
      try {
        renderOrder(await api(`/api/orders/${o.id}/review`, { method: 'POST', body: { rating, comment: $('#rv-comment').value } }));
        toast('شكراً لتقييمك ⭐');
      } catch (e) { toast(e.message, 'bad'); }
    });
  }
}

// ------------------------------------------------------------ المفضلة
async function pageFavorites() {
  setNav('favorites');
  if (!requireLogin()) return;
  loading();
  let list;
  try { list = await api('/api/restaurants'); } catch (e) { return errorView(e); }
  const favs = list.filter((r) => me.favorites.includes(r.id));
  view.innerHTML = `<h1>❤️ المفضلة</h1>${favs.length
    ? `<div class="r-grid">${favs.map(restaurantCard).join('')}</div>`
    : '<div class="empty"><span class="big">🤍</span>لم تضف أي مطعم للمفضلة بعد</div>'}`;
}

// ------------------------------------------------------------ الحساب
function pageLogin() {
  setNav('profile');
  if (me) { location.hash = '#/profile'; return; }
  view.innerHTML = `
    <div class="card auth-box">
      <h1 class="center">تسجيل الدخول</h1>
      <form id="f">
        <label><span>البريد الإلكتروني</span><input name="email" type="email" required autocomplete="email"></label>
        <label><span>كلمة المرور</span><input name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn block">دخول</button>
      </form>
      <p class="center">ليس لديك حساب؟ <a href="#/register" style="color:var(--primary);font-weight:700">أنشئ حساباً</a></p>
    </div>`;
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); doAuth('/api/auth/login', formData(e.target)); });
}

function pageRegister() {
  setNav('profile');
  if (me) { location.hash = '#/profile'; return; }
  view.innerHTML = `
    <div class="card auth-box">
      <h1 class="center">إنشاء حساب جديد</h1>
      <form id="f">
        <label><span>الاسم الكامل</span><input name="name" required></label>
        <label><span>رقم الهاتف</span><input name="phone" type="tel" required></label>
        <label><span>البريد الإلكتروني</span><input name="email" type="email" required autocomplete="email"></label>
        <label><span>كلمة المرور (6 أحرف على الأقل)</span><input name="password" type="password" minlength="6" required autocomplete="new-password"></label>
        <button class="btn block">إنشاء الحساب</button>
      </form>
      <p class="center">لديك حساب؟ <a href="#/login" style="color:var(--primary);font-weight:700">سجّل الدخول</a></p>
    </div>`;
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); doAuth('/api/auth/register', formData(e.target)); });
}

async function doAuth(url, body) {
  try {
    const { token, user } = await api(url, { method: 'POST', body });
    Store.set('user_token', token);
    me = user;
    toast(`أهلاً ${user.name} 👋`);
    const back = Store.get('after_login', '#/');
    Store.del('after_login');
    location.hash = back;
  } catch (e) { toast(e.message, 'bad'); }
}

function pageProfile() {
  setNav('profile');
  if (!requireLogin()) return;
  view.innerHTML = `
    <h1>👤 حسابي</h1>
    <div class="two-col">
      <div>
        <form class="card" id="pf" style="margin-bottom:14px">
          <h3>البيانات الشخصية</h3>
          <label><span>الاسم</span><input name="name" value="${esc(me.name)}" required></label>
          <label><span>رقم الهاتف</span><input name="phone" value="${esc(me.phone)}" required></label>
          <label><span>البريد الإلكتروني</span><input value="${esc(me.email)}" disabled></label>
          <button class="btn">حفظ</button>
        </form>
        <div class="card">
          <div class="row between"><h3>📍 عناويني</h3><button class="btn light sm" id="add-addr">+ إضافة</button></div>
          <div id="addrs"></div>
        </div>
      </div>
      <div>
        <form class="card" id="pw" style="margin-bottom:14px">
          <h3>🔒 تغيير كلمة المرور</h3>
          <label><span>كلمة المرور الحالية</span><input type="password" name="current" required></label>
          <label><span>كلمة المرور الجديدة</span><input type="password" name="next" minlength="6" required></label>
          <button class="btn">تغيير</button>
        </form>
        ${me.role === 'admin' ? '<a href="/admin" class="btn ghost block" style="margin-bottom:10px">🛠️ لوحة التحكم</a>' : ''}
        <button class="btn danger block" id="logout">تسجيل الخروج</button>
      </div>
    </div>`;

  const renderAddrs = () => {
    $('#addrs').innerHTML = me.addresses.length ? me.addresses.map((a, i) => `
      <div class="cart-line"><div class="grow"><b>${esc(a.label)}</b><div class="muted small">${esc(a.details)}</div></div>
      <button class="icon-btn" data-del="${i}" title="حذف">🗑</button></div>`).join('') : '<p class="muted">لا توجد عناوين محفوظة</p>';
  };
  renderAddrs();
  const saveAddrs = async (addresses) => {
    try { me = await api('/api/me', { method: 'PUT', body: { addresses } }); renderAddrs(); toast('تم الحفظ'); } catch (e) { toast(e.message, 'bad'); }
  };
  $('#addrs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (b) saveAddrs(me.addresses.filter((_, i) => i !== Number(b.dataset.del)));
  });
  $('#add-addr').addEventListener('click', () => {
    const m = openModal(`<h3>عنوان جديد</h3><form id="af">
      <label><span>الاسم</span><input name="label" placeholder="البيت، الشغل..." required></label>
      <label><span>التفاصيل</span><textarea name="details" required></textarea></label>
      <button class="btn block">حفظ</button></form>`);
    $('#af', m).addEventListener('submit', (e) => {
      e.preventDefault();
      closeModal();
      saveAddrs([...me.addresses, formData(e.target)]);
    });
  });
  $('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { me = await api('/api/me', { method: 'PUT', body: formData(e.target) }); toast('تم حفظ البيانات'); } catch (err) { toast(err.message, 'bad'); }
  });
  $('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/me/password', { method: 'PUT', body: formData(e.target) }); e.target.reset(); toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message, 'bad'); }
  });
  $('#logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
    Store.del('user_token');
    me = null;
    location.hash = '#/';
  });
}

// ------------------------------------------------------------ التشغيل
const routeTable = createRouter([
  ['/', pageHome],
  ['/r/:id', pageRestaurant],
  ['/cart', pageCart],
  ['/checkout', pageCheckout],
  ['/orders', pageOrders],
  ['/order/:id', pageOrder],
  ['/favorites', pageFavorites],
  ['/login', pageLogin],
  ['/register', pageRegister],
  ['/profile', pageProfile],
], () => { location.hash = '#/'; });

function router() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  closeModal();
  window.scrollTo(0, 0);
  return routeTable();
}
window.addEventListener('hashchange', router);

(async function init() {
  try {
    SETTINGS = await api('/api/settings');
    $('#app-name').textContent = `🍔 ${SETTINGS.appName}`;
    document.title = `${SETTINGS.appName} - اطلب أكلك المفضل`;
  } catch { /* استخدم الإعدادات الافتراضية */ }
  if (authToken('user')) {
    try { me = await api('/api/me'); } catch { Store.del('user_token'); }
  }
  router();
})();
