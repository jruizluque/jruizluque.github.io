// Observations will be loaded from observations.csv (columns: Dato,Target,Station,Instrument,Filter,Notes,ETD,AAVSO,ExoClock)
let observationsData = [];
let linksData = [];

function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').split('\n').filter(Boolean);
  if(lines.length < 2) return [];
  const header = lines[0].split(/,(?=(?:[^"]*"[^"]*")*(?![^"]*"))/).map(h=>h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const line = lines[i];
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*(?![^"]*"))/).map(c=>c.trim().replace(/^"|"$/g,''));
    const obj = {};
    for(let j=0;j<header.length;j++){
      const key = header[j] || `col${j}`;
      obj[key] = cols[j] || '';
    }
    // Normalize keys to lowercase english equivalents used by render
    const mapped = {
      date: obj['Date'] || obj['date'] || '',
      target: obj['Target'] || obj['target'] || '',
      station: obj['Station'] || '',
      instrument: obj['Instrument'] || '',
      filter: obj['Filter'] || '',
      notes: obj['Notes'] || '',
      etd: obj['ETD'] || obj['etd'] || '',
      aavso: obj['AAVSO'] || obj['aavso'] || '',
      exoclock: obj['ExoClock'] || obj['exoclock'] || '',
      databases: obj['Databases'] || ''
    };
    // Backward-compat: if old Databases column present and individual cols empty, split it
    if(mapped.databases && !(mapped.etd || mapped.aavso || mapped.exoclock)){
      const parts = (mapped.databases||'').split(/[|;]/).map(s=>s.trim());
      mapped.etd = mapped.etd || parts[0] || '';
      mapped.aavso = mapped.aavso || parts[1] || '';
      mapped.exoclock = mapped.exoclock || parts[2] || '';
    }
    rows.push(mapped);
  }
  return rows;
}

function parseCSVGeneric(text){
  const lines = text.replace(/\r\n/g,'\n').split('\n').filter(Boolean);
  if(lines.length < 2) return [];
  const header = lines[0].split(/,(?=(?:[^"']*"[^"']*")*(?![^"']*"))/).map(h=>h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(/,(?=(?:[^"']*"[^"']*")*(?![^"']*"))/).map(c=>c.trim().replace(/^"|"$/g,''));
    const obj = {};
    for(let j=0;j<header.length;j++){
      obj[header[j]] = cols[j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

async function loadLinksCSV(){
  try{
    const res = await fetch('links.csv');
    if(!res.ok) throw new Error('CSV load failed');
    const txt = await res.text();
    linksData = parseCSVGeneric(txt);
    renderLinksGrouped(linksData);
  }catch(err){
    console.error(err);
    const containers = ['links-associations','links-databases','links-readings','links-campaigns','links-software','links-tools'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.innerHTML = '<div class="note">Error cargando links.csv — revisa la consola.</div>';
    });
  }
}

function renderLinksGrouped(list){
  const groups = {
    associations: document.getElementById('links-associations'),
    databases: document.getElementById('links-databases'),
    readings: document.getElementById('links-readings'),
    campaigns: document.getElementById('links-campaigns'),
    software: document.getElementById('links-software'),
    tools: document.getElementById('links-tools')
  };

  for(const key in groups){
    if(!groups[key]) continue;
    groups[key].innerHTML = '';
  }

  if(!list || !list.length){
    for(const key in groups){
      if(groups[key]) groups[key].innerHTML = '<div class="note">No se encontraron links en links.csv.</div>';
    }
    return;
  }

  const categoryMap = {
    'associations': groups.associations,
    'databases': groups.databases,
    'readings': groups.readings,
    'campaigns': groups.campaigns,
    'software': groups.software,
    'tools': groups.tools
  };

  const itemsByCategory = {};
  for(const item of list){
    const catRaw = item['Category'] || item['category'] || '';
    const cat = catRaw.toLowerCase().trim();
    if(!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat].push(item);
  }

  for(const cat in categoryMap){
    const container = categoryMap[cat];
    const items = itemsByCategory[cat] || [];
    if(!items.length){
      container.innerHTML = '<div class="note">Sin enlaces en esta categoría.</div>';
      continue;
    }

    const ul = document.createElement('ul');
    ul.className = 'footer links'; // Le asignamos la clase que ahora tiene el grid
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';

    for(const item of items){
      const description = item['Description'] || item['description'] || '';
      const link = item['Link'] || item['link'] || '';
      const li = document.createElement('li');
      li.style.marginBottom = '8px';
      if(link.trim()){
        const safeLink = escapeHtml(link.trim());
        const safeDescription = escapeHtml(description || link.trim());
        li.innerHTML = `<a class="link" href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeDescription}</a>`;
      } else {
        li.textContent = description || 'Link sin URL';
      }
      ul.appendChild(li);
    }

    container.appendChild(ul);
  }
}

async function loadObservationsCSV(){
  try{
    const res = await fetch('observations.csv');
    if(!res.ok) throw new Error('CSV load failed');
    const txt = await res.text();
    observationsData = parseCSV(txt);
    renderObservations(observationsData);
  }catch(err){
    console.error(err);
    const container = document.getElementById('obs-container');
    if(container) container.innerHTML = '<div class="note">Error cargando observations.csv — revisa la consola.</div>';
  }
}

/* --- Render observations: responsive table on wide, stacked cards on narrow --- */
function updateCollapseState(){
  const isPhone = window.matchMedia('(max-width:680px)').matches;
  document.querySelectorAll('.collapsible').forEach(section => {
    const toggle = section.querySelector('.collapsible-toggle');
    if(!toggle) return;
    const label = toggle.querySelector('.toggle-label');
    if(isPhone){
      section.classList.remove('expanded');
      toggle.setAttribute('aria-expanded','false');
      if(label) label.textContent = 'Show';
    } else {
      section.classList.add('expanded');
      toggle.setAttribute('aria-expanded','true');
      if(label) label.textContent = 'Hide';
    }
  });
}

function setupCollapsibleSections(){
  document.querySelectorAll('.collapsible').forEach(section => {
    const toggle = section.querySelector('.collapsible-toggle');
    if(!toggle) return;
    toggle.addEventListener('click', () => {
      const expanded = !section.classList.contains('expanded');
      section.classList.toggle('expanded', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      const label = toggle.querySelector('.toggle-label');
      if(label) label.textContent = expanded ? 'Hide' : 'Show';
    });
  });
}

function renderObservations(list){
  const container = document.getElementById('obs-container');
  container.innerHTML = '';
  if(!list || !list.length){
    container.innerHTML = '<div class="note">No observations yet — add entries to the array at the top of the file.</div>';
    return;
  }

  // Detect narrow screens (Phones)
  const isNarrow = window.matchMedia('(max-width:520px)').matches;
  
  if(!isNarrow){
    // --- VIEW FOR DESKTOP/TABLET (Full Table) ---
    const table = document.createElement('table');
    table.className = 'obs';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Date</th><th>Target</th><th>Station</th><th>Instrument</th><th>Filter</th><th>Notes</th><th>Databases</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for(const o of list){
      const tr = document.createElement('tr');
      const dbLinksHtml = makeDbLinksFromCols(o.etd, o.aavso, o.exoclock, o.target);
      tr.innerHTML = `<td style="color:var(--muted);font-weight:600">${escapeHtml(o.date)}</td>
                      <td>${escapeHtml(o.target)}</td>
                      <td>${escapeHtml(o.station)}</td>
                      <td>${escapeHtml(o.instrument)}</td>
                      <td>${escapeHtml(o.filter)}</td>
                      <td>${escapeHtml(o.notes)}</td>
                      <td style="white-space:nowrap">${dbLinksHtml}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  } else {
    // --- VIEW FOR PHONES (Minimal Cards) ---
    const stack = document.createElement('div');
    stack.style.display = 'grid';
    stack.style.gap = '10px';
    for(const o of list){
      const c = document.createElement('div');
      c.className = 'card';
      c.style.padding = '10px';
      const dbLinksHtml = makeDbLinksFromCols(o.etd, o.aavso, o.exoclock, o.target);
      
      // Solo mostramos Target, Date y Links (y notas si existen)
      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-weight:700;color:var(--text)">${escapeHtml(o.target)}</div>
          <div style="color:var(--muted);font-size:0.95rem">${escapeHtml(o.date)}</div>
        </div>
        ${o.notes ? `<div style="color:var(--muted);margin-bottom:6px;font-size:0.9rem;">${escapeHtml(o.notes)}</div>` : ''}
        <div style="font-size:0.9rem;color:var(--muted);">${dbLinksHtml}</div>
      `;
      stack.appendChild(c);
    }
    container.appendChild(stack);
  }
}

function linkify(text, url){
  if(url && url.trim()){
    const safe = url.replace(/"/g,'');
    return `<a class="link" href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }
  return text;
}

function makeDbLinksFromCols(etdLink, aavsoLink, exoclockLink, target){
  // If a specific URL is provided for a database column, render it as a link.
  // If the CSV cell is empty, do not invent a search URL — show plain text instead.
  const make = (label, url) => {
    if(url && url.trim()){
      return `<a class="link" href="${escapeHtml(url.trim())}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    return label;
  };
  return `${make('ETD', etdLink)} · ${make('AAVSO', aavsoLink)} · ${make('ExoClock', exoclockLink)}`;
}

function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

renderObservations(observationsData);
loadLinksCSV();
setupCollapsibleSections();
updateCollapseState();
window.addEventListener('resize', () => {
  renderObservations(observationsData);
  updateCollapseState();
});

/* --- Starfield canvas: subtle twinkle, respects reduced motion --- */
(function(){
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d', {alpha:true});
  let w = canvas.width = innerWidth;
  let h = canvas.height = innerHeight;
  const stars = [];
  //dividir por 8000 para más estrellas, o por 20000 para menos; original era 12000
  const STAR_COUNT = Math.round((w*h)/4000); // scale with area

  function rand(min,max){ return Math.random()*(max-min)+min; }

  function init(){
    stars.length = 0;
    for(let i=0;i<STAR_COUNT;i++){
      stars.push({
        x: rand(0,w),
        y: rand(0,h),
        r: rand(0.3,1.6),
        baseA: rand(0.05,0.9),
        twinkle: rand(0.002,0.01),
        phase: Math.random()*Math.PI*2,
        hue: rand(180,210)
      });
    }
  }

  let last = performance.now();
  function draw(now){
    const dt = Math.min(40, now - last);
    last = now;
    ctx.clearRect(0,0,w,h);
    // faint gradient near horizon
    const g = ctx.createLinearGradient(0,h*0.6,w,h);
    g.addColorStop(0, 'rgba(7,14,34,0.00)');
    g.addColorStop(1, 'rgba(2,6,12,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    for(const s of stars){
      const a = s.baseA + Math.sin(s.phase + now*s.twinkle*0.001)*0.35*s.baseA;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue},20%,90%,${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
      // small glow
      if(s.r>1.0){
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue},30%,80%,${a*0.08})`;
        ctx.arc(s.x, s.y, s.r*3, 0, Math.PI*2);
        ctx.fill();
      }
      s.phase += (s.twinkle*dt*0.06);
    }
    if(!prefersReducedMotion()) requestAnimationFrame(draw);
  }

  function resize(){
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    init();
    renderObservations(observationsData);
  }
  function prefersReducedMotion(){
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.addEventListener('resize', resize);
  init();
  if(!prefersReducedMotion()) requestAnimationFrame(draw);
})();

/* Small accessible enhancements: focusable activity cards for keyboard users */
document.querySelectorAll('.activity').forEach((el)=> el.setAttribute('tabindex','0'));

// Load CSV at startup
loadObservationsCSV();
