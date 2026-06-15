import { useState, useEffect, useCallback, useRef } from 'react';

const today = () => new Date().toISOString().split('T')[0];
const mondayOfWeek = () => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().split('T')[0]; };
const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };
const fmtDate = iso => { if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
const fmtNum = (n,dec=3) => parseFloat(n||0).toFixed(dec);

function getToken(){ return typeof window!=='undefined'?localStorage.getItem('rp_token'):null; }
function getSucursalId(){ return typeof window!=='undefined'?localStorage.getItem('rp_sucursal_id'):null; }
async function apiFetch(path,opts={}){
  const token=getToken();
  const sucursalId=getSucursalId();
  const res=await fetch('/api'+path,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...(sucursalId?{'x-restaurante-id':sucursalId}:{}),...(opts.headers||{})},body:opts.body?JSON.stringify(opts.body):undefined});
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
  const[modo,setModo]=useState('semana'); // 'semana' | 'multisemana'
  const[semanaDesde,setSemanaDesde]=useState(mondayOfWeek());
  const[multiDesde,setMultiDesde]=useState(addDays(mondayOfWeek(),-21)); // 4 semanas atrás
  const[result,setResult]=useState(null);
  const[multiResult,setMultiResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[filtroActivo,setFiltroActivo]=useState(false);
  const[prodFiltro,setProdFiltro]=useState(new Set());
  const[tab,setTab]=useState('tabla');

  const toggleProd=n=>setProdFiltro(prev=>{const s=new Set(prev);s.has(n)?s.delete(n):s.add(n);return s;});
  const desvioColor=d=>{if(d===null)return'var(--text3)';return d>20?'#dc2626':d>10?'#d97706':d<-20?'#2563eb':d<-10?'#7c3aed':'#16a34a';};

  const calcular=async()=>{
    const desde=semanaDesde;const hasta=addDays(semanaDesde,6);
    setLoading(true);setError('');setResult(null);
    try{const data=await apiFetch(`/consumo?desde=${desde}&hasta=${hasta}`);setResult({...data,desde,hasta});}
    catch(e){setError(e.message);}
    setLoading(false);
  };

  const calcularMulti=async()=>{
    setLoading(true);setError('');setMultiResult(null);
    // Generar 4 semanas desde multiDesde
    const semanas=[];
    for(let i=0;i<4;i++){
      const lunes=addDays(multiDesde,i*7);
      const domingo=addDays(lunes,6);
      semanas.push({desde:lunes,hasta:domingo});
    }
    try{
      const resultados=await Promise.all(semanas.map(s=>apiFetch(`/consumo?desde=${s.desde}&hasta=${s.hasta}`).then(d=>({...d,...s}))));
      setMultiResult(resultados);
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const tabla=result?.tablaComparativa||[];
  const tablaFiltrada=filtroActivo&&prodFiltro.size>0?tabla.filter(p=>prodFiltro.has(p.nombre)):tabla;

  return(<div className="page active">
    <div className="page-header"><h2>Consumo teórico vs real</h2><p>Comparativa de stock, entregas y consumo</p></div>

    {/* Selector de modo */}
    <div className="card">
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button className={`tab${modo==='semana'?' active':''}`} onClick={()=>setModo('semana')} style={{padding:'6px 14px',borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',background:modo==='semana'?'var(--primary)':'var(--bg2)',color:modo==='semana'?'var(--primary-fg)':'var(--text2)',fontWeight:500}}>📊 Una semana</button>
        <button className={`tab${modo==='multisemana'?' active':''}`} onClick={()=>setModo('multisemana')} style={{padding:'6px 14px',borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',background:modo==='multisemana'?'var(--primary)':'var(--bg2)',color:modo==='multisemana'?'var(--primary-fg)':'var(--text2)',fontWeight:500}}>📈 Múltiples semanas</button>
      </div>

      {modo==='semana'&&(
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-field"><label>Semana del lunes</label><input type="date" value={semanaDesde} onChange={e=>setSemanaDesde(e.target.value)}/></div>
          <button className="btn" onClick={calcular} disabled={loading}>{loading?'Calculando...':'📊 Calcular'}</button>
          {result&&<span className="text-sm" style={{color:'var(--text2)'}}>Semana: {fmtDate(result.desde)} → {fmtDate(result.hasta)}</span>}
        </div>
      )}

      {modo==='multisemana'&&(
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-field"><label>Primer lunes del período</label><input type="date" value={multiDesde} onChange={e=>setMultiDesde(e.target.value)}/></div>
          <button className="btn" onClick={calcularMulti} disabled={loading}>{loading?'Calculando 4 semanas...':'📈 Calcular 4 semanas'}</button>
        </div>
      )}
      {error&&<p className="login-error mt-1">{error}</p>}
    </div>

    {/* VISTA UNA SEMANA */}
    {modo==='semana'&&result&&result.tablaComparativa?.length>0&&(<>
      <div className="tabs" style={{marginBottom:12}}>
        <button className={`tab${tab==='tabla'?' active':''}`} onClick={()=>setTab('tabla')}>📊 Tabla semanal</button>
        <button className={`tab${tab==='detalle'?' active':''}`} onClick={()=>setTab('detalle')}>📋 Ventas por plato</button>
      </div>

      {tab==='tabla'&&(<>
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
                  <td><strong>{p.nombre}</strong>{!p.tieneDatos&&<span className="text-sm" style={{color:'var(--text3)',marginLeft:6}}>sin stock</span>}</td>
                  <td>{p.unidad}</td>
                  <td style={{background:'#EFF6FF22'}}>{p.stkIni!==null?fmtNum(p.stkIni,3):'—'}</td>
                  <td style={{background:'#F0FDF422'}}>{p.entrega>0?fmtNum(p.entrega,3):'—'}</td>
                  <td style={{background:'#FFF7ED22',fontWeight:600}}>{fmtNum(p.consTeo,3)}</td>
                  <td style={{background:'#F5F3FF22'}}>{p.stkFinTeo!==null?fmtNum(p.stkFinTeo,3):'—'}</td>
                  <td style={{background:'#FEF3C722'}}>{p.stkFin!==null?fmtNum(p.stkFin,3):'—'}</td>
                  <td>{p.diferencia!==null?(
                    <span style={{fontWeight:600,color:desvioColor(p.desvio)}}>
                      {p.diferencia>0?'+':''}{fmtNum(p.diferencia,3)}
                      {p.desvio!==null&&<span style={{fontSize:11,marginLeft:4,fontWeight:400}}>({p.desvio>0?'+':''}{fmtNum(p.desvio,1)}%)</span>}
                    </span>
                  ):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-sm mt-1" style={{color:'var(--text3)'}}>STK Final Teórico = STK Inicial + Entrega − Consumo Teórico · Diferencia = STK Final Real − STK Final Teórico</p>
        </div>
      </>)}

      {tab==='detalle'&&(<div className="card">
        <div className="card-title">Ventas por plato</div>
        <div className="table-wrap"><table><thead><tr><th>Plato</th><th>Unidades</th></tr></thead>
          <tbody>{result.porPlato.map((p,i)=><tr key={i}><td>{p.nombre}</td><td><strong>{p.cantidad}</strong></td></tr>)}</tbody>
        </table></div>
      </div>)}
    </>)}

    {modo==='semana'&&result&&!result.ventas?.length&&<div className="card"><div className="empty-state"><div className="icon">📊</div><p>No hay ventas en esta semana.</p></div></div>}

    {/* VISTA MULTI-SEMANA */}
    {modo==='multisemana'&&multiResult&&(<>
      {/* Resumen de ventas por semana */}
      <div className="card">
        <div className="card-title">Ventas por semana</div>
        <div className="metric-grid">
          {multiResult.map((r,i)=>(
            <div className="metric" key={i}>
              <div className="metric-label">{fmtDate(r.desde)} → {fmtDate(r.hasta)}</div>
              <div className="metric-value">{r.ventas.reduce((a,v)=>a+parseInt(v.cantidad),0)}</div>
              <div className="text-sm" style={{color:'var(--text2)',marginTop:2}}>{r.porPlato.length} platos</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla multi-semana: un producto por fila, semanas como columnas */}
      {(()=>{
        // Recopilar todos los productos que aparecen en alguna semana
        const todosProds = {};
        multiResult.forEach(r=>{
          (r.tablaComparativa||[]).forEach(p=>{
            if(!todosProds[p.id]) todosProds[p.id]={id:p.id,nombre:p.nombre,unidad:p.unidad};
          });
        });
        const prods = Object.values(todosProds).sort((a,b)=>a.nombre.localeCompare(b.nombre));
        if(!prods.length) return <div className="card"><div className="empty-state"><div className="icon">📊</div><p>Sin datos en este período.</p></div></div>;
        return(
          <div className="card">
            <div className="card-title">Consumo teórico por semana y producto</div>
            <div className="table-wrap"><table>
              <thead><tr>
                <th>Producto</th><th>UM</th>
                {multiResult.map((r,i)=><th key={i} style={{background:'#FFF7ED22',color:'#9A3412',minWidth:90}}>{fmtDate(r.desde).slice(0,5)}</th>)}
                <th style={{background:'#EFF6FF22',color:'#1D4ED8'}}>Promedio</th>
              </tr></thead>
              <tbody>
                {prods.map(prod=>{
                  const vals=multiResult.map(r=>{
                    const p=(r.tablaComparativa||[]).find(x=>x.id===prod.id);
                    return p?p.consTeo:null;
                  });
                  const valsValidos=vals.filter(v=>v!==null&&v>0);
                  const promedio=valsValidos.length?valsValidos.reduce((a,b)=>a+b,0)/valsValidos.length:null;
                  if(!valsValidos.length) return null;
                  return(
                    <tr key={prod.id}>
                      <td><strong>{prod.nombre}</strong></td>
                      <td>{prod.unidad}</td>
                      {vals.map((v,i)=><td key={i} style={{background:'#FFF7ED11'}}>{v!==null&&v>0?fmtNum(v,3):<span style={{color:'var(--text3)'}}>—</span>}</td>)}
                      <td style={{background:'#EFF6FF22',fontWeight:600}}>{promedio?fmtNum(promedio,3):'—'}</td>
                    </tr>
                  );
                }).filter(Boolean)}
              </tbody>
            </table></div>
            <p className="text-sm mt-1" style={{color:'var(--text3)'}}>Solo se muestran productos con al menos una semana de consumo teórico.</p>
          </div>
        );
      })()}
    </>)}
  </div>);
}

// ── LOGIN ────────────────────────────────────────────────
function Login({onLogin}){
  const[modo,setModo]=useState('login'); // 'login' | 'registro'
  const[form,setForm]=useState({email:'',password:'',nombre:''});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[mensaje,setMensaje]=useState('');
  const[sucursales,setSucursales]=useState(null); // null = no logueado, [] = eligiendo
  const[tokenTemp,setTokenTemp]=useState(null);
  const[usuarioTemp,setUsuarioTemp]=useState(null);
  const[branding,setBranding]=useState(null);

  useEffect(()=>{
    try{const b=localStorage.getItem('rp_branding');if(b)setBranding(JSON.parse(b));}catch(e){}
  },[]);

  const submit=async()=>{
    if(!form.email||!form.password){setError('Completá email y contraseña');return;}
    setLoading(true);setError('');
    try{
      const data=await fetch('/api/auth/login-nuevo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email,password:form.password})}).then(r=>r.json());
      if(data.error) throw new Error(data.error);
      if(data.sucursales.length===1){
        // Una sola sucursal: entrar directo
        finalizarLogin(data.token, data.usuario, data.sucursales[0], data.sucursales);
      } else {
        // Múltiples sucursales: mostrar selector
        setTokenTemp(data.token);
        setUsuarioTemp(data.usuario);
        setSucursales(data.sucursales);
      }
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const registro=async()=>{
    if(!form.nombre||!form.email||!form.password){setError('Completá todos los campos');return;}
    setLoading(true);setError('');
    try{
      const data=await fetch('/api/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}).then(r=>r.json());
      if(data.error) throw new Error(data.error);
      setMensaje(data.mensaje);setModo('login');setForm({email:form.email,password:'',nombre:''});
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const finalizarLogin=(token,usuario,sucursal,todasSucursales)=>{
    localStorage.setItem('rp_token',token);
    localStorage.setItem('rp_user',JSON.stringify({...usuario,sucursal,sucursales:todasSucursales||[sucursal]}));
    localStorage.setItem('rp_sucursal_id',sucursal.id);
    localStorage.setItem('rp_modulos',JSON.stringify(sucursal.modulos||'all'));
    onLogin({...usuario,sucursal,sucursales:todasSucursales||[sucursal],modulos:sucursal.modulos||'all'});
  };

  const primaryColor=branding?.primaryColor||'#1c1917';
  const appName=branding?.appName||'RecetasPro';

  // Selector de sucursal
  if(sucursales){
    return(<div className="login-page"><div className="login-card">
      <div className="login-logo">
        {branding?.logoBase64||branding?.logoUrl
          ? <img src={branding.logoBase64||branding.logoUrl} alt="logo" style={{height:56,objectFit:'contain',marginBottom:8}}/>
          : <div style={{width:52,height:52,borderRadius:12,background:primaryColor,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:8,fontSize:24}}>🏪</div>
        }
        <h1>Seleccioná una sucursal</h1>
        <p style={{color:'var(--text2)',fontSize:13}}>Bienvenido/a, {usuarioTemp?.nombre}</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
        {sucursales.map(s=>(
          <button key={s.id} className="btn" style={{justifyContent:'flex-start',padding:'12px 16px',fontSize:14}}
            onClick={()=>finalizarLogin(tokenTemp,usuarioTemp,s,sucursales)}>
            🏪 {s.nombre}
          </button>
        ))}
      </div>
      <button className="btn btn-sm mt-1" style={{width:'100%',marginTop:12,color:'var(--text2)'}} onClick={()=>{setSucursales(null);setTokenTemp(null);}}>← Volver</button>
    </div></div>);
  }

  return(<div className="login-page"><div className="login-card">
    <div className="login-logo">
      {branding?.logoBase64||branding?.logoUrl
        ? <img src={branding.logoBase64||branding.logoUrl} alt="logo" style={{height:56,objectFit:'contain',marginBottom:8}}/>
        : <div style={{width:52,height:52,borderRadius:12,background:primaryColor,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:8,fontSize:24}}>👨‍🍳</div>
      }
      <h1>{appName}</h1>
      <p>Gestión gastronómica inteligente</p>
    </div>

    {mensaje&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'8px 12px',fontSize:13,color:'#166534',marginBottom:12}}>{mensaje}</div>}

    {modo==='login'&&(<>
      <div className="form-field" style={{marginBottom:12}}><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tu@email.com" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
      <div className="form-field" style={{marginBottom:12}}><label>Contraseña</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" style={{background:primaryColor,borderColor:primaryColor}} onClick={submit} disabled={loading}>{loading?'Ingresando...':'Ingresar'}</button>
      <button className="btn btn-block mt-1" style={{marginTop:8}} onClick={()=>{setModo('registro');setError('');}}>Crear cuenta nueva</button>
    </>)}

    {modo==='registro'&&(<>
      <div className="form-field" style={{marginBottom:10}}><label>Nombre completo</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Tu nombre"/></div>
      <div className="form-field" style={{marginBottom:10}}><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tu@email.com"/></div>
      <div className="form-field" style={{marginBottom:10}}><label>Contraseña</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mínimo 6 caracteres"/></div>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" style={{background:primaryColor,borderColor:primaryColor}} onClick={registro} disabled={loading}>{loading?'Creando cuenta...':'Crear cuenta'}</button>
      <button className="btn btn-block mt-1" style={{marginTop:8,color:'var(--text2)'}} onClick={()=>{setModo('login');setError('');}}>← Ya tengo cuenta</button>
    </>)}
  </div></div>);
}


function Branding({onSave}){
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
    applyBranding(config);
    if(onSave) onSave(config);
    alert('✓ Branding guardado.');
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

// ── SUCURSALES ───────────────────────────────────────────
function Sucursales({onUpdate}){
  const[sucursales,setSucursales]=useState([]);
  const[editing,setEditing]=useState(null);
  const[showNueva,setShowNueva]=useState(false);
  const[form,setForm]=useState({nombre:'',username:'',password:''});
  const[editForm,setEditForm]=useState({nombre:'',username:'',password:''});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[ok,setOk]=useState('');

  const load=async()=>{
    try{const s=await apiFetch('/sucursales');setSucursales(s);}catch(e){console.error(e);}
  };
  useEffect(()=>{load();},[]);

  const crear=async()=>{
    if(!form.nombre||!form.username||!form.password){setError('Completá todos los campos');return;}
    setLoading(true);setError('');
    try{
      await apiFetch('/sucursales',{method:'POST',body:form});
      setOk(`✓ Sucursal "${form.nombre}" creada`);
      setForm({nombre:'',username:'',password:''});
      setShowNueva(false);load();
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const guardar=async()=>{
    if(!editForm.nombre||!editForm.username){setError('Completá nombre y usuario');return;}
    setLoading(true);setError('');
    try{
      await apiFetch(`/sucursales/${editing.id}`,{method:'PUT',body:editForm});
      setEditing(null);setOk('✓ Sucursal actualizada');load();
      // If editing current sucursal, update name in sidebar
      if(parseInt(localStorage.getItem('rp_sucursal_id'))===editing.id && onUpdate) onUpdate(editForm.nombre);
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const openEdit=(s)=>{
    setEditing(s);
    setEditForm({nombre:s.nombre,username:s.username,password:''});
    setError('');
  };

  return(<div className="page active">
    <div className="page-header"><h2>Sucursales</h2><p>Gestioná las sucursales del sistema</p></div>

    {ok&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'10px 14px',fontSize:13,color:'#166534',marginBottom:12}}>{ok}</div>}

    {/* Crear nueva */}
    <div className="card">
      <div className="card-title">
        <span>Nueva sucursal</span>
        <button className="btn btn-sm" onClick={()=>{setShowNueva(!showNueva);setError('');}}>{showNueva?'✕ Cancelar':'+ Nueva sucursal'}</button>
      </div>
      {showNueva&&(<div>
        <div className="form-grid mb-1">
          <div className="form-field"><label>Nombre de la sucursal</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="ej: Sushi House Chacras"/></div>
          <div className="form-field"><label>Usuario (para login)</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="ej: sushi_chacras"/></div>
          <div className="form-field"><label>Contraseña inicial</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mínimo 6 caracteres"/></div>
        </div>
        {error&&<p className="login-error">{error}</p>}
        <button className="btn btn-primary" onClick={crear} disabled={loading}>{loading?'Creando...':'Crear sucursal'}</button>
      </div>)}
    </div>

    {/* Lista */}
    <div className="card">
      <div className="card-title">Sucursales ({sucursales.length})</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Creada</th><th></th></tr></thead>
        <tbody>
          {!sucursales.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">🏪</div><p>Sin sucursales.</p></div></td></tr>}
          {sucursales.map(s=>(<tr key={s.id}>
            <td><strong>{s.nombre}</strong></td>
            <td><span className="badge badge-gray">{s.username}</span></td>
            <td><span className="text-sm">{fmtDate(s.created_at?.split('T')[0])}</span></td>
            <td><button className="btn btn-sm" onClick={()=>openEdit(s)}>✏️ Editar</button></td>
          </tr>))}
        </tbody>
      </table></div>
    </div>

    {/* Modal editar */}
    {editing&&(<Modal title={`Editar — ${editing.nombre}`} onClose={()=>setEditing(null)}>
      <div className="form-grid mb-1">
        <div className="form-field"><label>Nombre</label><input value={editForm.nombre} onChange={e=>setEditForm({...editForm,nombre:e.target.value})}/></div>
        <div className="form-field"><label>Usuario</label><input value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})}/></div>
        <div className="form-field"><label>Nueva contraseña (dejar vacío para no cambiar)</label><input type="password" value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="••••••••"/></div>
      </div>
      {error&&<p className="login-error">{error}</p>}
      <button className="btn btn-primary btn-block mt-1" onClick={guardar} disabled={loading}>{loading?'Guardando...':'Guardar cambios'}</button>
    </Modal>)}
  </div>);
}

// ── USUARIOS (superadmin) ────────────────────────────────
function Usuarios(){
  const[usuarios,setUsuarios]=useState([]);
  const[restaurantes,setRestaurantes]=useState([]);
  const[editing,setEditing]=useState(null);
  const[loading,setLoading]=useState(false);
  const[showNuevo,setShowNuevo]=useState(false);
  const[nuevoForm,setNuevoForm]=useState({nombre:'',email:'',password:''});
  const[nuevoError,setNuevoError]=useState('');
  const[nuevoOk,setNuevoOk]=useState('');

  const TODOS_MODULOS=['productos','intermedias','finales','ventas','entregas','stock','stocklink','consumo','branding'];
  const MODULO_LABELS={productos:'Productos brutos',intermedias:'Recetas intermedias',finales:'Platos finales',ventas:'Ventas',entregas:'Entregas',stock:'Stock semanal',stocklink:'Link de stock',consumo:'Consumo teórico',branding:'Branding'};

  const load=async()=>{
    try{
      const[u,r]=await Promise.all([apiFetch('/usuarios'),apiFetch('/restaurantes-lista')]);
      setUsuarios(u);setRestaurantes(r);
    }catch(e){
      console.error('Error cargando usuarios/sucursales:',e);
      // Try loading just usuarios
      try{const u=await apiFetch('/usuarios');setUsuarios(u);}catch(e2){}
    }
  };
  useEffect(()=>{load();},[]);

  const crearUsuario=async()=>{
    if(!nuevoForm.nombre||!nuevoForm.email||!nuevoForm.password){setNuevoError('Completá todos los campos');return;}
    setLoading(true);setNuevoError('');
    try{
      const data=await fetch('/api/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(nuevoForm)}).then(r=>r.json());
      if(data.error) throw new Error(data.error);
      // Auto-aprobar si lo crea el superadmin
      const users=await apiFetch('/usuarios');
      const newUser=users.find(u=>u.email===nuevoForm.email.toLowerCase());
      if(newUser) await apiFetch(`/usuarios/${newUser.id}`,{method:'PUT',body:{activo:true,permisos:[]}});
      setNuevoOk(`✓ Usuario "${nuevoForm.nombre}" creado y activado`);
      setNuevoForm({nombre:'',email:'',password:''});
      setShowNuevo(false);
      load();
    }catch(e){setNuevoError(e.message);}
    setLoading(false);
  };

  const toggleActivo=async(u)=>{
    await apiFetch(`/usuarios/${u.id}`,{method:'PUT',body:{activo:!u.activo,permisos:u.permisos||[]}});load();
  };

  const eliminar=async(u)=>{
    if(!confirm(`¿Eliminar usuario "${u.nombre}"?`))return;
    await apiFetch(`/usuarios/${u.id}`,{method:'DELETE'});load();
  };

  const toggleModulo=(permiso,modulo,checked)=>{
    const mods=permiso.modulos||[];
    return checked?[...mods,modulo]:mods.filter(m=>m!==modulo);
  };

  const guardarPermisos=async()=>{
    setLoading(true);
    await apiFetch(`/usuarios/${editing.id}`,{method:'PUT',body:{activo:editing.activo,permisos:editing.permisos}});
    setEditing(null);setLoading(false);load();
  };

  return(<div className="page active">
    <div className="page-header"><h2>Gestión de usuarios</h2><p>Creá usuarios y asignales sucursales y módulos</p></div>

    {nuevoOk&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'10px 14px',fontSize:13,color:'#166534',marginBottom:12}}>{nuevoOk}</div>}

    {/* Crear usuario */}
    <div className="card">
      <div className="card-title">
        <span>Crear usuario</span>
        <button className="btn btn-sm" onClick={()=>{setShowNuevo(!showNuevo);setNuevoError('');}}>{showNuevo?'✕ Cancelar':'+ Nuevo usuario'}</button>
      </div>
      {showNuevo&&(<div>
        <div className="form-grid mb-1">
          <div className="form-field"><label>Nombre</label><input value={nuevoForm.nombre} onChange={e=>setNuevoForm({...nuevoForm,nombre:e.target.value})} placeholder="Nombre completo"/></div>
          <div className="form-field"><label>Email</label><input type="email" value={nuevoForm.email} onChange={e=>setNuevoForm({...nuevoForm,email:e.target.value})} placeholder="email@ejemplo.com"/></div>
          <div className="form-field"><label>Contraseña inicial</label><input type="password" value={nuevoForm.password} onChange={e=>setNuevoForm({...nuevoForm,password:e.target.value})} placeholder="Mínimo 6 caracteres"/></div>
        </div>
        {nuevoError&&<p className="login-error">{nuevoError}</p>}
        <button className="btn btn-primary" onClick={crearUsuario} disabled={loading}>{loading?'Creando...':'Crear y activar usuario'}</button>
        <p className="text-sm mt-1" style={{color:'var(--text2)'}}>El usuario queda activo de inmediato. Asignale sucursales y módulos desde la tabla abajo.</p>
      </div>)}
    </div>

    {/* Lista de usuarios */}
    <div className="card">
      <div className="card-title">Usuarios registrados ({usuarios.length})</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Estado</th><th>Sucursales con acceso</th><th></th></tr></thead>
        <tbody>
          {!usuarios.length&&<tr><td colSpan={5}><div className="empty-state"><div className="icon">👥</div><p>Sin usuarios aún. Creá el primero arriba.</p></div></td></tr>}
          {usuarios.map(u=>(
            <tr key={u.id}>
              <td>
                <strong>{u.nombre}</strong>
                {u.es_superadmin&&<span className="badge badge-blue" style={{marginLeft:6,fontSize:10}}>Superadmin</span>}
              </td>
              <td>{u.email}</td>
              <td>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                  <input type="checkbox" checked={u.activo} onChange={()=>toggleActivo(u)}/>
                  <span className={`badge ${u.activo?'badge-green':'badge-amber'}`}>{u.activo?'Activo':'Inactivo'}</span>
                </label>
              </td>
              <td>
                <span className="text-sm">
                  {(u.permisos||[]).length===0?<span style={{color:'var(--text3)'}}>Sin sucursales asignadas</span>
                    :u.permisos.map(p=><span key={p.restaurante_id} className="tag">{p.restaurante_nombre}</span>)}
                </span>
              </td>
              <td style={{display:'flex',gap:4}}>
                <button className="btn btn-sm" onClick={()=>setEditing({...u,permisos:u.permisos||[]})}>✏️ Permisos</button>
                {!u.es_superadmin&&<button className="btn btn-sm btn-danger" onClick={()=>eliminar(u)}>🗑</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>

    {/* Modal permisos */}
    {editing&&(
      <Modal title={`Permisos — ${editing.nombre}`} onClose={()=>setEditing(null)} wide>
        <div style={{marginBottom:14}}>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer'}}>
            <input type="checkbox" checked={editing.activo} onChange={e=>setEditing({...editing,activo:e.target.checked})}/>
            <strong>Usuario activo</strong> — puede ingresar al sistema
          </label>
        </div>

        <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:'var(--text2)'}}>Sucursales y módulos habilitados</div>
        {restaurantes.length===0&&<p className="text-sm" style={{color:'var(--text3)'}}>No hay sucursales cargadas.</p>}
        {restaurantes.map(r=>{
          const permiso=editing.permisos.find(p=>p.restaurante_id===r.id)||{restaurante_id:r.id,modulos:[]};
          const tieneAcceso=editing.permisos.some(p=>p.restaurante_id===r.id);
          const todosModulos=permiso.modulos.length===0;
          return(<div key={r.id} style={{border:'1px solid var(--border)',borderRadius:6,padding:12,marginBottom:8,background:tieneAcceso?'var(--bg3)':'var(--bg2)'}}>
            <label style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,marginBottom:tieneAcceso?10:0,cursor:'pointer',fontSize:14}}>
              <input type="checkbox" checked={tieneAcceso} onChange={e=>{
                if(e.target.checked) setEditing({...editing,permisos:[...editing.permisos,{restaurante_id:r.id,modulos:[]}]});
                else setEditing({...editing,permisos:editing.permisos.filter(p=>p.restaurante_id!==r.id)});
              }}/> 🏪 {r.nombre}
            </label>
            {tieneAcceso&&(<>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:6,marginLeft:24}}>Módulos habilitados:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginLeft:24}}>
                <label style={{fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:4,background:todosModulos?'var(--primary)':'var(--bg2)',color:todosModulos?'var(--primary-fg)':'var(--text2)',border:'1px solid var(--border)',fontWeight:600}}>
                  <input type="checkbox" style={{display:'none'}} checked={todosModulos} onChange={()=>{
                    setEditing({...editing,permisos:editing.permisos.map(p=>p.restaurante_id===r.id?{...p,modulos:[]}:p)});
                  }}/> ✓ Todos
                </label>
                {TODOS_MODULOS.map(m=>{
                  const activo=!todosModulos&&permiso.modulos.includes(m);
                  return(<label key={m} style={{fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:4,background:activo?'var(--primary)':'var(--bg2)',color:activo?'var(--primary-fg)':'var(--text2)',border:'1px solid var(--border)'}}>
                    <input type="checkbox" style={{display:'none'}} checked={activo} onChange={e=>{
                      const newMods=toggleModulo(permiso,m,e.target.checked);
                      setEditing({...editing,permisos:editing.permisos.map(p=>p.restaurante_id===r.id?{...p,modulos:newMods}:p)});
                    }}/>{MODULO_LABELS[m]}
                  </label>);
                })}
              </div>
            </>)}
          </div>);
        })}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn" onClick={()=>setEditing(null)}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={guardarPermisos} disabled={loading}>{loading?'Guardando...':'✓ Guardar permisos'}</button>
        </div>
      </Modal>
    )}
  </div>);
}

// ── APP ──────────────────────────────────────────────────
const TODOS_NAV=[
  {section:'Recetas',items:[{id:'productos',label:'Productos brutos',icon:'📦'},{id:'intermedias',label:'Recetas intermedias',icon:'🧪'},{id:'finales',label:'Platos finales',icon:'🍽️'}]},
  {section:'Operaciones',items:[{id:'ventas',label:'Ventas',icon:'💰'},{id:'entregas',label:'Entregas',icon:'🚚'},{id:'stock',label:'Stock semanal',icon:'📊'},{id:'stocklink',label:'Link de stock',icon:'🔗'}]},
  {section:'Análisis',items:[{id:'consumo',label:'Consumo teórico',icon:'📈'}]},
  {section:'Config',items:[{id:'branding',label:'Branding',icon:'🎨'},{id:'sucursales',label:'Sucursales',icon:'🏪'},{id:'usuarios',label:'Usuarios',icon:'👥'}]},
];

export default function App(){
  const[user,setUser]=useState(null);
  const[page,setPage]=useState('productos');
  const[db,setDb]=useState({productos:[],intermedias:[],finales:[]});
  const[branding,setBranding]=useState(null);
  const[showSucursales,setShowSucursales]=useState(false);

  useEffect(()=>{
    const token=localStorage.getItem('rp_token');
    const u=localStorage.getItem('rp_user');
    const b=localStorage.getItem('rp_branding');
    if(token&&u) setUser(JSON.parse(u));
    if(b) try{const bd=JSON.parse(b);setBranding(bd);applyBranding(bd);}catch(e){}
  },[]);

  const loadAll=useCallback(async()=>{
    const[p,i,f]=await Promise.all([apiFetch('/productos'),apiFetch('/intermedias'),apiFetch('/finales')]);
    setDb({productos:p,intermedias:i,finales:f});
    try{const b=await apiFetch('/branding');if(b){setBranding(b);applyBranding(b);localStorage.setItem('rp_branding',JSON.stringify(b));}}catch(e){}
  },[]);

  useEffect(()=>{if(user)loadAll();},[user,loadAll]);

  const cambiarSucursal=(sucursal)=>{
    setShowSucursales(false);
    localStorage.setItem('rp_sucursal_id', sucursal.id);
    localStorage.setItem('rp_modulos', JSON.stringify(sucursal.modulos||'all'));
    setUser(u=>({...u, sucursal, modulos:sucursal.modulos||'all'}));
    setSucursalNombre(sucursal.nombre);
    setPage('productos');
    loadAll();
  };

  const logout=()=>{
    ['rp_token','rp_user','rp_branding','rp_sucursal_id','rp_modulos'].forEach(k=>localStorage.removeItem(k));
    setUser(null);
  };

  if(!user) return <Login onLogin={u=>setUser(u)}/>;

  // Filtrar módulos según permisos del usuario
  const modulos=user.modulos||'all';
  const tieneAcceso=m=>modulos==='all'||user.esSuperadmin||(Array.isArray(modulos)&&(modulos.length===0||modulos.includes(m)));

  const NAV=TODOS_NAV.map(s=>({...s,items:s.items.filter(item=>{
    if(item.id==='usuarios') return user.esSuperadmin;
    return tieneAcceso(item.id);
  })})).filter(s=>s.items.length>0);

  const renderPage=()=>{
    if(page==='productos') return <Productos data={db.productos} onRefresh={loadAll}/>;
    if(page==='intermedias') return <Intermedias data={db.intermedias} productos={db.productos} onRefresh={loadAll}/>;
    if(page==='finales') return <Finales data={db.finales} productos={db.productos} intermedias={db.intermedias} onRefresh={loadAll}/>;
    if(page==='ventas') return <Ventas finales={db.finales}/>;
    if(page==='entregas') return <Entregas productos={db.productos} intermedias={db.intermedias}/>;
    if(page==='stock') return <Stock productos={db.productos}/>;
    if(page==='stocklink') return <StockLink productos={db.productos}/>;
    if(page==='consumo') return <Consumo/>;
    if(page==='branding') return <Branding onSave={b=>{setBranding(b);applyBranding(b);localStorage.setItem('rp_branding',JSON.stringify(b));}}/>;
    if(page==='sucursales') return <Sucursales onUpdate={nombre=>setSucursalNombre(nombre)}/>;
    if(page==='usuarios') return <Usuarios/>;
  };

  const sidebarBg=branding?.primaryColor||'var(--bg2)';
  const sidebarTxt=branding?.secondaryColor||'var(--text2)';
  // Always get fresh sucursal name from db if available
  const[sucursalNombre,setSucursalNombre]=useState(user.sucursal?.nombre||user.nombre);
  useEffect(()=>{
    apiFetch('/sucursales').then(subs=>{
      const current=subs.find(s=>s.id===parseInt(localStorage.getItem('rp_sucursal_id')));
      if(current) setSucursalNombre(current.nombre);
    }).catch(()=>{});
  },[]);

  return(<div className="app">
    <div className="sidebar" style={{background:sidebarBg,position:'relative'}}>
      <div className="sidebar-header" style={{borderColor:'rgba(255,255,255,.15)',cursor:user.sucursales?.length>1?'pointer':'default'}}
        onClick={()=>setShowSucursales(s=>!s)}>
        {branding?.logoBase64||branding?.logoUrl
          ? <img src={branding.logoBase64||branding.logoUrl} alt="logo" style={{height:36,objectFit:'contain',marginBottom:4}}/>
          : <div className="rest-name" style={{color:sidebarTxt}}>{branding?.appName||'RecetasPro'}</div>
        }
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div className="rest-sub" style={{color:sidebarTxt,opacity:.7}}>{sucursalNombre}</div>
          <span style={{color:sidebarTxt,opacity:.4,fontSize:10}}>▾</span>
        </div>
        {showSucursales&&(
          <div style={{position:'absolute',top:72,left:0,right:0,background:'white',border:'1px solid var(--border)',borderRadius:6,boxShadow:'0 4px 12px rgba(0,0,0,.15)',zIndex:200,overflow:'hidden'}}>
            {user.sucursales.map(s=>(
              <div key={s.id} style={{padding:'10px 14px',fontSize:13,cursor:'pointer',borderBottom:'1px solid var(--border)',color:'var(--text)',fontWeight:s.id===user.sucursal?.id?600:400,background:s.id===user.sucursal?.id?'var(--bg3)':'white'}}
                onClick={e=>{e.stopPropagation();cambiarSucursal(s);}}>
                🏪 {s.nombre}
              </div>
            ))}
          </div>
        )}
      </div>
      {NAV.map(s=>(<div className="nav-section" key={s.section}>
        <div className="nav-label" style={{color:sidebarTxt,opacity:.5}}>{s.section}</div>
        {s.items.map(item=>(<div key={item.id}
          className={`nav-item${page===item.id?' active':''}`}
          style={{color:sidebarTxt,background:page===item.id?'rgba(255,255,255,.18)':'',opacity:page===item.id?1:.8}}
          onClick={()=>setPage(item.id)}>
          <span>{item.icon}</span>{item.label}
        </div>))}
      </div>))}
      <div className="sidebar-footer" style={{borderColor:'rgba(255,255,255,.15)'}}>
        {user.esSuperadmin&&<div style={{fontSize:11,color:sidebarTxt,opacity:.5,marginBottom:6}}>Superadmin</div>}
        <button className="logout-btn" style={{color:sidebarTxt,opacity:.7}} onClick={logout}>🚪 Cerrar sesión</button>
      </div>
    </div>
    <div className="content">{renderPage()}</div>
  </div>);
}
