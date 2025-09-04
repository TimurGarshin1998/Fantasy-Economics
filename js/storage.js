/* =========================
   STORAGE (сохранение/загрузка)
   ========================= */

/** Собрать конфиг для сохранения */
function getConfig() {
  return {
    // экономика
    resources, enabled, basePrice, elasticity,
    manualDemand, manualSupply, markups,
    activeWorld: [...activeWorld],
    activeSeasons: [...activeSeasons],
    // товары/биржа/контракты
    items,
    market,
    contracts
  };
}

/** Применить конфиг */
function setConfig(cfg) {
  try {
    resources    = [...(cfg.resources || resources)];
    enabled      = {...enabled, ...(cfg.enabled || {})};
    basePrice    = {...basePrice, ...(cfg.basePrice || {})};
    elasticity   = {...elasticity, ...(cfg.elasticity || {})};
    manualDemand = {...manualDemand, ...(cfg.manualDemand || {})};
    manualSupply = {...manualSupply, ...(cfg.manualSupply || {})};
    markups      = {...markups, ...(cfg.markups || {})};

    activeWorld   = new Set(cfg.activeWorld || []);
    activeSeasons = new Set(cfg.activeSeasons || []);

    items    = Array.isArray(cfg.items) ? cfg.items : (items || []);
    market   = typeof cfg.market === 'object' && cfg.market ? cfg.market : (market || {});
    contracts= Array.isArray(cfg.contracts) ? cfg.contracts : (contracts || []);
  } catch (e) {
    alert('Ошибка загрузки: ' + e.message);
  }

  // обновить UI
  drawBaseInputs?.();
  drawShocks?.();
  drawPresets?.();

  const mt = document.getElementById('mk_transport'); if (mt) mt.value = markups.transport ?? 0;
  const ms = document.getElementById('mk_storage');   if (ms) ms.value = markups.storage ?? 0;
  const mr = document.getElementById('mk_risk');      if (mr) mr.value = markups.risk ?? 0;
  const mp = document.getElementById('mk_profit');    if (mp) mp.value = markups.profit ?? 0;

  populateContractRes?.();
  recalc?.();
  renderContracts?.(lastPriceMap || {});
}

/** Скачать конфиг в файл */
function downloadConfig() {
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(getConfig(), null, 2));
  a.download = 'fantasy_econ_config.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// === B) Надёжный импорт товаров/рецептов ===
function importItemsJson(obj){
  try{
    // 0) нормализация входа
    let rawArr = null;
    if (Array.isArray(obj)) rawArr = obj;
    else if (obj && Array.isArray(obj.items)) rawArr = obj.items;
    else if (obj && Array.isArray(obj.recipes)) rawArr = obj.recipes;
    else if (obj && Array.isArray(obj.data)) rawArr = obj.data;

    if (!rawArr || !rawArr.length){
      alert('JSON не содержит списка товаров (ожидались массив или items[]/recipes[]/data[]).');
      return;
    }

    if (!Array.isArray(window.items)) window.items = [];

    // индексы существующих
    const byName = new Map(items.map(it => [String(it.name).trim().toLowerCase(), it]));
    const byId   = new Map(items.map(it => [+it.id, it]));

    // фаза объявления (создание/обновление шапок)
    let nextId = items.length ? Math.max(...items.map(x => +x.id || 0)) + 1 : 1;
    const created = []; const updated = [];

    const normType = (v) => Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);

    rawArr.forEach(src => {
      const name = String(src.name || '').trim();
      if (!name) return;

      const key = name.toLowerCase();
      let it = byName.get(key);

      if (!it) {
        const idToUse = (Number.isFinite(+src.id) && !byId.has(+src.id)) ? +src.id : nextId++;
        it = {
          id: idToUse,
          name,
          type: normType(src.type),
          unit: src.unit || '',
          compound: [],
          isResource: !!src.isResource
        };
        items.push(it);
        byName.set(key, it);
        byId.set(it.id, it);
        created.push(name);
      } else {
        if (src.type != null) it.type = normType(src.type);
        if (src.unit != null) it.unit = src.unit;
        updated.push(name);
      }
    });

    // фаза связки состава
    function resolveItemId(ref){
      if (ref == null) return null;
      if (typeof ref === 'number' && byId.has(+ref)) return +ref;
      if (typeof ref === 'string') {
        const trg = byName.get(ref.trim().toLowerCase());
        return trg ? +trg.id : null;
      }
      return null;
    }

    rawArr.forEach(src => {
      const name = String(src.name || '').trim();
      if (!name) return;
      const it = byName.get(name.toLowerCase());
      if (!it) return;

      const comp = Array.isArray(src.compound) ? src.compound : [];
      const newCompound = comp.map(c => {
        const ref = (c.itemId != null) ? c.itemId
                  : (c.item   != null) ? c.item
                  : (c.ref    != null) ? c.ref
                  : null;
        const id = resolveItemId(ref);
        const qty = Math.max(0.0001, +c.qty || 0);
        if (!id) {
          console.warn(`[importItemsJson] Не найден компонент "${ref}" для "${name}"`);
          return null;
        }
        return { itemId: id, qty };
      }).filter(Boolean);

      if (comp.length) it.compound = newCompound;
    });

    // UI обновления
    populateCompoundCandidates?.();
    populateTypeOptions?.();
    populateItemsResFilterOptions?.();

    recalc?.();
    renderItems?.(lastPriceMap || {});

    alert(`Импорт завершён: добавлено ${created.length}, обновлено ${updated.length}.`);
    console.log('[importItemsJson] Добавлены:', created);
    console.log('[importItemsJson] Обновлены:', updated);
  } catch(e){
    console.error('importItemsJson error:', e);
    alert('Ошибка импорта товаров: ' + e.message);
  }
}

// на всякий случай в глобал:
// window.importItemsJson = importItemsJson;

// (function bindFileInput(){
//   const el = document.getElementById('fileInput');
//   if (!el) {
//     console.warn('[storage] #fileInput не найден, импорт из файла недоступен.');
//     return;
//   }
//   el.addEventListener('change', (e) => {
//     const f = e.target.files[0]; if (!f) return;
//     const r = new FileReader();
//     r.onload = () => {
//       try {
//         const obj = JSON.parse(r.result);
//         console.log('[storage] JSON загружен:', obj);

//         // Полный конфиг?
//         const looksLikeFullConfig = obj && (
//           obj.resources || obj.items || obj.contracts ||
//           obj.markups || obj.activeWorld || obj.activeSeasons || obj.market
//         );

//         if (looksLikeFullConfig) {
//           console.log('[storage] Определён как ПОЛНЫЙ КОНФИГ → setConfig()');
//           setConfig(obj);
//         } else {
//           console.log('[storage] Определён как ПРЕСЕТ ТОВАРОВ → importItemsJson()');
//           importItemsJson(obj);
//         }
//       } catch(err){
//         console.error('[storage] Неверный JSON:', err);
//         alert('Неверный JSON: ' + err.message);
//       }
//     };
//     r.readAsText(f, 'utf-8');
//     e.target.value = '';
//   });
// })();
window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('fileInput');
  if (!el) return console.warn('[storage] #fileInput не найден');

  el.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);

        const looksLikeFullConfig = obj && (
          obj.resources || obj.items || obj.contracts ||
          obj.markups || obj.activeWorld || obj.activeSeasons || obj.market
        );

        if (looksLikeFullConfig) {
          setConfig(obj);
        } else {
          importItemsJson(obj);   // пресет товаров/рецептов
        }
      } catch (err) {
        alert('Неверный JSON: ' + err.message);
      } finally {
        // важно: позволяет снова выбрать тот же файл
        e.target.value = '';
      }
    };
    r.readAsText(f, 'utf-8');
  });
});


/** LocalStorage */
function saveLocal() {
  try {
    localStorage.setItem('fantasy_econ_cfg', JSON.stringify(getConfig()));
    alert('Сохранено локально.');
  } catch (e) {
    alert('Не удалось сохранить: ' + e.message);
  }
}
function loadLocal() {
  try {
    const t = localStorage.getItem('fantasy_econ_cfg');
    if (!t) { alert('В LocalStorage нет сохранённой конфигурации.'); return; }
    setConfig(JSON.parse(t));
  } catch (e) {
    alert('Не удалось загрузить: ' + e.message);
  }
}

/** Сброс проекта (перезагрузка страницы) */
function resetAll() {
  if (confirm('Сбросить к настройкам по умолчанию?')) location.reload();
}
