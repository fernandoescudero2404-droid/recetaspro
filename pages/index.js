import { useState, useEffect, useCallback, useRef } from 'react';

const today = () => new Date().toISOString().split('T')[0];
const mondayOfWeek = () => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().split('T')[0]; };
const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };
const fmtDate = iso => { if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
const fmtNum = (n,dec=3) => parseFloat(n||0).toFixed(dec);

function getToken(){ return typeof window!=='undefined'?localStorage.getItem('rp_token'):null; }
async function apiFetch(path,opts={}){
  const token=getToken();
  const res=await fetch('/api'+path,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...(opts.headers||{})},body:opts.body?JSON.stringify(opts.body):undefined});
  if(!res.ok){const e=await res.json().catch(()=>({error:'Error'}));throw new Error(e.error||`HTTP ${res.status}`);}
  return res.json();
}
const api={
  login:(u,p)=>apiFetch('/auth/login',{method:'POST',body:{username:u,password:p}}),
  getProductos:()=>apiFetch('/productos'),
  createProducto:d=>apiFetch('/productos',{method:'POST',body:d}),
  updateProducto:(id,d)=>apiFetch(`/productos/${id}`,{method:'PUT',body:d}),
  deleteProducto:id=>apiFetch(`/productos/${id}`,{method:'DELETE'}),
  getIntermedias:()=>apiFetch('/intermedias'),
  createIntermedia:d=>apiFetch('/intermedias',{method:'POST',body:d}),
  updateIntermedia:(id,d)=>apiFetch(`/intermedias/${id}`,{method:'PUT',body:d}),
  deleteIntermedia:id=>apiFetch(`/intermedias/${id}`,{method:'DELETE'}),
  getFinales:()=>apiFetch('/finales'),
  createFinal:d=>apiFetch('/finales',{method:'POST',body:d}),
  updateFinal:(id,d)=>apiFetch(`/finales/${id}`,{method:'PUT',body:d}),
  deleteFinal:id=>apiFetch(`/finales/${id}`,{method:'DELETE'}),
  getVentas:p=>apiFetch('/ventas'+(p?.desde?`?desde=${p.desde}&hasta=${p.hasta}`:'')),
  createVenta:d=>apiFetch('/ventas',{method:'POST',body:d}),
  deleteVenta:id=>apiFetch(`/ventas/${id}`,{method:'DELETE'}),
  getStocks:()=>apiFetch('/stocks'),
  createStock:d=>apiFetch('/stocks',{method:'POST',body:d}),
  deleteStock:id=>apiFetch(`/stocks/${id}`,{method:'DELETE'}),
  getEntregas:p=>apiFetch('/entregas'+(p?.desde?`?desde=${p.desde}&hasta=${p.hasta}`:'')),
  createEntrega:d=>apiFetch('/entregas',{method:'POST',body:d}),
  deleteEntrega:id=>apiFetch(`/entregas/${id}`,{method:'DELETE'}),
  getConsumo:(desde,hasta)=>apiFetch(`/consumo?desde=${desde}&hasta=${hasta}`),
  getStockConfig:()=>apiFetch('/stock-publico/config'),
  generarToken:()=>apiFetch('/stock-publico/config',{method:'POST',body:{action:'generar_token'}}),
  saveStockConfig:productos=>apiFetch('/stock-publico/config',{method:'PUT',body:{productos}}),
};

function Modal({title,onClose,children,wide}){
  return(<div className="modal-bg open" onClick={e=>e.target.classList.contains('modal-bg')&&onClose()}>
    <div className="modal" style={wide?{maxWidth:680}:{}}><div className="modal-header"><h3>{title}</h3><button className="close-btn" onClick={onClose}>×</button></div>{children}</div>
  </div>);
}

function BuscadorPlato({finales,onChange}){
  const[query,setQuery]=useState('');const[open,setOpen]=useState(false);const[cursor,setCursor]=useState(0);const ref=useRef(null);
  const filtered=finales.filter(p=>p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0,12);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const select=p=>{onChange(p);setQuery(p.nombre);setOpen(false);};
  const handleKey=e=>{if(!open)return;if(e.key==='ArrowDown'){e.preventDefault();setCursor(c=>Math.min(c+1,filtered.length-1));}if(e.key==='ArrowUp'){e.preventDefault();setCursor(c=>Math.max(c-1,0));}if(e.key==='Enter'&&filtered[cursor]){e.preventDefault();select(filtered[cursor]);}if(e.key==='Escape')setOpen(false);};
  return(<div ref={ref} style={{position:'relative',flex:2,minWidth:200}}>
    <div className="form-field"><label>Plato</label>
      <input value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);setCursor(0);onChange(null);}} onFocus={()=>setOpen(true)} onKeyDown={handleKey} placeholder="Escribí para buscar..." autoComplete="off"/>
    </div>
    {open&&filtered.length>0&&(<div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',boxShadow:'0 4px 12px rgba(0,0,0,.12)',zIndex:50,maxHeight:280,overflowY:'auto'}}>
      {filtered.map((p,i)=>(<div key={p.id} onMouseDown={()=>select(p)} style={{padding:'7px 12px',fontSize:13,cursor:'pointer',background:i===cursor?'var(--bg3)':'transparent',borderBottom:'1px solid var(--border)'}} onMouseEnter={()=>setCursor(i)}>{p.nombre}</div>))}
    </div>)}
  </div>);
}

function IngRow({ing,idx,productos,intermedias,finales,onChange,onRemove,allowFinal}){
  return(<div className="ing-row">
    <div className="form-field" style={{flex:2,minWidth:160}}><label style={{fontSize:11}}>Ingrediente</label>
      <select value={`${ing.tipo}:${ing.ref_id}`} onChange={e=>{const[tipo,ref_id]=e.target.value.split(':');onChange(idx,{...ing,tipo,ref_id:parseInt(ref_id)});}}>
        <option value=":">— Seleccioná —</option>
        <optgroup label="Productos brutos">{productos.map(p=><option key={p.id} value={`producto:${p.id}`}>{p.nombre}</option>)}</optgroup>
        {intermedias.length>0&&<optgroup label="Recetas intermedias">{intermedias.map(r=><option key={r.id} value={`intermedia:${r.id}`}>{r.nombre}</option>)}</optgroup>}
        {allowFinal&&finales?.length>0&&<optgroup label="Platos finales">{finales.map(r=><option key={r.id} value={`final:${r.id}`}>{r.nombre}</option>)}</optgroup>}
      </select>
    </div>
    <div className="form-field" style={{minWidth:80}}><label style={{fontSize:11}}>Cantidad</label><input type="number" min="0" step="0.001" value={ing.cantidad} onChange={e=>onChange(idx,{...ing,cantidad:e.target.value})}/></div>
    <div className="form-field" style={{minWidth:70}}><label style={{fontSize:11}}>Unidad</label>
      <select value={ing.unidad} onChange={e=>onChange(idx,{...ing,unidad:e.target.value})}>{['kg','g','unidad','litro','ml','porcion','grs','lts','und','roll'].map(u=><option key={u}>{u}</option>)}</select>
    </div>
    <button className="btn btn-sm btn-danger" onClick={()=>onRemove(idx)} style={{marginBottom:1}}>×</button>
  </div>);
}

// ── PRODUCTOS ────────────────────────────────────────────
function Productos({data,onRefresh}){
  const[modal,setModal]=useState(false);const[editing,setEditing]=useState(null);
  const[form,setForm]=useState({nombre:'',unidad:'kg',merma:'',notas:''});
  const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[search,setSearch]=useState('');
  const openNew=()=>{setEditing(null);setForm({nombre:'',unidad:'kg',merma:'',notas:''});setError('');setModal(true);};
  const openEdit=p=>{setEditing(p);setForm({nombre:p.nombre,unidad:p.unidad,merma:p.merma,notas:p.notas||''});setError('');setModal(true);};
  const save=async()=>{if(!form.nombre.trim()){setError('Ingresá el nombre');return;}setLoading(true);setError('');
    try{if(editing)await api.updateProducto(editing.id,{...form,merma:parseFloat(form.merma)||0});else await api.createProducto({...form,merma:parseFloat(form.merma)||0});setModal(false);onRefresh();}catch(e){setError(e.message);}setLoading(false);};
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteProducto(id);onRefresh();};
  const filtered=data.filter(p=>p.nombre.toLowerCase().includes(search.toLowerCase()));
  return(<div className="page active">
    <div className="page-header"><h2>Productos brutos</h2><p>Materia prima con merma por procesado o descongelado</p></div>
    <div className="card"><div className="card-title"><span>Productos ({filtered.length})</span>
      <div style={{display:'flex',gap:8}}><input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/><button className="btn btn-sm" onClick={openNew}>+ Nuevo</button></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Unidad</th><th>Merma</th><th>Rendimiento</th><th></th></tr></thead>
    <tbody>{!filtered.length&&<tr><td colSpan={6}><div className="empty-state"><div className="icon">📦</div><p>Sin resultados.</p></div></td></tr>}
      {filtered.map(p=>(<tr key={p.id}>
        <td><span className="badge badge-gray" style={{fontSize:10}}>{p.notas||'—'}</span></td>
        <td><strong>{p.nombre}</strong></td><td>{p.unidad}</td>
        <td><span className={`badge ${p.merma>30?'badge-amber':p.merma>15?'badge-blue':'badge-green'}`}>{p.merma}%</span></td>
        <td><div className="flex items-center gap-2"><span className="text-sm">{(100-p.merma).toFixed(0)}%</span><div className="progress-bar" style={{flex:1,minWidth:50}}><div className="progress-fill" style={{width:`${100-p.merma}%`,background:p.merma>30?'var(--warn)':p.merma>15?'var(--blue)':'var(--success)'}}/></div></div></td>
        <td style={{display:'flex',gap:4}}><button className="btn btn-sm" onClick={()=>openEdit(p)}>✏️</button><button className="btn btn-sm btn-danger" onClick={()=>del(p.id)}>🗑</button></td>
      </tr>))}
    </tbody></table></div></div>
    {modal&&(<Modal title={editing?'Editar producto':'Nuevo producto bruto'} onClose={()=>setModal(false)}>
      <div className="form-grid mb-1">
        <div className="form-field"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="ej: Langostino congelado"/></div>
        <div className="form-field"><label>Unidad</label><select value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})}>{['kg','g','unidad','litro','lts','grs','und','porcion'].map(u=><option key={u}>{u}</option>)}</select></div>
        <div className="form-field"><label>Merma (%)</label><input type="number" min="0" max="100" step="0.01" value={form.merma} onChange={e=>setForm({...form,merma:e.target.value})} placeholder="ej: 15.30"/></div>
        <div className="form-field"><label>SKU / Notas</label><input value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="ej: LANX"/></div>
      </div>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear producto'}</button>
    </Modal>)}
  </div>);
}

// ── INTERMEDIAS ──────────────────────────────────────────
function Intermedias({data,productos,onRefresh}){
  const[modal,setModal]=useState(false);const[editing,setEditing]=useState(null);
  const[form,setForm]=useState({nombre:'',rinde:''});const[ings,setIngs]=useState([]);
  const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[search,setSearch]=useState('');const[expanded,setExpanded]=useState(null);
  const openNew=()=>{setEditing(null);setForm({nombre:'',rinde:''});setIngs([]);setError('');setModal(true);};
  const openEdit=r=>{setEditing(r);setForm({nombre:r.nombre,rinde:r.rinde||''});setIngs((r.ingredientes||[]).map(i=>({tipo:i.tipo,ref_id:i.ref_id,cantidad:i.cantidad,unidad:i.unidad})));setError('');setModal(true);};
  const addIng=()=>setIngs([...ings,{tipo:'producto',ref_id:0,cantidad:'',unidad:'kg'}]);
  const updateIng=(i,v)=>{const a=[...ings];a[i]=v;setIngs(a);};const removeIng=i=>setIngs(ings.filter((_,idx)=>idx!==i));
  const resolveNombre=(tipo,ref_id)=>{if(tipo==='producto')return productos.find(p=>p.id===ref_id)?.nombre||'?';return data.find(r=>r.id===ref_id)?.nombre||'?';};
  const save=async()=>{if(!form.nombre.trim()){setError('Ingresá el nombre');return;}setLoading(true);setError('');
    try{const payload={...form,ingredientes:ings.map(i=>({...i,ref_id:parseInt(i.ref_id),cantidad:parseFloat(i.cantidad)||0}))};
      if(editing)await api.updateIntermedia(editing.id,payload);else await api.createIntermedia(payload);setModal(false);onRefresh();}catch(e){setError(e.message);}setLoading(false);};
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteIntermedia(id);onRefresh();};
  const filtered=data.filter(r=>r.nombre.toLowerCase().includes(search.toLowerCase()));
  return(<div className="page active">
    <div className="page-header"><h2>Recetas intermedias</h2><p>Preparaciones base a 1kg</p></div>
    <div className="card"><div className="card-title"><span>Intermedias ({filtered.length})</span>
      <div style={{display:'flex',gap:8}}><input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/><button className="btn btn-sm" onClick={openNew}>+ Nueva</button></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Rinde</th><th>Ingredientes</th><th></th></tr></thead>
    <tbody>{!filtered.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">🧪</div><p>Sin resultados.</p></div></td></tr>}
      {filtered.map(r=>(<>
        <tr key={r.id}><td><strong style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>{expanded===r.id?'▾':'▸'} {r.nombre}</strong></td>
          <td><span className="badge badge-gray">{r.rinde||'1 kg'}</span></td>
          <td><span className="text-sm">{(r.ingredientes||[]).length} ingredientes</span></td>
          <td style={{display:'flex',gap:4}}><button className="btn btn-sm" onClick={()=>openEdit(r)}>✏️</button><button className="btn btn-sm btn-danger" onClick={()=>del(r.id)}>🗑</button></td>
        </tr>
        {expanded===r.id&&(<tr key={`exp-${r.id}`}><td colSpan={4} style={{background:'var(--bg3)',padding:'8px 16px'}}>
          {(r.ingredientes||[]).map((ing,i)=>(<span key={i} className="tag">{ing.tipo==='intermedia'?'🧪':'📦'} {resolveNombre(ing.tipo,ing.ref_id)} — {fmtNum(ing.cantidad,4)} {ing.unidad}</span>))}
        </td></tr>)}
      </>))}
    </tbody></table></div></div>
    {modal&&(<Modal title={editing?'Editar receta':'Nueva receta intermedia'} onClose={()=>setModal(false)} wide>
      <div className="form-grid mb-1">
        <div className="form-field"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="ej: Vinagreta"/></div>
        <div className="form-field"><label>Rendimiento</label><input value={form.rinde} onChange={e=>setForm({...form,rinde:e.target.value})} placeholder="ej: 1 kg"/></div>
      </div>
      <div className="card-title" style={{fontSize:13}}>Ingredientes</div>
      {ings.map((ing,i)=><IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={data} finales={[]} onChange={updateIng} onRemove={removeIng} allowFinal={false}/>)}
      <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear receta'}</button>
    </Modal>)}
  </div>);
}

// ── FINALES ──────────────────────────────────────────────
function Finales({data,productos,intermedias,onRefresh}){
  const[modal,setModal]=useState(false);const[editing,setEditing]=useState(null);
  const[nombre,setNombre]=useState('');const[ings,setIngs]=useState([]);
  const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[search,setSearch]=useState('');const[expanded,setExpanded]=useState(null);
  const openNew=()=>{setEditing(null);setNombre('');setIngs([]);setError('');setModal(true);};
  const openEdit=r=>{setEditing(r);setNombre(r.nombre);setIngs((r.ingredientes||[]).map(i=>({tipo:i.tipo,ref_id:i.ref_id,cantidad:i.cantidad,unidad:i.unidad})));setError('');setModal(true);};
  const addIng=()=>setIngs([...ings,{tipo:'producto',ref_id:0,cantidad:'',unidad:'kg'}]);
  const updateIng=(i,v)=>{const a=[...ings];a[i]=v;setIngs(a);};const removeIng=i=>setIngs(ings.filter((_,idx)=>idx!==i));
  const resolveNombre=(tipo,ref_id)=>{if(tipo==='producto')return productos.find(p=>p.id===ref_id)?.nombre||'?';if(tipo==='intermedia')return intermedias.find(r=>r.id===ref_id)?.nombre||'?';return data.find(r=>r.id===ref_id)?.nombre||'?';};
  const tipoIcon=t=>t==='intermedia'?'🧪':t==='final'?'🍽️':'📦';
  const save=async()=>{if(!nombre.trim()){setError('Ingresá el nombre');return;}setLoading(true);setError('');
    try{const payload={nombre,ingredientes:ings.map(i=>({...i,ref_id:parseInt(i.ref_id),cantidad:parseFloat(i.cantidad)||0}))};
      if(editing)await api.updateFinal(editing.id,payload);else await api.createFinal(payload);setModal(false);onRefresh();}catch(e){setError(e.message);}setLoading(false);};
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteFinal(id);onRefresh();};
  const filtered=data.filter(r=>r.nombre.toLowerCase().includes(search.toLowerCase()));
  return(<div className="page active">
    <div className="page-header"><h2>Platos finales</h2><p>Platos del menú que se venden al cliente</p></div>
    <div className="card"><div className="card-title"><span>Platos ({filtered.length})</span>
      <div style={{display:'flex',gap:8}}><input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/><button className="btn btn-sm" onClick={openNew}>+ Nuevo</button></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Plato</th><th>Ingredientes</th><th></th></tr></thead>
    <tbody>{!filtered.length&&<tr><td colSpan={3}><div className="empty-state"><div className="icon">🍽️</div><p>Sin resultados.</p></div></td></tr>}
      {filtered.map(r=>(<>
        <tr key={r.id}><td><strong style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>{expanded===r.id?'▾':'▸'} {r.nombre}</strong></td>
          <td><span className="text-sm">{(r.ingredientes||[]).length} ingredientes</span></td>
          <td style={{display:'flex',gap:4}}><button className="btn btn-sm" onClick={()=>openEdit(r)}>✏️</button><button className="btn btn-sm btn-danger" onClick={()=>del(r.id)}>🗑</button></td>
        </tr>
        {expanded===r.id&&(<tr key={`exp-${r.id}`}><td colSpan={3} style={{background:'var(--bg3)',padding:'8px 16px'}}>
          {!(r.ingredientes||[]).length&&<span className="text-sm">Sin ingredientes</span>}
          {(r.ingredientes||[]).map((ing,i)=>(<span key={i} className="tag">{tipoIcon(ing.tipo)} {resolveNombre(ing.tipo,ing.ref_id)} — {fmtNum(ing.cantidad,3)} {ing.unidad}</span>))}
        </td></tr>)}
      </>))}
    </tbody></table></div></div>
    {modal&&(<Modal title={editing?'Editar plato':'Nuevo plato final'} onClose={()=>setModal(false)} wide>
      <div className="form-field mb-1"><label>Nombre del plato</label><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="ej: Roll de sushi de langostinos"/></div>
      <div className="card-title" style={{fontSize:13}}>Ingredientes</div>
      {ings.map((ing,i)=><IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={intermedias} finales={data} onChange={updateIng} onRemove={removeIng} allowFinal={true}/>)}
      <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear plato'}</button>
    </Modal>)}
  </div>);
}

// ── VENTAS ───────────────────────────────────────────────
function Ventas({finales}){
  const[ventas,setVentas]=useState([]);const[platoSel,setPlatoSel]=useState(null);
  const[fecha,setFecha]=useState(today());const[cantidad,setCantidad]=useState(1);const[nota,setNota]=useState('');const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{const d=await api.getVentas();setVentas(d);},[]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{if(!platoSel||!fecha){alert('Seleccioná fecha y plato');return;}setLoading(true);
    await api.createVenta({fecha,receta_final_id:platoSel.id,receta_nombre:platoSel.nombre+(nota?` (${nota})`:''),cantidad:parseInt(cantidad)||1});
    setLoading(false);setPlatoSel(null);setNota('');setCantidad(1);load();};
  const del=async id=>{await api.deleteVenta(id);load();};
  return(<div className="page active">
    <div className="page-header"><h2>Carga de ventas</h2><p>Registrá las ventas diarias de cada plato</p></div>
    <div className="card"><div className="card-title">Registrar venta</div>
      <div className="form-row" style={{alignItems:'flex-end'}}>
        <div className="form-field" style={{minWidth:130}}><label>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
        <BuscadorPlato finales={finales} onChange={p=>{setPlatoSel(p);setNota('');}}/>
        <div className="form-field" style={{minWidth:80}}><label>Cantidad</label><input type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)}/></div>
        <button className="btn" onClick={save} disabled={loading||!platoSel}>{loading?'...':'✓ Registrar'}</button>
      </div>
      {platoSel&&(<div style={{marginTop:10}}><div className="form-field">
        <label>Nota / detalle (opcional)</label>
        <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="ej: cantidad de rolls, variedades elegidas..."/>
      </div></div>)}
    </div>
    <div className="card"><div className="card-title">Ventas recientes</div>
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Plato / Detalle</th><th>Cant.</th><th></th></tr></thead>
      <tbody>{!ventas.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">💰</div><p>Sin ventas aún.</p></div></td></tr>}
        {ventas.map(v=>(<tr key={v.id}><td>{fmtDate(v.fecha)}</td><td>{v.receta_nombre}</td><td><strong>{v.cantidad}</strong></td>
          <td><button className="btn btn-sm btn-danger" onClick={()=>del(v.id)}>🗑</button></td></tr>))}
      </tbody></table></div>
    </div>
  </div>);
}

// ── STOCK ────────────────────────────────────────────────
function Stock({productos}){
  const[stocks,setStocks]=useState([]);
  const[form,setForm]=useState({fecha:today(),producto_id:'',cantidad:0,notas:''});
  const[search,setSearch]=useState('');
  const[filtroDesde,setFiltroDesde]=useState('');
  const[filtroHasta,setFiltroHasta]=useState('');
  const[editing,setEditing]=useState(null);
  const[loadingEdit,setLoadingEdit]=useState(false);
  const[detalle,setDetalle]=useState(null); // fecha seleccionada para ver detalle

  const load=useCallback(async()=>{
    let url='/stocks';
    if(filtroDesde&&filtroHasta) url+=`?desde=${filtroDesde}&hasta=${filtroHasta}`;
    const data=await apiFetch(url);
    setStocks(data);
  },[filtroDesde,filtroHasta]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.producto_id||!form.fecha){alert('Completá fecha y producto');return;}
    const prod=productos.find(p=>p.id===parseInt(form.producto_id));
    await api.createStock({...form,producto_id:parseInt(form.producto_id),producto_nombre:prod.nombre,unidad:prod.unidad,cantidad:parseFloat(form.cantidad)||0});
    load();
  };

  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteStock(id);load();};

  const saveEdit=async()=>{
    setLoadingEdit(true);
    await apiFetch(`/stocks/${editing.id}`,{method:'PUT',body:{cantidad:parseFloat(editing.cantidad)||0,notas:editing.notas||null}});
    setEditing(null);setLoadingEdit(false);load();
  };

  // Solo mostrar productos brutos (no las líneas de recetas intermedias)
  // Las notas "Stock receta intermedia" y "Calculado desde..." son las generadas por el link
  // Solo mostramos las que NO son la cabecera de intermedia
  const stocksBrutos = stocks.filter(s=>
    !s.notas || !s.notas.startsWith('Stock receta intermedia')
  );

  // Para detalle: agrupar por fecha — mostrar registros de esa fecha
  const fechas = [...new Set(stocksBrutos.map(s=>s.fecha))].sort((a,b)=>b.localeCompare(a));

  const filtered = stocksBrutos.filter(s=>{
    const matchSearch = !search || s.producto_nombre.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // Aplicar merma: si el producto tiene merma, mostrar también el equivalente bruto
  const getProdMerma = (nombre) => {
    const p = productos.find(p=>p.nombre===nombre);
    return p ? parseFloat(p.merma)||0 : 0;
  };

  // Solo calcular bruto si el registro NO vino ya convertido desde el link
  // Los convertidos tienen nota que empieza con "Desde "
  // Stock que ya viene expandido desde una receta intermedia (la API ya aplicó la merma)
  const esCalculado = (s) => s.notas && s.notas.startsWith('Calculado desde');

  // Equiv. bruto = lo que tenés que tener en stock
  // Cantidad neta = equiv. bruto × (100 - merma) / 100
  const getEquivBruto = (s) => {
    if(s.notas && (s.notas.startsWith('Calculado desde') || s.notas.startsWith('Conversion:'))) {
      return parseFloat(s.cantidad); // ya está en bruto
    }
    const merma = getProdMerma(s.producto_nombre);
    if(merma <= 0) return null;
    return parseFloat(s.cantidad) / ((100 - merma) / 100);
  };

  const getCantiNeta = (s) => {
    if(s.notas && (s.notas.startsWith('Calculado desde') || s.notas.startsWith('Conversion:'))) {
      const merma = getProdMerma(s.producto_nombre);
      return parseFloat(s.cantidad) * ((100 - merma) / 100);
    }
    return parseFloat(s.cantidad);
  };

  return(<div className="page active">
    <div className="page-header"><h2>Stock semanal</h2><p>Conteo de inventario — incluye lo cargado por el personal desde el link</p></div>

    <div className="card"><div className="card-title">Registrar stock manual</div>
      <div className="form-row">
        <div className="form-field" style={{minWidth:130}}><label>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></div>
        <div className="form-field" style={{flex:2,minWidth:200}}><label>Producto</label>
          <select value={form.producto_id} onChange={e=>setForm({...form,producto_id:e.target.value})}>
            <option value="">— Seleccioná producto —</option>
            {[...productos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
          </select>
        </div>
        <div className="form-field" style={{minWidth:90}}><label>Cantidad</label><input type="number" min="0" step="0.01" value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})}/></div>
        <div className="form-field" style={{flex:1,minWidth:120}}><label>Notas</label><input value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="opcional"/></div>
        <button className="btn" onClick={save}>✓ Guardar</button>
      </div>
    </div>

    <div className="card">
      <div className="card-title">
        <span>Historial de stock ({filtered.length} registros)</span>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="Buscar producto..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:160}}/>
          <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)} title="Desde"/>
          <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)} title="Hasta"/>
          {(filtroDesde||filtroHasta||search)&&<button className="btn btn-sm" onClick={()=>{setFiltroDesde('');setFiltroHasta('');setSearch('');}}>✕ Limpiar</button>}
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Cant. neta</th><th>Merma</th><th>Equiv. bruto</th><th>Notas</th><th></th></tr></thead>
        <tbody>
          {!filtered.length&&<tr><td colSpan={7}><div className="empty-state"><div className="icon">📦</div><p>Sin registros.</p></div></td></tr>}
          {filtered.map(s=>{
            const bruto = getEquivBruto(s);
            const neta = getCantiNeta(s);
            const merma = getProdMerma(s.producto_nombre);
            return(
              <tr key={s.id}>
                <td>{fmtDate(s.fecha)}</td>
                <td><strong>{s.producto_nombre}</strong></td>
                <td>
                  {editing?.id===s.id
                    ? <input type="number" min="0" step="0.01" value={editing.cantidad} style={{width:80}} onChange={e=>setEditing({...editing,cantidad:e.target.value})}/>
                    : <><strong>{fmtNum(neta,3)}</strong> {s.unidad}</>}
                </td>
                <td>{merma>0?<span className={`badge ${merma>30?'badge-amber':merma>15?'badge-blue':'badge-green'}`}>{merma}%</span>:'—'}</td>
                <td>
                  {bruto?<strong>{fmtNum(bruto,3)} {s.unidad}</strong>:'—'}
                </td>
                <td>
                  {editing?.id===s.id
                    ? <input value={editing.notas||''} style={{width:120}} onChange={e=>setEditing({...editing,notas:e.target.value})} placeholder="notas..."/>
                    : <span className="text-sm" style={{color:'var(--text3)'}}>{s.notas||'—'}</span>}
                </td>
                <td style={{display:'flex',gap:4}}>
                  {editing?.id===s.id
                    ? <><button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={loadingEdit}>{loadingEdit?'...':'✓'}</button>
                        <button className="btn btn-sm" onClick={()=>setEditing(null)}>✕</button></>
                    : <><button className="btn btn-sm" onClick={()=>setEditing({id:s.id,cantidad:s.cantidad,notas:s.notas||''})}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>del(s.id)}>🗑</button></>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  </div>);
}

function StockLink({productos}){
  const[config,setConfig]=useState(null);const[saving,setSaving]=useState(false);const[copied,setCopied]=useState(false);
  const[prods,setProds]=useState([]);const[ints,setInts]=useState([]);const[tabSel,setTabSel]=useState('brutos');
  const load=async()=>{
    const d=await api.getStockConfig();setConfig(d);
    setProds(d.productos.map(p=>({...p,habilitado:p.stock_publico||false,factor:p.factor_conversion||1.0,base_id:p.producto_base_id||null})));
    setInts((d.intermedias||[]).map(r=>({...r,habilitado:r.stock_publico_intermedia||false})));
  };
  useEffect(()=>{load();},[]);

  const generarToken=async()=>{const d=await api.generarToken();setConfig(c=>({...c,token:d.token}));};

  const guardar=async()=>{setSaving(true);
    await apiFetch('/stock-publico/config',{method:'PUT',body:{
      productos:prods.map(p=>({id:p.id,stock_publico:p.habilitado,factor_conversion:parseFloat(p.factor)||1.0,producto_base_id:p.base_id||null})),
      intermedias:ints.map(r=>({id:r.id,habilitado:r.habilitado})),
    }});
    setSaving(false);alert('Configuración guardada');};

  const link=config?.token?`${typeof window!=='undefined'?window.location.origin:''}/stock/${config.token}`:'';
  const copiar=()=>{navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),2000);};

  if(!config) return <div className="page active"><div className="page-header"><h2>Link de stock</h2></div><div className="card"><p className="text-sm">Cargando...</p></div></div>;

  return(<div className="page active">
    <div className="page-header"><h2>Link de stock público</h2><p>El personal carga stock desde este link sin loguearse</p></div>

    <div className="card"><div className="card-title">Link del local</div>
      {config.token?(
        <div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
            <input readOnly value={link} style={{flex:1,fontFamily:'monospace',fontSize:12}}/>
            <button className="btn btn-sm" onClick={copiar}>{copied?'✓ Copiado':'📋 Copiar'}</button>
          </div>
          <p className="text-sm" style={{color:'var(--text2)'}}>Compartí este link con el personal. Pueden abrirlo desde el celular sin usuario ni contraseña.</p>
          <button className="btn btn-sm btn-danger mt-1" onClick={()=>{if(confirm('¿Regenerar el link? El anterior dejará de funcionar.'))generarToken();}}>🔄 Regenerar link</button>
        </div>
      ):(<div><p className="text-sm" style={{marginBottom:12,color:'var(--text2)'}}>Aún no tenés un link generado.</p><button className="btn" onClick={generarToken}>🔗 Generar link</button></div>)}
    </div>

    <div className="card">
      <div className="card-title">Qué aparece en el link</div>
      <div className="tabs" style={{marginBottom:12}}>
        <button className={`tab${tabSel==='brutos'?' active':''}`} onClick={()=>setTabSel('brutos')}>📦 Productos brutos ({prods.filter(p=>p.habilitado).length} activos)</button>
        <button className={`tab${tabSel==='intermedias'?' active':''}`} onClick={()=>setTabSel('intermedias')}>🧪 Recetas intermedias ({ints.filter(r=>r.habilitado).length} activas)</button>
      </div>

      {tabSel==='brutos'&&(<>
        <p className="text-sm mb-1" style={{color:'var(--text2)'}}>Para estados distintos (ej: salmón fileteado), activá el producto, poné el factor de conversión y seleccioná a qué producto base equivale.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>✓</th><th>Producto bruto</th><th>Unidad</th><th>Factor ×</th><th>Convierte a</th></tr></thead>
          <tbody>{prods.map((p,i)=>(
            <tr key={p.id} style={{opacity:p.habilitado?1:.55}}>
              <td><input type="checkbox" checked={p.habilitado} onChange={e=>setProds(arr=>{const a=[...arr];a[i]={...a[i],habilitado:e.target.checked};return a;})}/></td>
              <td>{p.nombre}</td><td>{p.unidad}</td>
              <td><input type="number" min="0.01" step="0.0001" value={p.factor} style={{width:85}} disabled={!p.habilitado}
                onChange={e=>setProds(arr=>{const a=[...arr];a[i]={...a[i],factor:e.target.value};return a;})}/></td>
              <td><select value={p.base_id||''} style={{fontSize:12}} disabled={!p.habilitado}
                onChange={e=>setProds(arr=>{const a=[...arr];a[i]={...a[i],base_id:e.target.value?parseInt(e.target.value):null};return a;})}>
                <option value="">— Mismo producto —</option>
                {productos.map(pp=><option key={pp.id} value={pp.id}>{pp.nombre}</option>)}
              </select></td>
            </tr>
          ))}</tbody>
        </table></div>
      </>)}

      {tabSel==='intermedias'&&(<>
        <p className="text-sm mb-1" style={{color:'var(--text2)'}}>Al habilitar una receta intermedia, el personal puede cargar kg de esa preparación. El sistema calcula automáticamente el equivalente en productos brutos usando la composición de la receta (rinde 1kg).</p>
        <div className="table-wrap"><table>
          <thead><tr><th>✓</th><th>Receta intermedia</th><th>Factor auto (kg bruto / kg receta)</th></tr></thead>
          <tbody>{ints.map((r,i)=>(
            <tr key={r.id} style={{opacity:r.habilitado?1:.55}}>
              <td><input type="checkbox" checked={r.habilitado} onChange={e=>setInts(arr=>{const a=[...arr];a[i]={...a[i],habilitado:e.target.checked};return a;})}/></td>
              <td><strong>{r.nombre}</strong></td>
              <td>
                <span className="badge badge-blue">× {parseFloat(r.factor_auto||1).toFixed(4)} kg</span>
                <span className="text-sm" style={{marginLeft:8,color:'var(--text3)'}}>1 kg de receta = {parseFloat(r.factor_auto||1).toFixed(3)} kg de ingredientes brutos</span>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </>)}

      <button className="btn btn-primary mt-1" onClick={guardar} disabled={saving}>{saving?'Guardando...':'Guardar configuración'}</button>
    </div>
  </div>);
}

// ── CONSUMO TEÓRICO ───────────────────────────────────────
function Consumo(){
  const[semanaDesde,setSemanaDesde]=useState(mondayOfWeek());
  const[result,setResult]=useState(null);const[loading,setLoading]=useState(false);const[error,setError]=useState('');
  const[filtroActivo,setFiltroActivo]=useState(false);const[prodFiltro,setProdFiltro]=useState(new Set());
  const[tab,setTab]=useState('tabla'); // 'tabla' | 'detalle'

  const calcular=async()=>{
    const desde=semanaDesde; const hasta=addDays(semanaDesde,6);
    setLoading(true);setError('');setResult(null);
    try{const data=await api.getConsumo(desde,hasta);setResult({...data,desde,hasta});}
    catch(e){setError(e.message);}setLoading(false);
  };

  const toggleProd=n=>setProdFiltro(prev=>{const s=new Set(prev);s.has(n)?s.delete(n):s.add(n);return s;});

  const tabla=result?.tablaComparativa||[];
  const tablaFiltrada=filtroActivo&&prodFiltro.size>0?tabla.filter(p=>prodFiltro.has(p.nombre)):tabla;

  const desvioColor=d=>d>20?'#dc2626':d>10?'#d97706':d<-10?'#2563eb':'#16a34a';
  const desvioLabel=d=>`${d>0?'+':''}${d.toFixed(1)}%`;

  return(<div className="page active">
    <div className="page-header"><h2>Consumo teórico vs real</h2><p>Comparativa semanal de stock, entregas y consumo</p></div>

    <div className="card">
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div className="form-field"><label>Semana del lunes</label><input type="date" value={semanaDesde} onChange={e=>setSemanaDesde(e.target.value)}/></div>
        <button className="btn" onClick={calcular} disabled={loading}>{loading?'Calculando...':'📊 Calcular semana'}</button>
        {result&&<span className="text-sm" style={{color:'var(--text2)'}}>Semana: {fmtDate(result.desde)} → {fmtDate(result.hasta)}</span>}
      </div>
      {error&&<p className="login-error mt-1">{error}</p>}
    </div>

    {result&&result.tablaComparativa?.length>0&&(<>
      {/* Tabs */}
      <div className="tabs" style={{marginBottom:12}}>
        <button className={`tab${tab==='tabla'?' active':''}`} onClick={()=>setTab('tabla')}>📊 Tabla semanal</button>
        <button className={`tab${tab==='detalle'?' active':''}`} onClick={()=>setTab('detalle')}>📋 Ventas por plato</button>
      </div>

      {tab==='tabla'&&(<>
        {/* Filtro */}
        <div className="card" style={{marginBottom:12}}>
          <div className="card-title"><span>Filtrar productos</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{fontSize:12,color:'var(--text2)',display:'flex',alignItems:'center',gap:4,cursor:'pointer'}}>
                <input type="checkbox" checked={filtroActivo} onChange={e=>setFiltroActivo(e.target.checked)}/> Activar filtro
              </label>
              {filtroActivo&&<button className="btn btn-sm" onClick={()=>setProdFiltro(new Set(tabla.map(p=>p.nombre)))}>Todos</button>}
              {filtroActivo&&<button className="btn btn-sm" onClick={()=>setProdFiltro(new Set())}>Ninguno</button>}
            </div>
          </div>
          {filtroActivo&&(<div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {tabla.map(p=>(<label key={p.nombre} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',padding:'4px 8px',borderRadius:4,background:prodFiltro.has(p.nombre)?'var(--primary)':'var(--bg3)',color:prodFiltro.has(p.nombre)?'var(--primary-fg)':'var(--text2)',border:'1px solid var(--border)'}}>
              <input type="checkbox" style={{display:'none'}} checked={prodFiltro.has(p.nombre)} onChange={()=>toggleProd(p.nombre)}/>{p.nombre}
            </label>))}
          </div>)}
        </div>
        <div className="card">
          <div className="card-title">
            Semana del {fmtDate(result.desde)} al {fmtDate(result.hasta)}
            <span className="text-sm" style={{fontWeight:400}}>{result.ventas.reduce((a,v)=>a+parseInt(v.cantidad),0)} platos vendidos</span>
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>Producto</th><th>UM</th>
              <th style={{background:'#EFF6FF',color:'#1D4ED8'}}>STK INICIAL</th>
              <th style={{background:'#F0FDF4',color:'#166534'}}>ENTREGA</th>
              <th style={{background:'#FFF7ED',color:'#9A3412'}}>CONS. TEÓRICO</th>
              <th style={{background:'#F5F3FF',color:'#6D28D9'}}>STK FINAL TEÓRICO</th>
              <th style={{background:'#FEF3C7',color:'#92400E'}}>STK FINAL REAL</th>
              <th>DIFERENCIA</th>
            </tr></thead>
            <tbody>
              {tablaFiltrada.map(p=>(
                <tr key={p.id} style={{opacity:p.consTeo>0||p.tieneDatos?1:.45}}>
                  <td>
                    <strong>{p.nombre}</strong>
                    {!p.tieneDatos&&<span className="text-sm" style={{color:'var(--text3)',marginLeft:6}}>sin stock</span>}
                  </td>
                  <td>{p.unidad}</td>
                  <td style={{background:'#EFF6FF22',fontWeight:500}}>
                    {p.stkIni!==null?fmtNum(p.stkIni,3):<span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td style={{background:'#F0FDF422',fontWeight:500}}>
                    {p.entrega>0?fmtNum(p.entrega,3):<span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td style={{background:'#FFF7ED22',fontWeight:600}}>{fmtNum(p.consTeo,3)}</td>
                  <td style={{background:'#F5F3FF22',fontWeight:500}}>
                    {p.stkFinTeo!==null?fmtNum(p.stkFinTeo,3):<span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td style={{background:'#FEF3C722',fontWeight:500}}>
                    {p.stkFin!==null?fmtNum(p.stkFin,3):<span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td>
                    {p.diferencia!==null?(
                      <span style={{fontWeight:600,color:desvioColor(p.desvio||0)}}>
                        {p.diferencia>0?'+':''}{fmtNum(p.diferencia,3)}
                        {p.desvio!==null&&<span style={{fontSize:11,marginLeft:4,fontWeight:400}}>({p.desvio>0?'+':''}{p.desvio}%)</span>}
                      </span>
                    ):<span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-sm mt-1" style={{color:'var(--text3)'}}>
            STK Final Teórico = STK Inicial + Entrega − Consumo Teórico · Diferencia = STK Final Real − STK Final Teórico
          </p>
        </div>
      </>)}

      {tab==='detalle'&&(<div className="card">
        <div className="card-title">Ventas por plato</div>
        <div className="table-wrap"><table><thead><tr><th>Plato</th><th>Unidades vendidas</th></tr></thead>
          <tbody>{result.porPlato.map((p,i)=><tr key={i}><td>{p.nombre}</td><td><strong>{p.cantidad}</strong></td></tr>)}</tbody>
        </table></div>
      </div>)}
    </>)}

    {result&&!result.ventas?.length&&<div className="card"><div className="empty-state"><div className="icon">📊</div><p>No hay ventas en esta semana.</p></div></div>}
  </div>);
}

// ── LOGIN ────────────────────────────────────────────────
function Login({onLogin}){
  const[form,setForm]=useState({username:'',password:''});const[loading,setLoading]=useState(false);const[error,setError]=useState('');
  const submit=async()=>{if(!form.username||!form.password){setError('Completá usuario y contraseña');return;}setLoading(true);setError('');
    try{const data=await api.login(form.username,form.password);localStorage.setItem('rp_token',data.token);localStorage.setItem('rp_user',JSON.stringify(data.restaurante));onLogin(data.restaurante);}catch(e){setError(e.message);}setLoading(false);};
  return(<div className="login-page"><div className="login-card">
    <div className="login-logo"><div className="icon">👨‍🍳</div><h1>RecetasPro</h1><p>Gestión gastronómica inteligente</p></div>
    <div className="form-field" style={{marginBottom:12}}><label>Usuario</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="tu_usuario" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
    <div className="form-field" style={{marginBottom:12}}><label>Contraseña</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
    {error&&<p className="login-error">{error}</p>}
    <button className="btn btn-primary btn-block mt-1" onClick={submit} disabled={loading}>{loading?'Ingresando...':'Ingresar'}</button>
  </div></div>);
}

// ── APP ──────────────────────────────────────────────────
const NAV=[
  {section:'Recetas',items:[{id:'productos',label:'Productos brutos',icon:'📦'},{id:'intermedias',label:'Recetas intermedias',icon:'🧪'},{id:'finales',label:'Platos finales',icon:'🍽️'}]},
  {section:'Operaciones',items:[{id:'ventas',label:'Ventas',icon:'💰'},{id:'entregas',label:'Entregas',icon:'🚚'},{id:'stock',label:'Stock semanal',icon:'📊'},{id:'stocklink',label:'Link de stock',icon:'🔗'}]},
  {section:'Análisis',items:[{id:'consumo',label:'Consumo teórico',icon:'📈'}]},
  {section:'Configuración',items:[{id:'branding',label:'Branding',icon:'🎨'}]},
];

export default function App(){
  const[user,setUser]=useState(null);const[page,setPage]=useState('productos');
  const[db,setDb]=useState({productos:[],intermedias:[],finales:[]});
  const[branding,setBranding]=useState(null);

  useEffect(()=>{
    const token=localStorage.getItem('rp_token');
    const u=localStorage.getItem('rp_user');
    if(token&&u) setUser(JSON.parse(u));
  },[]);

  const loadAll=useCallback(async()=>{
    const[p,i,f]=await Promise.all([api.getProductos(),api.getIntermedias(),api.getFinales()]);
    setDb({productos:p,intermedias:i,finales:f});
    // Load branding
    try{
      const b=await apiFetch('/branding');
      if(b){setBranding(b);applyBranding(b);}
    }catch(e){}
  },[]);

  useEffect(()=>{if(user)loadAll();},[user,loadAll]);
  const logout=()=>{localStorage.removeItem('rp_token');localStorage.removeItem('rp_user');setUser(null);};
  if(!user) return <Login onLogin={u=>setUser(u)}/>;

  const renderPage=()=>{
    if(page==='productos') return <Productos data={db.productos} onRefresh={loadAll}/>;
    if(page==='intermedias') return <Intermedias data={db.intermedias} productos={db.productos} onRefresh={loadAll}/>;
    if(page==='finales') return <Finales data={db.finales} productos={db.productos} intermedias={db.intermedias} onRefresh={loadAll}/>;
    if(page==='ventas') return <Ventas finales={db.finales}/>;
    if(page==='entregas') return <Entregas productos={db.productos}/>;
    if(page==='stock') return <Stock productos={db.productos}/>;
    if(page==='stocklink') return <StockLink productos={db.productos}/>;
    if(page==='consumo') return <Consumo/>;
    if(page==='branding') return <Branding/>;
  };

  const sidebarBg = branding?.primaryColor || 'var(--bg2)';
  const sidebarColor = branding?.secondaryColor || 'var(--text2)';

  return(<div className="app">
    <div className="sidebar" style={{background:sidebarBg}}>
      <div className="sidebar-header" style={{borderColor:'rgba(255,255,255,.15)'}}>
        {branding?.logoBase64||branding?.logoUrl
          ? <img src={branding.logoBase64||branding.logoUrl} alt="logo" style={{height:32,objectFit:'contain',marginBottom:4}}/>
          : <div className="rest-name" style={{color:sidebarColor}}>{branding?.appName||user.nombre}</div>
        }
        <div className="rest-sub" style={{color:sidebarColor,opacity:.7}}>{user.nombre}</div>
      </div>
      {NAV.map(s=>(<div className="nav-section" key={s.section}>
        <div className="nav-label" style={{color:sidebarColor,opacity:.5}}>{s.section}</div>
        {s.items.map(item=>(<div key={item.id}
          className={`nav-item${page===item.id?' active':''}`}
          style={{color:page===item.id?sidebarColor:'',background:page===item.id?'rgba(255,255,255,.15)':'',opacity:page===item.id?1:.8}}
          onClick={()=>setPage(item.id)}>
          <span>{item.icon}</span>{item.label}
        </div>))}
      </div>))}
      <div className="sidebar-footer" style={{borderColor:'rgba(255,255,255,.15)'}}>
        <button className="logout-btn" style={{color:sidebarColor,opacity:.7}} onClick={logout}>🚪 Cerrar sesión</button>
      </div>
    </div>
    <div className="content">{renderPage()}</div>
  </div>);
}

// ── ENTREGAS ─────────────────────────────────────────────
function Entregas({productos}){
  const[entregas,setEntregas]=useState([]);
  const[form,setForm]=useState({fecha:today(),producto_id:'',producto_nombre:'',unidad:'kg',cantidad:0,proveedor:'',notas:''});
  const[filtroDesde,setFiltroDesde]=useState('');
  const[filtroHasta,setFiltroHasta]=useState('');
  const[search,setSearch]=useState('');
  // PDF import state
  const[pdfModal,setPdfModal]=useState(false);
  const[pdfLoading,setPdfLoading]=useState(false);
  const[pdfItems,setPdfItems]=useState(null);
  const[pdfMeta,setPdfMeta]=useState({proveedor:'',fecha:today(),numero:''});

  const load=useCallback(async()=>{
    let url='/entregas';
    if(filtroDesde&&filtroHasta) url+=`?desde=${filtroDesde}&hasta=${filtroHasta}`;
    setEntregas(await apiFetch(url));
  },[filtroDesde,filtroHasta]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.fecha||!form.producto_nombre){alert('Completá fecha y producto');return;}
    await apiFetch('/entregas',{method:'POST',body:{...form,cantidad:parseFloat(form.cantidad)||0,producto_id:form.producto_id?parseInt(form.producto_id):null}});
    setForm({fecha:today(),producto_id:'',producto_nombre:'',unidad:'kg',cantidad:0,proveedor:'',notas:''});
    load();
  };

  const del=async id=>{if(!confirm('¿Eliminar?'))return;await apiFetch(`/entregas/${id}`,{method:'DELETE'});load();};

  const handleProdSelect=e=>{
    const prod=productos.find(p=>p.id===parseInt(e.target.value));
    if(prod) setForm({...form,producto_id:prod.id,producto_nombre:prod.nombre,unidad:prod.unidad});
    else setForm({...form,producto_id:'',producto_nombre:'',unidad:'kg'});
  };

  const handlePDF=async e=>{
    const file=e.target.files[0];
    if(!file) return;
    setPdfLoading(true);
    const reader=new FileReader();
    reader.onload=async ev=>{
      const base64=ev.target.result.split(',')[1];
      try{
        const data=await apiFetch('/pdf-remito',{method:'POST',body:{pdfBase64:base64}});
        setPdfMeta({proveedor:data.proveedor||'',fecha:data.fecha||today(),numero:data.numero||''});
        setPdfItems((data.items||[]).map((item,i)=>({
          ...item,
          id:i,
          producto_id: productos.find(p=>p.nombre.toLowerCase().includes(item.descripcion.toLowerCase().substring(0,8)))?.id||null,
          activo:true
        })));
        setPdfModal(true);
      }catch(err){alert('Error al leer el PDF: '+err.message);}
      setPdfLoading(false);
    };
    reader.readAsDataURL(file);
    e.target.value='';
  };

  const confirmarPDF=async()=>{
    const activos=pdfItems.filter(i=>i.activo&&parseFloat(i.cantidad)>0);
    for(const item of activos){
      const prod=item.producto_id?productos.find(p=>p.id===item.producto_id):null;
      await apiFetch('/entregas',{method:'POST',body:{
        fecha:pdfMeta.fecha,
        producto_id:prod?.id||null,
        producto_nombre:prod?.nombre||item.descripcion,
        unidad:item.unidad||prod?.unidad||'kg',
        cantidad:parseFloat(item.cantidad)||0,
        proveedor:pdfMeta.proveedor,
        notas:pdfMeta.numero?`Remito ${pdfMeta.numero}`:null,
      }});
    }
    setPdfModal(false);setPdfItems(null);
    load();
    alert(`✓ ${activos.length} ítems importados`);
  };

  const filtered=entregas.filter(e=>!search||e.producto_nombre.toLowerCase().includes(search.toLowerCase()));

  return(<div className="page active">
    <div className="page-header"><h2>Entregas</h2><p>Ingreso de mercadería desde proveedores</p></div>

    {/* Importar PDF */}
    <div className="card">
      <div className="card-title">Importar remito PDF</div>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <label className="btn" style={{cursor:'pointer'}}>
          {pdfLoading?'Leyendo PDF...':'📄 Subir PDF de remito'}
          <input type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDF} disabled={pdfLoading}/>
        </label>
        <span className="text-sm" style={{color:'var(--text2)'}}>El sistema lee el PDF y te muestra los ítems para que los revises antes de confirmar</span>
      </div>
    </div>

    {/* Carga manual */}
    <div className="card">
      <div className="card-title">Carga manual</div>
      <div className="form-row" style={{flexWrap:'wrap'}}>
        <div className="form-field" style={{minWidth:120}}><label>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></div>
        <div className="form-field" style={{flex:2,minWidth:180}}><label>Producto</label>
          <select value={form.producto_id} onChange={handleProdSelect}>
            <option value="">— Seleccioná o escribí abajo —</option>
            {[...productos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="form-field" style={{flex:2,minWidth:160}}><label>Nombre (si no está en lista)</label>
          <input value={form.producto_nombre} onChange={e=>setForm({...form,producto_nombre:e.target.value})} placeholder="ej: Aceite de soja x 5L"/>
        </div>
        <div className="form-field" style={{minWidth:70}}><label>Unidad</label>
          <select value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})}>
            {['kg','g','und','unidad','litro','lts','grs','porcion'].map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-field" style={{minWidth:90}}><label>Cantidad</label><input type="number" min="0" step="0.01" value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})}/></div>
        <div className="form-field" style={{minWidth:130}}><label>Proveedor</label><input value={form.proveedor} onChange={e=>setForm({...form,proveedor:e.target.value})} placeholder="ej: Roll Factory"/></div>
        <div className="form-field" style={{minWidth:120}}><label>Notas</label><input value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="ej: Remito 123"/></div>
        <button className="btn" onClick={save}>✓ Guardar</button>
      </div>
    </div>

    {/* Historial */}
    <div className="card">
      <div className="card-title">
        <span>Historial ({filtered.length})</span>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:150}}/>
          <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)} title="Desde"/>
          <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)} title="Hasta"/>
          {(filtroDesde||filtroHasta||search)&&<button className="btn btn-sm" onClick={()=>{setFiltroDesde('');setFiltroHasta('');setSearch('');}}>✕</button>}
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Proveedor / Notas</th><th></th></tr></thead>
        <tbody>
          {!filtered.length&&<tr><td colSpan={5}><div className="empty-state"><div className="icon">📦</div><p>Sin entregas cargadas.</p></div></td></tr>}
          {filtered.map(e=>(<tr key={e.id}>
            <td>{fmtDate(e.fecha)}</td>
            <td><strong>{e.producto_nombre}</strong></td>
            <td><strong>{fmtNum(e.cantidad,3)}</strong> {e.unidad}</td>
            <td><span className="text-sm" style={{color:'var(--text3)'}}>{e.notas||'—'}</span></td>
            <td><button className="btn btn-sm btn-danger" onClick={()=>del(e.id)}>🗑</button></td>
          </tr>))}
        </tbody>
      </table></div>
    </div>

    {/* Modal revisión PDF */}
    {pdfModal&&pdfItems&&(
      <Modal title="Revisar remito importado" onClose={()=>{setPdfModal(false);setPdfItems(null);}} wide>
        <div className="form-grid mb-1" style={{marginBottom:12}}>
          <div className="form-field"><label>Proveedor</label><input value={pdfMeta.proveedor} onChange={e=>setPdfMeta({...pdfMeta,proveedor:e.target.value})}/></div>
          <div className="form-field"><label>Fecha</label><input type="date" value={pdfMeta.fecha} onChange={e=>setPdfMeta({...pdfMeta,fecha:e.target.value})}/></div>
          <div className="form-field"><label>Nro. Remito</label><input value={pdfMeta.numero} onChange={e=>setPdfMeta({...pdfMeta,numero:e.target.value})}/></div>
        </div>
        <div className="table-wrap" style={{marginBottom:12}}><table>
          <thead><tr><th>✓</th><th>Descripción PDF</th><th>Producto del sistema</th><th>Cantidad</th><th>Unidad</th></tr></thead>
          <tbody>{pdfItems.map((item,i)=>(
            <tr key={i} style={{opacity:item.activo?1:.45}}>
              <td><input type="checkbox" checked={item.activo} onChange={e=>setPdfItems(arr=>{const a=[...arr];a[i]={...a[i],activo:e.target.checked};return a;})}/></td>
              <td><span className="text-sm">{item.descripcion}</span>{item.sku&&<span className="badge badge-gray" style={{marginLeft:4,fontSize:10}}>{item.sku}</span>}</td>
              <td>
                <select value={item.producto_id||''} style={{fontSize:12}} onChange={e=>setPdfItems(arr=>{const a=[...arr];a[i]={...a[i],producto_id:e.target.value?parseInt(e.target.value):null};return a;})}>
                  <option value="">— Sin vincular —</option>
                  {[...productos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </td>
              <td><input type="number" min="0" step="0.01" value={item.cantidad} style={{width:80}} onChange={e=>setPdfItems(arr=>{const a=[...arr];a[i]={...a[i],cantidad:e.target.value};return a;})}/></td>
              <td><select value={item.unidad||'kg'} style={{fontSize:12,width:60}} onChange={e=>setPdfItems(arr=>{const a=[...arr];a[i]={...a[i],unidad:e.target.value};return a;})}>
                {['kg','g','und','unidad','lts','litro','grs'].map(u=><option key={u}>{u}</option>)}
              </select></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn" onClick={()=>{setPdfModal(false);setPdfItems(null);}}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmarPDF}>✓ Confirmar y guardar {pdfItems.filter(i=>i.activo).length} ítems</button>
        </div>
      </Modal>
    )}
  </div>);
}

// ── BRANDING ─────────────────────────────────────────────
function Branding(){
  const[config,setConfig]=useState({
    primaryColor:'#DC2626',
    secondaryColor:'#ffffff',
    accentColor:'#991B1B',
    appName:'RecetasPro',
    logoUrl:'',
    logoBase64:'',
  });
  const[saving,setSaving]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    apiFetch('/branding').then(data=>{
      if(data) setConfig(c=>({...c,...data}));
      setLoaded(true);
    }).catch(()=>setLoaded(true));
  },[]);

  const save=async()=>{
    setSaving(true);
    await apiFetch('/branding',{method:'PUT',body:config});
    setSaving(false);
    // Aplicar cambios al CSS
    applyBranding(config);
    alert('✓ Branding guardado. Recargá la página para ver todos los cambios.');
  };

  const handleLogo=e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setConfig(c=>({...c,logoBase64:ev.target.result,logoUrl:''}));
    reader.readAsDataURL(file);
  };

  if(!loaded) return <div className="page active"><div className="page-header"><h2>Branding</h2></div><div className="card"><p className="text-sm">Cargando...</p></div></div>;

  return(<div className="page active">
    <div className="page-header"><h2>Branding</h2><p>Personalizá la apariencia de la plataforma</p></div>

    <div className="card">
      <div className="card-title">Nombre e identidad</div>
      <div className="form-grid mb-1">
        <div className="form-field"><label>Nombre de la app</label><input value={config.appName} onChange={e=>setConfig({...config,appName:e.target.value})} placeholder="ej: Ai Sushi Control"/></div>
      </div>
      <div className="form-field mb-1">
        <label>Logo (PNG, JPG, SVG)</label>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <label className="btn" style={{cursor:'pointer'}}>
            📷 Subir logo
            <input type="file" accept="image/*" style={{display:'none'}} onChange={handleLogo}/>
          </label>
          {(config.logoBase64||config.logoUrl)&&(
            <img src={config.logoBase64||config.logoUrl} alt="Logo" style={{height:48,objectFit:'contain',border:'1px solid var(--border)',borderRadius:4,padding:4,background:'white'}}/>
          )}
          {(config.logoBase64||config.logoUrl)&&<button className="btn btn-sm btn-danger" onClick={()=>setConfig({...config,logoBase64:'',logoUrl:''})}>✕ Quitar logo</button>}
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-title">Colores</div>
      <div className="form-grid mb-1">
        <div className="form-field">
          <label>Color principal</label>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="color" value={config.primaryColor} onChange={e=>setConfig({...config,primaryColor:e.target.value})} style={{width:48,height:36,padding:2,border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}/>
            <input value={config.primaryColor} onChange={e=>setConfig({...config,primaryColor:e.target.value})} style={{fontFamily:'monospace',fontSize:13}}/>
          </div>
          <span className="text-sm">Sidebar, botones primarios, nav activo</span>
        </div>
        <div className="form-field">
          <label>Color de acento</label>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="color" value={config.accentColor} onChange={e=>setConfig({...config,accentColor:e.target.value})} style={{width:48,height:36,padding:2,border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}/>
            <input value={config.accentColor} onChange={e=>setConfig({...config,accentColor:e.target.value})} style={{fontFamily:'monospace',fontSize:13}}/>
          </div>
          <span className="text-sm">Hover, badges, detalles</span>
        </div>
        <div className="form-field">
          <label>Color de texto del sidebar</label>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="color" value={config.secondaryColor} onChange={e=>setConfig({...config,secondaryColor:e.target.value})} style={{width:48,height:36,padding:2,border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}/>
            <input value={config.secondaryColor} onChange={e=>setConfig({...config,secondaryColor:e.target.value})} style={{fontFamily:'monospace',fontSize:13}}/>
          </div>
          <span className="text-sm">Texto e íconos del menú lateral</span>
        </div>
      </div>

      {/* Preview */}
      <div style={{marginTop:12,border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxWidth:360}}>
        <div style={{background:config.primaryColor,padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
          {(config.logoBase64||config.logoUrl)?<img src={config.logoBase64||config.logoUrl} alt="logo" style={{height:28,objectFit:'contain'}}/>:
            <span style={{fontWeight:700,fontSize:16,color:config.secondaryColor}}>{config.appName}</span>}
        </div>
        <div style={{background:config.primaryColor,padding:'4px 0',opacity:.9}}>
          {['Productos brutos','Recetas intermedias','Ventas','Consumo teórico'].map(item=>(
            <div key={item} style={{padding:'7px 16px',fontSize:13,color:config.secondaryColor,opacity:.85}}>{item}</div>
          ))}
        </div>
      </div>
    </div>

    <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar branding'}</button>
  </div>);
}

function applyBranding(config){
  if(!config) return;
  const root=document.documentElement;
  if(config.primaryColor){
    root.style.setProperty('--brand-primary',config.primaryColor);
    // Update sidebar background
    document.querySelectorAll('.sidebar').forEach(el=>el.style.background=config.primaryColor);
  }
}
