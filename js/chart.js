/* =========================
   CHART & RESULTS TABLE
   ========================= */

/* Таблица результатов (ресурс, цена, спрос, предложение) */
function renderTable(act, price, D, S){
  const tb = document.querySelector("#resultTbl tbody");
  if (!tb) return;
  tb.innerHTML = "";
  (act || []).forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r}</td>
      <td>${(price[r]||0).toFixed(3)}</td>
      <td>${(D[r]||0).toFixed(1)}</td>
      <td>${(S[r]||0).toFixed(1)}</td>`;
    tb.appendChild(tr);
  });
}

/* ---- График столбиков с зумом/перетаскиванием ---- */
const chartState = { scale:1, offsetX:0, offsetY:0, dragging:false, lastX:0, lastY:0 };

function renderChart(act, price){
  const c = document.getElementById("chart");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w=c.width, h=c.height;

  ctx.save();
  ctx.clearRect(0,0,w,h);
  ctx.translate(chartState.offsetX, chartState.offsetY);
  ctx.scale(chartState.scale, chartState.scale);

  const padL=70, padR=20, padT=20, padB=40;
  const innerW=w/chartState.scale - padL - padR;
  const innerH=h/chartState.scale - padT - padB;

  // оси
  ctx.strokeStyle="#284055"; ctx.lineWidth=1/chartState.scale;
  ctx.beginPath();
  ctx.moveTo(padL,padT);
  ctx.lineTo(padL,padT+innerH);
  ctx.lineTo(padL+innerW,padT+innerH);
  ctx.stroke();

  // максимум
  let max=0; (act||[]).forEach(r=>{ if((price[r]||0)>max) max=price[r]; });
  if (max<=0) max=1;

  // сетка Y
  ctx.fillStyle="#9aa4ad";
  ctx.font = `${12/chartState.scale}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  for(let i=0;i<=5;i++){
    const y=padT+innerH - i*innerH/5;
    const val=(max*i/5).toFixed(2);
    ctx.fillText(val, 8, y+4);
    ctx.strokeStyle="#1e2c3b";
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+innerW, y); ctx.stroke();
  }

  // столбики
  const n=(act||[]).length;
  const bw = n ? innerW/n*0.7 : 0;
  (act||[]).forEach((r,idx)=>{
    const x = padL + (idx+0.5)*innerW/n - bw/2;
    const hBar = (price[r]/max)*innerH;
    const y = padT + innerH - hBar;
    const grad = ctx.createLinearGradient(0,y,0,y+hBar);
    grad.addColorStop(0,"#78c1ff"); grad.addColorStop(1,"#7bd389");
    ctx.fillStyle = grad;
    ctx.fillRect(x,y,bw,hBar);

    ctx.fillStyle="#c8d2db";
    ctx.fillText(r, x, padT+innerH+18);
    ctx.fillStyle="#dfe7ee";
    ctx.fillText((price[r]||0).toFixed(2), x, y-6);
  });

  ctx.restore();
}

/* Привязка событий к canvas (однократно после загрузки DOM) */
(function bindChartEvents(){
  window.addEventListener('DOMContentLoaded', ()=>{
    const c = document.getElementById("chart");
    if (!c) return;

    c.addEventListener("wheel",(e)=>{
      e.preventDefault();
      const scaleFactor=(e.deltaY<0)?1.1:0.9;
      const rect=c.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const x=(mx-chartState.offsetX)/chartState.scale;
      const y=(my-chartState.offsetY)/chartState.scale;
      chartState.offsetX = mx - x*chartState.scale*scaleFactor;
      chartState.offsetY = my - y*chartState.scale*scaleFactor;
      chartState.scale = Math.max(0.5, Math.min(6, chartState.scale*scaleFactor));
      // перерисовка вызовется из recalc(), но если его не будет — подстрахуемся
      if (typeof renderChart === 'function' && window.lastPriceMap){
        const act = (window.resources||[]).filter(r=>window.enabled?.[r]);
        renderChart(act, window.lastPriceMap);
      }
    }, {passive:false});

    c.addEventListener("mousedown",(e)=>{
      chartState.dragging=true; chartState.lastX=e.clientX; chartState.lastY=e.clientY;
    });
    window.addEventListener("mousemove",(e)=>{
      if(!chartState.dragging) return;
      const dx=e.clientX-chartState.lastX, dy=e.clientY-chartState.lastY;
      chartState.offsetX+=dx; chartState.offsetY+=dy;
      chartState.lastX=e.clientX; chartState.lastY=e.clientY;
      if (typeof renderChart === 'function' && window.lastPriceMap){
        const act = (window.resources||[]).filter(r=>window.enabled?.[r]);
        renderChart(act, window.lastPriceMap);
      }
    });
    window.addEventListener("mouseup",()=>{ chartState.dragging=false; });

    c.addEventListener("dblclick",()=>{
      chartState.scale=1; chartState.offsetX=0; chartState.offsetY=0;
      if (typeof renderChart === 'function' && window.lastPriceMap){
        const act = (window.resources||[]).filter(r=>window.enabled?.[r]);
        renderChart(act, window.lastPriceMap);
      }
    });
  });
})();
