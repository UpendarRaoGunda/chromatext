// api/translate.js — Vercel serverless function
// Translates text between English and Telugu via the free MyMemory API.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, directions: ['en-te', 'te-en'] });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST with JSON body { text, direction }' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const text = String(body.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });
    if (text.length > 500) return res.status(400).json({ error: 'text too long (max 500 chars)' });

    const direction = body.direction === 'te-en' ? 'te-en' : 'en-te';
    const langpair = direction === 'te-en' ? 'te|en' : 'en|te';

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated) return res.status(502).json({ error: 'translation service returned no result' });

    return res.status(200).json({ translated, direction });
  } catch (e) {
    return res.status(500).json({ error: 'translate failed', detail: String(e.message || e) });
  }
};
