/* =========================
   UI: базовые панели и init
   ========================= */

/* Ресурсы: таблица базовых параметров */
function drawBaseInputs() {
  const div = document.getElementById('baseInputs');
  if (!div) return;
  div.innerHTML = '';
  (resources || []).forEach(r => {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `
      <span class="name">${r}</span>
      <input type="number" step="0.001" value="${basePrice[r] ?? 1}" onchange="basePrice['${r}']=+this.value; recalc()"/>
      <input type="number" step="0.05"  value="${elasticity[r] ?? 0.8}" onchange="elasticity['${r}']=+this.value; recalc()"/>
      <div class="tog">
        <input type="checkbox" ${enabled[r] ? 'checked' : ''} onchange="enabled['${r}']=this.checked; populateContractRes(); recalc()"/>
        <span class="del" title="Удалить" onclick="removeResource('${r}')">×</span>
      </div>`;
    div.appendChild(row);
  });
  populateContractRes?.();
}

/* Шоки спроса/предложения (по ресурсам) */
function drawShocks() {
  const container = document.getElementById('shockInputs');
  if (!container) return;
  container.innerHTML = '';

  (resources || []).forEach(r => {
    manualDemand[r] ??= 0;
    manualSupply[r] ??= 0;

    const card = document.createElement('div');
    card.className = 'card shock-row'; // важный класс для «свернуть до 2х»
    card.style.marginBottom = '8px';

    const title = document.createElement('b');
    title.textContent = r;
    card.appendChild(title);
    card.appendChild(document.createElement('br'));

    // спрос
    const dLbl = document.createElement('label'); dLbl.textContent = 'Спрос (Δ относит.)';
    const dRange = document.createElement('input'); dRange.type = 'range'; dRange.min = '-1'; dRange.max = '1'; dRange.step = '0.01';
    dRange.value = manualDemand[r];
    const dVal = document.createElement('span'); dVal.className = 'muted small'; dVal.textContent = (+dRange.value).toFixed(2);
    dRange.oninput = () => { manualDemand[r] = parseFloat(dRange.value); dVal.textContent = (+dRange.value).toFixed(2); recalc(); };

    card.appendChild(dLbl); card.appendChild(dRange); card.appendChild(dVal);

    // предложение
    const sLbl = document.createElement('label'); sLbl.textContent = 'Предложение (Δ относит.)';
    const sRange = document.createElement('input'); sRange.type = 'range'; sRange.min = '-1'; sRange.max = '1'; sRange.step = '0.01';
    sRange.value = manualSupply[r];
    const sVal = document.createElement('span'); sVal.className = 'muted small'; sVal.textContent = (+sRange.value).toFixed(2);
    sRange.oninput = () => { manualSupply[r] = parseFloat(sRange.value); sVal.textContent = (+sRange.value).toFixed(2); recalc(); };

    card.appendChild(sLbl); card.appendChild(sRange); card.appendChild(sVal);

    container.appendChild(card);
  });
}

/* Сворачиватель «Шоков»: при свернутом состоянии видны первые 2 элемента */
function toggleShocks() {
  const btn  = document.getElementById('toggleShocksBtn');
  const body = document.getElementById('shockInputs');
  if (!body) return;

  const collapsed = body.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? 'Развернуть' : 'Свернуть';
}

/* CSS-правило нужно в style.css:
   #shockInputs.collapsed .shock-row:nth-child(n+3){ display:none; }
*/

/* Мировые события/Сезоны (пилюли) */
function drawPresets() {
  const w = document.getElementById('worldPresets'); 
  if (w) {
    w.innerHTML = '';
    Object.keys(WORLD).forEach(name => {
      const pill = document.createElement('span');
      pill.className = 'pill' + (activeWorld.has(name) ? ' active' : '');
      pill.textContent = name;
      pill.onclick = () => toggleWorld(name);
      w.appendChild(pill);
    });
  }
  const s = document.getElementById('seasonPresets');
  if (s) {
    s.innerHTML = '';
    Object.keys(SEASONS).forEach(name => {
      const pill = document.createElement('span');
      pill.className = 'pill' + (activeSeasons.has(name) ? ' active' : '');
      pill.textContent = name;
      pill.onclick = () => toggleSeason(name);
      s.appendChild(pill);
    });
  }
}

/* Наценки (слайдеры) */
function bindMarkups() {
  ['transport', 'storage', 'risk', 'profit'].forEach(k => {
    const el = document.getElementById('mk_' + k);
    if (!el) return;
    el.addEventListener('input', e => {
      markups[k] = parseFloat(e.target.value || 0);
      recalc();
    });
  });
}

/* Ресурсы: добавить/удалить */
function addResource() {
  const name = (document.getElementById('newName')?.value || '').trim();
  const price = +document.getElementById('newPrice')?.value || 1;
  const elas = +document.getElementById('newElas')?.value || 0.8;
  if (!name) { alert('Введите название ресурса'); return; }
  if (resources.includes(name)) { alert('Такой ресурс уже существует'); return; }
  resources.push(name); enabled[name] = true; basePrice[name] = price; elasticity[name] = elas;
  manualDemand[name] = 0; manualSupply[name] = 0;
  const nn = document.getElementById('newName'); if (nn) nn.value = '';
  drawBaseInputs(); renderItems(lastPriceMap || {}); drawShocks(); recalc();
}

function removeResource(r) {
  if (!confirm(`Удалить ресурс «${r}»?`)) return;
  resources = resources.filter(x => x !== r);
  delete enabled[r]; delete basePrice[r]; delete elasticity[r];
  delete manualDemand[r]; delete manualSupply[r];
  contracts = contracts.filter(c => c.res !== r);
  drawBaseInputs(); drawShocks(); renderContracts({}); recalc();
}

/* Инициализация интерфейса */
window.addEventListener('DOMContentLoaded', () => {
  drawBaseInputs();
  drawShocks();
  drawPresets();
  bindMarkups();

  populateContractRes?.();
  recalc();
  populateTypeOptions?.();
  populateItemsResFilterOptions?.();
  renderItems?.(lastPriceMap || {});
  renderContracts?.(lastPriceMap || {});
  renderExchangeUI?.();
  exchangeRefreshQuote?.(); 
//   renderContracts?.(lastPriceMap || {});

});
