import { useState, useEffect } from 'react';

const today = () => new Date().toISOString().split('T')[0];
const fmtDate = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };

export default function StockPublico() {
  const [token, setToken]     = useState('');
  const [data, setData]       = useState(null);
  const [fecha, setFecha]     = useState(today());
  const [vals, setVals]       = useState({}); // id -> cantidad
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const parts = window.location.pathname.split('/');
    const t = parts[parts.length - 1];
    if (t && t !== 'stock') { setToken(t); cargar(t); }
  }, []);

  const cargar = async (t) => {
    try {
      const res = await fetch(`/api/stock-publico/${t}`);
      if (!res.ok) { setError('Link inválido o expirado'); return; }
      const json = await res.json();
      setData(json);
      const init = {};
      json.productos.forEach(p => { init[`prod_${p.id}`] = ''; });
      json.intermedias.forEach(r => { init[`int_${r.id}`] = ''; });
      setVals(init);
    } catch { setError('Error al cargar'); }
  };

  const enviar = async () => {
    const items = [];
    Object.entries(vals).forEach(([key, v]) => {
      if (v === '' || parseFloat(v) <= 0) return;
      const [tipo, id] = key.split('_');
      // tipo viene como 'prod' o 'int', normalizamos a 'producto' o 'intermedia'
      const tipoNorm = tipo === 'prod' ? 'producto' : 'intermedia';
      items.push({ tipo: tipoNorm, id: parseInt(id), cantidad: parseFloat(v) });
    });
    if (!items.length) { alert('Ingresá al menos una cantidad'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/stock-publico/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, items }),
      });
      if (!res.ok) throw new Error('Error al enviar');
      setEnviado(true);
    } catch (e) { alert('Error: ' + e.message); }
    setLoading(false);
  };

  const s = { // styles
    page:   { minHeight:'100vh', background:'#f5f5f4', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', padding:'1rem' },
    wrap:   { maxWidth:520, margin:'0 auto' },
    card:   { background:'white', borderRadius:8, border:'1px solid #e7e5e4', padding:'1.25rem', marginBottom:12 },
    label:  { fontSize:11, color:'#a8a29e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4, display:'block' },
    h1:     { fontSize:18, fontWeight:600, margin:0 },
    sec:    { fontSize:13, fontWeight:600, color:'#1c1917', margin:'0 0 10px', paddingBottom:6, borderBottom:'1px solid #f5f5f4' },
    row:    { display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f5f5f4' },
    name:   { flex:1, fontSize:14, fontWeight:500, color:'#1c1917' },
    sub:    { fontSize:11, color:'#a8a29e', marginTop:2 },
    input:  { width:90, border:'1px solid #e7e5e4', borderRadius:5, padding:'6px 8px', fontSize:14, textAlign:'right' },
    unit:   { fontSize:12, color:'#57534e', minWidth:30 },
    btn:    { width:'100%', padding:'12px', background:'#1c1917', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:500, cursor:'pointer' },
    footer: { textAlign:'center', fontSize:11, color:'#a8a29e', marginTop:8 },
  };

  if (error) return <div style={{...s.page,display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{...s.card,textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>❌</div><p style={{color:'#57534e'}}>{error}</p></div></div>;

  if (!data) return <div style={{...s.page,display:'flex',alignItems:'center',justifyContent:'center'}}>
    <p style={{color:'#a8a29e'}}>Cargando...</p></div>;

  if (enviado) return <div style={{...s.page,display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{...s.card,textAlign:'center',maxWidth:360,width:'100%'}}>
      <div style={{fontSize:48,marginBottom:12}}>✅</div>
      <h2 style={{fontSize:20,marginBottom:8}}>¡Stock enviado!</h2>
      <p style={{color:'#57534e',fontSize:14}}>Stock del {fmtDate(fecha)} registrado para {data.restaurante}.</p>
      <button onClick={()=>{setEnviado(false);const init={};data.productos.forEach(p=>{init[`prod_${p.id}`]='';});data.intermedias.forEach(r=>{init[`int_${r.id}`]='';});setVals(init);}}
        style={{...s.btn,marginTop:16,width:'auto',padding:'8px 20px'}}>Cargar otro stock</button>
    </div></div>;

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* Header */}
        <div style={s.card}>
          <span style={s.label}>Control de stock</span>
          <h1 style={s.h1}>{data.restaurante}</h1>
          <div style={{marginTop:12}}>
            <span style={s.label}>Fecha del conteo</span>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
              style={{border:'1px solid #e7e5e4',borderRadius:5,padding:'7px 10px',fontSize:14,width:'100%',boxSizing:'border-box'}}/>
          </div>
        </div>

        {/* Productos brutos */}
        {data.productos.length > 0 && (
          <div style={s.card}>
            <div style={s.sec}>📦 Productos brutos</div>
            {data.productos.map(p => (
              <div key={p.id} style={{...s.row, borderBottom: undefined, paddingBottom:8, marginBottom:2}}>
                <div style={{flex:1}}>
                  <div style={s.name}>{p.nombre}</div>
                  {parseFloat(p.factor_conversion) !== 1 && (
                    <div style={s.sub}>× {parseFloat(p.factor_conversion).toFixed(4)} → se convierte al producto base</div>
                  )}
                </div>
                <input type="number" min="0" step="0.01" placeholder="0"
                  value={vals[`prod_${p.id}`] ?? ''}
                  onChange={e=>setVals(prev=>({...prev,[`prod_${p.id}`]:e.target.value}))}
                  style={s.input}/>
                <span style={s.unit}>{p.unidad}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recetas intermedias */}
        {data.intermedias.length > 0 && (
          <div style={s.card}>
            <div style={s.sec}>🧪 Preparaciones</div>
            {data.intermedias.map(r => (
              <div key={r.id} style={{...s.row, borderBottom: undefined, paddingBottom:8, marginBottom:2}}>
                <div style={{flex:1}}>
                  <div style={s.name}>{r.nombre}</div>
                  <div style={s.sub}>1 kg de esta preparación = {parseFloat(r.factor_auto||1).toFixed(3)} kg de ingredientes brutos</div>
                </div>
                <input type="number" min="0" step="0.01" placeholder="0"
                  value={vals[`int_${r.id}`] ?? ''}
                  onChange={e=>setVals(prev=>({...prev,[`int_${r.id}`]:e.target.value}))}
                  style={s.input}/>
                <span style={s.unit}>kg</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={enviar} disabled={loading} style={s.btn}>
          {loading ? 'Enviando...' : '✓ Enviar stock'}
        </button>
        <p style={s.footer}>RecetasPro · Solo para uso interno del local</p>
      </div>
    </div>
  );
}
