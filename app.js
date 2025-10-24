
/* StarCars Full app.js
 - Shared reg autocompletion across tabs
 - Desktop: offline; Cloud builder available in /builder to make EXE
*/
const DBK = 'starcars_full_db_v1';
const emptyDB = { company:{name:'Star Cars London Ltd', vat:''}, logo:null, dvlaKey:'', vehicles:[], expenses:[], sales:[], statusHistory:[] };
let db = JSON.parse(localStorage.getItem(DBK) || 'null') || emptyDB;
function save(){ localStorage.setItem(DBK, JSON.stringify(db)); render(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function money(n){ return '£'+(Number(n||0).toFixed(2)); }

const tabs = ['Dashboard','Vehicles','Expenses','Sales','Reports','Settings'];
let active = localStorage.getItem('starcars_tab') || 'Dashboard';

const tabsEl = document.getElementById('tabs');
tabs.forEach(t=>{ const b = document.createElement('button'); b.textContent=t; b.className = t===active? 'active':''; b.onclick=()=>{ active=t; localStorage.setItem('starcars_tab',t); render(); }; tabsEl.appendChild(b); });

function render(){
  document.querySelectorAll('#tabs button').forEach(b=> b.classList.toggle('active', b.textContent===active));
  const main = document.getElementById('main'); main.innerHTML='';
  if(active==='Dashboard') main.appendChild(viewDashboard());
  if(active==='Vehicles') main.appendChild(viewVehicles());
  if(active==='Expenses') main.appendChild(viewExpenses());
  if(active==='Sales') main.appendChild(viewSales());
  if(active==='Reports') main.appendChild(viewReports());
  if(active==='Settings') main.appendChild(viewSettings());
  // logo box
  const lb = document.getElementById('logoBox'); if(db.logo){ lb.style.backgroundImage = `url(${db.logo})`; lb.textContent=''; } else lb.textContent='SC';
}

/* Dashboard */
function viewDashboard(){ const c = document.createElement('div'); c.className='card'; c.innerHTML=`<h2>Dashboard</h2><p class="small">Vehicles: ${db.vehicles.length} • Expenses: ${db.expenses.length} • Sales: ${db.sales.length}</p><label>Quick search reg: <input id="dash_search" placeholder="Type reg"></label>`; setTimeout(()=>{ document.getElementById('dash_search').addEventListener('input', (e)=>{ const q = e.target.value.trim().toLowerCase(); if(!q) return; const match = db.vehicles.find(v=> v.reg.toLowerCase().startsWith(q)); if(match){ active='Vehicles'; localStorage.setItem('starcars_tab','Vehicles'); render(); setTimeout(()=>{ document.getElementById('searchReg').value = match.reg; document.getElementById('searchReg').dispatchEvent(new Event('input')); }, 200); } }); }, 100); return c; }

/* Vehicles */
function viewVehicles(){
  const wrap = document.createElement('div'); wrap.className='card';
  const form = document.createElement('div');
  form.innerHTML = `<h3>Add vehicle</h3>
    <label>Registration (type to search) <input id="v_reg" class="reg-input" placeholder="AB12 CDE"></label>
    <label>Make <input id="v_make"></label>
    <label>Model <input id="v_model"></label>
    <label>Mileage <input id="v_mileage" type="number"></label>
    <label>Fuel <input id="v_fuel"></label>
    <label>Purchase (£) <input id="v_purchase" type="number"></label>
    <label>Status <select id="v_status"><option>For Sale</option><option>Sold</option><option>Auction</option><option>Returned</option><option>Reserved</option></select></label>
    <div style="margin-top:8px"><button id="addV">Add Vehicle</button> <button id="dvlaBtn">DVLA Lookup</button></div>
    <p class="small">Tip: start typing reg to autocomplete from existing stock</p>`;
  wrap.appendChild(form);

  // Wire inputs: register event for reg autocompletion & auto-fill from matched vehicle
  wrap.querySelectorAll('.reg-input').forEach(inp=>{
    inp.addEventListener('input', onRegInput);
    inp.addEventListener('blur', onRegBlur);
  });
  function onRegInput(e){
    const q = e.target.value.trim().toLowerCase();
    const match = db.vehicles.find(v=> v.reg.toLowerCase().startsWith(q));
    if(match){
      // auto-fill fields
      document.getElementById('v_make').value = match.make || '';
      document.getElementById('v_model').value = match.model || '';
      document.getElementById('v_mileage').value = match.mileage || '';
      document.getElementById('v_fuel').value = match.fuel || '';
      document.getElementById('v_purchase').value = match.purchase || '';
      document.getElementById('v_status').value = match.status || 'For Sale';
    }
  }
  function onRegBlur(e){ /* keep as-is */ }

  wrap.querySelector('#addV').onclick = ()=>{
    const reg = document.getElementById('v_reg').value.trim().toUpperCase();
    if(!reg){ alert('Reg required'); return; }
    const v = { id: uid(), reg, make: document.getElementById('v_make').value, model: document.getElementById('v_model').value,
      mileage: document.getElementById('v_mileage').value, fuel: document.getElementById('v_fuel').value, purchase: Number(document.getElementById('v_purchase').value||0),
      status: document.getElementById('v_status').value || 'For Sale', history: [] };
    db.vehicles.unshift(v); save();
  };

  wrap.querySelector('#dvlaBtn').onclick = async ()=>{
    const reg = document.getElementById('v_reg').value.trim().toUpperCase();
    if(!reg) return alert('Enter reg first');
    if(!db.dvlaKey) return alert('DVLA key not set yet (Settings)');
    try{
      const res = await fetch('/api/dvla/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({reg})});
      const data = await res.json();
      if(data.error) return alert('DVLA: '+(data.detail||data.error));
      document.getElementById('v_make').value = data.make || '';
      document.getElementById('v_model').value = data.model || '';
      document.getElementById('v_fuel').value = data.fuelType || data.fuel || '';
    }catch(e){ alert('Lookup failed'); }
  };

  // List existing vehicles with quick search box
  const listWrap = document.createElement('div'); listWrap.style.marginTop='12px';
  listWrap.innerHTML = `<h3>Inventory</h3><input id="searchReg" placeholder="Search by reg or model" style="width:60%"><table class="table"><thead><tr><th>Reg</th><th>Make/Model</th><th>Purchase</th><th>Status</th><th>Actions</th></tr></thead><tbody id="vehBody"></tbody></table>`;
  wrap.appendChild(listWrap);

  listWrap.querySelector('#searchReg').addEventListener('input', ()=> fillList(listWrap.querySelector('#searchReg').value.trim().toLowerCase()));
  fillList('');
  function fillList(q){
    const tbody = listWrap.querySelector('#vehBody'); tbody.innerHTML='';
    db.vehicles.filter(v=> !q || v.reg.toLowerCase().includes(q) || (v.make+' '+(v.model||'')).toLowerCase().includes(q)).forEach(v=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${v.reg}</td><td>${v.make||''} ${v.model||''}</td><td>${money(v.purchase)}</td><td>${v.status||''}</td><td></td>`;
      const td = tr.children[4];
      const btnS = document.createElement('button'); btnS.textContent='Change Status'; btnS.onclick=()=> changeStatus(v);
      const btnH = document.createElement('button'); btnH.textContent='History'; btnH.onclick=()=> showHistory(v);
      td.appendChild(btnS); td.appendChild(btnH);
      tbody.appendChild(tr);
    });
  }

  return wrap;
}

/* Expenses */
function viewExpenses(){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `<h3>Expenses</h3>
    <label>Vehicle search (type reg to auto-select) <input id="exp_reg" class="reg-input"></label>
    <label>Date <input id="exp_date" type="date"></label>
    <label>Type <input id="exp_type"></label>
    <label>Supplier <input id="exp_sup"></label>
    <label>Amount <input id="exp_amt" type="number"></label>
    <div style="margin-top:6px"><button id="addExp">Add Expense</button> <button id="totExp">Total for Reg</button></div>
    <div id="expList" style="margin-top:10px"></div>`;

  wrap.querySelectorAll('.reg-input').forEach(i=> i.addEventListener('input', onExpReg));
  function onExpReg(e){
    const q = e.target.value.trim().toLowerCase();
    const match = db.vehicles.find(v=> v.reg.toLowerCase().startsWith(q));
    if(match){ e.target.dataset.vid = match.id; }
    else e.target.dataset.vid = '';
  }
  wrap.querySelector('#addExp').onclick = ()=>{
    const vid = wrap.querySelector('#exp_reg').dataset.vid || null;
    const exp = { id: uid(), date: wrap.querySelector('#exp_date').value, vehicleId: vid, type: wrap.querySelector('#exp_type').value, supplier: wrap.querySelector('#exp_sup').value, amount: Number(wrap.querySelector('#exp_amt').value||0) };
    db.expenses.unshift(exp); save();
  };
  wrap.querySelector('#totExp').onclick = ()=>{
    const q = wrap.querySelector('#exp_reg').value.trim().toLowerCase();
    const v = db.vehicles.find(x=> x.reg.toLowerCase()===q);
    if(!v) return alert('No exact vehicle match for total');
    const tot = db.expenses.filter(e=> e.vehicleId===v.id).reduce((s,x)=> s+(+x.amount||0),0);
    alert('Total expenses for '+v.reg+': '+money(tot));
  };

  renderExpenseList();
  function renderExpenseList(){
    const div = wrap.querySelector('#expList'); div.innerHTML='';
    if(db.expenses.length===0) return div.appendChild(document.createTextNode('No expenses yet'));
    const table = document.createElement('table'); table.className='table'; table.innerHTML='<thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Supplier</th><th>Amount</th></tr></thead>';
    const tb = document.createElement('tbody');
    db.expenses.forEach(e=>{
      const v = db.vehicles.find(x=> x.id===e.vehicleId);
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${e.date||''}</td><td>${v? v.reg:'Showroom'}</td><td>${e.type||''}</td><td>${e.supplier||''}</td><td>${money(e.amount)}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb); div.appendChild(table);
  }
  return wrap;
}

/* Sales */
function viewSales(){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `<h3>Sales</h3><button id="newSale">Record Sale</button><div id="salesList" style="margin-top:10px"></div>`;
  wrap.querySelector('#newSale').onclick = recordSale;
  renderSalesList();
  function renderSalesList(){
    const div = wrap.querySelector('#salesList'); div.innerHTML='';
    if(db.sales.length===0) return div.appendChild(document.createTextNode('No sales yet'));
    const table = document.createElement('table'); table.className='table'; table.innerHTML='<thead><tr><th>Date</th><th>Reg</th><th>Buyer</th><th>Sale</th><th>Invoice</th></tr></thead>';
    const tb = document.createElement('tbody');
    db.sales.forEach(s=>{
      const v = db.vehicles.find(x=> x.id===s.vehicleId);
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${s.date||''}</td><td>${v? v.reg:''}</td><td>${s.buyer||''}</td><td>${money(s.salePrice)}</td><td></td>`;
      const btn = document.createElement('button'); btn.textContent='Print'; btn.onclick=()=> printInvoice(s);
      tr.children[4].appendChild(btn); tb.appendChild(tr);
    });
    table.appendChild(tb); div.appendChild(table);
  }
  return wrap;
}

function recordSale(){
  const reg = prompt('Vehicle reg (exact)')||'';
  const v = db.vehicles.find(x=> x.reg===reg.toUpperCase());
  const salePrice = Number(prompt('Sale price')||0); const buyer = prompt('Buyer name')||'';
  const pxVal = Number(prompt('Part-ex valuation (0 if none)')||0); const cash = Number(prompt('Cash paid')||0);
  const card = Number(prompt('Card paid')||0); const finance = Number(prompt('Finance paid')||0);
  const date = new Date().toISOString().slice(0,10);
  const sale = { id: uid(), vehicleId: v? v.id:null, date, buyer, salePrice, partExchange:{valuation:pxVal}, payment:{cash,card,finance}, invoiceNo: 'SC'+Math.floor(Math.random()*90000+10000) };
  db.sales.unshift(sale); if(v){ const from=v.status; v.status='Sold'; db.statusHistory.unshift({id:uid(),vehicleId:v.id,from,to:'Sold',at:new Date().toISOString()}); }
  save(); printInvoice(sale);
}

/* Reports */
function viewReports(){
  const wrap = document.createElement('div'); wrap.className='card'; wrap.innerHTML = `<h3>Reports</h3><button id="expCSV">Export Expenses CSV</button> <button id="invCSV">Export Inventory CSV</button> <button id="salesCSV">Export Sales CSV</button>`;
  wrap.querySelector('#expCSV').onclick = ()=> downloadCSV('expenses.csv',['date','vehicleReg','type','supplier','amount'], db.expenses.map(e=>{ const v=db.vehicles.find(x=> x.id===e.vehicleId); return [e.date, v? v.reg:'Showroom', e.type, e.supplier, e.amount]; }));
  wrap.querySelector('#invCSV').onclick = ()=> downloadCSV('inventory.csv',['reg','make','model','mileage','purchase','status'], db.vehicles.map(v=>[v.reg,v.make,v.model,v.mileage,v.purchase,v.status]));
  wrap.querySelector('#salesCSV').onclick = ()=> downloadCSV('sales.csv',['date','reg','buyer','sale','px','cash','card','finance'], db.sales.map(s=>{ const v=db.vehicles.find(x=> x.id===s.vehicleId); return [s.date, v? v.reg:'', s.buyer, s.salePrice, s.partExchange?.valuation||0, s.payment?.cash||0, s.payment?.card||0, s.payment?.finance||0]; }));
  return wrap;
}

/* Settings */
function viewSettings(){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `<h3>Settings</h3>
    <label>Company name <input id="s_name"></label>
    <label>VAT <input id="s_vat"></label>
    <label>Logo (PNG/JPG) <input id="s_logo" type="file"></label>
    <label>DVLA API key (paste when available) <input id="s_dvla"></label>
    <label>Invoice T&C (editable)<textarea id="s_terms" rows="4" style="width:100%"></textarea></label>
    <div style="margin-top:8px"><button id="saveSettings">Save</button></div>`;
  wrap.querySelector('#s_name').value = db.company.name || '';
  wrap.querySelector('#s_vat').value = db.company.vat || '';
  wrap.querySelector('#s_terms').value = localStorage.getItem('starcars_terms') || 'Payment due within 7 days.';
  wrap.querySelector('#s_logo').addEventListener('change', function(e){ const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = ()=>{ db.logo = r.result; save(); alert('Logo uploaded'); }; r.readAsDataURL(f); });
  wrap.querySelector('#saveSettings').onclick = ()=>{ db.company.name = wrap.querySelector('#s_name').value; db.company.vat = wrap.querySelector('#s_vat').value; db.dvlaKey = wrap.querySelector('#s_dvla').value.trim(); localStorage.setItem('starcars_terms', wrap.querySelector('#s_terms').value); save(); alert('Saved'); };
  // restore button
  const restore = document.createElement('button'); restore.textContent='Restore JSON'; restore.onclick = ()=> restoreJSON(); wrap.appendChild(restore);
  return wrap;
}

/* Invoice printing (includes reg, adjustable logo size and T&C) */
function printInvoice(sale){
  const v = db.vehicles.find(x=> x.id===sale.vehicleId) || {};
  const company = db.company || {};
  const terms = localStorage.getItem('starcars_terms') || 'Payment due within 7 days.';
  const logoHtml = db.logo ? `<img src="${db.logo}" style="height:80px" id="invLogo">` : '<div style="width:80px;height:80px;background:#ccc;display:inline-block"></div>';
  const expenses = db.expenses.filter(e=> e.vehicleId===sale.vehicleId).reduce((a,b)=> a+(+b.amount||0),0);
  const purchase = v.purchase||0; const profit = (sale.salePrice||0) - purchase - expenses;
  const html = `
  <html><head><meta charset="utf-8"><title>Invoice ${sale.invoiceNo}</title><style>body{font-family:Arial;padding:20px;color:#222} header{display:flex;justify-content:center;align-items:center;flex-direction:column} #invLogo{max-height:140px} table{width:100%;border-collapse:collapse;margin-top:12px} td,th{padding:8px;border:1px solid #ddd}</style></head><body>
    <header>${logoHtml}<h2>${company.name||'Star Cars'}</h2><div>${company.address||''}</div><div>VAT: ${company.vat||''}</div></header>
    <hr/>
    <h3>Invoice: ${sale.invoiceNo}</h3>
    <div><strong>Buyer:</strong> ${sale.buyer||''} • <strong>Date:</strong> ${sale.date||''}</div>
    <h4>Vehicle</h4>
    <div>Reg: ${v.reg||''} • ${v.make||''} ${v.model||''} • Mileage: ${v.mileage||''} • Fuel: ${v.fuel||''}</div>
    <table><tr><td>Sale Price</td><td style="text-align:right">£${Number(sale.salePrice||0).toFixed(2)}</td></tr>
      <tr><td>Part-Exchange</td><td style="text-align:right">£${Number(sale.partExchange?.valuation||0).toFixed(2)}</td></tr>
      <tr><td><strong>Net</strong></td><td style="text-align:right"><strong>£${(sale.salePrice - (sale.partExchange?.valuation||0)).toFixed(2)}</strong></td></tr>
    </table>
    <h4>Payments</h4>
    <div>Cash: £${Number(sale.payment?.cash||0).toFixed(2)} • Card: £${Number(sale.payment?.card||0).toFixed(2)} • Finance: £${Number(sale.payment?.finance||0).toFixed(2)}</div>
    <hr/>
    <div style="margin-top:12px"><strong>Terms & Conditions</strong><div>${terms.replace(/\n/g,'<br>')}</div></div>
  </body></html>`;
  const f = document.getElementById('printFrame'); f.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); f.onload = ()=> f.contentWindow.print();
}

/* Helpers */
function changeStatus(v){ const n = prompt('New status', v.status||'For Sale'); if(n){ const from=v.status; v.status=n; db.statusHistory.unshift({id:uid(),vehicleId:v.id,from,to:n,at:new Date().toISOString()}); save(); } }
function showHistory(v){ const list = db.statusHistory.filter(h=> h.vehicleId===v.id); alert(list.map(l=> new Date(l.at).toLocaleString()+' '+(l.from||'')+'→'+(l.to||'')).join('\n')); }
function downloadCSV(name, header, rows){ const csv = [header.join(',')].concat(rows.map(r=> r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(','))).join('\r\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=name; a.click(); }
function downloadFile(name, data, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type})); a.download=name; a.click(); }
function backupJSON(){ downloadFile('starcars-backup.json', JSON.stringify(db,null,2), 'application/json'); }
function exportAllCSV(){ downloadCSV('vehicles.csv',['reg','make','model','mileage','purchase','status'], db.vehicles.map(v=>[v.reg,v.make,v.model,v.mileage,v.purchase,v.status])); backupJSON(); }
function restoreJSON(){ const f = document.createElement('input'); f.type='file'; f.accept='.json'; f.onchange = ()=>{ const file = f.files[0]; const r = new FileReader(); r.onload = ()=>{ try{ db = JSON.parse(r.result); save(); alert('Restored'); }catch(e){ alert('Invalid file'); } }; r.readAsText(file); }; f.click(); }

/* render on load */
render();
