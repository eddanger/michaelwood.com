# michaelwood.com — Woodtown 🏘️

A tiny Three.js voxel town with a shared graffiti wall. Not a furniture store.

Drag to wander, scroll to zoom, click people and buildings. The big brick
wall downtown is painted by every visitor — strokes persist in Cloudflare D1
and slowly weather away over ~60 days. There's a UFO, dinosaur bones, a
sleeping dragon, dogs with zoomies, fireworks after dark, and a busker who
actually plays (WebAudio). The town hall clock shows your local time.

## Stack

- Three.js voxel town rendered through a pixelation pipeline (low-res buffer,
  nearest-neighbor upscale, orthographic iso camera) — real 3D, pixel-art look
- Static assets + a small Worker (`src/worker.js`) on Cloudflare Workers
- D1 (`michaelwood-wall`) stores graffiti strokes; see `migrations/`
- No build step, no framework — vanilla ES modules in `public/js/`
  - `gfx.js` — renderer/camera/picking · `data.js` — the town as data
  - `painters.js` — canvas art that becomes textures (ground, facades, underground)
  - `town3d.js` / `life3d.js` — static scene · living entities
  - `wall.js` — graffiti wall (2D, shared via D1) · `main.js` — glue

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

## Debug hashes

| hash | what |
| --- | --- |
| `#night` | start at night |
| `#rain` | force rain |
| `#fireworks` | fireworks anytime |
| `#stars` | shooting stars anytime |
| `#plane` | paper airplane flyby |
| `#far` | fully zoomed-out miniature view |
| `#underground` | pan down to the cross-section |
| `#wall` | open the graffiti wall |

## Growing the town

- New building: add an entry to `BUILDINGS` in `data.js`, then a branch in
  `buildKind` (`town3d.js`) and optional facade painter.
- New citizen / critter: append to `CITIZENS` / `DOGS` in `data.js`, or add an
  `Entity3D` subclass in `life3d.js` and push it from `createLife`.
- Wall admin: `DELETE /api/wall?key=…` power-washes all paint (set the
  `ADMIN_KEY` secret via `wrangler secret put ADMIN_KEY`).

## Legacy

`/apps`, `/resume.md`, `/keybase.txt`, `/notbug.gif` still served from
`public/`. GarageBot lives at garagebot.michaelwood.com (dokku, separate).

An abandoned forest prototype still exists under `public/js/v5/` but is not
linked from the site.
