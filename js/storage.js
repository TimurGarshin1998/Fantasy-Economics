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

/** Загрузка из файла input[type=file]#fileInput (добавь в HTML) */
(function bindFileInput(){
  const el = document.getElementById('fileInput');
  if (!el) return;
  el.addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { 
      try { setConfig(JSON.parse(r.result)); } 
      catch (err) { alert('Неверный JSON: ' + err.message); } 
    };
    r.readAsText(f, 'utf-8'); 
    e.target.value = '';
  });
})();

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
