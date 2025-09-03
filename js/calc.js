/* =========================
   CALC (пересчёт экономики)
   ========================= */

// Создаём товары-ресурсы по карте цен (из resultTbl)
function ensureResourceItemsFromPriceMap(priceMap){
  if (!Array.isArray(window.items)) window.items = [];
  const names = new Set(items.map(it => it.name));
  let nextId = items.length ? Math.max(...items.map(x=>+x.id||0)) + 1 : 1;

  Object.keys(priceMap || {}).forEach(resName => {
    if (!names.has(resName)) {
      items.push({
        id: nextId++,
        name: resName,
        type: [resName],
        unit: 'ед.',
        compound: [],
        isResource: true
      });
      names.add(resName);
    } else {
      const it = items.find(x => x.name === resName);
      if (it && (!Array.isArray(it.type) || it.type.length !== 1 || it.type[0] !== resName)) {
        it.type = [resName];
      }
    }
  });
}

/** Главный пересчёт */
function recalc(){
  try{
    // 1) активные ресурсы
    const act = (resources || []).filter(r => enabled?.[r]);

    // 2) спрос/предложение с учётом шоков
    const D = {}, S = {};
    act.forEach(r => {
      const d = 1 + (+manualDemand?.[r] || 0);
      const s = 1 + (+manualSupply?.[r] || 0);
      D[r] = 100 * d;
      S[r] = 100 * s;
    });

    // 3) наценки
    let m = {
      transport: +(markups?.transport || 0),
      storage:   +(markups?.storage   || 0),
      risk:      +(markups?.risk      || 0),
      profit:    +(markups?.profit    || 0),
    };

    // 4) применяем пресеты (мир/сезоны)
    const applyPreset = (p) => {
      if (!p) return;
      if (p.demand) for (const r in p.demand) if (D[r]!=null) D[r] *= (1 + p.demand[r]);
      if (p.supply) for (const r in p.supply) if (S[r]!=null) S[r] *= (1 + p.supply[r]);
      if (p.markups) for (const k in p.markups) m[k] = (m[k] || 0) + p.markups[k];
    };
    (activeWorld  || new Set()).forEach(n => applyPreset(WORLD?.[n]));
    (activeSeasons|| new Set()).forEach(n => applyPreset(SEASONS?.[n]));

    // 4.1) дополнительный хук, если есть
    if (typeof applyLiquidity === 'function') applyLiquidity(D, S, m);

    // 5) защита от крайностей
    act.forEach(r=>{
      if (!isFinite(D[r]) || D[r] < 0) D[r] = 0;
      if (!isFinite(S[r]) || S[r] <= 0) S[r] = 1e-6;
    });

    // 6) финальный мультипликатор (не даём уйти в минус)
    const mult = 1
      + Math.max(0, m.transport || 0)
      + Math.max(0, m.storage   || 0)
      + Math.max(0, m.risk      || 0)
      + Math.max(0, m.profit    || 0);

    // 7) расчёт цен по ресурсам
    const price = {};
    act.forEach(r=>{
      const base  = Number(basePrice?.[r] ?? 1);
      const elas  = Number(elasticity?.[r] ?? 1);
      const ratio = D[r] / S[r];
      let p = base * Math.pow(ratio, elas) * mult;
      if (!isFinite(p) || p < 0) p = 0;
      price[r] = p;
    });

    // 8) сохраняем карту цен и заводим товары-ресурсы
    window.lastPriceMap = price;
    ensureResourceItemsFromPriceMap(price);

    // 9) обновляем UI (ровно по одному разу)
    if (typeof renderTable                 === 'function') renderTable(act, price, D, S);
    if (typeof renderChart                 === 'function') renderChart(act, price);
    if (typeof populateTypeOptions         === 'function') populateTypeOptions();
    if (typeof populateItemsResFilterOptions=== 'function') populateItemsResFilterOptions();
    if (typeof renderItems                 === 'function') renderItems(price);
    if (typeof renderContracts             === 'function') renderContracts(price);
    if (typeof renderExchangeUI            === 'function') renderExchangeUI();
    if (typeof exchangeRefreshQuote        === 'function') exchangeRefreshQuote();

  } catch(e){
    console.error('recalc() error:', e);
  }
}

// Экспорт в глобал (на случай строгих окружений)
window.recalc = recalc;
window.ensureResourceItemsFromPriceMap = ensureResourceItemsFromPriceMap;
