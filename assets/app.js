
let POLES = [];
const fmt = (v, d=1) => (v === null || v === undefined || v === '') ? '' : (Number.isFinite(+v) ? (+v).toFixed(d).replace(/\.0$/,'').replace(/(\.\d*?)0+$/,'$1') : v);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function loadPoles(){
  if(POLES.length) return POLES;
  const dataUrl = location.pathname.includes('/pole_assessments/') ? '../data/poles.json' : 'data/poles.json';
  const res = await fetch(dataUrl);
  POLES = await res.json();
  return POLES;
}
function refOptions(data){
  return [...new Set(data.map(d=>d.reference).filter(Boolean))].sort();
}
function areaOptions(data){
  return [...new Set(data.map(d=>d.area).filter(Boolean))].sort();
}
function renderSummary(data){
  const el = document.querySelector('[data-summary]'); if(!el) return;
  const inScope = data.filter(d=>d.is_cretaceous_scope).length;
  const refs = new Set(data.map(d=>d.reference).filter(Boolean)).size;
  const ages = data.map(d=>d.nominal_age_ma).filter(v=>v!==null);
  const totalSites = data.reduce((a,d)=>a+(+d.n_sites||0),0);
  el.innerHTML = `
    <div class="card"><div class="num">${data.length}</div><div class="label">uploaded pole entries</div></div>
    <div class="card"><div class="num">${inScope}</div><div class="label">within 145–66 Ma</div></div>
    <div class="card"><div class="num">${refs}</div><div class="label">references</div></div>
    <div class="card"><div class="num">${fmt(Math.min(...ages),0)}–${fmt(Math.max(...ages),0)}</div><div class="label">nominal age range, Ma</div></div>`;
}
function renderBreakdowns(data){
  document.querySelectorAll('[data-breakdown]').forEach(el=>{
    const key = el.dataset.breakdown;
    const counts = {};
    data.forEach(d=>{ const k = d[key] || 'Unknown'; counts[k]=(counts[k]||0)+1; });
    const max = Math.max(...Object.values(counts));
    el.innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
      `<div style="margin:10px 0"><b>${esc(k)}</b> <span class="small">${v}</span><div class="chartbar"><span style="width:${100*v/max}%"></span></div></div>`
    ).join('');
  });
}
function setupCompilation(data){
  const table = document.querySelector('#pole-table'); if(!table) return;
  const search = document.querySelector('#search');
  const scope = document.querySelector('#scope-filter');
  const ref = document.querySelector('#ref-filter');
  const area = document.querySelector('#area-filter');
  ref.innerHTML = '<option value="">All references</option>' + refOptions(data).map(x=>`<option>${esc(x)}</option>`).join('');
  area.innerHTML = '<option value="">All areas</option>' + areaOptions(data).map(x=>`<option>${esc(x)}</option>`).join('');
  let sortKey = 'nominal_age_ma', sortDir = 1;
  function filtered(){
    const q = (search.value||'').toLowerCase();
    return data.filter(d=>{
      if(scope.value === 'in' && !d.is_cretaceous_scope) return false;
      if(scope.value === 'out' && d.is_cretaceous_scope) return false;
      if(ref.value && d.reference !== ref.value) return false;
      if(area.value && d.area !== area.value) return false;
      if(q && !(`${d.area} ${d.unit} ${d.reference} ${d.comment} ${d.id}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=>{
      let av=a[sortKey], bv=b[sortKey];
      if(av===null||av===undefined) av=''; if(bv===null||bv===undefined) bv='';
      if(typeof av === 'number' || typeof bv === 'number') return ((+av||0)-(+bv||0))*sortDir;
      return String(av).localeCompare(String(bv))*sortDir;
    });
  }
  function draw(){
    const rows = filtered();
    document.querySelector('#count').textContent = rows.length;
    table.querySelector('tbody').innerHTML = rows.map(d=>`
      <tr>
        <td><a href="pole_assessments/${esc(d.page_slug)}"><b>${esc(d.id)}</b></a><br><span class="small">${esc(d.subperiod)}</span></td>
        <td>${esc(d.area)}</td>
        <td>${esc(d.unit)}</td>
        <td class="num">${fmt(d.nominal_age_ma,1)}</td>
        <td class="num">${fmt(d.high_age_ma,1)}</td>
        <td class="num">${fmt(d.low_age_ma,1)}</td>
        <td class="num">${fmt(d.n_sites,0)}</td>
        <td class="num">${fmt(d.dec_deg,1)}</td>
        <td class="num">${fmt(d.inc_deg,1)}</td>
        <td class="num">${fmt(d.alpha95_deg,1)}</td>
        <td class="num">${fmt(d.pole_lat,1)}</td>
        <td class="num">${fmt(d.pole_lon_0_360,1)}</td>
        <td class="num">${fmt(d.a95_deg,1)}</td>
        <td>${esc(d.reference)}</td>
        <td>${d.is_cretaceous_scope ? '<span class="badge ok">145–66 Ma</span>' : '<span class="badge out">outside scope</span>'}</td>
      </tr>`).join('');
  }
  [search,scope,ref,area].forEach(el=>el.addEventListener('input', draw));
  document.querySelector('#reset')?.addEventListener('click',()=>{search.value='';scope.value='in';ref.value='';area.value='';draw();});
  table.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.sort; if(k===sortKey) sortDir*=-1; else {sortKey=k; sortDir=1;} draw(); }));
  draw();
}
function markerHtml(color){return `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px #333"></span>`}
function initMaps(data){
  if(!document.querySelector('#site-map') || typeof L === 'undefined') return;
  const siteMap = L.map('site-map').setView([25,34],5);
  const poleMap = L.map('pole-map').setView([55,-80],2);
  const tiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attr = '&copy; OpenStreetMap contributors';
  L.tileLayer(tiles,{maxZoom:10, attribution:attr}).addTo(siteMap);
  L.tileLayer(tiles,{maxZoom:5, attribution:attr}).addTo(poleMap);
  const siteGroup = L.featureGroup().addTo(siteMap);
  const poleGroup = L.featureGroup().addTo(poleMap);
  data.forEach(d=>{
    const color = d.is_cretaceous_scope ? '#16a085' : '#a33a2c';
    const popup = `<b>${esc(d.area)}</b><br>${esc(d.unit)}<br>${fmt(d.nominal_age_ma,1)} Ma<br><a href="pole_assessments/${esc(d.page_slug)}">assessment page</a>`;
    if(d.site_lat !== null && d.site_lon !== null){
      L.marker([d.site_lat,d.site_lon],{icon:L.divIcon({className:'',html:markerHtml(color),iconSize:[14,14]})}).bindPopup(popup).addTo(siteGroup);
    }
    if(d.pole_lat !== null && d.pole_lon_minus180_180 !== null){
      L.circleMarker([d.pole_lat,d.pole_lon_minus180_180],{radius:6,color:color,fillColor:color,fillOpacity:.75,weight:1}).bindPopup(`${popup}<br>VGP/pole lon shown as ${fmt(d.pole_lon_minus180_180,1)}° for map`).addTo(poleGroup);
    }
  });
  if(siteGroup.getLayers().length) siteMap.fitBounds(siteGroup.getBounds().pad(.25));
  if(poleGroup.getLayers().length) poleMap.fitBounds(poleGroup.getBounds().pad(.25));
}
loadPoles().then(data=>{renderSummary(data);renderBreakdowns(data);setupCompilation(data);initMaps(data);});
