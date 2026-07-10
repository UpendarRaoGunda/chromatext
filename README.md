# chroma·text

Type anything — English, or any language — and it shows up **live-translated into Telugu**, colored letter-by-letter or word-by-word (rainbow sweep, custom gradients, curated palettes, or seeded random). Built for Telugu speakers: the output is always Telugu, never the original language. Copy the result as rich HTML (pastes colored into Gmail/Docs/Notion), download it as a PNG, or share straight to WhatsApp.

**Fully backend-driven**: translation and all color math run in Vercel serverless functions. The frontend only renders what the API returns — no client-side translation or color logic.

## Structure

```
api/
  translate.js       # POST { text } → Telugu, via MyMemory (free, no key)
  colorize.js         # POST { text, mode, scope, ... } → colored HTML
  _lib/
    http.js            # shared JSON body reader
    translate.js        # translation logic + Telugu-detection (skip re-translating)
public/
  index.html          # frontend — calls /api/translate then /api/colorize
vercel.json
```

## Why two API calls instead of one

Typing triggers `/api/translate` (debounced, only when the text itself changes). Switching color mode, palette, or scope calls `/api/colorize` directly on the **already-translated** Telugu text — it never re-hits the translator. This keeps color changes instant and doesn't burn through the free translation quota on every button click.

If you type Telugu directly, the backend detects it (Unicode block check) and skips the translation call entirely.

## Why "letter" mode uses grapheme clusters, not raw characters

Telugu vowel signs and virama are separate Unicode code points that must stay attached to their base consonant to render correctly — splitting by raw code point tears them into broken marks (e.g. "birthday" in Telugu naively split becomes 24 fragments; correctly clustered, it's 11 whole syllables, conjuncts included). `api/colorize.js` uses `Intl.Segmenter` with grapheme-cluster granularity for letter mode so each colored span is a complete, correctly-shaped syllable.

## API

`POST /api/translate`
```json
{ "text": "Happy Birthday!" }
→ { "translated": "పుట్టినరోజు శుభాకాంక్షలు", "source": "en", "target": "te", "skipped": false }
```

`POST /api/colorize`
```json
{
  "text": "పుట్టినరోజు శుభాకాంక్షలు",
  "mode": "rainbow | gradient | palette | random",
  "scope": "letter | word",
  "palette": "sunset | ocean | neon | pastel | candy | fire | forest | festival",
  "gradientStops": ["#ff5e62", "#00c6ff"],
  "seed": 42
}
→ { "spans": [{"t":"...","c":"#..."}], "html": "...", "seed": 42 }
```

Translation uses [MyMemory](https://mymemory.translated.net) — free, no API key, ~5000 words/day per IP. If you outgrow that, swap the URL in `api/_lib/translate.js` for a self-hosted [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) instance; the calling code doesn't need to change.

## Run locally

```bash
npm i -g vercel
vercel dev
```

## Deploy

```bash
# 1. create the GitHub repo and push (needs GitHub CLI: https://cli.github.com)
gh repo create chroma-text --public --source=. --push

# 2. deploy to Vercel
npm i -g vercel
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard (Add New → Project → import `chroma-text`) — zero config needed, Vercel auto-detects `api/` functions and `public/` static files.

## License

MIT
