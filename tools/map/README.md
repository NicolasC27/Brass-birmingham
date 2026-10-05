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
grounds, merchant basins) and mist in the far edges. The source is
`tools/assets/map/map-era-canal-midjourney.jpg`. It was tried as the
etched canal ground and set aside: too much detail under the tiles. The
"etched" setting keeps the composed terrain of step 4 as
`map-era-canal.webp`.

The prompt that worked asked for the countryside alone. Every attempt that
named villages or mist got sprawling golden towns and cumulus clouds
instead; the compositor draws both from the geometry, so the painting
should carry neither.

## Grounds for the painted tiles

The woodcut tiles are ink on cream and want a pale sheet under them. The
painted tiles carry their own light and want the opposite: on a bright
ground they read as holes, on a dark one as lamps. Measured, the tiles sit
between 28 and 42 in lightness, so a ground for them belongs around 20, at
a saturation well under theirs.

Two such grounds are served. "Terre sombre" (`map-dusk-*`) is a pair of
paintings that had been set aside, graded down. "Terres boisées"
(`map-wooded-*`) came from `fal-ai/nano-banana/edit` with a patch of the
etched terrain as the reference image, upscaled three times by
`fal-ai/clarity-upscaler`; the rail era is the same terrain handed back to
the same model to be aged — woods cut back, spoil heaps, soot — so both
eras stand on the same land. Sources in `tools/assets/map/map-wooded-*-fal.jpg`.

Referring the model to an image beat describing the style in words. Five
rounds of prompting produced nothing usable; one edit against the patch
did.

"Terres labourées" (`map-ploughed-*`) came the same way, from four variants
asked for in one pass: a quilt of small fields, a heather moor, a mixed
country, and worked earth. The last won on measurement as much as on the
eye — the lowest lightness and saturation of the four, even coverage, and
the only one with no water of its own to argue with the engraved canals.

Both composers take four knobs, all defaulting to what they did before:
`TONE` (the painting's brightness and saturation), `LIT=1` (waters, lanes,
basin rims and rails inked pale, for a dark ground), `DIM` and `FADE` (how
the land beyond the board falls away — a pale painting wants a gentler
fall, or the world reads as a lit rectangle). The grounds above were made
with `LIT=1 TONE=150,105 DIM=90 FADE=140` and the rail era at `135,108`.

The "painted" setting no longer serves the Midjourney countryside: it is a
hand-tinted 1830 survey sheet seen from directly above
(`map-painted-canal-midjourney.jpg`), for the woodcut tiles.

## The quiet country, and the places on it

The board's default ground is "Campagne paisible" (`map-calm-*`): a still
morning over sage and oat fields, soft hedgerows, mist in the hollows,
asked of `fal-ai/nano-banana` with no reference image and upscaled three
times. It sits at 55 in lightness against tiles that sit between 28 and 42,
so the tiles and the places are the brightest things on the table. The rail
era is the same fields carried into industry by the same model.

Under each town the board lays a painted place: four of them
(`town-place-0..3.webp`), one to a town by its coordinates, the farm hamlet
always the fourth. They were drawn by `fal-ai/nano-banana/edit` with the
v3 tiles themselves as the reference image, so they carry the same brush,
the same light from the upper left and the same weight of shape. Sources in
`tools/assets/map/villages/`. The engraved map keeps its ink hamlets.

Before this there was one painting for all twenty-two towns, drawn at the
width of the card block and faded to 62 %: it read as a grey smudge. A
place is now wider than the cards it stands behind and drawn at 84 %.

A town wears the trade it built: the first works to go up replaces its
place with that industry's own drawing (`town-works-*.webp`, six of them),
and it keeps whatever was built first. A second kind of works stands
behind the first as an annex at three fifths of its size, and the place
grows a tenth for every further works up to three, so a town with a mine,
a forge and a mill reads as the larger place it has become. Farms neither
trade nor grow.

## The three grounds

Eight grounds were tried and dropped. Three are offered: **the English
model** (`map-relief-*`), the board's default — low swells in painted
plaster under a raking light, a shelf cut for every town; **the engraved
map** (`map-engraved-*`), drawn from the geometry and nothing else; and
**the inked map** (`map-inked-*`), sepia mounds and tiny trees on
parchment. A fourth, the etched terrain (`map-era-*`), is not in the
settings: it is the ground a rail-era painting bought at the counter is
shown on, and a reader who owns one keeps it.

The sources of the ones dropped stay in `tools/assets/map/`, so any of
them can be composed again; only their served WebP went.

## Anchoring a place

A village drawn straight onto a terrain floats, and on a slope it looks
pitched. Three things hold it down, all in `compose-canal.sh` except the
last:

* `RELIEF` lays a height field of our own making — plasma at a coarse
  grain, blurred into rolling ground — lit from over the reader's left
  shoulder and applied as `2·shade·land`, which leaves the overall tone
  where it was. `RELIEF_WEIGHT` is gone; `RELIEF_SPREAD` sets how firmly
  the ground is felt, `RELIEF_LIGHT` the sun's bearing, `RELIEF_SEED` the
  hills themselves. Note that ImageMagick's own `soft-light` is not
  Photoshop's and blows a mid-grey map out to white — hence the arithmetic.
* Each town's ground is levelled: the shade map is brought back to neutral
  in a disc around it, so no village ends up standing on a hillside.
* Every link arrives as a pair of pale cart tracks, so a place reads as
  somewhere roads meet.
* The place sprites themselves carry a cleared patch of earth, laid at the
  drawing's feet by `tools/assets/map/anchor-place.py` from the keyed cut
  (`tools/assets/map/villages/*-cut.png`). No shadow is baked in.
* The shadow is thrown at play time (`castShadow` in `paint.ts`): the
  drawing's own soft silhouette (`*-shadow.webp`, made by the same script)
  laid flat from its foot, flipped, squashed and leaning down and right,
  the way a lamp throws a model's shadow across the table. How far it runs
  is read off the terrain: `tools/map/place-ground.py` samples the relief
  painting where each town's and merchant's shadow falls — lit from the
  upper left, a slope falling away down and right reads dark, one climbing
  reads light — and writes `app/src/gl/placeGround.ts`. Below zero the
  shadow runs long down the slope; above, it bunches short and dense
  against the rise. Only the English model carries this; the engraved and
  inked grounds are level and every shadow on them is the same. Run the
  script again when a drawing or the relief painting changes.

## The wharves

Each of the five edge merchants keeps its framed sign, and now stands on a
wharf of its own below it (`merchant-wharf-0..4.webp`): a warehouse with a
hoist, a customs house with a clock, a timber staithe on piles, a transit
shed with its lime kiln, an arcaded market hall. Drawn from the v3 tiles as
reference like the places and the works, keyed off magenta, and given the
same cleared ground and play-time shadow so they sit on the map rather
than hang over it.

The gilded frame is going: Oxford's sign is now a painted oak signboard
(`tools/assets/fal-signboards.py`) — planks and iron straps, the name
painted large on the top plank, the tiles resting on a slate panel, the
bonus on a brass roundel — in the hand of the tiles and the places, and
`houses.ts` marks it `board` so no brass nameplate is laid over it. The
other four, and the Veneto's five, follow the same road when the fal
balance allows.

The sign itself no longer floats: it stands on two oak posts planted on
the quay's deck, the board's shadow thrown across the deck and the ground
beyond. Where the ground falls away the posts run longer to reach it and
the shadow runs with them; against a rise both draw in.

## A second board

`app/src/game/boards/` holds the geography: `midlands.ts`, `veneto.ts`, and
a registry that places either on the 3200×1800 world. A game carries its
board's id in `setup.options.map`, so a game replayed from seed and actions
— by the analysis, by a bot, by the server — stands on the ground it was
played on.

The Veneto keeps every count the Midlands has: twenty towns and two
cellars, five edge merchants, thirty-nine links split thirty both-era,
eight rail, one canal, the same multiset of sockets and the same location
card totals. That is what lets the tiles, the deck and the market balanced
for one stand for the other; `boards.test.ts` holds it to that.

Its art follows the same road as the home country's: the terrain from
`fal-ai/nano-banana/edit` with the Midlands ground as the reference so the
two read as one game, upscaled three times, then composed with the Veneto's
own geometry — `node /tmp/geo.mjs /tmp/geo-veneto.json veneto`. Its five
merchant houses were repainted from the Oxford plate, keeping the frame,
the brass disc and the nameplate. Sources in `tools/assets/map/houses/`.

## Three grounds that are not a patchwork

Every ground above is a countryside seen from a plane: fields, hedges,
copses. Asked for something else, three directions were tried in one pass
and all three kept, each with a rail era aged from its own canal painting
by `fal-ai/nano-banana/edit`, upscaled three times, composed with the
geometry, RELIEF=0 (they carry their own):

- **Crêtes peintes** (`map-ridges-*`, the default): the terrain of a
  strategy board — long diagonal ridges, rock on the high ground,
  scattered painted woods, lit from the upper left as the painted tiles
  are. The one that speaks their language. Asked with "no grid of fields,
  no repetition, no symmetry"; the first take tiled four identical islands.
- **Maquette** (`map-model-*`): sculpted plaster hills, static grass,
  lichen trees, photographed straight down — the table reads as a
  miniature and the tiles as pieces set on it. Dark; composed LIT=1.
- **Carte à l'encre** (`map-inked-*`): hill mounds and tiny trees in
  sepia on parchment, washed green and ochre. Old-atlas charm.

Sources in `tools/assets/map/map-{ridges,model,inked}-{canal,rail}-fal.jpg`.

The quiet country's composer meanwhile gained cart tracks converging on
every town (`lane.txt`), a wider cleared ground under each, and a relief
pass: a seeded plasma height field lit from the upper left, applied as
2·shade·land so a map centred at a half leaves the tone alone. Soft-light
was tried first and brightened the whole sheet — ImageMagick's formula is
not the one painters mean.

## The engraved map

The board's default ground is no painting at all: a period engraved map,
drawn from the geometry by `tools/assets/map/compose-engraved.sh <geo.json>`
(the draw lists come from `tools/map/engrave.py`). A laid cream sheet with
the plate mark at the world's edge; in sepia ink, canal beds with a towpath,
the future rails as dashed survey lines, merchant basins, the ground bare
under the towns; form lines and small engraved trees on the free land only, kept clear of
every town and link so nothing fights the live tiles. The Rail Era is the
same sheet yellowed and sooted, the rails as black-and-white ladders.
It writes `map-engraved-canal.webp` and `map-engraved-rail.webp`, and it is
deterministic: same geometry, same seeds, same sheet. The paintings above
stay as the "etched" and "painted" board settings.

Under each town the board lays its own village, below the cards: the
painting `town-village.webp` on the etched and painted grounds, and on the
engraved map one of three ink hamlets drawn by Midjourney in the same hand
(`town-hamlet-0..2.webp`, square, bottom-aligned; sources
`tools/assets/map/vignette-*-midjourney.jpg`), the church and the roofs
showing between the cards.
