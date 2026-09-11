# michaelwood.com

Spare homepage for [Michael Wood](https://michaelwood.com) — British Columbia, Canada.
Builder and operator of agent-run company experiments (Wemble, Fitnito, Fitify).

[Woodtown](/woodtown/) is still here: a tiny Three.js voxel town with a shared
graffiti wall. It is a side page, not the bio.

## Stack

- Static assets + a small Worker (`src/worker.js`) on Cloudflare Workers
- Homepage is plain HTML/CSS (`public/index.html`, `public/css/home.css`)
- Woodtown: Three.js voxel town in `public/js/`, D1 (`michaelwood-wall`) for graffiti
- No build step, no framework

## Dev

```sh
bun install
npx wrangler d1 migrations apply michaelwood-wall --local  # once
bun run dev                                                # http://localhost:8787
bun test tests/
```

## Deploy

```sh
npx wrangler deploy   # serves michaelwood.com + www (custom domains)
```

## Crawler files

`/robots.txt`, `/sitemap.xml`, `/favicon.ico`, and `/llms.txt` live in `public/`
and must 200 at the origin. The sitemap lists only the homepage.

## Woodtown debug hashes

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

`/apps`, `/resume.md`, `/keybase.txt` still served from `public/`. GarageBot
lives at garagebot.michaelwood.com (dokku, separate). `/resume.md` is not linked
from the homepage and is disallowed in `robots.txt`.

An abandoned forest prototype still exists under `public/js/v5/` but is not
linked from the site.
