// api/translate.js — POST { text } → { translated, source, target }
// Called on its own so switching color mode/palette never re-triggers a
// translation network call — only actual text edits do.
const { readBody } = require('./_lib/http');
const { translateText } = require('./_lib/translate');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, target: 'te', provider: 'MyMemory' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST with JSON body { text }' });
  }

  try {
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (text.length > 500) return res.status(400).json({ error: 'text too long to translate (max 500 chars)' });

    const target = body.target === 'te' || !body.target ? 'te' : body.target;
    const result = await translateText(text, { target });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
