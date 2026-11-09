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

### The survey, on its own layer

Key C hides the board's unbuilt traces; on the English model the ground
itself carried the routes — canal beds, towpaths and cart roads in the
canal era, the railways in the rail era — and a hidden trace still left
its line on the land. `ETCH=1` on `compose-canal.sh` and `compose-rail.sh`
now serves those routes as a transparent layer of their own
(`map-relief-*-etch.webp`) over a land bare of them; the board lays it
over each era's ground (`etchCanal`/`etchRail` in `PixiBoard.tsx`, listed
in `MAP_URL`) and hides it with the traces. What C leaves is carved into
the model itself: `FURROW=1` (the default) on both composers lays a
shallow valley along every route — the slope up-left of it lit, the one
down-right shaded — with a thin groove on its floor; the whole layer is
then wobbled by a coarse plasma and let come and go along the way by
another (`FURROW_SEED`), so no route reads as ruled. Canal-era routes on
the canal ground, the railways on the rail one. The country then still
tells where a route may go, the way a hillside would, and C still reads
as a switch: rubans and survey on, valleys alone off.

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

## The merchants

A merchant is laid out like a town, in `paint.ts` and nothing else: its
tiles in a row on parchment shelves, the bonus engraved on a brass
medallion drawn beside them, the name on the towns' own ribbon below
(counter-scaled like theirs), and behind the row its wharf
(`merchant-wharf-0..4.webp`): a warehouse with a hoist, a customs house
with a clock, a timber staithe on piles, a transit shed with its lime
kiln, an arcaded market hall — drawn from the v3 tiles as reference like
the places and the works, keyed off magenta, given the same cleared
ground and the same play-time shadow.

The framed signs went — first the gilded frame with its dusk painting
(`tools/assets/fal-merchants.sh`), then the oak signboards
(`tools/assets/fal-signboards.py`): a picture on the map read as a picture,
its black surround with it, and five of the same board read as wallpaper.
Their pictures stay served for the counter (`merchant-house-*.webp`).
Nothing on a merchant is read off a picture any more, so a second board's
merchants draw the same way with no table to fill.

On the ink grounds — the engraved map and the inked map — the towns keep
their ink hamlets and the merchants stand without a wharf: an ink map
keeps its own hand, and a painted place on it read as a sticker.

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

## A frozen country, on trial

A ground in the spirit of Frostpunk, not offered in the settings: it is
asked for in the address, `?ground=frost`, over whatever board is on the
table (`TRIAL_GROUNDS` in `boardOptions.ts`). It is the English model under
snow — `fal-ai/nano-banana/edit` with `map-relief-canal-fal.jpg` as the
reference, so the swells, the streams and the woods stand where they
stood: deep wind-packed snow in a polar twilight, slate in the shadows, a
few outcrops of dark rock, two frozen ponds, the woods gone to frosted
pines. The rail era is the same painting handed back to the same model to
be aged — the snow greyed with soot, slag heaps, thaw on the ponds. Both
upscaled three times by `fal-ai/clarity-upscaler` (creativity 0.2,
resemblance 1). Sources in `tools/assets/map/map-frost-{canal,rail}-fal.jpg`.

Three takes were asked for. The first came back all cliffs and strata,
too busy under the tiles; the second was the English model whitewashed,
calm but not cold. The third named how many of each thing it wanted —
"five or six outcrops", "three or four ponds" — and asked for a dark
image, never white: it sits at 26 in lightness, under the tiles.

Both composers gained two knobs for it, neither changing what they did
before: `INK=ice` (the waters as ice, lanes of trodden snow, a town's worn
ground a dark slush, grey ballast and cold rails) and `MIST` (the colour
of the distance past the play area — a dark ground wants it darker, not
paler). The rail painting is brought to the world's size first, so both
eras stand on the same land:

    magick map-frost-rail-fal.jpg -resize '3200x1800^' -gravity center -extent 3200x1800 rail-world.png
    ETCH=1 RELIEF=0 PADS=1 INK=ice DIM=70 FADE=60 MIST='rgb(30,38,54)' \
      tools/assets/map/compose-canal.sh tools/assets/map/map-frost-canal-fal.jpg geo.json map-frost-canal
    ETCH=1 INK=ice TONE=114,90 DIM=70 FADE=60 MIST='rgb(30,38,54)' \
      tools/assets/map/compose-rail.sh rail-world.png geo.json map-frost-rail

## The frozen city, on trial

The frozen country read as countryside; Frostpunk is a city. `?ground=city`
is the second trial: a wasteland of wind-packed snow with a ring settlement
under every town and a depot under every merchant.

A model asked for a city paints one where it likes. Given the board as a
plan — a disc for every town — `fal-ai/nano-banana/edit` kept the style of
its reference and the layout of its own, twenty-seven rings where the
board has twenty-two places; and eight of those rings cycled over the
towns read as the same stamp twenty-two times. So the model is asked for
settlements by the sheet instead, nine to a sheet, each named by its
trade and no two alike in footprint — round, oval, a crescent, a walled
square, a scattered hamlet, a row along one street
(`map-frostcity-sheet-{a,b,c}-fal.jpg`: cotton mills and collieries;
manufactories, ironworks and farmsteads; breweries, the potteries and
five depots) — and the city is assembled by hand on an empty snowfield
(`map-frostcity-snow-fal.jpg`, the first wasteland asked to remove every
man-made thing). `tools/map/frost-city.py` cuts every settlement from its
sheet through a soft ellipse, read off the sheets by eye, and lays it
under the town that trades as it does — Burton its brewhouse tower,
Stoke its bottle kilns, Cannock its pit and spoil heap, Birmingham the
great ring — sized to the town's cards, a depot of its own under every
merchant, at the places the board shows them (`tools/map/places.ts`: the
towns nudged clear of one another, the southern merchants lifted — not
the authentic anchors of `geo.ts`).

The rail era is the same sheet a generation on, made by the same script
and no model: asked to age it, the model kept every ring in place but
laid great white plumes over the snow, and the board breathes its own.
Soot settles on the walls and drifts down and right of every place, and
the lamps come on in every ring — a furnace door and a few windows at
the inner edge of the houses, never under the cards.

A design review of the first assembly asked for the autumn villages and
the wharves off this ground (`villages: 'none'` on the trial,
`setVillages('none')` in `paint.ts`: a ground that paints its own places
stands bare under the cards), the walls held under the cards' own light
(the sprites' highlights pressed down), and the snowfield emptied of
anything that read as a thing to play — all done. The rail era's brown
wash went for the lamps above.

    node places.mjs places.json
    tools/map/frost-city.py tools/assets/map/map-frostcity-sheet-{a,b,c}-fal.jpg \
      tools/assets/map/map-frostcity-snow-fal.jpg places.json canal.png rail.png
    magick rail.png -resize '3200x1800^' -gravity center -extent 3200x1800 rail-world.png
    ETCH=1 RELIEF=0 INK=ice FURROW_SCALE=0.45 DIM=70 FADE=60 MIST='rgb(24,30,44)' \
      tools/assets/map/compose-canal.sh canal.png geo.json map-frostcity-canal
    ETCH=1 INK=ice FURROW_SCALE=0.45 TONE=116,92 DIM=70 FADE=60 MIST='rgb(24,30,44)' \
      tools/assets/map/compose-rail.sh rail-world.png geo.json map-frostcity-rail

With the traces hidden (key C) the valley carved into the ground is all
that is left of a route, and on the snow it read as a road: `FURROW_SCALE`
narrows it (0.45 on the frozen city, 1 elsewhere).

### The crater's rim

Frostpunk's city sits at the bottom of a crater. The served frozen-city
ground, handed to `fal-ai/nano-banana/edit` with "keep the middle exactly
as it is, only the outer margin changes", came back with walls of cracked
ice and dark rock all round — and the middle repainted, the walls climbing
a long way into the play area. `tools/map/crater-rim.py` keeps only what
is wanted of it: the rim is laid over the served ground through a mask
that is the crater's floor — the world less 150 px at the sides, its
corners rounded, so the walls come in where the board is empty — and a
clear disc round every town and merchant, so nothing a player reads
changes. Both eras wear the same rim, the rail's a little darker
(`88,90`). Source in `map-frostcity-rim-fal.jpg`; run it last, after the
composers:

    tools/map/crater-rim.py tools/assets/map/map-frostcity-rim-fal.jpg places.json \
      app/public/map-frostcity-canal.webp app/public/map-frostcity-canal.webp
    tools/map/crater-rim.py tools/assets/map/map-frostcity-rim-fal.jpg places.json \
      app/public/map-frostcity-rail.webp app/public/map-frostcity-rail.webp 88,90

### The cold itself

The frozen city's ground carries its weather (`weather: 'frost'` on the
trial in `boardOptions.ts`, read by the board through `groundWeather()`):

- **the wind** under the table instead of the era's recording (`windBed`
  in `sfx.ts`): a breath of noise kept low, its pitch and its strength
  swaying slowly and out of step, so it gusts and never repeats. Made
  rather than recorded, levelled by ear against the canal's bed (an RMS of
  0.04 either way); `amb-frost` stays in `generate.py`'s plan for the day
  the sound model is asked for it — its key was refused on 2026-11-06;
- **the breath of every settlement** (`plumes.ts`): a thread of steam off
  the houses at the top of each town's block, works or none, a farm's
  thinner, so the city reads as lived in against the cold;
- **the hearth**: Birmingham is to this country what the generator is to
  Frostpunk's city — a warmth painted on the snow round it in either era
  (`frost-city.py`) and a wide, warm halo the board lays over it
  (`ambiance.ts`);
- **the snow** (`snow.ts`): flakes and streaks of blown snow crossing the
  table from the upper left, as the wind would carry them, over the towns
  and under their names; a third of the sheet by day, all of it by night,
  and now and then a gust that drives the streaks. Under reduced motion a
  few flakes stand still.

### The works under snow

A town on the frozen ground wears no painted village, but the works it
builds still stand behind its cards: the six drawings
(`town-works-*.webp`) handed back to `fal-ai/nano-banana/edit` one by one
— "the same buildings in the dead of a Frostpunk winter, the magenta
untouched" — snow on every roof, icicles, the windows lit, steam off the
chimney. The ironworks came back once with a dark vignette painted over
the magenta and was asked again with the background spelled out. Keyed
off the magenta at a 24 % fuzz, trimmed, and set on trodden snow rather
than bare earth (`GROUND='rgba(150,162,184,0.42)'` to `anchor-place.py`),
served as `town-works-*-frost.webp` with their shadows, their feet added
to `placeGround.ts`. `villages: 'frost'` on the trial; `setVillages('frost')`
shows them and nothing else. Sources in `villages/works-*-frost-{fal,cut}.png`.
The five merchants' wharves went the same way ("on a plus de bâtiment pour
les marchands ?"): `merchant-wharf-*-frost.webp`, the quay's water frozen
to grey ice, set on their own feet in `placeGround.ts` and swapped in by
`setVillages('frost')`.

### At the counter

The frozen city is not a setting: it is bought at the counter
(`ground-frost`, 200 guineas, `online/counter.ts`) and worn through the
`ground` board option, as the tile sets are (`boardWear` in
`Comptoir.tsx`); `mapUrls` serves it on the English board alone, a second
country being its own. The English model stays everyone's
(`ground-midlands`, free). The counter being in standby, the ground
stands in its window with the portraits and the tiles. The trials
(`?ground=frost`, `?ground=city`) remain for looking.

### The cold, a second round

Asked what more the map could take, and told "tout": the eras' events
give way to the cold's own on the frozen ground (`LIFE.frost`: the ice,
a sledge, a horn, men breaking ice); a storm every five and a half
minutes (`storm()` in `snow.ts`: twenty seconds rising, a minute blowing,
twenty falling — the sheet full, the wind heard rising to twice its
level, a veil over the table never past a third); every settlement's
windows come on at dusk, works or none (`plumes.ts`); a sledge wears two
ruts into the snow along its line, deeper with every crossing
(`ambiance.ts`); the market trades for the winter, the frost creeping in
at its panel's edges (`MarketTray.tsx`, dressing only); and the hand's
location cards are engraved again under snow
(`tools/assets/cards/frost-cards.sh`, `town-*-frost.webp`, dealt on the
frozen ground by `cardArt`). The first ask for the cards, "in the dead of
a hard winter", came back as the same plates with hardly a flake: the
snow has to be asked for plainly, as most of the picture.

### The cold, a third round

Told "fais tout" once more: the frozen city's own music, one piece an
era (`TUNES_FROST` in playlist.ts, the plans in generate.py, the choice
in CHOIX.md); the challenge of the winter (`winter` in challenge.ts: the
frozen city lent to everyone for the week, two collieries sold, six
links on the ice, one loan at most, and first place — the tab wears the
ground as a trial when the notice is opened); a fourth look for the
photo mode, the blizzard (`BLIZZARD` in photo.ts: steel and ice, blown
snow streaking the frame, a veil thick at the edges and lifted off the
places that are read); the townsfolk's bubbles iced and rimmed in blue
(`VoiceBubble.tsx`); a sledge's bells for a link laid on the ice
(`link-sledge`); and Birmingham's hearth burning wider for every works
the city builds (`hearthHalo` in ambiance.ts).

### The winter tiles and the winter engravings, at the counter

Asked for the tiles and the cards "en mode Frostpunk, très légèrement",
sold apart: the six painted subjects (`tools/tiles/subjects`) handed to
`fal-ai/nano-banana/edit` on magenta — "a thin dusting of snow along the
top edges, a little frost, the light a touch colder, change nothing
else" — keyed off, and built into `app/public/tiles-frost` by
`tools/tiles/build-subject.sh tools/tiles/subjects-frost tiles-frost`
(the 44 files, dual slots included). The set is the `frost` variant of
every industry in `faces.ts`, worn through `tileArt` by `tiles-frost`
(120 guineas). The winter engravings already made for the frozen ground
are the `cards-frost` item (90 guineas), worn through the `cardSet`
option; the frozen ground still deals them on its own. The pottery
subject was refused three times with the trade named and came on the
first ask without it.

### The counter opened

The counter had stood in standby since it was built (`COUNTER_OPEN`);
it is open now, the office selling and debiting as before. A thing the
board wears — the frozen city, the winter tiles, the winter engravings —
can be seen on the table before it is bought: "Voir sur la table"
(`tryOn` in `boardOptions.ts`) has the tab wear it for ten minutes
(`brassworks.tryon` in sessionStorage) and opens a table; the ground,
the tile variant and the card plates read the trial as they read the
frozen ground.

### The map, finer

Asked whether the routes could be finer and whether the traces between
the towns were needed at all: the ground already carries every route
(the survey layer, the valleys carved into the model, the ice channels),
so the trace Pixi lays over it is now a hairline — a thin dark bed and
one fine line of water or steel — and a built link a slim ribbon in its
owner's colour (half its old width), read by its colour rather than its
bulk. The towns' ribbons were tried as ink plates and the merchants' rows on
a quay of dressed stone; both read as severe and were put back (the
coloured ribbons, the row's soft shadow). The empty slots are engraved in a cold steel
ink on the frozen ground (`toneTable('cold')`); the apron's far haze
leans toward the table's felt; and key N takes the names off the table.

### The frozen ground's own links

Asked for routes that keep to the theme and belong to it alone: on the
frozen ground (`frost` in `drawLinks`) a route not yet made is a trail
staked out over the ice — a thin pale line and the stakes along it; a
canal link is an ice road, pale ice between dark banks, the owner's
colour as the lanterns posted along it rather than as the water; a rail
link is iron on the snow, the owner's sleepers under twin rails of
frosted steel. Every other ground keeps the slim ribbons.

### The HUD iced over

On the frozen ground the game page marks itself (`data-weather="frost"`
on `<html>`, set by `Game.tsx`) and `index.css` ices the HUD over: a rim
of frost at the plates' corners and a line of ice along their top edge
(`.plate`, `.plaque`), the brass gone cold and bluer (`.plaque-brass`,
`--brass-plate` for the tickets), the era named by its winter — "Hiver
1847", "Hiver 1848" — and the era's track frozen over. The players'
colours and the cards keep their own. Nothing of it on any other ground.
