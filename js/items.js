/* =========================
   ITEMS (товары)
   ========================= */

/** Подсчёт базы: сумма текущих цен выбранных ресурсов (из resultTbl / lastPriceMap) */
function computeBaseFromTypes(types) {
  return (types || []).reduce((s, r) => s + (lastPriceMap[r] || 0), 0);
}

/** Рекурсивная стоимость товара по модели (без биржевой премии) */
function computeItemCurrentPrice(item, priceMap, visited = new Set()) {
  if (!item) return NaN;
  if (visited.has(item.id)) return NaN;
  visited.add(item.id);

  // базовая часть = сумма цен ресурсов из type
  let total = computeBaseFromTypes(item.type);

  // составные части
  if (item.compound && item.compound.length) {
    for (const c of item.compound) {
      const sub = items.find(x => x.id === c.itemId);
      if (!sub) continue;
      const subPrice = computeItemCurrentPrice(sub, priceMap, visited);
      if (Number.isFinite(subPrice)) total += c.qty * subPrice;
    }
  }
  visited.delete(item.id);
  return total;
}

/** Получить «рыночную» цену (модель × биржевая премия); есть fallback, если биржа не подключена */
function getItemDisplayPrice(item, priceMap) {
  if (typeof getMarketAdjustedPrice === 'function') {
    return getMarketAdjustedPrice(item, priceMap);
  }
  return computeItemCurrentPrice(item, priceMap);
}

/** Мультиселект ресурсов (тип товара) берётся из lastPriceMap */
function populateTypeOptions() {
  const sel = document.getElementById('itmType');
  if (!sel) return;
  sel.innerHTML = '';
  Object.entries(lastPriceMap || {}).forEach(([res, price]) => {
    const opt = document.createElement('option');
    opt.value = res;
    opt.textContent = `${res} (${price.toFixed(3)})`;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    const types = getSelectedResources();
    const base = types.reduce((s, r) => s + (lastPriceMap[r] || 0), 0);
    const baseField = document.getElementById('itmBase');
    if (baseField) baseField.value = base.toFixed(3);
  };
}

/** Выбранные ресурсы из мультиселекта типа */
function getSelectedResources() {
  const sel = document.getElementById('itmType');
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => o.value);
}

/** Добавить товар */
function addItem() {
  const name = (document.getElementById('itmName')?.value || '').trim();
  if (!name) return alert('Введите название');

  const types = getSelectedResources();
  if (!types.length) return alert('Выберите хотя бы один ресурс в «Тип (ресурсы из результатов)»');

  const unit = (document.getElementById('itmUnit')?.value || '').trim();
  const id = items.length ? Math.max(...items.map(x => +x.id || 0)) + 1 : 1;

  items.push({
    id,
    name,
    type: types,    // список ресурсов
    unit,
    compound: []    // редактируется через «⚙»
  });

  // очистка формы
  document.getElementById('itmName').value = '';
  document.getElementById('itmUnit').value = '';
  const baseField = document.getElementById('itmBase');
  if (baseField) baseField.value = '';

  populateCompoundCandidates();
  renderItems(lastPriceMap || {});
}

/** Удалить товар (и ссылки на него из составов других товаров) */
function removeItem(id) {
  items = items.filter(x => x.id !== id);
  items.forEach(it => {
    it.compound = (it.compound || []).filter(c => c.itemId !== id);
  });
  populateCompoundCandidates();
  renderItems(lastPriceMap || {});
}

/** Таблица «Товары»: поиск/фильтр/сорт + цены */
function renderItems(priceMap) {
  const tb = document.querySelector('#itemsTbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  const list = Array.isArray(items) ? items.slice() : [];
  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="muted">Товары не добавлены</td>`;
    tb.appendChild(tr);
    return;
  }

  // фильтрация
  let filtered = list.filter(it => {
    if (itemsSearchTerm) {
      const nm = (it.name || '').toLowerCase();
      if (!nm.includes(itemsSearchTerm)) return false;
    }
    if (itemsTypeFilter === 'onlyResources' && !it.isResource) return false;
    if (itemsTypeFilter === 'onlyComposite' && (it.isResource || !(it.compound && it.compound.length))) return false;
    if (itemsTypeFilter.startsWith('res:')) {
      const resName = itemsTypeFilter.slice(4);
      if (!(it.type || []).includes(resName)) return false;
    }
    return true;
  });

  // сортировка
  filtered.sort((a, b) => {
    if (itemsSort === 'nameAsc' || itemsSort === 'nameDesc') {
      const s = (a.name || '').localeCompare(b.name || '', 'ru');
      return itemsSort === 'nameAsc' ? s : -s;
    } else {
      const pa = getItemDisplayPrice(a, priceMap);
      const pb = getItemDisplayPrice(b, priceMap);
      const sa = Number.isFinite(pa) ? pa : -Infinity;
      const sb = Number.isFinite(pb) ? pb : -Infinity;
      return itemsSort === 'priceAsc' ? (sa - sb) : (sb - sa);
    }
  });

  // рендер
  filtered.forEach(it => {
    const baseNow = computeBaseFromTypes(it.type);
    const cur = getItemDisplayPrice(it, priceMap);

    const typeStr = (it.type && it.type.length) ? it.type.join(', ') : '—';
    const compStr = (it.compound && it.compound.length)
      ? it.compound.map(c => {
          const sub = items.find(x => x.id === c.itemId);
          return sub ? `${c.qty}×${sub.name}` : `${c.qty}×?`;
        }).join(', ')
      : '—';

    const actions = it.isResource
      ? `<span class="muted">ресурс</span>`
      : `<button class="pill" title="Редактировать состав" onclick="openCompoundEditor(${it.id})">⚙</button>
         <span class="del" title="Удалить" onclick="removeItem(${it.id})">×</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.id}</td>
      <td>${it.name}</td>
      <td>${typeStr}</td>
      <td>${it.unit || ''}</td>
      <td>${Number.isFinite(baseNow) ? baseNow.toFixed(3) : '—'}</td>
      <td>${compStr}</td>
      <td>${Number.isFinite(cur) ? cur.toFixed(3) : '—'}</td>
      <td>${actions}</td>
    `;
    tb.appendChild(tr);
  });
}

/* ---------- Редактор состава (модалка) ---------- */

let cmpEditingId = null;   // id редактируемого товара
let cmpWorking = [];       // временный массив строк состава

function populateCompoundCandidates() {
  // Заполняет селект кандидатов, если он есть (в модалке)
  const sel = document.getElementById('cmpEditSelect');
  if (!sel) return;
  const id = cmpEditingId;
  sel.innerHTML = '';
  items.filter(x => x.id !== id).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} [id:${t.id}]`;
    sel.appendChild(opt);
  });
}

function openCompoundEditor(id) {
  cmpEditingId = id;
  const it = items.find(x => x.id === id);
  if (!it) return;

  cmpWorking = JSON.parse(JSON.stringify(it.compound || []));
  document.getElementById('cmpModalTitle').textContent = `Состав: ${it.name} [id:${it.id}]`;

  populateCompoundCandidates();
  renderCmpWorking();

  document.getElementById('cmpModalBackdrop').style.display = 'block';
  document.getElementById('cmpModal').style.display = 'block';
}

function renderCmpWorking() {
  const box = document.getElementById('cmpEditList');
  if (!box) return;
  box.innerHTML = '';

  if (!cmpWorking.length) {
    box.innerHTML = '<div class="muted">Состав пуст</div>';
    renderItems(lastPriceMap || {});
    return;
  }

  cmpWorking.forEach((row, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'row';

    const sel = document.createElement('select');
    items.filter(x => x.id !== cmpEditingId).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = `${t.name} [id:${t.id}]`;
      if (+row.itemId === t.id) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => {
      row.itemId = +sel.value;
      renderItems(lastPriceMap || {});
    };

    const qty = document.createElement('input');
    qty.type = 'number'; qty.min = '0.1'; qty.step = '0.1'; qty.value = row.qty || 1;
    qty.oninput = () => {
      row.qty = Math.max(0.1, +qty.value || 0.1);
      renderItems(lastPriceMap || {});
    };

    const del = document.createElement('button');
    del.className = 'pill';
    del.textContent = 'Удалить';
    del.onclick = () => {
      cmpWorking.splice(idx, 1);
      renderCmpWorking();
      renderItems(lastPriceMap || {});
    };

    wrap.appendChild(sel);
    wrap.appendChild(qty);
    wrap.appendChild(del);
    box.appendChild(wrap);
  });

  renderItems(lastPriceMap || {});
}

function cmpAddRow() {
  const sel = document.getElementById('cmpEditSelect');
  const id = +sel.value;
  const qty = Math.max(0.1, +document.getElementById('cmpEditQty').value || 1);
  if (!id) return alert('Выбери товар для добавления');
  if (id === cmpEditingId) return alert('Нельзя добавить сам товар в его же состав');
  cmpWorking.push({ itemId: id, qty });
  renderCmpWorking();
}

function cmpClose() {
  document.getElementById('cmpModalBackdrop').style.display = 'none';
  document.getElementById('cmpModal').style.display = 'none';
  cmpEditingId = null; cmpWorking = [];
}

function wouldCreateCycle(startId, working) {
  const deps = new Map();
  items.forEach(x => deps.set(x.id, (x.compound || []).map(c => c.itemId)));
  deps.set(startId, (working || []).map(c => c.itemId));

  const seen = new Set();
  function dfs(v) {
    if (v === startId && seen.size) return true;
    if (seen.has(v)) return false;
    seen.add(v);
    for (const u of deps.get(v) || []) {
      if (u === startId) return true;
      if (dfs(u)) return true;
    }
    seen.delete(v);
    return false;
  }
  return dfs(startId);
}

function cmpSave() {
  const it = items.find(x => x.id === cmpEditingId);
  if (!it) return cmpClose();

  if (wouldCreateCycle(it.id, cmpWorking)) {
    alert('Циклическая зависимость в составе. Убери цикл и попробуй снова.');
    return;
  }

  it.compound = JSON.parse(JSON.stringify(cmpWorking));
  cmpClose();
  renderItems(lastPriceMap || {});
}

/* ---------- Фильтры таблицы товаров ---------- */

function populateItemsResFilterOptions() {
  const grp = document.getElementById('itemsResFilterGroup');
  if (!grp) return;
  grp.innerHTML = '';
  Object.keys(lastPriceMap || {}).forEach(r => {
    const opt = document.createElement('option');
    opt.value = 'res:' + r;
    opt.textContent = r;
    grp.appendChild(opt);
  });
}

function onItemsSearchChange() {
  itemsSearchTerm = (document.getElementById('itemsSearch').value || '').trim().toLowerCase();
  renderItems(lastPriceMap || {});
}
function onItemsFilterChange() {
  itemsTypeFilter = document.getElementById('itemsTypeFilter').value;
  renderItems(lastPriceMap || {});
}
function onItemsSortChange() {
  itemsSort = document.getElementById('itemsSort').value;
  renderItems(lastPriceMap || {});
}
function resetItemsFilters() {
  itemsSearchTerm = '';
  itemsTypeFilter = 'all';
  itemsSort = 'priceDesc';
  document.getElementById('itemsSearch').value = '';
  document.getElementById('itemsTypeFilter').value = 'all';
  document.getElementById('itemsSort').value = 'priceDesc';
  renderItems(lastPriceMap || {});
}
