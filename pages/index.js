import { useState, useEffect, useCallback, useRef } from 'react';

const today = () => new Date().toISOString().split('T')[0];
const mondayOfWeek = () => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().split('T')[0]; };
const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };
const fmtDate = iso => { if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };

function getToken(){ return typeof window!=='undefined'?localStorage.getItem('rp_token'):null; }
async function apiFetch(path,opts={}){
  const token=getToken();
  const res=await fetch('/api'+path,{
    ...opts,
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...(opts.headers||{})},
    body:opts.body?JSON.stringify(opts.body):undefined,
  });
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
  getConsumo:(desde,hasta)=>apiFetch(`/consumo?desde=${desde}&hasta=${hasta}`),
};

// ─── Modal ───────────────────────────────────────────────
function Modal({title,onClose,children,wide}){
  return(
    <div className="modal-bg open" onClick={e=>e.target.classList.contains('modal-bg')&&onClose()}>
      <div className="modal" style={wide?{maxWidth:680}:{}}>
        <div className="modal-header"><h3>{title}</h3><button className="close-btn" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

// ─── Buscador autocomplete ───────────────────────────────
function BuscadorPlato({finales, value, onChange}){
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef(null);

  const filtered = finales.filter(p=>p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0,12);

  useEffect(()=>{
    // Cerrar si click fuera
    const handler = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return ()=>document.removeEventListener('mousedown', handler);
  },[]);

  const select = (p) => {
    onChange(p);
    setQuery(p.nombre);
    setOpen(false);
  };

  const handleKey = e => {
    if(!open) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); setCursor(c=>Math.min(c+1,filtered.length-1)); }
    if(e.key==='ArrowUp'){ e.preventDefault(); setCursor(c=>Math.max(c-1,0)); }
    if(e.key==='Enter' && filtered[cursor]){ e.preventDefault(); select(filtered[cursor]); }
    if(e.key==='Escape'){ setOpen(false); }
  };

  return(
    <div ref={ref} style={{position:'relative',flex:2,minWidth:200}}>
      <div className="form-field">
        <label>Plato</label>
        <input
          value={query}
          onChange={e=>{ setQuery(e.target.value); setOpen(true); setCursor(0); onChange(null); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Escribí para buscar..."
          autoComplete="off"
        />
      </div>
      {open && filtered.length>0 && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',boxShadow:'0 4px 12px rgba(0,0,0,.12)',zIndex:50,maxHeight:280,overflowY:'auto'}}>
          {filtered.map((p,i)=>(
            <div key={p.id}
              onMouseDown={()=>select(p)}
              style={{padding:'7px 12px',fontSize:13,cursor:'pointer',background:i===cursor?'var(--bg3)':'transparent',borderBottom:'1px solid var(--border)'}}
              onMouseEnter={()=>setCursor(i)}
            >{p.nombre}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── IngRow ──────────────────────────────────────────────
function IngRow({ing,idx,productos,intermedias,finales,onChange,onRemove,allowFinal}){
  return(
    <div className="ing-row">
      <div className="form-field" style={{flex:2,minWidth:160}}>
        <label style={{fontSize:11}}>Ingrediente</label>
        <select value={`${ing.tipo}:${ing.ref_id}`} onChange={e=>{
          const[tipo,ref_id]=e.target.value.split(':');
          onChange(idx,{...ing,tipo,ref_id:parseInt(ref_id)});
        }}>
          <option value=":">— Seleccioná —</option>
          <optgroup label="Productos brutos">{productos.map(p=><option key={p.id} value={`producto:${p.id}`}>{p.nombre}</option>)}</optgroup>
          {intermedias.length>0&&<optgroup label="Recetas intermedias">{intermedias.map(r=><option key={r.id} value={`intermedia:${r.id}`}>{r.nombre}</option>)}</optgroup>}
          {allowFinal&&finales&&finales.length>0&&<optgroup label="Platos finales">{finales.map(r=><option key={r.id} value={`final:${r.id}`}>{r.nombre}</option>)}</optgroup>}
        </select>
      </div>
      <div className="form-field" style={{minWidth:80}}>
        <label style={{fontSize:11}}>Cantidad</label>
        <input type="number" min="0" step="0.001" value={ing.cantidad} onChange={e=>onChange(idx,{...ing,cantidad:e.target.value})}/>
      </div>
      <div className="form-field" style={{minWidth:70}}>
        <label style={{fontSize:11}}>Unidad</label>
        <select value={ing.unidad} onChange={e=>onChange(idx,{...ing,unidad:e.target.value})}>
          {['kg','g','unidad','litro','ml','porcion','grs','lts','und','roll'].map(u=><option key={u}>{u}</option>)}
        </select>
      </div>
      <button className="btn btn-sm btn-danger" onClick={()=>onRemove(idx)} style={{marginBottom:1}}>×</button>
    </div>
  );
}

// ─── PRODUCTOS BRUTOS ────────────────────────────────────
function Productos({data,onRefresh}){
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[form,setForm]=useState({nombre:'',unidad:'kg',merma:'',notas:''});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[search,setSearch]=useState('');

  const openNew=()=>{setEditing(null);setForm({nombre:'',unidad:'kg',merma:'',notas:''});setError('');setModal(true);};
  const openEdit=p=>{setEditing(p);setForm({nombre:p.nombre,unidad:p.unidad,merma:p.merma,notas:p.notas||''});setError('');setModal(true);};
  const save=async()=>{
    if(!form.nombre.trim()){setError('Ingresá el nombre');return;}
    setLoading(true);setError('');
    try{
      if(editing) await api.updateProducto(editing.id,{...form,merma:parseFloat(form.merma)||0});
      else await api.createProducto({...form,merma:parseFloat(form.merma)||0});
      setModal(false);onRefresh();
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteProducto(id);onRefresh();};
  const filtered=data.filter(p=>p.nombre.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className="page active">
      <div className="page-header"><h2>Productos brutos</h2><p>Materia prima con merma por procesado o descongelado</p></div>
      <div className="card">
        <div className="card-title">
          <span>Productos ({filtered.length})</span>
          <div style={{display:'flex',gap:8}}>
            <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
            <button className="btn btn-sm" onClick={openNew}>+ Nuevo</button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>SKU</th><th>Producto</th><th>Unidad</th><th>Merma</th><th>Rendimiento</th><th></th></tr></thead>
          <tbody>
            {!filtered.length&&<tr><td colSpan={6}><div className="empty-state"><div className="icon">📦</div><p>Sin resultados.</p></div></td></tr>}
            {filtered.map(p=>(
              <tr key={p.id}>
                <td><span className="badge badge-gray" style={{fontSize:10}}>{p.notas||'—'}</span></td>
                <td><strong>{p.nombre}</strong></td>
                <td>{p.unidad}</td>
                <td><span className={`badge ${p.merma>30?'badge-amber':p.merma>15?'badge-blue':'badge-green'}`}>{p.merma}%</span></td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{(100-p.merma).toFixed(0)}%</span>
                    <div className="progress-bar" style={{flex:1,minWidth:50}}>
                      <div className="progress-fill" style={{width:`${100-p.merma}%`,background:p.merma>30?'var(--warn)':p.merma>15?'var(--blue)':'var(--success)'}}/>
                    </div>
                  </div>
                </td>
                <td style={{display:'flex',gap:4}}>
                  <button className="btn btn-sm" onClick={()=>openEdit(p)}>✏️</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>del(p.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      {modal&&(
        <Modal title={editing?'Editar producto':'Nuevo producto bruto'} onClose={()=>setModal(false)}>
          <div className="form-grid mb-1">
            <div className="form-field"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="ej: Langostino congelado"/></div>
            <div className="form-field"><label>Unidad</label>
              <select value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})}>
                {['kg','g','unidad','litro','lts','grs','und','porcion'].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-field"><label>Merma (%)</label><input type="number" min="0" max="100" step="0.01" value={form.merma} onChange={e=>setForm({...form,merma:e.target.value})} placeholder="ej: 15.30"/></div>
            <div className="form-field"><label>SKU / Notas</label><input value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="ej: LANX"/></div>
          </div>
          {error&&<p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear producto'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── INTERMEDIAS ─────────────────────────────────────────
function Intermedias({data,productos,onRefresh}){
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[form,setForm]=useState({nombre:'',rinde:''});
  const[ings,setIngs]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[search,setSearch]=useState('');
  const[expanded,setExpanded]=useState(null);

  const openNew=()=>{setEditing(null);setForm({nombre:'',rinde:''});setIngs([]);setError('');setModal(true);};
  const openEdit=r=>{setEditing(r);setForm({nombre:r.nombre,rinde:r.rinde||''});setIngs((r.ingredientes||[]).map(i=>({tipo:i.tipo,ref_id:i.ref_id,cantidad:i.cantidad,unidad:i.unidad})));setError('');setModal(true);};
  const addIng=()=>setIngs([...ings,{tipo:'producto',ref_id:0,cantidad:'',unidad:'kg'}]);
  const updateIng=(i,v)=>{const a=[...ings];a[i]=v;setIngs(a);};
  const removeIng=i=>setIngs(ings.filter((_,idx)=>idx!==i));

  const resolveNombre=(tipo,ref_id)=>{
    if(tipo==='producto') return productos.find(p=>p.id===ref_id)?.nombre||'?';
    return data.find(r=>r.id===ref_id)?.nombre||'?';
  };

  const save=async()=>{
    if(!form.nombre.trim()){setError('Ingresá el nombre');return;}
    setLoading(true);setError('');
    try{
      const payload={...form,ingredientes:ings.map(i=>({...i,ref_id:parseInt(i.ref_id),cantidad:parseFloat(i.cantidad)||0}))};
      if(editing) await api.updateIntermedia(editing.id,payload);
      else await api.createIntermedia(payload);
      setModal(false);onRefresh();
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteIntermedia(id);onRefresh();};
  const filtered=data.filter(r=>r.nombre.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className="page active">
      <div className="page-header"><h2>Recetas intermedias</h2><p>Preparaciones base a 1kg — reutilizables en platos</p></div>
      <div className="card">
        <div className="card-title">
          <span>Intermedias ({filtered.length})</span>
          <div style={{display:'flex',gap:8}}>
            <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
            <button className="btn btn-sm" onClick={openNew}>+ Nueva</button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Nombre</th><th>Rinde</th><th>Ingredientes</th><th></th></tr></thead>
          <tbody>
            {!filtered.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">🧪</div><p>Sin resultados.</p></div></td></tr>}
            {filtered.map(r=>(
              <>
                <tr key={r.id}>
                  <td><strong style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>{expanded===r.id?'▾':'▸'} {r.nombre}</strong></td>
                  <td><span className="badge badge-gray">{r.rinde||'1 kg'}</span></td>
                  <td><span className="text-sm">{(r.ingredientes||[]).length} ingredientes</span></td>
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm" onClick={()=>openEdit(r)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>del(r.id)}>🗑</button>
                  </td>
                </tr>
                {expanded===r.id&&(
                  <tr key={`exp-${r.id}`}>
                    <td colSpan={4} style={{background:'var(--bg3)',padding:'8px 16px'}}>
                      {(r.ingredientes||[]).map((ing,i)=>(
                        <span key={i} className="tag">{ing.tipo==='intermedia'?'🧪':'📦'} {resolveNombre(ing.tipo,ing.ref_id)} — {parseFloat(ing.cantidad).toFixed(4)} {ing.unidad}</span>
                      ))}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table></div>
      </div>
      {modal&&(
        <Modal title={editing?'Editar receta intermedia':'Nueva receta intermedia'} onClose={()=>setModal(false)} wide>
          <div className="form-grid mb-1">
            <div className="form-field"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="ej: Vinagreta"/></div>
            <div className="form-field"><label>Rendimiento</label><input value={form.rinde} onChange={e=>setForm({...form,rinde:e.target.value})} placeholder="ej: 1 kg"/></div>
          </div>
          <div className="card-title" style={{fontSize:13}}>Ingredientes</div>
          {ings.map((ing,i)=><IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={data} finales={[]} onChange={updateIng} onRemove={removeIng} allowFinal={false}/>)}
          <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
          {error&&<p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear receta'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── FINALES ─────────────────────────────────────────────
function Finales({data,productos,intermedias,onRefresh}){
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[nombre,setNombre]=useState('');
  const[ings,setIngs]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[search,setSearch]=useState('');
  const[expanded,setExpanded]=useState(null);

  const openNew=()=>{setEditing(null);setNombre('');setIngs([]);setError('');setModal(true);};
  const openEdit=r=>{setEditing(r);setNombre(r.nombre);setIngs((r.ingredientes||[]).map(i=>({tipo:i.tipo,ref_id:i.ref_id,cantidad:i.cantidad,unidad:i.unidad})));setError('');setModal(true);};
  const addIng=()=>setIngs([...ings,{tipo:'producto',ref_id:0,cantidad:'',unidad:'kg'}]);
  const updateIng=(i,v)=>{const a=[...ings];a[i]=v;setIngs(a);};
  const removeIng=i=>setIngs(ings.filter((_,idx)=>idx!==i));

  // Resuelve nombre para los 3 tipos: producto, intermedia, final
  const resolveNombre=(tipo,ref_id)=>{
    if(tipo==='producto') return productos.find(p=>p.id===ref_id)?.nombre||`?prod(${ref_id})`;
    if(tipo==='intermedia') return intermedias.find(r=>r.id===ref_id)?.nombre||`?int(${ref_id})`;
    if(tipo==='final') return data.find(r=>r.id===ref_id)?.nombre||`?final(${ref_id})`;
    return '?';
  };
  const tipoIcon=tipo=>tipo==='intermedia'?'🧪':tipo==='final'?'🍽️':'📦';

  const save=async()=>{
    if(!nombre.trim()){setError('Ingresá el nombre');return;}
    setLoading(true);setError('');
    try{
      const payload={nombre,ingredientes:ings.map(i=>({...i,ref_id:parseInt(i.ref_id),cantidad:parseFloat(i.cantidad)||0}))};
      if(editing) await api.updateFinal(editing.id,payload);
      else await api.createFinal(payload);
      setModal(false);onRefresh();
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  const del=async id=>{if(!confirm('¿Eliminar?'))return;await api.deleteFinal(id);onRefresh();};
  const filtered=data.filter(r=>r.nombre.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className="page active">
      <div className="page-header"><h2>Platos finales</h2><p>Platos del menú que se venden al cliente</p></div>
      <div className="card">
        <div className="card-title">
          <span>Platos ({filtered.length})</span>
          <div style={{display:'flex',gap:8}}>
            <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
            <button className="btn btn-sm" onClick={openNew}>+ Nuevo</button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Plato</th><th>Ingredientes</th><th></th></tr></thead>
          <tbody>
            {!filtered.length&&<tr><td colSpan={3}><div className="empty-state"><div className="icon">🍽️</div><p>Sin resultados.</p></div></td></tr>}
            {filtered.map(r=>(
              <>
                <tr key={r.id}>
                  <td><strong style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>{expanded===r.id?'▾':'▸'} {r.nombre}</strong></td>
                  <td><span className="text-sm">{(r.ingredientes||[]).length} ingredientes</span></td>
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm" onClick={()=>openEdit(r)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>del(r.id)}>🗑</button>
                  </td>
                </tr>
                {expanded===r.id&&(
                  <tr key={`exp-${r.id}`}>
                    <td colSpan={3} style={{background:'var(--bg3)',padding:'8px 16px'}}>
                      {(r.ingredientes||[]).length===0 && <span className="text-sm">Sin ingredientes</span>}
                      {(r.ingredientes||[]).map((ing,i)=>(
                        <span key={i} className="tag">
                          {tipoIcon(ing.tipo)} {resolveNombre(ing.tipo,ing.ref_id)} — {parseFloat(ing.cantidad).toFixed(3)} {ing.unidad}
                        </span>
                      ))}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table></div>
      </div>
      {modal&&(
        <Modal title={editing?'Editar plato':'Nuevo plato final'} onClose={()=>setModal(false)} wide>
          <div className="form-field mb-1"><label>Nombre del plato</label><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="ej: Roll de sushi de langostinos"/></div>
          <div className="card-title" style={{fontSize:13}}>Ingredientes</div>
          {ings.map((ing,i)=><IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={intermedias} finales={data} onChange={updateIng} onRemove={removeIng} allowFinal={true}/>)}
          <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
          {error&&<p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading?'Guardando...':editing?'Guardar cambios':'Crear plato'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── VENTAS ──────────────────────────────────────────────
function Ventas({finales}){
  const[ventas,setVentas]=useState([]);
  const[platoSel,setPlatoSel]=useState(null); // plato objeto seleccionado
  const[fecha,setFecha]=useState(today());
  const[cantidad,setCantidad]=useState(1);
  const[nota,setNota]=useState(''); // nota libre (para armalas como quieras, etc)
  const[loading,setLoading]=useState(false);

  const load=useCallback(async()=>{const d=await api.getVentas();setVentas(d);},[]);
  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!platoSel||!fecha){alert('Seleccioná fecha y plato');return;}
    setLoading(true);
    await api.createVenta({
      fecha,
      receta_final_id: platoSel.id,
      receta_nombre: platoSel.nombre + (nota ? ` (${nota})` : ''),
      cantidad: parseInt(cantidad)||1,
    });
    setLoading(false);
    setPlatoSel(null);
    setNota('');
    setCantidad(1);
    load();
  };

  const del=async id=>{await api.deleteVenta(id);load();};

  return(
    <div className="page active">
      <div className="page-header"><h2>Carga de ventas</h2><p>Registrá las ventas diarias de cada plato</p></div>
      <div className="card">
        <div className="card-title">Registrar venta</div>
        <div className="form-row" style={{alignItems:'flex-end'}}>
          <div className="form-field" style={{minWidth:130}}>
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
          </div>
          <BuscadorPlato finales={finales} value={platoSel} onChange={p=>{setPlatoSel(p);setNota('');}}/>
          <div className="form-field" style={{minWidth:80}}>
            <label>Cantidad</label>
            <input type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)}/>
          </div>
          <button className="btn" onClick={save} disabled={loading||!platoSel}>{loading?'...':'✓ Registrar'}</button>
        </div>
        {/* Nota libre — útil para "Armala como quieras", especificar variedades o detalles */}
        {platoSel&&(
          <div style={{marginTop:10}}>
            <div className="form-field">
              <label>Nota / detalle (opcional) — ej: cantidad de rolls o variedades elegidas</label>
              <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="ej: 2 rolls salmón, 1 langostinos — o dejá vacío"/>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-title">Ventas recientes</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Plato / Detalle</th><th>Cant.</th><th></th></tr></thead>
          <tbody>
            {!ventas.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">💰</div><p>Sin ventas aún.</p></div></td></tr>}
            {ventas.map(v=>(
              <tr key={v.id}>
                <td>{fmtDate(v.fecha)}</td>
                <td>{v.receta_nombre}</td>
                <td><strong>{v.cantidad}</strong></td>
                <td><button className="btn btn-sm btn-danger" onClick={()=>del(v.id)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

// ─── STOCK ───────────────────────────────────────────────
function Stock({productos}){
  const[stocks,setStocks]=useState([]);
  const[form,setForm]=useState({fecha:today(),producto_id:'',cantidad:0});
  const load=async()=>setStocks(await api.getStocks());
  useEffect(()=>{load();},[]);
  const save=async()=>{
    if(!form.producto_id||!form.fecha){alert('Completá fecha y producto');return;}
    const prod=productos.find(p=>p.id===parseInt(form.producto_id));
    await api.createStock({...form,producto_id:parseInt(form.producto_id),producto_nombre:prod.nombre,unidad:prod.unidad,cantidad:parseFloat(form.cantidad)||0});
    load();
  };
  const del=async id=>{await api.deleteStock(id);load();};
  return(
    <div className="page active">
      <div className="page-header"><h2>Stock semanal</h2><p>Conteo de inventario — se recomienda cada lunes a la mañana</p></div>
      <div className="card">
        <div className="card-title">Registrar stock</div>
        <div className="form-row">
          <div className="form-field" style={{minWidth:130}}><label>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></div>
          <div className="form-field" style={{flex:2,minWidth:200}}><label>Producto</label>
            <select value={form.producto_id} onChange={e=>setForm({...form,producto_id:e.target.value})}>
              <option value="">— Seleccioná producto —</option>
              {[...productos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
            </select>
          </div>
          <div className="form-field" style={{minWidth:100}}><label>Cantidad</label><input type="number" min="0" step="0.01" value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})}/></div>
          <button className="btn" onClick={save}>✓ Guardar</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Historial</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th></th></tr></thead>
          <tbody>
            {!stocks.length&&<tr><td colSpan={4}><div className="empty-state"><div className="icon">📦</div><p>Sin stock cargado.</p></div></td></tr>}
            {stocks.map(s=><tr key={s.id}><td>{fmtDate(s.fecha)}</td><td>{s.producto_nombre}</td><td><strong>{parseFloat(s.cantidad).toFixed(2)}</strong> {s.unidad}</td><td><button className="btn btn-sm btn-danger" onClick={()=>del(s.id)}>🗑</button></td></tr>)}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

// ─── CONSUMO ─────────────────────────────────────────────
function Consumo(){
  const[periodo,setPeriodo]=useState('semana');
  const[semanaDesde,setSemanaDesde]=useState(mondayOfWeek());
  const[dia,setDia]=useState(today());
  const[mes,setMes]=useState(today().slice(0,7));
  const[rangoDesde,setRangoDesde]=useState(mondayOfWeek());
  const[rangoHasta,setRangoHasta]=useState(today());
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  // Filtro de productos
  const[filtroActivo,setFiltroActivo]=useState(false);
  const[productosFiltro,setProductosFiltro]=useState(new Set()); // nombres seleccionados

  const calcular=async()=>{
    let desde,hasta;
    if(periodo==='semana'){desde=semanaDesde;hasta=addDays(semanaDesde,6);}
    else if(periodo==='dia'){desde=hasta=dia;}
    else if(periodo==='mes'){const[y,m]=mes.split('-');desde=`${y}-${m}-01`;const d=new Date(y,m,0);hasta=d.toISOString().split('T')[0];}
    else{desde=rangoDesde;hasta=rangoHasta;}
    setLoading(true);setError('');setResult(null);
    try{const data=await api.getConsumo(desde,hasta);setResult({...data,desde,hasta});}
    catch(e){setError(e.message);}
    setLoading(false);
  };

  const toggleFiltroProducto=nombre=>{
    setProductosFiltro(prev=>{
      const s=new Set(prev);
      if(s.has(nombre)) s.delete(nombre); else s.add(nombre);
      return s;
    });
  };

  const consumoMostrado = result?.consumo
    ? (filtroActivo && productosFiltro.size>0
        ? result.consumo.filter(p=>productosFiltro.has(p.nombre))
        : result.consumo)
    : [];

  return(
    <div className="page active">
      <div className="page-header"><h2>Consumo teórico</h2><p>En base a las ventas, ¿cuánto debería haberse consumido?</p></div>
      <div className="card">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-field">
            <label>Período</label>
            <div className="tabs">
              {[['semana','Semana'],['dia','Día'],['mes','Mes'],['rango','Rango']].map(([p,l])=>(
                <button key={p} className={`tab${periodo===p?' active':''}`} onClick={()=>setPeriodo(p)}>{l}</button>
              ))}
            </div>
          </div>
          {periodo==='semana'&&<div className="form-field"><label>Semana del</label><input type="date" value={semanaDesde} onChange={e=>setSemanaDesde(e.target.value)}/></div>}
          {periodo==='dia'&&<div className="form-field"><label>Día</label><input type="date" value={dia} onChange={e=>setDia(e.target.value)}/></div>}
          {periodo==='mes'&&<div className="form-field"><label>Mes</label><input type="month" value={mes} onChange={e=>setMes(e.target.value)}/></div>}
          {periodo==='rango'&&<><div className="form-field"><label>Desde</label><input type="date" value={rangoDesde} onChange={e=>setRangoDesde(e.target.value)}/></div><div className="form-field"><label>Hasta</label><input type="date" value={rangoHasta} onChange={e=>setRangoHasta(e.target.value)}/></div></>}
          <button className="btn" onClick={calcular} disabled={loading}>{loading?'Calculando...':'📊 Calcular'}</button>
        </div>
        {error&&<p className="login-error mt-1">{error}</p>}
      </div>

      {result&&result.consumo?.length>0&&(
        <div className="card">
          <div className="card-title">
            <span>Filtrar productos</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{fontSize:12,color:'var(--text2)',display:'flex',alignItems:'center',gap:4,cursor:'pointer'}}>
                <input type="checkbox" checked={filtroActivo} onChange={e=>setFiltroActivo(e.target.checked)}/>
                Activar filtro
              </label>
              {filtroActivo&&<button className="btn btn-sm" onClick={()=>setProductosFiltro(new Set(result.consumo.map(p=>p.nombre)))}>Seleccionar todos</button>}
              {filtroActivo&&<button className="btn btn-sm" onClick={()=>setProductosFiltro(new Set())}>Limpiar</button>}
            </div>
          </div>
          {filtroActivo&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {result.consumo.map(p=>(
                <label key={p.nombre} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',padding:'4px 8px',borderRadius:4,background:productosFiltro.has(p.nombre)?'var(--primary)':'var(--bg3)',color:productosFiltro.has(p.nombre)?'var(--primary-fg)':'var(--text2)',border:'1px solid var(--border)'}}>
                  <input type="checkbox" style={{display:'none'}} checked={productosFiltro.has(p.nombre)} onChange={()=>toggleFiltroProducto(p.nombre)}/>
                  {p.nombre}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {result&&!result.ventas?.length&&<div className="card"><div className="empty-state"><div className="icon">📊</div><p>No hay ventas en el período.</p></div></div>}
      {result&&result.ventas?.length>0&&(<>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Período</div><div className="metric-value" style={{fontSize:14}}>{fmtDate(result.desde)}{result.desde!==result.hasta?` → ${fmtDate(result.hasta)}`:''}</div></div>
          <div className="metric"><div className="metric-label">Platos vendidos</div><div className="metric-value">{result.ventas.reduce((a,v)=>a+parseInt(v.cantidad),0)}</div></div>
          <div className="metric"><div className="metric-label">Tipos de plato</div><div className="metric-value">{result.porPlato.length}</div></div>
          <div className="metric"><div className="metric-label">Ingredientes</div><div className="metric-value">{consumoMostrado.length}{filtroActivo&&productosFiltro.size>0?` / ${result.consumo.length}`:''}</div></div>
        </div>
        <div className="card">
          <div className="card-title">Ventas por plato</div>
          <div className="table-wrap"><table><thead><tr><th>Plato</th><th>Unidades</th></tr></thead>
            <tbody>{result.porPlato.map((p,i)=><tr key={i}><td>{p.nombre}</td><td><strong>{p.cantidad}</strong></td></tr>)}</tbody>
          </table></div>
        </div>
        {consumoMostrado.length>0&&<div className="card">
          <div className="card-title">Consumo teórico de materia prima{filtroActivo&&productosFiltro.size>0?' (filtrado)':''}</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Producto</th><th>Consumo neto</th><th>Merma</th><th>Consumo bruto</th></tr></thead>
            <tbody>{consumoMostrado.map((p,i)=>(
              <tr key={i}>
                <td><strong>{p.nombre}</strong></td>
                <td>{parseFloat(p.cantidad).toFixed(3)} {p.unidad}</td>
                <td><span className={`badge ${p.merma>30?'badge-amber':p.merma>15?'badge-blue':'badge-green'}`}>{p.merma}%</span></td>
                <td><strong>{parseFloat(p.bruto).toFixed(3)} {p.unidad}</strong></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>}
      </>)}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────
function Login({onLogin}){
  const[form,setForm]=useState({username:'',password:''});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const submit=async()=>{
    if(!form.username||!form.password){setError('Completá usuario y contraseña');return;}
    setLoading(true);setError('');
    try{
      const data=await api.login(form.username,form.password);
      localStorage.setItem('rp_token',data.token);
      localStorage.setItem('rp_user',JSON.stringify(data.restaurante));
      onLogin(data.restaurante);
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  return(
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo"><div className="icon">👨‍🍳</div><h1>RecetasPro</h1><p>Gestión gastronómica inteligente</p></div>
        <div className="form-field" style={{marginBottom:12}}><label>Usuario</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="tu_usuario" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
        <div className="form-field" style={{marginBottom:12}}><label>Contraseña</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
        {error&&<p className="login-error">{error}</p>}
        <button className="btn btn-primary btn-block mt-1" onClick={submit} disabled={loading}>{loading?'Ingresando...':'Ingresar'}</button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────
const NAV=[
  {section:'Recetas',items:[{id:'productos',label:'Productos brutos',icon:'📦'},{id:'intermedias',label:'Recetas intermedias',icon:'🧪'},{id:'finales',label:'Platos finales',icon:'🍽️'}]},
  {section:'Operaciones',items:[{id:'ventas',label:'Ventas',icon:'💰'},{id:'stock',label:'Stock semanal',icon:'📊'}]},
  {section:'Análisis',items:[{id:'consumo',label:'Consumo teórico',icon:'📈'}]},
];

export default function App(){
  const[user,setUser]=useState(null);
  const[page,setPage]=useState('productos');
  const[db,setDb]=useState({productos:[],intermedias:[],finales:[]});

  useEffect(()=>{
    const token=localStorage.getItem('rp_token');
    const u=localStorage.getItem('rp_user');
    if(token&&u) setUser(JSON.parse(u));
  },[]);

  const loadAll=useCallback(async()=>{
    const[productos,intermedias,finales]=await Promise.all([api.getProductos(),api.getIntermedias(),api.getFinales()]);
    setDb({productos,intermedias,finales});
  },[]);

  useEffect(()=>{if(user) loadAll();},[user,loadAll]);

  const logout=()=>{localStorage.removeItem('rp_token');localStorage.removeItem('rp_user');setUser(null);};

  if(!user) return <Login onLogin={u=>{setUser(u);}}/>;

  const renderPage=()=>{
    if(page==='productos') return <Productos data={db.productos} onRefresh={loadAll}/>;
    if(page==='intermedias') return <Intermedias data={db.intermedias} productos={db.productos} onRefresh={loadAll}/>;
    if(page==='finales') return <Finales data={db.finales} productos={db.productos} intermedias={db.intermedias} onRefresh={loadAll}/>;
    if(page==='ventas') return <Ventas finales={db.finales}/>;
    if(page==='stock') return <Stock productos={db.productos}/>;
    if(page==='consumo') return <Consumo/>;
  };

  return(
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header"><div className="rest-name">{user.nombre}</div><div className="rest-sub">Panel de gestión</div></div>
        {NAV.map(s=>(
          <div className="nav-section" key={s.section}>
            <div className="nav-label">{s.section}</div>
            {s.items.map(item=>(
              <div key={item.id} className={`nav-item${page===item.id?' active':''}`} onClick={()=>setPage(item.id)}>
                <span>{item.icon}</span>{item.label}
              </div>
            ))}
          </div>
        ))}
        <div className="sidebar-footer"><button className="logout-btn" onClick={logout}>🚪 Cerrar sesión</button></div>
      </div>
      <div className="content">{renderPage()}</div>
    </div>
  );
}
