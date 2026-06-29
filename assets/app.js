let POLES = [];
let PSV_LOCALITIES = [];

const fmt = (v, d=1) => (v === null || v === undefined || v === '') ? '' : (Number.isFinite(+v) ? (+v).toFixed(d).replace(/\.0$/,'').replace(/(\.\d*?)0+$/,'$1') : v);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadPoles(){
  if(POLES.length) return POLES;
  const dataUrl = location.pathname.includes('/pole_assessments/') ? '../data/poles.json' : 'data/poles.json';
  const res = await fetch(dataUrl);
  POLES = await res.json();
  return POLES;
}

function parseCSV(text){
  const rows = [];
  let row = [], cell = '', inQuotes = false;

  for(let i=0; i<text.length; i++){
    const c = text[i], n = text[i+1];

    if(c === '"' && inQuotes && n === '"'){
      cell += '"';
      i++;
    } else if(c === '"'){
      inQuotes = !inQuotes;
    } else if(c === ',' && !inQuotes){
      row.push(cell);
      cell = '';
    } else if((c === '\n' || c === '\r') && !inQuotes){
      if(c === '\r' && n === '\n') i++;
      row.push(cell);
      if(row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if(cell || row.length){
    row.push(cell);
    if(row.some(x => x.trim() !== '')) rows.push(row);
  }

  const headers = rows.shift().map(h => h.trim());
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] ?? '').trim());
    return obj;
  });
}

function getAny(obj, keys){
  for(const k of keys){
    if(obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

function normalizeLon(lon){
  const x = Number(lon);
  if(!Number.isFinite(x)) return null;
  return x > 180 ? x - 360 : x;
}

async function loadPSVLocalities(){
  if(PSV_LOCALITIES.length) return PSV_LOCALITIES;

  const dataUrl = location.pathname.includes('/pole_assessments/')
    ? '../data/global_psv_localities_145_66_preferred.csv'
    : 'data/global_psv_localities_145_66_preferred.csv';

  try{
    const res = await fetch(dataUrl);
    if(!res.ok) throw new Error(`Could not load ${dataUrl}`);
    const text = await res.text();
    PSV_LOCALITIES = parseCSV(text);
  } catch(err){
    console.warn('Global PSV layer not loaded:', err);
    PSV_LOCALITIES = [];
  }

  return PSV_LOCALITIES;
}

function refOptions(data){
  return [...new Set(data.map(d=>d.reference).filter(Boolean))].sort();
}

function areaOptions(data){
  return [...new Set(data.map(d=>d.area).filter(Boolean))].sort();
}

function renderSummary(data){
  const el = document.querySelector('[data-summary]');
  if(!el) return;

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

    data.forEach(d=>{
      const k = d[key] || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    });

    const max = Math.max(...Object.values(counts));

    el.innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
      `<div style="margin:10px 0"><b>${esc(k)}</b> <span class="small">${v}</span><div class="chartbar"><span style="width:${100*v/max}%"></span></div></div>`
    ).join('');
  });
}

function setupCompilation(data){
  const table = document.querySelector('#pole-table');
  if(!table) return;

  const search = document.querySelector('#search');
  const scope = document.querySelector('#scope-filter');
  const ref = document.querySelector('#ref-filter');
  const area = document.querySelector('#area-filter');

  ref.innerHTML = '<option value="">All references</option>' + refOptions(data).map(x=>`<option>${esc(x)}</option>`).join('');
  area.innerHTML = '<option value="">All areas</option>' + areaOptions(data).map(x=>`<option>${esc(x)}</option>`).join('');

  let sortKey = 'nominal_age_ma', sortDir = 1;

  function filtered(){
    const q = (search.value || '').toLowerCase();

    return data.filter(d=>{
      if(scope.value === 'in' && !d.is_cretaceous_scope) return false;
      if(scope.value === 'out' && d.is_cretaceous_scope) return false;
      if(ref.value && d.reference !== ref.value) return false;
      if(area.value && d.area !== area.value) return false;
      if(q && !(`${d.area} ${d.unit} ${d.reference} ${d.comment} ${d.id}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=>{
      let av = a[sortKey], bv = b[sortKey];
      if(av === null || av === undefined) av = '';
      if(bv === null || bv === undefined) bv = '';

      if(typeof av === 'number' || typeof bv === 'number') {
        return ((+av || 0) - (+bv || 0)) * sortDir;
      }

      return String(av).localeCompare(String(bv)) * sortDir;
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
        <td class="num age-cell"><span class="age-dot" style="background:${ageColor(d)}"></span>${fmt(d.nominal_age_ma,1)}</td>
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

  [search, scope, ref, area].forEach(el=>el.addEventListener('input', draw));

  document.querySelector('#reset')?.addEventListener('click', ()=>{
    search.value = '';
    scope.value = 'in';
    ref.value = '';
    area.value = '';
    draw();
  });

  table.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click', ()=>{
    const k = th.dataset.sort;
    if(k === sortKey) sortDir *= -1;
    else {
      sortKey = k;
      sortDir = 1;
    }
    draw();
  }));

  draw();
}

const CRET_MIN = 66;
const CRET_MAX = 145;

const VIRIDIS_STOPS = [
  {t:0.00, hex:'#440154'},
  {t:0.25, hex:'#3b528b'},
  {t:0.50, hex:'#21918c'},
  {t:0.75, hex:'#5ec962'},
  {t:1.00, hex:'#fde725'}
];

function hexToRgb(hex){
  const h = hex.replace('#','');
  return [
    parseInt(h.slice(0,2),16),
    parseInt(h.slice(2,4),16),
    parseInt(h.slice(4,6),16)
  ];
}

function rgbToHex(rgb){
  return '#' + rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}

function interpColor(t){
  t = Math.max(0, Math.min(1, t));

  for(let i=0; i<VIRIDIS_STOPS.length-1; i++){
    const a = VIRIDIS_STOPS[i], b = VIRIDIS_STOPS[i+1];

    if(t >= a.t && t <= b.t){
      const f = (t - a.t) / (b.t - a.t);
      const ar = hexToRgb(a.hex), br = hexToRgb(b.hex);
      return rgbToHex(ar.map((v,j)=>v + (br[j]-v)*f));
    }
  }

  return VIRIDIS_STOPS[VIRIDIS_STOPS.length-1].hex;
}

function ageT(d){
  const age = Number(d.nominal_age_ma);
  if(!Number.isFinite(age)) return null;
  return (age - CRET_MIN) / (CRET_MAX - CRET_MIN);
}

function ageBin(d){
  const age = Number(d.nominal_age_ma);

  if(!Number.isFinite(age)) return {label:'age unknown', color:'#7a8494'};
  if(age < CRET_MIN || age > CRET_MAX) return {label:'outside 145–66 Ma', color:'#a33a2c'};

  return {label:`${fmt(age,1)} Ma`, color:interpColor(ageT(d))};
}

function ageColor(d){
  return ageBin(d).color;
}

function markerHtml(color, outside=false){
  const extra = outside ? 'outline:2px solid #a33a2c;outline-offset:2px;' : '';

  return `<span style="display:block;width:15px;height:15px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px #333;${extra}"></span>`;
}

function psvMarkerHtml(color){
  return `<span style="
    display:block;
    width:13px;
    height:13px;
    background:${color};
    border:2px solid white;
    box-shadow:0 0 0 1px #222;
    transform:rotate(45deg);
  "></span>`;
}

function addAgeScaleControl(map){
  const control = L.control({position:'topright'});

  control.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-control age-scale-control');

    div.innerHTML = `
      <div class="age-scale-title">Nominal age (Ma)</div>
      <div class="age-scale-bar"></div>
      <div class="age-scale-ticks">
        <span>66</span><span>80</span><span>90</span><span>100.5</span><span>120</span><span>145</span>
      </div>
      <div class="age-scale-note"><i></i> outside scope</div>`;

    L.DomEvent.disableClickPropagation(div);
    return div;
  };

  control.addTo(map);
}

async function initMaps(data){
  if(!document.querySelector('#site-map') || typeof L === 'undefined') return;

  const siteMap = L.map('site-map').setView([25,34],5);
  const poleMap = L.map('pole-map').setView([55,-80],2);

  const tiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attr = '&copy; OpenStreetMap contributors';

  L.tileLayer(tiles,{maxZoom:10, attribution:attr}).addTo(siteMap);
  L.tileLayer(tiles,{maxZoom:5, attribution:attr}).addTo(poleMap);

  addAgeScaleControl(siteMap);
  addAgeScaleControl(poleMap);

  const siteGroup = L.featureGroup().addTo(siteMap);
  const poleGroup = L.featureGroup().addTo(poleMap);
  const psvGroup = L.featureGroup();

  data.forEach(d=>{
    const bin = ageBin(d);
    const color = bin.color;
    const outside = !d.is_cretaceous_scope;

    const popup = `<b>${esc(d.area)}</b><br>${esc(d.unit)}<br><b>${fmt(d.nominal_age_ma,1)} Ma</b> — ${esc(bin.label)}<br><a href="pole_assessments/${esc(d.page_slug)}">assessment page</a>`;

    if(d.site_lat !== null && d.site_lon !== null){
      L.marker([d.site_lat,d.site_lon],{
        icon:L.divIcon({
          className:'',
          html:markerHtml(color, outside),
          iconSize:[18,18]
        })
      }).bindPopup(popup).addTo(siteGroup);
    }

    if(d.pole_lat !== null && d.pole_lon_minus180_180 !== null){
      L.circleMarker([d.pole_lat,d.pole_lon_minus180_180],{
        radius:6.5,
        color:outside ? '#7a231d' : '#243447',
        fillColor:color,
        fillOpacity:.88,
        weight:1.2
      }).bindPopup(`${popup}<br>VGP/pole lon shown as ${fmt(d.pole_lon_minus180_180,1)}° for map`).addTo(poleGroup);
    }
  });

  const psvData = await loadPSVLocalities();

  psvData.forEach(d=>{
    const lat = Number(getAny(d, ['lat','Lat','LAT','latitude','Latitude']));
    const lonRaw = getAny(d, ['long','lon','Long','Lon','LONG','LON','longitude','Longitude']);
    const lon = normalizeLon(lonRaw);

    const ageRaw = getAny(d, ['nominal_age_ma','age_ma','Age_Ma','age','Age']);
    const age = Number(ageRaw);

    if(!Number.isFinite(lat) || lon === null) return;

    const color = Number.isFinite(age)
      ? interpColor((age - CRET_MIN) / (CRET_MAX - CRET_MIN))
      : '#222';

    const locality = getAny(d, ['locality','Locality','location','Location','rock_formation','Rock formation','source_id','DSID']);
    const country = getAny(d, ['country','Country']);
    const source = getAny(d, ['source_database','source','Source']);
    const nsites = getAny(d, ['n_sites','N_sites','N','n']);
    const reference = getAny(d, ['primary_reference','reference','Reference','references','References']);

    const popup = `
      <b>${esc(locality)}</b><br>
      ${esc(country)}<br>
      <b>${fmt(age,1)} Ma</b><br>
      Source: ${esc(source)}<br>
      N sites: ${esc(nsites)}<br>
      Reference: ${esc(reference)}
    `;

    L.marker([lat, lon],{
      icon:L.divIcon({
        className:'',
        html:psvMarkerHtml(color),
        iconSize:[18,18]
      })
    }).bindPopup(popup).addTo(psvGroup);
  });

  L.control.layers(null, {
    'Egyptian site/locality positions': siteGroup,
    'Global PSV localities, 145–66 Ma': psvGroup
  }, {collapsed:false}).addTo(siteMap);

  L.control.layers(null, {
    'Egyptian paleomagnetic poles': poleGroup
  }, {collapsed:false}).addTo(poleMap);

  if(siteGroup.getLayers().length) siteMap.fitBounds(siteGroup.getBounds().pad(.25));
  if(poleGroup.getLayers().length) poleMap.fitBounds(poleGroup.getBounds().pad(.25));
}

loadPoles().then(data=>{
  renderSummary(data);
  renderBreakdowns(data);
  setupCompilation(data);
  initMaps(data);
});
