# chroma·text

Colorful text generator. Type a sentence ("Happy Birthday!") and get every letter or word colored — rainbow sweep, custom multi-stop gradients, curated palettes, or seeded random. Copy the result as rich HTML (pastes colored into Gmail/Docs/Notion) or download it as a PNG.

**Backend-driven by design**: all color math (HSL sweeps, hex interpolation, palette cycling, deterministic PRNG) runs in a Vercel serverless function. The frontend only renders what the API returns.

## Structure

```
api/colorize.js     # serverless backend — all colorization logic
api/translate.js    # serverless backend — English/Telugu translation (MyMemory API)
public/index.html   # frontend — calls POST /api/colorize and POST /api/translate
vercel.json
```

## API

`POST /api/colorize`

```json
{
  "text": "Happy Birthday!",
  "mode": "rainbow | gradient | palette | random",
  "scope": "letter | word",
  "palette": "sunset | ocean | neon | pastel | candy | fire | forest | festival",
  "gradientStops": ["#ff5e62", "#00c6ff"],
  "seed": 42
}
```

Returns `{ spans: [{t, c}], html, seed }`. `seed` makes random mode reproducible/shareable. `GET /api/colorize` lists available modes and palettes.

`POST /api/translate`

```json
{
  "text": "Happy Birthday!",
  "direction": "en-te | te-en"
}
```

Returns `{ translated, direction }`. The UI can also be switched between English and Telugu (chips at the top of the page).

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
