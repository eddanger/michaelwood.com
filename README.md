# michaelwood.com — Woodtown 🏘️

v4 of michaelwood.com: a tiny isometric pixel town with a shared graffiti
wall. Not a furniture store.

Drag to wander, scroll to zoom, click people and buildings. The big brick
wall downtown is painted by every visitor — strokes persist in Cloudflare D1
and slowly weather away over ~60 days. There's a UFO. There are dinosaur
bones. The town hall clock shows your local time.

## Stack

- Static assets + a small Worker (`src/worker.js`) on Cloudflare Workers
- D1 (`michaelwood-wall`) stores graffiti strokes; see `migrations/`
- No build step, no framework — vanilla ES modules in `public/js/`
  - `town.js` — tile map, buildings, pre-rendered iso world, scenery animation
  - `npc.js` — wandering citizens + dialogue
  - `wall.js` — graffiti wall canvas, spray rendering, API client
  - `main.js` — camera, input, HUD glue

## Dev

```sh
bun install
npx wrangler d1 migrations apply michaelwood-wall --local  # once
bun run dev                                                # http://localhost:8787
```

## Deploy

```sh
npx wrangler deploy   # serves michaelwood.com + www (custom domains)
```

## Growing the town

- New building: add an entry to `BUILDINGS` in `town.js` (config-driven
  storefronts via `shopRenderer`, or a custom render fn). Mind the iso
  occlusion rule: keep ~`height/8` rows south of a building clear.
- New citizen: append to `CITIZENS` in `npc.js`.
- Wall admin: `DELETE /api/wall?key=…` power-washes all paint (set the
  `ADMIN_KEY` secret via `wrangler secret put ADMIN_KEY`).

## Legacy

`/apps`, `/resume.md`, `/keybase.txt`, `/notbug.gif` still served from
`public/`. GarageBot lives at garagebot.michaelwood.com (dokku, separate).
