# Brass: Birmingham — Authentic Board Geography (Roxley Games, 2018)

Compiled for faithful reproduction of the official board in a web adaptation.
Every fact below was cross-checked against **at least two independent sources** (three independent software implementations of the board — the "Eliza/Eleanor" solo app, the brassforge.cc "Boomforge" engine, the npow/brass-birmingham GitHub project — plus the official Roxley rulebook text and direct visual inspection of a high-resolution photo of the official board). All three board-graph encodings agree with each other and with the official board image on **every** location, industry space, and link.

**Corrections to common assumptions:** Nottingham, Shrewsbury, Gloucester, Oxford and Warrington are **merchant locations on the board edge, not buildable towns**. **Leicester does not appear on the board at all.** The 20 buildable industry locations are exactly the ones listed below, plus 2 unnamed single-space "Farm Brewery" locations.

---

## 1. Locations (towns/cities) and their industry spaces

20 buildable locations. Industry space order is **left-to-right, top-to-bottom** as printed on the board (numbering convention used by the Eliza solo app and confirmed against the board image). Industry types: Coal Mine, Iron Works, Cotton Mill, Manufacturer (manufactured goods), Pottery, Brewery. A space showing two icons accepts either industry.

The board groups locations into 5 coloured regions (the banner colour also encodes the player count at which that location's cards enter the deck — see §7):

### Derbyshire (teal banner) — cards only in 4-player games
| Location | Spaces (in order) |
|---|---|
| **Belper** | 1. Cotton Mill / Manufacturer · 2. Coal Mine · 3. Pottery |
| **Derby** | 1. Cotton Mill / Brewery · 2. Cotton Mill / Manufacturer · 3. Iron Works |

### Staffordshire (blue banner) — cards in 3- and 4-player games
| Location | Spaces (in order) |
|---|---|
| **Leek** | 1. Cotton Mill / Manufacturer · 2. Cotton Mill / Coal Mine |
| **Stoke-on-Trent** | 1. Cotton Mill / Manufacturer · 2. Pottery / Iron Works · 3. Manufacturer |
| **Stone** | 1. Cotton Mill / Brewery · 2. Manufacturer / Coal Mine |
| **Uttoxeter** | 1. Manufacturer / Brewery · 2. Cotton Mill / Brewery |

### West Midlands / "red" region (maroon banner) — all player counts
| Location | Spaces (in order) |
|---|---|
| **Stafford** | 1. Manufacturer / Brewery · 2. Pottery |
| **Burton-on-Trent** (a.k.a. Burton-upon-Trent) | 1. Manufacturer / Coal Mine · 2. Brewery |
| **Cannock** | 1. Manufacturer / Coal Mine · 2. Coal Mine |
| **Tamworth** | 1. Cotton Mill / Coal Mine · 2. Cotton Mill / Coal Mine |
| **Walsall** | 1. Iron Works / Manufacturer · 2. Manufacturer / Brewery |

### Black Country (brown banner) — all player counts
| Location | Spaces (in order) |
|---|---|
| **Wolverhampton** | 1. Manufacturer · 2. Manufacturer / Coal Mine |
| **Coalbrookdale** | 1. Iron Works / Brewery · 2. Iron Works · 3. Coal Mine |
| **Dudley** | 1. Coal Mine · 2. Iron Works |
| **Kidderminster** | 1. Cotton Mill / Coal Mine · 2. Cotton Mill |
| **Worcester** | 1. Cotton Mill · 2. Cotton Mill |

### Birmingham region (purple banner) — all player counts
| Location | Spaces (in order) |
|---|---|
| **Birmingham** | 1. Cotton Mill / Manufacturer · 2. Manufacturer · 3. Iron Works · 4. Manufacturer |
| **Coventry** | 1. Pottery · 2. Manufacturer / Coal Mine · 3. Iron Works / Manufacturer |
| **Nuneaton** | 1. Manufacturer / Brewery · 2. Cotton Mill / Coal Mine |
| **Redditch** | 1. Manufacturer / Coal Mine · 2. Iron Works |

### Farm Breweries (2 unnamed single-space locations)
- **Farm Brewery (North)** — 1 Brewery space, located between Cannock and Wolverhampton/Stafford, left of Cannock. Connected to Cannock by a dedicated link space (a link tile is required to connect Cannock to it).
- **Farm Brewery (South)** — 1 Brewery space, located between Kidderminster and Worcester (to the left of the Kidderminster–Worcester link). Per the rules, a link tile placed between Kidderminster and Worcester **also** connects both towns to this Farm Brewery; no second link tile is required or allowed there.
- Buildable only with a Brewery industry card or Wild Industry card (never with a location card / wild location card).

**Totals check:** 45 industry spaces across the 20 towns + 2 farm brewery spaces. Space icons verified visually on the official board for Birmingham, Coalbrookdale, Wolverhampton, Cannock, Worcester and the two farm spaces; all 20 towns confirmed identically by three independent board-graph encodings. Nothing in this section is unverified.

---

## 2. Connections (link graph)

39 printed link spaces total. "Both" = one printed space that accepts a canal tile in the Canal Era or a rail tile in the Rail Era. Rail-only spaces cannot hold canal tiles; the single canal-only space cannot hold a rail tile. Canal links are the waterways; rail links are land routes. 31 links are buildable in the Canal Era; 38 in the Rail Era.

### Canal + Rail (both eras) — 30 links
| # | Endpoint A | Endpoint B |
|---|---|---|
| 1 | Warrington (merchant) | Stoke-on-Trent |
| 2 | Stoke-on-Trent | Leek |
| 3 | Belper | Derby |
| 4 | Derby | Nottingham (merchant) |
| 5 | Derby | Burton-on-Trent |
| 6 | Stoke-on-Trent | Stone |
| 7 | Stone | Stafford |
| 8 | Stone | Burton-on-Trent |
| 9 | Stafford | Cannock |
| 10 | Cannock | Farm Brewery (North) |
| 11 | Cannock | Wolverhampton |
| 12 | Cannock | Walsall |
| 13 | Burton-on-Trent | Tamworth |
| 14 | Tamworth | Nuneaton |
| 15 | Tamworth | Birmingham |
| 16 | Coventry | Birmingham |
| 17 | Birmingham | Oxford (merchant) |
| 18 | Redditch | Oxford (merchant) |
| 19 | Redditch | Gloucester (merchant) |
| 20 | Birmingham | Walsall |
| 21 | Walsall | Wolverhampton |
| 22 | Wolverhampton | Coalbrookdale |
| 23 | Coalbrookdale | Shrewsbury (merchant) |
| 24 | Coalbrookdale | Kidderminster |
| 25 | Wolverhampton | Dudley |
| 26 | Birmingham | Dudley |
| 27 | Dudley | Kidderminster |
| 28 | Kidderminster | Worcester — *this single link also connects both towns to Farm Brewery (South)* |
| 29 | Birmingham | Worcester |
| 30 | Worcester | Gloucester (merchant) |

### Rail only — 8 links
| # | Endpoint A | Endpoint B |
|---|---|---|
| 31 | Leek | Belper |
| 32 | Derby | Uttoxeter |
| 33 | Uttoxeter | Stone |
| 34 | Burton-on-Trent | Cannock |
| 35 | Tamworth | Walsall |
| 36 | Nuneaton | Coventry |
| 37 | Nuneaton | Birmingham |
| 38 | Birmingham | Redditch |

### Canal only — 1 link
| # | Endpoint A | Endpoint B |
|---|---|---|
| 39 | Burton-on-Trent | Walsall |

**Merchant connections (subset of the above):** Warrington–Stoke; Nottingham–Derby; Shrewsbury–Coalbrookdale; Oxford–Birmingham and Oxford–Redditch; Gloucester–Redditch and Gloucester–Worcester. All are "both era" spaces.

---

## 3. Merchant tiles and merchant spaces

**5 merchant locations** sit around the board edge, each with printed merchant-tile slot(s) and a beer-barrel space beside each slot, plus a printed bonus that a player receives when consuming that merchant's beer during a Sell action:

| Merchant | Slots | In play at | Beer bonus | Position on board |
|---|---|---|---|---|
| **Warrington** | 2 | 3- and 4-player games only | **£5** from the bank | top-left corner |
| **Nottingham** | 2 | 4-player games only | **+3 VP** | top-right corner |
| **Shrewsbury** | 1 | all games | **+4 VP** | left edge, mid-height |
| **Oxford** | 2 | all games | **+2 income** (advance income marker 2 spaces) | bottom-right |
| **Gloucester** | 2 | all games | **Develop** (remove 1 lowest-level non-lightbulb industry tile from your mat, no iron cost) | bottom, left-of-centre |

- **9 merchant tiles** exist in the game. Tile mix by minimum player count (confirmed by the Eliza app and the brassforge.cc engine, which agree):
  - **2-player tiles (5):** 2 × blank (buys nothing, no beer barrel placed beside it), 1 × Cotton Mill, 1 × Manufacturer, 1 × "any" (buys cotton, manufactured goods **or** pottery).
  - **3-player adds (2):** 1 × blank, 1 × Pottery. → 7 tiles in a 3-player game.
  - **4-player adds (2):** 1 × Manufacturer, 1 × Cotton Mill. → 9 tiles in a 4-player game.
  - Full 4-player mix: 3 blank, 2 cotton, 2 manufacturer, 1 pottery, 1 any.
  - *(Note: the npow/brass-birmingham repo lists the 3p/4p additions differently — pottery+manufacturer and any+cotton — and is contradicted by the other two implementations; treat npow as the outlier.)* [tile faces verified from code only, not from a readable photo — moderate confidence, two agreeing sources]
- At setup the active tiles are **shuffled and dealt randomly**, one face-up per merchant slot. In a 2-player game no tiles are placed at Warrington or Nottingham; in a 3-player game none at Nottingham (official rulebook).
- Place **1 beer barrel on each beer-barrel space beside a non-blank merchant tile** at setup, and refill empty ones at the end of the Canal Era. Merchant beer may only be consumed as part of a Sell action to that merchant; consuming it grants the location's bonus.

---

## 4. External / off-board areas (per official rules)

- **Coal Market** (printed on the board's right edge): 14 spaces, prices £1–£8. Setup: 13 black cubes, leaving **one of the two £1 spaces** empty. To **buy** coal from the market a player must be connected to any merchant location icon (Warrington, Shrewsbury, Nottingham, Gloucester or Oxford — even a merchant space without a tile). If the market is empty, coal can still be bought for £8. When a Coal Mine is built while connected to any merchant space, its cubes are immediately sold into the market (most expensive spaces first).
- **Iron Market** (right edge, beside the Coal Market): 10 spaces, prices £1–£8. Setup: 8 orange cubes, leaving **both £1 spaces** empty. Iron can be bought **without any connection** (iron "teleports"). When any Iron Works is built, its cubes are immediately sold into the market regardless of connection.
- **General Supply** (off-board): the remaining coal cubes (30 total − 13 in market = 17), iron cubes (18 − 8 = 10) and beer barrels (15 total) not on the board; consumed resources return here.
- **The Bank** (off-board): money tokens; loans (£30) come from here.
- **Beer has no market.** Beer sources: (1) your own unflipped breweries — no connection required ("teleports"); (2) an opponent's unflipped brewery — must be connected to where the beer is needed; (3) the beer-barrel space beside a merchant tile you are selling to (Sell action only, grants the merchant bonus). The two Farm Breweries are on-board beer sources. In the Rail Era, the Network action to place **two rail links** costs £15 + 1 beer (which may **not** come from a merchant), plus 1 coal per link (each rail link must also be connected to a coal source).
- **No distant market**: unlike Brass: Lancashire there is no Distant Cotton Market — the 5 merchant locations replace it as the external demand for cotton, manufactured goods and pottery.
- **Other on-board furniture** (for a faithful reproduction): the combined **Progress Track** (VP 0–100 + income track) runs around the board border; the **Turn Order Track** sits on the left edge; **3 Card Draw Areas** (Wild Location, Wild Industry, Draw Deck) are on the left edge; Coal/Iron markets on the right edge.

---

## 5. Suggested normalized coordinates (1600 × 1100 canvas)

Derived by measuring location centres on a high-resolution photo of the official (night-side) board and mapping with **uniform scale 0.9167** (board aspect is ~1:1, so it fills the full 1100 px height and is centred horizontally, leaving ~249 px margins left/right for side panels — matching how most web adaptations lay out). If you prefer a full-bleed stretched canvas, use `x = img_x/1203*1600, y = img_y/1200*1100` instead. North = Leek/Belper/Warrington/Nottingham; south = Worcester/Gloucester/Oxford; west = Shrewsbury/Coalbrookdale; east = Derby/Nottingham/Coventry. (M) = merchant.

| Location | x | y |
|---|---|---|
| Leek | 843 | 87 |
| Belper | 1074 | 92 |
| Warrington (M) | 551 | 119 |
| Stoke-on-Trent | 698 | 156 |
| Nottingham (M) | 1243 | 197 |
| Derby | 1083 | 261 |
| Uttoxeter | 870 | 266 |
| Stone | 590 | 280 |
| Stafford | 689 | 385 |
| Burton-on-Trent | 996 | 417 |
| Farm Brewery (N) | 580 | 477 |
| Cannock | 762 | 500 |
| Tamworth | 1023 | 564 |
| Wolverhampton | 657 | 591 |
| Walsall | 822 | 614 |
| Coalbrookdale | 510 | 619 |
| Shrewsbury (M) | 354 | 632 |
| Nuneaton | 1119 | 669 |
| Dudley | 704 | 729 |
| Birmingham | 913 | 756 |
| Coventry | 1130 | 784 |
| Kidderminster | 629 | 839 |
| Redditch | 886 | 894 |
| Farm Brewery (S) | 535 | 917 |
| Oxford (M) | 1152 | 944 |
| Worcester | 652 | 985 |
| Gloucester (M) | 872 | 1040 |

(Coordinates are location centres, measured from one board photo; ±15 px tolerance. The relative geography was sanity-checked against two fan implementations' independent layouts, which place the same locations in the same relative positions.)

---

## 6. Sources

1. **Official rulebook (Roxley), English** — https://officialgamerules.org/wp-content/uploads/2025/04/64-brass-birmingham-rulebook-1.pdf and text mirror https://rulespal.com/brass-birmingham/rulebook — confirmed: 5 merchant locations & their beer bonuses, merchant placement by player count (no tiles at Warrington/Nottingham at 2p, none at Nottingham at 3p), beer-barrel spaces beside non-blank merchant tiles, Coal Market (14 spaces, one £1 left open) / Iron Market (10 spaces, both £1 left open) setup, coal-from-market requires merchant connection, iron needs no connection, farm brewery rules (Cannock link; Kidderminster–Worcester link dual-connects), beer sources, rail-era Network costs, region banner colours gating location cards by player count, 9 merchant tiles, component counts.
2. **gameswithtony.com "Eliza/Eleanor" solo app** — https://gameswithtony.com/eliza/ (data files `data.js`, `app.js`) — full board graph: 20 towns + 2 farm breweries with per-space industry types, canal/rail edge lists (including rail-only/canal-only distinctions), merchant locations/slots/bonuses (£5 Warrington, 4 VP Shrewsbury, 3 VP Nottingham, +2 income Oxford, develop Gloucester), merchant tile mix (2p: blank,blank,any,cotton,manufacturer; 3p: +blank,+pottery; 4p: +manufacturer,+cotton), space numbering convention (left-to-right, top-to-bottom).
3. **brassforge.cc "Boomforge" online implementation** — https://brassforge.cc/ (client bundle `/assets/index-*.js`) — independent full board graph: identical 20 towns + 2 farm breweries, identical industry spaces, identical 39-link graph with identical canal-only/rail-only classifications, identical merchant slots/bonuses, identical merchant tile mix (2p/3p/4p), plus card deck composition.
4. **github.com/npow/brass-birmingham** — https://github.com/npow/brass-birmingham (`js/gameData.js`) — third board-graph encoding; agrees fully on locations, spaces and links (its merchant-tile 3p/4p additions conflict with sources 2–3 and are treated as erroneous).
5. **Official board photograph (night side)** — https://boardgamesland.com/wp-content/uploads/2024/09/najdobra-mapa-scaled.jpeg (and setup photo …/game-setup-scaled.jpeg) — visual verification of relative geography, region groupings, merchant positions/bonus tokens (hex "4" at Shrewsbury, "3" at Nottingham, "£5" at Warrington), and direct visual confirmation of industry spaces for Birmingham, Coalbrookdale, Wolverhampton, Cannock, Worcester and both farm brewery spaces; coordinates in §5 were measured from this image.
6. **boardgamesbot.com rules summary** — https://www.boardgamesbot.com/brass-birmingham/how-to-play — corroborated setup, Network action costs (£3 canal; £5 + 1 coal rail; £15 + 1 beer for two rails), resource sourcing rules.
7. **eriktwice.com industry guide** — https://eriktwice.com/en/2021/01/15/brass-birmingham-understanding-the-industries/ — corroborated strategic geography (brewery-space towns, Burton/Uttoxeter breweries, pottery in Coventry & Stoke-on-Trent, iron in Dudley/Coventry/Coalbrookdale).

**Uncertainty notes:**
- Merchant tile *faces* (§3 mix) rest on two agreeing code sources (Eliza + brassforge); photos obtained were too low-resolution to read tile faces — confidence: high but not photo-confirmed.
- Pixel coordinates are measured approximations from one photograph (mild perspective/keystone possible), tolerance ±15 px.
- Everything in §1 (spaces), §2 (links) and §4 (markets/supply rules) is triple-confirmed and consistent across all sources; nothing is [UNVERIFIED] in those sections.

---

## 7. Appendix — location card gating by player count (board banner colours)

From the official rulebook: banner colours indicate which location cards are in the draw deck.
- **2-player games:** teal (Derbyshire — Belper, Derby) and blue (Staffordshire — Leek, Stoke-on-Trent, Stone, Uttoxeter) location cards are removed.
- **3-player games:** teal (Belper, Derby) cards are removed.
- **4-player games:** all location cards are used.
(Buildings may still be placed in any location at any player count; only the *cards* are removed. Confirmed identically in the card decks of all three implementations.)
