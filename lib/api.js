const BASE = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rp_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username, password) => apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
  // Productos
  getProductos: () => apiFetch('/productos'),
  createProducto: (data) => apiFetch('/productos', { method: 'POST', body: data }),
  deleteProducto: (id) => apiFetch(`/productos/${id}`, { method: 'DELETE' }),
  // Intermedias
  getIntermedias: () => apiFetch('/intermedias'),
  createIntermedia: (data) => apiFetch('/intermedias', { method: 'POST', body: data }),
  deleteIntermedia: (id) => apiFetch(`/intermedias/${id}`, { method: 'DELETE' }),
  // Finales
  getFinales: () => apiFetch('/finales'),
  createFinal: (data) => apiFetch('/finales', { method: 'POST', body: data }),
  deleteFinal: (id) => apiFetch(`/finales/${id}`, { method: 'DELETE' }),
  // Ventas
  getVentas: (params = {}) => apiFetch('/ventas' + (params.desde ? `?desde=${params.desde}&hasta=${params.hasta}` : '')),
  createVenta: (data) => apiFetch('/ventas', { method: 'POST', body: data }),
  deleteVenta: (id) => apiFetch(`/ventas/${id}`, { method: 'DELETE' }),
  // Stocks
  getStocks: () => apiFetch('/stocks'),
  createStock: (data) => apiFetch('/stocks', { method: 'POST', body: data }),
  deleteStock: (id) => apiFetch(`/stocks/${id}`, { method: 'DELETE' }),
  // Consumo
  getConsumo: (desde, hasta) => apiFetch(`/consumo?desde=${desde}&hasta=${hasta}`),
};

// Edición
export const apiExtra = {
  updateProducto: (id, data) => apiFetch(`/productos/${id}`, { method: 'PUT', body: data }),
  updateIntermedia: (id, data) => apiFetch(`/intermedias/${id}`, { method: 'PUT', body: data }),
  updateFinal: (id, data) => apiFetch(`/finales/${id}`, { method: 'PUT', body: data }),
};
