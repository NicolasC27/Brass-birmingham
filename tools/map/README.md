# Map art pipeline

The era backgrounds in `app/public` are composed, not hand-painted:

1. `geo.ts` exports the board geometry (routes, towns, merchants) to JSON.
   Bundle and run it from `app/`:
   `./node_modules/.bin/esbuild ../tools/map/geo.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/geo.mjs && node /tmp/geo.mjs /tmp/geo.json`
2. `bg-control2.mjs` draws control sheets for image models (`edges`, `lines`, `overlay`).
3. `fal-run.mjs` submits a request to a fal.ai endpoint (key read from `.env.local`, `FAL_KEY=...`) and downloads the result.
   The terrain currently in use came from `fal-ai/nano-banana` with a strict top-down prompt, upscaled ×3 by `fal-ai/clarity-upscaler`.
4. `bg-compose.mjs` takes a top-down terrain painting and engraves the canal beds, survey lines, village grounds and merchant basins from the real geometry, with a 15 % bleed on every side. It writes both the canal painting and the rail-era grade.

Scripts need Playwright's Chromium (`PLAYWRIGHT_BROWSERS_PATH` pointing at a browsers folder) and ImageMagick for previews.

## Rail era, painted

The rail-era background is no longer a grade of the canal painting: it is a
Midjourney painting of the same land under industry. Three of them are
served (`map-era-rail.webp`, `-2`, `-3`; the board setting "Rail-era
painting" picks one), each composed into the canal map's frame by
`tools/assets/map/compose-rail.sh <painting> <geo.json> [stem]`: the
painting keeps its own pixels, centred on the world, the rest mirrored from
its edges to fill the 15 % bleed; rail beds engraved along the rail routes;
mist in the far edges; served as WebP. Sources stay in `tools/assets/map/`.

The rail routes themselves are traced on that painting by
`tools/map/rail-routes.py <terrain.pgm> <geo.json> <railRoutes.ts> <routes.json>`
(terrain = the painting placed in the world at 1/4 scale, grey): a least-cost
line per link that hugs valleys and contours, keeps clear of third towns and
of the other lines. It writes `app/src/components/game/railRoutes.ts`, which
the board uses for every rail link in the Rail Era, and `geo.ts` exports the
same tracing (`railPts`) for the compositor to engrave.

## Canal era, painted

The canal-era background followed the same road: a Midjourney painting of
the Midlands countryside before industry — hedgerow fields, oak copses,
threads of water, no towns, no mist — composed by
`tools/assets/map/compose-canal.sh <painting> <geo.json> [stem]`: the
painting brought up to the world's size, the bleed mirrored from its edges,
a grade that caps the bleached clearings so the tiles stay the brightest
thing on the table, then the real geometry engraved as in `bg-compose.mjs`
(canal beds with a towpath, the future rail lines as cart roads, village
grounds, merchant basins) and mist in the far edges. It replaces the
composed terrain of step 4 as `map-era-canal.webp`; the source is
`tools/assets/map/map-era-canal-midjourney.jpg`.

The prompt that worked asked for the countryside alone. Every attempt that
named villages or mist got sprawling golden towns and cumulus clouds
instead; the compositor draws both from the geometry, so the painting
should carry neither.

## The engraved map

The board's default ground is no painting at all: a period engraved map,
drawn from the geometry by `tools/assets/map/compose-engraved.sh <geo.json>`
(the draw lists come from `tools/map/engrave.py`). A laid cream sheet with
the plate mark at the world's edge; in sepia ink, canal beds with a towpath,
the future rails as dashed survey lines, village blocks, merchant basins;
form lines and small engraved trees on the free land only, kept clear of
every town and link so nothing fights the live tiles. The Rail Era is the
same sheet yellowed and sooted, the rails as black-and-white ladders.
It writes `map-engraved-canal.webp` and `map-engraved-rail.webp`, and it is
deterministic: same geometry, same seeds, same sheet. The paintings above
stay as the "etched" and "painted" board settings.
