import { requireAuth } from '../../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pdfBase64 } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: 'Falta el PDF' });

  try {
    // Usar Claude API para leer el PDF y extraer los items del remito
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: `Leé este remito/factura y extraé los productos entregados. 
Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener este formato exacto:
{
  "proveedor": "nombre del proveedor o empresa",
  "fecha": "fecha en formato YYYY-MM-DD o null",
  "numero": "número de remito/factura o null",
  "items": [
    { "sku": "SKU si está disponible o null", "descripcion": "nombre del producto", "cantidad": 0.0, "unidad": "kg/un/lts/etc" }
  ]
}
Usá la columna ENVIADO (no SOLICITADO) para la cantidad. Si no hay columna ENVIADO, usá la cantidad disponible.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Error en API de Claude');
    }

    const data = await response.json();
    const text = data.content.find(c => c.type === 'text')?.text || '';

    // Parsear el JSON
    let parsed;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      // Intentar extraer JSON si hay texto extra
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No se pudo parsear la respuesta del PDF');
    }

    return res.json({ ok: true, ...parsed });

  } catch (err) {
    console.error('Error leyendo PDF:', err);
    return res.status(500).json({ error: err.message });
  }
});
