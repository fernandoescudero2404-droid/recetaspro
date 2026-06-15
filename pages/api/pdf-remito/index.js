// PDF processing is done client-side with pdf.js - no API key needed
// Updated: 2026-06-15
export default function handler(req, res) {
  res.status(410).json({ error: 'PDF processing moved to client-side with pdf.js' });
}
