import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const today = () => new Date().toISOString().split('T')[0];
const mondayOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split('T')[0];
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ id, title, onClose, children }) {
  return (
    <div className="modal-bg open" onClick={e => e.target.classList.contains('modal-bg') && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── IngredienteRow ───────────────────────────────────────────────────────────
function IngRow({ ing, idx, productos, intermedias, onChange, onRemove }) {
  return (
    <div className="ing-row">
      <div className="form-field" style={{ flex: 2, minWidth: 160 }}>
        <label style={{ fontSize: 11 }}>Ingrediente</label>
        <select value={`${ing.tipo}:${ing.ref_id}`} onChange={e => {
          const [tipo, ref_id] = e.target.value.split(':');
          onChange(idx, { ...ing, tipo, ref_id: parseInt(ref_id) });
        }}>
          <option value=":">— Seleccioná —</option>
          <optgroup label="Productos brutos">
            {productos.map(p => <option key={p.id} value={`producto:${p.id}`}>{p.nombre}</option>)}
          </optgroup>
          {intermedias.length > 0 && (
            <optgroup label="Recetas intermedias">
              {intermedias.map(r => <option key={r.id} value={`intermedia:${r.id}`}>{r.nombre}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <div className="form-field" style={{ minWidth: 80 }}>
        <label style={{ fontSize: 11 }}>Cantidad</label>
        <input type="number" min="0" step="0.01" value={ing.cantidad}
          onChange={e => onChange(idx, { ...ing, cantidad: e.target.value })} />
      </div>
      <div className="form-field" style={{ minWidth: 70 }}>
        <label style={{ fontSize: 11 }}>Unidad</label>
        <select value={ing.unidad} onChange={e => onChange(idx, { ...ing, unidad: e.target.value })}>
          {['kg','g','unidad','litro','ml','porción'].map(u => <option key={u}>{u}</option>)}
        </select>
      </div>
      <button className="btn btn-sm btn-danger" onClick={() => onRemove(idx)} style={{ marginBottom: 1 }}>×</button>
    </div>
  );
}

// ─── PRODUCTOS BRUTOS ────────────────────────────────────────────────────────
function Productos({ data, onRefresh }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', unidad: 'kg', merma: '', notas: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.nombre.trim()) { setError('Ingresá el nombre'); return; }
    setLoading(true); setError('');
    try {
      await api.createProducto({ ...form, merma: parseFloat(form.merma) || 0 });
      setModal(false); setForm({ nombre: '', unidad: 'kg', merma: '', notas: '' });
      onRefresh();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await api.deleteProducto(id); onRefresh();
  };

  return (
    <div id="page-productos" className="page active">
      <div className="page-header">
        <h2>Productos brutos</h2>
        <p>Materia prima con porcentaje de merma por procesado o descongelado</p>
      </div>
      <div className="card">
        <div className="card-title">
          <span>Productos registrados</span>
          <button className="btn btn-sm" onClick={() => setModal(true)}>+ Nuevo producto</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th>Unidad</th><th>Merma</th><th>Rendimiento</th><th></th></tr></thead>
            <tbody>
              {!data.length && <tr><td colSpan={5}><div className="empty-state"><div className="icon">📦</div><p>No hay productos aún. Agregá el primero.</p></div></td></tr>}
              {data.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong>{p.notas && <><br /><span className="text-sm">{p.notas}</span></>}</td>
                  <td>{p.unidad}</td>
                  <td><span className={`badge ${p.merma > 30 ? 'badge-amber' : p.merma > 15 ? 'badge-blue' : 'badge-green'}`}>{p.merma}%</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{(100 - p.merma).toFixed(0)}%</span>
                      <div className="progress-bar" style={{ flex: 1, minWidth: 60 }}>
                        <div className="progress-fill" style={{ width: `${100 - p.merma}%`, background: p.merma > 30 ? 'var(--warn)' : 'var(--success)' }} />
                      </div>
                    </div>
                  </td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Nuevo producto bruto" onClose={() => setModal(false)}>
          <div className="form-grid mb-1">
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Langostino congelado" />
            </div>
            <div className="form-field">
              <label>Unidad</label>
              <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
                {['kg','g','unidad','litro','porción'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Merma (%)</label>
              <input type="number" min="0" max="100" value={form.merma} onChange={e => setForm({ ...form, merma: e.target.value })} placeholder="ej: 20" />
            </div>
          </div>
          <div className="form-field mb-1">
            <label>Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} placeholder="ej: pérdida por descongelado" />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading ? 'Guardando...' : 'Guardar producto'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── RECETAS INTERMEDIAS ─────────────────────────────────────────────────────
function Intermedias({ data, productos, onRefresh }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', rinde: '' });
  const [ings, setIngs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addIng = () => setIngs([...ings, { tipo: 'producto', ref_id: 0, cantidad: '', unidad: 'kg' }]);
  const updateIng = (i, v) => { const a = [...ings]; a[i] = v; setIngs(a); };
  const removeIng = (i) => setIngs(ings.filter((_, idx) => idx !== i));

  const resolveNombre = (tipo, ref_id) => {
    if (tipo === 'producto') return productos.find(p => p.id === ref_id)?.nombre || '?';
    return data.find(r => r.id === ref_id)?.nombre || '?';
  };

  const save = async () => {
    if (!form.nombre.trim()) { setError('Ingresá el nombre'); return; }
    if (!ings.length) { setError('Agregá al menos un ingrediente'); return; }
    setLoading(true); setError('');
    try {
      await api.createIntermedia({ ...form, ingredientes: ings });
      setModal(false); setForm({ nombre: '', rinde: '' }); setIngs([]);
      onRefresh();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar esta receta?')) return;
    await api.deleteIntermedia(id); onRefresh();
  };

  return (
    <div id="page-intermedias" className="page active">
      <div className="page-header">
        <h2>Recetas intermedias</h2>
        <p>Preparaciones base reutilizables — pueden contener otras recetas intermedias</p>
      </div>
      <div className="card">
        <div className="card-title">
          <span>Recetas intermedias</span>
          <button className="btn btn-sm" onClick={() => setModal(true)}>+ Nueva receta</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Rinde</th><th>Ingredientes</th><th></th></tr></thead>
            <tbody>
              {!data.length && <tr><td colSpan={4}><div className="empty-state"><div className="icon">🧪</div><p>No hay recetas intermedias aún.</p></div></td></tr>}
              {data.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong></td>
                  <td><span className="badge badge-gray">{r.rinde || '—'}</span></td>
                  <td>{(r.ingredientes || []).map((ing, i) => <span key={i} className="tag">{resolveNombre(ing.tipo, ing.ref_id)} {ing.cantidad}{ing.unidad}</span>)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(r.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Nueva receta intermedia" onClose={() => { setModal(false); setIngs([]); }}>
          <div className="form-grid mb-1">
            <div className="form-field">
              <label>Nombre de la receta</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Langostinos apanados" />
            </div>
            <div className="form-field">
              <label>Rendimiento</label>
              <input value={form.rinde} onChange={e => setForm({ ...form, rinde: e.target.value })} placeholder="ej: 500g, 10 porciones" />
            </div>
          </div>
          <div className="card-title" style={{ fontSize: 13 }}>Ingredientes</div>
          {ings.map((ing, i) => (
            <IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={data} onChange={updateIng} onRemove={removeIng} />
          ))}
          <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading ? 'Guardando...' : 'Guardar receta'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── RECETAS FINALES ──────────────────────────────────────────────────────────
function Finales({ data, productos, intermedias, onRefresh }) {
  const [modal, setModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ings, setIngs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addIng = () => setIngs([...ings, { tipo: 'producto', ref_id: 0, cantidad: '', unidad: 'kg' }]);
  const updateIng = (i, v) => { const a = [...ings]; a[i] = v; setIngs(a); };
  const removeIng = (i) => setIngs(ings.filter((_, idx) => idx !== i));

  const resolveNombre = (tipo, ref_id) => {
    if (tipo === 'producto') return productos.find(p => p.id === ref_id)?.nombre || '?';
    return intermedias.find(r => r.id === ref_id)?.nombre || '?';
  };

  const save = async () => {
    if (!nombre.trim()) { setError('Ingresá el nombre del plato'); return; }
    if (!ings.length) { setError('Agregá al menos un ingrediente'); return; }
    setLoading(true); setError('');
    try {
      await api.createFinal({ nombre, ingredientes: ings });
      setModal(false); setNombre(''); setIngs([]);
      onRefresh();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar este plato?')) return;
    await api.deleteFinal(id); onRefresh();
  };

  return (
    <div id="page-finales" className="page active">
      <div className="page-header">
        <h2>Platos finales</h2>
        <p>Platos del menú que se venden al cliente</p>
      </div>
      <div className="card">
        <div className="card-title">
          <span>Platos del menú</span>
          <button className="btn btn-sm" onClick={() => setModal(true)}>+ Nuevo plato</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Plato</th><th>Ingredientes</th><th></th></tr></thead>
            <tbody>
              {!data.length && <tr><td colSpan={3}><div className="empty-state"><div className="icon">🍽️</div><p>No hay platos finales aún.</p></div></td></tr>}
              {data.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong></td>
                  <td>{(r.ingredientes || []).map((ing, i) => <span key={i} className="tag">{resolveNombre(ing.tipo, ing.ref_id)} {ing.cantidad}{ing.unidad}</span>)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(r.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Nuevo plato final" onClose={() => { setModal(false); setIngs([]); }}>
          <div className="form-field mb-1">
            <label>Nombre del plato</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Roll de sushi de langostinos" />
          </div>
          <div className="card-title" style={{ fontSize: 13 }}>Ingredientes del plato</div>
          {ings.map((ing, i) => (
            <IngRow key={i} ing={ing} idx={i} productos={productos} intermedias={intermedias} onChange={updateIng} onRemove={removeIng} />
          ))}
          <button className="btn btn-sm mb-1" onClick={addIng}>+ Agregar ingrediente</button>
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-block mt-1" onClick={save} disabled={loading}>{loading ? 'Guardando...' : 'Guardar plato'}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── VENTAS ───────────────────────────────────────────────────────────────────
function Ventas({ finales, onRefresh }) {
  const [ventas, setVentas] = useState([]);
  const [form, setForm] = useState({ fecha: today(), receta_final_id: '', cantidad: 1 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await api.getVentas();
    setVentas(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.receta_final_id || !form.fecha) { alert('Completá fecha y plato'); return; }
    setLoading(true);
    const plato = finales.find(f => f.id === parseInt(form.receta_final_id));
    await api.createVenta({ ...form, receta_final_id: parseInt(form.receta_final_id), receta_nombre: plato.nombre, cantidad: parseInt(form.cantidad) || 1 });
    setLoading(false);
    load();
  };

  const del = async (id) => {
    await api.deleteVenta(id); load();
  };

  return (
    <div id="page-ventas" className="page active">
      <div className="page-header">
        <h2>Carga de ventas</h2>
        <p>Registrá las ventas diarias de cada plato</p>
      </div>
      <div className="card">
        <div className="card-title">Registrar venta</div>
        <div className="form-row">
          <div className="form-field" style={{ minWidth: 130 }}>
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
            <label>Plato</label>
            <select value={form.receta_final_id} onChange={e => setForm({ ...form, receta_final_id: e.target.value })}>
              <option value="">— Seleccioná un plato —</option>
              {finales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ minWidth: 90 }}>
            <label>Cantidad</label>
            <input type="number" min="1" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
          </div>
          <button className="btn" onClick={save} disabled={loading}>{loading ? '...' : '✓ Registrar'}</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Ventas recientes</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Plato</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              {!ventas.length && <tr><td colSpan={4}><div className="empty-state"><div className="icon">💰</div><p>No hay ventas cargadas aún.</p></div></td></tr>}
              {ventas.map(v => (
                <tr key={v.id}>
                  <td>{fmtDate(v.fecha)}</td>
                  <td>{v.receta_nombre}</td>
                  <td><strong>{v.cantidad}</strong></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(v.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── STOCK ────────────────────────────────────────────────────────────────────
function Stock({ productos }) {
  const [stocks, setStocks] = useState([]);
  const [form, setForm] = useState({ fecha: today(), producto_id: '', cantidad: 0 });

  const load = async () => setStocks(await api.getStocks());
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.producto_id || !form.fecha) { alert('Completá fecha y producto'); return; }
    const prod = productos.find(p => p.id === parseInt(form.producto_id));
    await api.createStock({ ...form, producto_id: parseInt(form.producto_id), producto_nombre: prod.nombre, unidad: prod.unidad, cantidad: parseFloat(form.cantidad) || 0 });
    load();
  };

  const del = async (id) => { await api.deleteStock(id); load(); };

  return (
    <div id="page-stock" className="page active">
      <div className="page-header">
        <h2>Stock semanal</h2>
        <p>Conteo de inventario — se recomienda cada lunes a la mañana</p>
      </div>
      <div className="card">
        <div className="card-title">Registrar stock</div>
        <div className="form-row">
          <div className="form-field" style={{ minWidth: 130 }}>
            <label>Fecha del conteo</label>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
            <label>Producto</label>
            <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })}>
              <option value="">— Seleccioná producto —</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
            </select>
          </div>
          <div className="form-field" style={{ minWidth: 100 }}>
            <label>Cantidad</label>
            <input type="number" min="0" step="0.01" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
          </div>
          <button className="btn" onClick={save}>✓ Guardar</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Historial de stock</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              {!stocks.length && <tr><td colSpan={4}><div className="empty-state"><div className="icon">📦</div><p>No hay stock cargado aún.</p></div></td></tr>}
              {stocks.map(s => (
                <tr key={s.id}>
                  <td>{fmtDate(s.fecha)}</td>
                  <td>{s.producto_nombre}</td>
                  <td><strong>{parseFloat(s.cantidad).toFixed(2)}</strong> {s.unidad}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => del(s.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── CONSUMO TEÓRICO ──────────────────────────────────────────────────────────
function Consumo() {
  const [periodo, setPeriodo] = useState('semana');
  const [semanaDesde, setSemanaDesde] = useState(mondayOfWeek());
  const [dia, setDia] = useState(today());
  const [mes, setMes] = useState(today().slice(0, 7));
  const [rangoDesde, setRangoDesde] = useState(mondayOfWeek());
  const [rangoHasta, setRangoHasta] = useState(today());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calcular = async () => {
    let desde, hasta;
    if (periodo === 'semana') { desde = semanaDesde; hasta = addDays(semanaDesde, 6); }
    else if (periodo === 'dia') { desde = hasta = dia; }
    else if (periodo === 'mes') { const [y, m] = mes.split('-'); desde = `${y}-${m}-01`; const d = new Date(y, m, 0); hasta = d.toISOString().split('T')[0]; }
    else { desde = rangoDesde; hasta = rangoHasta; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api.getConsumo(desde, hasta);
      setResult({ ...data, desde, hasta });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div id="page-consumo" className="page active">
      <div className="page-header">
        <h2>Consumo teórico</h2>
        <p>En base a las ventas cargadas, ¿cuánto debería haberse consumido?</p>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-field">
            <label>Período</label>
            <div className="tabs">
              {['semana','dia','mes','rango'].map(p => (
                <button key={p} className={`tab${periodo === p ? ' active' : ''}`} onClick={() => setPeriodo(p)}>
                  {p === 'semana' ? 'Semana' : p === 'dia' ? 'Día' : p === 'mes' ? 'Mes' : 'Rango'}
                </button>
              ))}
            </div>
          </div>
          {periodo === 'semana' && <div className="form-field"><label>Semana del</label><input type="date" value={semanaDesde} onChange={e => setSemanaDesde(e.target.value)} /></div>}
          {periodo === 'dia' && <div className="form-field"><label>Día</label><input type="date" value={dia} onChange={e => setDia(e.target.value)} /></div>}
          {periodo === 'mes' && <div className="form-field"><label>Mes</label><input type="month" value={mes} onChange={e => setMes(e.target.value)} /></div>}
          {periodo === 'rango' && <>
            <div className="form-field"><label>Desde</label><input type="date" value={rangoDesde} onChange={e => setRangoDesde(e.target.value)} /></div>
            <div className="form-field"><label>Hasta</label><input type="date" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} /></div>
          </>}
          <button className="btn" onClick={calcular} disabled={loading}>{loading ? 'Calculando...' : '📊 Calcular'}</button>
        </div>
        {error && <p className="login-error mt-1">{error}</p>}
      </div>

      {result && !result.ventas?.length && (
        <div className="card"><div className="empty-state"><div className="icon">📊</div><p>No hay ventas en el período seleccionado.</p></div></div>
      )}

      {result && result.ventas?.length > 0 && (<>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Período</div><div className="metric-value" style={{ fontSize: 15 }}>{fmtDate(result.desde)}{result.desde !== result.hasta ? ` → ${fmtDate(result.hasta)}` : ''}</div></div>
          <div className="metric"><div className="metric-label">Platos vendidos</div><div className="metric-value">{result.ventas.reduce((a, v) => a + parseInt(v.cantidad), 0)}</div></div>
          <div className="metric"><div className="metric-label">Tipos de plato</div><div className="metric-value">{result.porPlato.length}</div></div>
          <div className="metric"><div className="metric-label">Ingredientes afectados</div><div className="metric-value">{result.consumo.length}</div></div>
        </div>
        <div className="card">
          <div className="card-title">Ventas por plato</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Plato</th><th>Unidades vendidas</th></tr></thead>
              <tbody>{result.porPlato.map((p, i) => <tr key={i}><td>{p.nombre}</td><td><strong>{p.cantidad}</strong></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        {result.consumo.length > 0 && (
          <div className="card">
            <div className="card-title">Consumo teórico de materia prima</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Consumo neto</th><th>Merma</th><th>Consumo bruto (a ingresar)</th></tr></thead>
                <tbody>{result.consumo.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{parseFloat(p.cantidad).toFixed(3)} {p.unidad}</td>
                    <td><span className={`badge ${p.merma > 30 ? 'badge-amber' : p.merma > 15 ? 'badge-blue' : 'badge-green'}`}>{p.merma}%</span></td>
                    <td><strong>{parseFloat(p.bruto).toFixed(3)} {p.unidad}</strong></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.username || !form.password) { setError('Completá usuario y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.login(form.username, form.password);
      localStorage.setItem('rp_token', data.token);
      localStorage.setItem('rp_user', JSON.stringify(data.restaurante));
      onLogin(data.restaurante);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">👨‍🍳</div>
          <h1>RecetasPro</h1>
          <p>Gestión gastronómica inteligente</p>
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>Usuario</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="tu_usuario" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>Contraseña</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button className="btn btn-primary btn-block mt-1" onClick={submit} disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const NAV = [
  { section: 'Recetas', items: [
    { id: 'productos', label: 'Productos brutos', icon: '📦' },
    { id: 'intermedias', label: 'Recetas intermedias', icon: '🧪' },
    { id: 'finales', label: 'Platos finales', icon: '🍽️' },
  ]},
  { section: 'Operaciones', items: [
    { id: 'ventas', label: 'Ventas', icon: '💰' },
    { id: 'stock', label: 'Stock semanal', icon: '📊' },
  ]},
  { section: 'Análisis', items: [
    { id: 'consumo', label: 'Consumo teórico', icon: '📈' },
  ]},
];

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('productos');
  const [db, setDb] = useState({ productos: [], intermedias: [], finales: [] });

  useEffect(() => {
    const token = localStorage.getItem('rp_token');
    const u = localStorage.getItem('rp_user');
    if (token && u) setUser(JSON.parse(u));
  }, []);

  const loadAll = useCallback(async () => {
    const [productos, intermedias, finales] = await Promise.all([
      api.getProductos(), api.getIntermedias(), api.getFinales()
    ]);
    setDb({ productos, intermedias, finales });
  }, []);

  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  const logout = () => {
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={u => { setUser(u); }} />;

  const renderPage = () => {
    if (page === 'productos') return <Productos data={db.productos} onRefresh={loadAll} />;
    if (page === 'intermedias') return <Intermedias data={db.intermedias} productos={db.productos} onRefresh={loadAll} />;
    if (page === 'finales') return <Finales data={db.finales} productos={db.productos} intermedias={db.intermedias} onRefresh={loadAll} />;
    if (page === 'ventas') return <Ventas finales={db.finales} onRefresh={loadAll} />;
    if (page === 'stock') return <Stock productos={db.productos} />;
    if (page === 'consumo') return <Consumo />;
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="rest-name">{user.nombre}</div>
          <div className="rest-sub">Panel de gestión</div>
        </div>
        {NAV.map(s => (
          <div className="nav-section" key={s.section}>
            <div className="nav-label">{s.section}</div>
            {s.items.map(item => (
              <div key={item.id} className={`nav-item${page === item.id ? ' active' : ''}`} onClick={() => setPage(item.id)}>
                <span>{item.icon}</span>{item.label}
              </div>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>🚪 Cerrar sesión</button>
        </div>
      </div>
      <div className="content">
        {renderPage()}
      </div>
    </div>
  );
}
