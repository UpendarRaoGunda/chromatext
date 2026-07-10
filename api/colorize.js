// api/colorize.js — Vercel serverless function
// All color math lives on the backend. The frontend only renders what this returns.

// ---------- color utilities ----------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

// multi-stop gradient sample at t in [0,1]
function sampleGradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const seg = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
  const local = t * (stops.length - 1) - seg;
  return lerpColor(stops[seg], stops[seg + 1], local);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: 255 * f(0), g: 255 * f(8), b: 255 * f(4) });
}

// deterministic PRNG so "random" mode is shareable/reproducible
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- palettes ----------
const PALETTES = {
  rainbow: null, // computed via HSL sweep
  sunset:  ['#ff5e62', '#ff9966', '#ffcf5c', '#f76b8a', '#a83279'],
  ocean:   ['#00c6ff', '#0072ff', '#00e0d0', '#4ba3f5', '#0052cc'],
  neon:    ['#39ff14', '#ff2079', '#04d9ff', '#ffe700', '#bc13fe'],
  pastel:  ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff'],
  candy:   ['#ff6f91', '#ff9671', '#ffc75f', '#f9f871', '#d65db1'],
  fire:    ['#ff0000', '#ff5400', '#ff9e00', '#ffce00', '#ff2d00'],
  forest:  ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'],
  festival:['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#9b5de5'],
};

// ---------- core ----------
function splitUnits(text, scope) {
  // returns array of { text, colorable } preserving whitespace
  if (scope === 'word') {
    return text.split(/(\s+)/).filter(s => s.length).map(s => ({
      text: s, colorable: /\S/.test(s),
    }));
  }
  // letter scope
  return Array.from(text).map(ch => ({ text: ch, colorable: /\S/.test(ch) }));
}

function colorize({ text, mode, scope, palette, gradientStops, seed }) {
  const units = splitUnits(text, scope);
  const colorables = units.filter(u => u.colorable);
  const n = Math.max(colorables.length, 1);
  const rand = mulberry32(seed);

  let idx = 0;
  for (const u of units) {
    if (!u.colorable) continue;
    const t = n === 1 ? 0 : idx / (n - 1);

    if (mode === 'rainbow') {
      u.color = hslToHex(Math.round(t * 300), 90, 55); // 0→300 hue sweep, red→violet
    } else if (mode === 'gradient') {
      u.color = sampleGradient(gradientStops, t);
    } else if (mode === 'random') {
      const list = PALETTES[palette] || PALETTES.candy;
      u.color = list[Math.floor(rand() * list.length)];
    } else { // 'palette' — cycle in order
      const list = PALETTES[palette] || PALETTES.sunset;
      u.color = list[idx % list.length];
    }
    idx++;
  }
  return units;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toHtml(units) {
  return units.map(u =>
    u.colorable
      ? `<span style="color:${u.color}">${escapeHtml(u.text)}</span>`
      : escapeHtml(u.text)
  ).join('');
}

// ---------- handler ----------
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  // fallback: some runtimes don't pre-parse the body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      modes: ['rainbow', 'gradient', 'palette', 'random'],
      scopes: ['letter', 'word'],
      palettes: Object.keys(PALETTES).filter(k => k !== 'rainbow'),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST with JSON body { text, mode, ... }' });
  }

  try {
    const body = await readBody(req);
    const text = String(body.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });
    if (text.length > 5000) return res.status(400).json({ error: 'text too long (max 5000 chars)' });

    const mode = ['rainbow', 'gradient', 'palette', 'random'].includes(body.mode) ? body.mode : 'rainbow';
    const scope = body.scope === 'word' ? 'word' : 'letter';
    const palette = body.palette || 'sunset';
    const seed = Number.isFinite(body.seed) ? body.seed : Math.floor(Math.random() * 1e9);

    let gradientStops = Array.isArray(body.gradientStops) ? body.gradientStops : ['#ff5e62', '#00c6ff'];
    gradientStops = gradientStops
      .filter(c => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(c)))
      .slice(0, 5);
    if (gradientStops.length < 2) gradientStops = ['#ff5e62', '#00c6ff'];

    const units = colorize({ text, mode, scope, palette, gradientStops, seed });

    return res.status(200).json({
      spans: units.map(u => ({ t: u.text, c: u.colorable ? u.color : null })),
      html: toHtml(units),
      seed,
      mode, scope, palette,
    });
  } catch (e) {
    return res.status(500).json({ error: 'colorize failed', detail: String(e.message || e) });
  }
};

// exported for local testing
module.exports._internal = { colorize, toHtml, PALETTES };
