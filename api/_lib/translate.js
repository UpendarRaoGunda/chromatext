// Translation backend — MyMemory Translated API (free, keyless).
// Docs: https://mymemory.translated.net/doc/spec.php
// Free tier: ~5000 words/day per IP (anonymous). Good enough for a text toy;
// swap MYMEMORY_URL for a self-hosted LibreTranslate instance if you outgrow it.

const TELUGU_BLOCK = /[\u0C00-\u0C7F]/;

// Treat input as "already Telugu" if most of its non-space characters sit
// in the Telugu Unicode block — lets people type Telugu directly without
// a pointless round trip through the translator.
function looksTelugu(text) {
  const chars = text.replace(/\s+/g, '');
  if (!chars) return false;
  const teluguCount = (chars.match(new RegExp(TELUGU_BLOCK, 'g')) || []).length;
  return teluguCount / chars.length > 0.4;
}

async function translateText(text, { source = 'en', target = 'te' } = {}) {
  if (looksTelugu(text)) {
    return { translated: text, source: 'te', target: 'te', skipped: true };
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error('translation service unreachable: ' + e.message);
  }
  if (!res.ok) {
    throw new Error(`translation service returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const translated = data && data.responseData && data.responseData.translatedText;

  if (!translated) {
    throw new Error('translation service returned no result');
  }
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE/i.test(translated)) {
    throw new Error('translation quota reached — try again shortly or shorten the text');
  }

  return {
    translated,
    source,
    target,
    skipped: false,
    matchQuality: data.responseData.match ?? null,
  };
}

module.exports = { translateText, looksTelugu, TELUGU_BLOCK };
