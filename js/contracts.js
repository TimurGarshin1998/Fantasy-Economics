/* =========================
   CONTRACTS (форварды / опционы)
   ========================= */
/*
  Формат контракта:
  { id, res, qty, strike, prem, type: 'forward'|'call'|'put', side: 'buy'|'sell', term }
*/

if (!window.contracts) window.contracts = [];

function populateContractRes() {
  const sel = document.getElementById('cRes'); if (!sel) return;
  sel.innerHTML = '';
  (resources || []).filter(r => enabled[r]).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    sel.appendChild(opt);
  });
}

/** P/L при текущей цене S */
function computePL(S, c) {
  const Q = +c.qty || 0;
  const K = +c.strike || 0;
  const prem = +c.prem || 0;
  const sideSign = (c.side === 'sell') ? -1 : 1; // buy=+1, sell=−1

  if (!Number.isFinite(S) || Q <= 0) return null;

  if (c.type === 'forward') {
    return sideSign * (S - K) * Q;
  }
  if (c.type === 'call') {
    const intrinsic = Math.max(0, S - K) * Q;
    return (sideSign > 0) ? (intrinsic - prem * Q) : (-intrinsic + prem * Q);
  }
  if (c.type === 'put') {
    const intrinsic = Math.max(0, K - S) * Q;
    return (sideSign > 0) ? (intrinsic - prem * Q) : (-intrinsic + prem * Q);
  }
  return (S - K) * Q; // дефолт как forward buy
}

function addContract() {
  const res = (document.getElementById('cRes')?.value || '').trim();
  const qty = +document.getElementById('cQty')?.value || 0;
  const K = +document.getElementById('cPrice')?.value || 0;
  const prem = +document.getElementById('cPrem')?.value || 0;
  const type = (document.getElementById('cType')?.value || 'forward').toLowerCase();
  const side = (document.getElementById('cSide')?.value || 'buy').toLowerCase();
  const term = (document.getElementById('cTerm')?.value || '').trim();

  if (!res || qty <= 0) { alert('Укажи ресурс и положительное количество'); return; }
  if (!['forward', 'call', 'put'].includes(type)) { alert('Неверный тип контракта'); return; }
  if (!['buy', 'sell'].includes(side)) { alert('Сторона должна быть buy или sell'); return; }

  const id = Math.random().toString(36).slice(2, 9);
  contracts.push({ id, res, qty, strike: K, prem, type, side, term });
  renderContracts(lastPriceMap || {});
}

function removeContract(id) {
  contracts = contracts.filter(c => c.id !== id);
  renderContracts(lastPriceMap || {});
}

function renderContracts(priceMap) {
  const tb = document.querySelector('#contractTbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  const activeSeasonNames = new Set([...(activeSeasons || [])].map(s => String(s).toLowerCase()));

  (contracts || []).forEach(c => {
    const S = priceMap[c.res];
    const hasPrice = Number.isFinite(S);
    const pl = hasPrice ? computePL(S, c) : null;
    const status = c.term && activeSeasonNames.has(String(c.term).toLowerCase()) ? 'в срок' : 'до срока';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.res}</td>
      <td>${(c.type || 'forward').toUpperCase()}</td>
      <td>${(c.side || 'buy').toUpperCase()}</td>
      <td>${c.qty}</td>
      <td>${(+c.strike || 0).toFixed(3)}</td>
      <td>${(+c.prem || 0).toFixed(3)}</td>
      <td>${hasPrice ? (+S).toFixed(3) : '—'}</td>
      <td style="color:${pl == null ? '#e6e6e6' : (pl >= 0 ? '#7bd389' : '#ff9b9b')}">${pl == null ? '—' : pl.toFixed(3)}</td>
      <td>${status}</td>
      <td><span class="del" title="Удалить" onclick="removeContract('${c.id}')">×</span></td>
    `;
    tb.appendChild(tr);
  });
}
