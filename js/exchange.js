/* =========================
   EXCHANGE (биржа товаров)
   ========================= */

// market[itemId] = {min,max,stock,spread,alpha,premium}
if (!window.market) window.market = {};

// хелперы
function _nz(x, d = 0) { x = Number(x); return Number.isFinite(x) ? x : d; }
function _clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/** Премия рынка для itemId; сохраняет market[itemId].premium */
function computeMarketPremium(itemId) {
  const m = market[itemId];
  if (!m) return 0;
  const min = Math.max(0, _nz(m.min, 0));
  const max = Math.max(min + 1, _nz(m.max, min + 1));
  const mid = (min + max) / 2;
  const stock = _clamp(_nz(m.stock, mid), min, max);
  const alpha = _nz(m.alpha, 0.6);

  const deviation = (mid - stock) / mid;               // [-1..+1]
  const premium = _clamp(alpha * deviation, -0.5, +1); // доля
  m.premium = premium;
  return premium;
}

/** Рыночная цена товара = модельная × (1 + premium) */
function getMarketAdjustedPrice(item, priceMap) {
  const base = computeItemCurrentPrice(item, priceMap);
  const prem = computeMarketPremium(item.id);
  return base * (1 + prem);
}

/** UI: список товаров и текущие котировки */
function renderExchangeUI() {
  const sel = document.getElementById('exItem');
  if (!sel) return;
  sel.innerHTML = '';
  (items || []).forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.id; opt.textContent = `[${it.id}] ${it.name}`;
    sel.appendChild(opt);
  });
  sel.onchange = exchangeLoad;

  if (items && items.length) sel.value = sel.value || items[0].id;
  exchangeLoad();
}

function exchangeLoad() {
  const id = +document.getElementById('exItem').value;
  if (!market[id]) {
    market[id] = { min: 1000, max: 5000, stock: 3000, spread: 0.02, alpha: 0.6, premium: 0 };
  }
  const m = market[id];
  document.getElementById('exMin').value = m.min;
  document.getElementById('exMax').value = m.max;
  document.getElementById('exStock').value = m.stock;
  document.getElementById('exSpread').value = (m.spread * 100).toFixed(2);
  document.getElementById('exAlpha').value = m.alpha;

  exchangeRefreshQuote();
}

function exchangeSave() {
  const id = +document.getElementById('exItem').value;
  if (!market[id]) market[id] = {};
  const m = market[id];
  m.min = +document.getElementById('exMin').value || 0;
  m.max = +document.getElementById('exMax').value || (m.min + 1);
  m.stock = +document.getElementById('exStock').value || ((m.min + m.max) / 2);
  m.spread = (+document.getElementById('exSpread').value || 2) / 100;
  m.alpha = +document.getElementById('exAlpha').value || 0.6;

  exchangeRefreshQuote();
  renderItems(lastPriceMap || {});
}

function exchangeRefreshQuote() {
  const id = +document.getElementById('exItem').value;
  const it = (items || []).find(x => x.id === id);
  if (!it) return;

  computeMarketPremium(id);

  const mid = getMarketAdjustedPrice(it, lastPriceMap || {});
  const spr = _nz(market[id]?.spread, 0.02);
  const bid = mid * (1 - spr / 2);
  const ask = mid * (1 + spr / 2);

  document.getElementById('exMid').textContent = Number.isFinite(mid) ? mid.toFixed(3) : '—';
  document.getElementById('exBid').textContent = Number.isFinite(bid) ? bid.toFixed(3) : '—';
  document.getElementById('exAsk').textContent = Number.isFinite(ask) ? ask.toFixed(3) : '—';

  const m = market[id];
  const pct = _clamp(100 * (m.stock - m.min) / (m.max - m.min || 1), 0, 100);
  document.getElementById('exBar').style.width = pct + '%';
}

function exchangeBuy() {
  const id = +document.getElementById('exItem').value;
  const qty = Math.max(1, +document.getElementById('exQty').value || 1);
  const it = items.find(x => x.id === id); if (!it) return;

  const price = getMarketAdjustedPrice(it, lastPriceMap || {});
  const spr = _nz(market[id]?.spread, 0.02);
  const pay = price * (1 + spr / 2) * qty;

  market[id].stock = _clamp(_nz(market[id].stock, 0) - qty, market[id].min, market[id].max);

  logExchange(`КУПИТЬ ${qty}т ${it.name} @ ~${(price * (1 + spr / 2)).toFixed(3)} (= ${pay.toFixed(3)})`);
  exchangeRefreshQuote();
  renderItems(lastPriceMap || {});
}

function exchangeSell() {
  const id = +document.getElementById('exItem').value;
  const qty = Math.max(1, +document.getElementById('exQty').value || 1);
  const it = items.find(x => x.id === id); if (!it) return;

  const price = getMarketAdjustedPrice(it, lastPriceMap || {});
  const spr = _nz(market[id]?.spread, 0.02);
  const get = price * (1 - spr / 2) * qty;

  market[id].stock = _clamp(_nz(market[id].stock, 0) + qty, market[id].min, market[id].max);

  logExchange(`ПРОДАТЬ ${qty}т ${it.name} @ ~${(price * (1 - spr / 2)).toFixed(3)} (= ${get.toFixed(3)})`);
  exchangeRefreshQuote();
  renderItems(lastPriceMap || {});
}

function logExchange(msg) {
  const box = document.getElementById('exchangeLog');
  if (!box) return;
  const p = document.createElement('div');
  p.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
  box.prepend(p);
}
