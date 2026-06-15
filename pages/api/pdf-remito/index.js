// PDF processing moved to client-side using pdf.js - updated 2026-06-15T02:00:00.465858
// No API key required
export default function handler(req, res) {
  res.status(410).json({ error: 'Este endpoint fue reemplazado por procesamiento en el cliente con pdf.js' });
}
