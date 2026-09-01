const rules = {
  status: {
    faithful: 'Faithful',
    approximate: 'Approximate',
    planned: 'Planned',
  },
  chapters: {
    quickstart: 'The Short of It',
    eras: 'The Two Eras',
    actions: 'The Six Actions',
    industries: 'The Industries',
    network: 'The Network',
    supply: 'Coal & Iron, Delivered',
    market: 'The Living Market',
    selling: 'Selling & Merchants',
    money: 'Money & Loans',
    scoring: 'Scoring & Victory',
    glossary: 'The Glossary',
    approximations: 'Current Approximations',
  },
  hero: {
    eyebrow: 'The Midlands Compendium',
    title: 'Of Trade & Manufacture',
    lede:
      'Being a faithful account of the rules of Brassworks — canals, coal, iron, and the two great eras of industry.',
    wholeOfIt: 'The Whole of It',
  },
  rail: {
    chapters: 'Chapters',
    jumpAria: 'Jump to chapter',
    navAria: 'Codex chapters',
    index: 'Index of Chapters',
    footnote:
      'Chapter XII is the honest ledger of what this prototype simplifies — linked wherever a fidelity chip appears.',
  },
  quickstart: {
    note: 'Every turn begins with a card. Everything else follows from where it lets you reach.',
  },
  quick: {
    goal: {
      title: 'The Goal',
      body: 'Amass the most victory points after two great eras. Points come from flipped industries and from every link in your network.',
    },
    turn: {
      title: 'Your Turn',
      body: 'Play one card from your hand, then take one or two actions — build, connect, sell, borrow, develop or scout.',
    },
    build: {
      title: 'Build Industries',
      body: 'Play a location or industry card to place a tile from your board onto a matching slot. Pay its money, coal and iron.',
    },
    connect: {
      title: 'Connect the Network',
      body: 'Lay canals, then rails, between towns. Everything you build, feed and sell must reach along your network.',
    },
    sell: {
      title: 'Sell, Borrow, Develop',
      body: 'Sell goods to distant merchants to flip tiles for income, take loans when brass runs short, and develop away weak works.',
    },
    supply: {
      title: 'Supply & Scoring',
      body: 'Coal and iron must physically reach you — by canal, by rail, or bought dear from the market. Each era ends in a full scoring.',
    },
  },
  eras: {
    canalAlt: 'Engraved frieze of the Canal Era',
    railAlt: 'Engraved frieze of the Rail Era',
    canalTitle: 'The Canal Era, 1770–1830',
    canalBody:
      'Turns proceed round by round: play a card, take one or two actions, draw back to a full hand. Canals cost £3 per link and are the era’s only roads. When the deck and every hand are spent, the era is scored — flipped industries pay their VP, and each link scores the link icons of the industry tiles in the locations it joins, and two per merchant.',
    railTitle: 'The Rail Era, 1830–1850',
    railBody:
      'A new deck, fresh hands, and rails at £5 plus a coal per link — two links may be laid in one action for £15 and two coal. No new canals may be cut. Stronger works sell dearer and demand two beer. When this deck too is spent, the board is scored a second time and the richest ledger wins.',
    betweenTitle: 'Between eras',
    betweenBody:
      'Level-1 works are swept from the board when the waters recede — plan their flipping before the Canal Era closes, or watch them vanish uncounted.',
  },
  actionsIntro:
    'Each card played buys you one or two of the six actions below. Open any row for its costs, its steps, and the edge cases that decide close games.',
  actionsUi: {
    edgeCases: 'Edge cases',
    diagram: {
      town: 'Town',
      yourTown: 'your town',
      newTown: 'new town',
      minusIron: '−1 iron',
      perTile: 'per tile',
      mill: 'mill',
      beer: 'beer',
      merchant: 'merchant',
      loanLabel: '−3 steps · +£30',
    },
  },
  actions: {
    build: {
      name: 'Build',
      cost: '£ tile cost + coal & iron shown',
      steps: {
        s1: 'Play a location card (build in that town) or an industry card (build that industry anywhere on your network).',
        s2: 'Take the lowest-level matching tile from your player board and place it on a free slot.',
        s3: 'Pay the money cost, then deliver the coal and iron it requires (see Chapter VI).',
      },
      edges: {
        e1: 'Your first build of the game may go anywhere; afterwards you must build on — or connected to — your network.',
        e2: 'A wild card may stand for any location or any industry.',
        e3: "One tile per slot; an opponent's tile may be overbuilt only by a higher level of the same industry.",
      },
    },
    network: {
      name: 'Network',
      cost: 'Canal £3 · Rail £5 + 1 coal',
      steps: {
        s1: 'Play any card and place one canal link (Canal Era) or one rail link (Rail Era) on an empty route between two towns.',
        s2: 'The link must touch your existing network — a town holding your tile, or the end of one of your links.',
        s3: 'Pay the cost; rail links also consume one coal, delivered as in Chapter VI.',
      },
      edges: {
        e1: 'In the Rail Era you may lay two rail links in a single action for £15 and 2 coal.',
        e2: 'No new canals may be built once the Rail Era begins; existing canals remain.',
        e3: 'Merchant ports count as towns for connection purposes.',
      },
    },
    develop: {
      name: 'Develop',
      cost: '1 iron per tile removed (max 2)',
      steps: {
        s1: "Play any card and remove one or two tiles from the top of your player board's industry stacks.",
        s2: 'Pay one iron for each tile removed, delivered to the board as usual.',
        s3: 'Removed tiles return to the box, revealing the stronger levels beneath.',
      },
      edges: {
        e1: 'Developing is the only way to reach your level-3 and level-4 works early.',
        e2: 'You may remove tiles of two different industries in one develop action.',
      },
    },
    sell: {
      name: 'Sell',
      cost: 'Beer: 1 per tile (2 for late works)',
      steps: {
        s1: 'Play any card and choose one or more of your cotton mills, manufacturers or potteries.',
        s2: 'Each must trace a connection to a merchant port whose demand pips still match the industry.',
        s3: "Spend the required beer — from your own breweries, a connected brewery, or the merchant's own supply — then flip each sold tile.",
      },
      edges: {
        e1: "Flipped tiles pay their income bonus immediately and score VP at era's end.",
        e2: "A merchant's demand is exhausted as pips are claimed; latecomers find bare shelves.",
        e3: 'In the Rail Era, stronger works demand two beer to sell.',
      },
    },
    loan: {
      name: 'Loan',
      cost: 'Income −3 steps · take £30',
      steps: {
        s1: 'Play any card, move your income marker three steps down the track, and take £30 from the bank.',
      },
      edges: {
        e1: 'A loan may be taken in either action slot of your turn — even as the second action.',
        e2: 'Loans are never repaid; the income loss is permanent.',
        e3: "If your income falls below £0, you pay the bank at each round's end.",
      },
    },
    scout: {
      name: 'Scout',
      cost: 'Discard 3 cards · draw 2 wilds',
      steps: {
        s1: 'Discard any three cards from your hand.',
        s2: 'Take the two wild cards — one wild location, one wild industry — into your hand.',
      },
      edges: {
        e1: "Scouting consumes your whole turn's card play; take it when your hand has no honest future.",
        e2: 'Wild cards may be played for any town or any industry thereafter.',
      },
    },
  },
  industriesIntro:
    'Six trades keep the Midlands turning. Each exists in four levels on your player board; you always build the lowest remaining level, and develop to reach the stronger ones. Learn to read a tile: pips mark the level, the brass chip the income gained on flipping, the cream chip the victory points.',
  industries: {
    tuningTag: 'Printed tiles',
    tuningNote:
      '— every value below is read from the official player mat: 45 tiles per player, canal-only and rail-only levels, beer needed to sell, link icons and lightbulbs.',
    headers: {
      tile: 'Tile',
      lvl: 'Lvl',
      build: 'Build',
      coalIron: 'Coal / Iron',
      beerToFlip: 'Beer to flip',
      income: 'Income Δ',
      vp: 'VP',
      notes: 'Notes',
    },
    resource: {
      coal: '{n} coal',
      iron: '{n} iron',
      none: '—',
    },
    beer: {
      count: '{n} beer',
      onEmpty: 'on empty',
    },
    coalMine: {
      name: 'Coal Mine',
      blurb:
        'The black foundation of everything. Mines arrive laden with coal cubes that feed the whole network; when the seam is emptied the tile flips of its own accord.',
      notes: {
        n1: 'Canal Era only. 2 coal; 2 link icons; flips when emptied.',
        n2: '3 coal; flips when emptied.',
        n3: '4 coal; needs 1 iron to build.',
        n4: '5 coal, needs 1 iron to build.',
      },
    },
    ironWorks: {
      name: 'Iron Works',
      blurb:
        'Forges that stock iron bars for building and developing. Like mines, they flip when their stock is exhausted — a foundry worked cold is a foundry paid for.',
      notes: {
        n1: 'Canal Era only. 4 iron; needs 1 coal.',
        n2: '4 iron; needs 1 coal.',
        n3: '5 iron; needs 1 coal.',
        n4: '6 iron; needs 1 coal.',
      },
    },
    cottonMill: {
      name: 'Cotton Mill',
      blurb:
        'The great money-spinner of the Midlands. Mills flip only by selling to a distant merchant — and they pay handsomely for the trouble.',
      notes: {
        n1: 'Canal Era only. 1 link icon; ×3 on the mat.',
        n2: 'Needs 1 coal; 2 link icons; ×2.',
        n3: 'Needs 1 coal + 1 iron; ×3.',
        n4: 'Needs 1 coal + 1 iron; ×3 — the richest mill.',
      },
    },
    manufacturer: {
      name: 'Manufacturer',
      blurb:
        'Workshops turning out finished goods. Cheaper than mills and steadier — the quiet backbone of many a winning ledger.',
      notes: {
        n1: 'Canal Era only. Needs 1 coal; 2 link icons.',
        n2: 'Needs 1 iron; ×2.',
        n3: 'Needs 2 coal; no link icon.',
        n4: 'Needs 1 iron; cheap and quick.',
        n5: 'Needs 1 coal; sells for 2 beer; 2 link icons; ×2.',
        n6: 'No resources needed.',
        n7: 'Needs 1 coal + 1 iron; no link icon.',
        n8: 'Needs 2 iron; ×2 — the top of the mat.',
      },
    },
    pottery: {
      name: 'Pottery',
      blurb:
        'Kilns of modest appetite and remarkable value. Pottery scores above its weight but is dear to sell in the later era.',
      notes: {
        n1: 'Both eras. Needs 1 iron. Lightbulb: cannot be developed.',
        n2: 'Free to build; needs 1 coal. Develop this one away.',
        n3: 'Needs 2 coal; sells for 2 beer. Lightbulb: cannot be developed.',
        n4: 'Free to build; needs 1 coal.',
        n5: 'Rail Era only. Needs 2 coal; sells for 2 beer; 20 VP.',
      },
    },
    brewery: {
      name: 'Brewery',
      blurb:
        "Beer makes the sales go down. Breweries arrive stocked with barrels and flip when drained — yours, or anyone's, if connected.",
      notes: {
        n1: 'Canal Era only. Needs 1 iron; 2 link icons; ×2.',
        n2: 'Needs 1 iron; ×2.',
        n3: 'Needs 1 iron; ×2.',
        n4: 'Rail Era only. Needs 1 iron.',
      },
    },
  },
  network: {
    intro:
      'Your network is every town holding one of your tiles and every link you have laid — plus whatever it touches through other players’ routes. Building beyond your first move, delivering coal and iron, and selling to merchants all trace along it.',
    canalChip: 'Canal link · £3 · Canal Era',
    railChip: 'Rail link · £5 + 1 coal · Rail Era',
    doubleRailChip: 'Double rail · £15 + 2 coal · one action',
    outro:
      'Links are scored, not merely used: at each era’s end every link counts the link icons printed on the industry tiles in the locations it joins — whoever owns them — and two for each merchant. A well-placed canal through a rival’s flourishing town is worth as much to you as to them.',
  },
  supply: {
    intro: 'This is the heart of the game, and it is not abstracted. Every cube of coal or iron a build demands must physically arrive: from your own connected mines and works for free, from a rival’s connected works at no cost to you (their tile empties — a gift that flips their industry!), or bought from the market at the current price. If no source can be reached, the build cannot happen.',
    note: 'Iron travels the same roads as coal; beer obeys the same law, sourced from breweries or from a merchant’s own cellar when selling.',
    aria:
      'Diagram of coal supply: a connected mine delivers free coal along your canals, the market sells at the current price, and a broken connection refuses the build.',
    groupAria: 'Supply scenarios',
    modes: {
      mine: {
        label: 'Connected mine',
        hint: 'Your build traces a chain of links to your own coal mine. The coal rides your canals free of charge — the mine sheds a cube.',
      },
      market: {
        label: 'Buy from market',
        hint: 'No connected mine? The coal is bought from the market tray instead: pay the current price (£3 here) and the cheapest cube vanishes — so the next buyer pays more.',
      },
      none: {
        label: 'No supply',
        hint: 'The mine lies beyond a broken chain: no link reaches it, and a spent market offers nothing. The build is refused outright — supply is law, not suggestion.',
      },
    },
    chips: {
      mine: 'Coal £0 — your own mine',
      market: 'Buy 1 coal · £3',
      none: 'No reachable coal',
    },
    yourMine: 'your coal mine',
    marketLabel: 'the market',
    buildSlot: 'build · 1 coal',
  },
  marketTray: {
    title: 'The coal tray',
    buy: 'Buy £3',
    caption: '← buying empties the cheap cells first · selling refills from the dear end →',
  },
  market: {
    p1:
      'When supply runs short, the market answers — at a price. Coal and iron each sit in a tray of cells priced £1 to £8. Buying takes the cheapest cube and the price climbs; selling resources back (or the era-end refill) restocks from the dear end and the price falls.',
    p2:
      'An empty market is a wall, not an inconvenience: coal that cannot be bought and cannot be reached simply cannot be had. Watch the trays the way a foreman watches the sky.',
  },
  selling: {
    intro: 'Cotton mills, manufacturers and potteries flip only by selling to a merchant port at the map’s edge. The port must still hold a demand pip for your industry, you must trace a connection to it, and each tile drinks beer before it sells — one barrel in the Canal Era, two for the great late works.',
    li1: "Beer comes first from your own breweries, then any connected brewery, then the merchant's own cellar.",
    li2: "Flipping pays the income bonus immediately and banks the tile's VP for era scoring.",
    li3: 'Claimed pips are gone for good — a merchant once sold out is only a view of the sea.',
    choice:
      'The choice is the game in miniature: income now raises every future round’s purse, while VP waits quietly for the reckoning.',
    flip: {
      aria: 'Demonstration tile: hover or focus to flip it from its parchment face to its sold ember face',
      tileName: 'cotton mill II',
      vp: 'victory points',
      sold: 'sold · flipped',
      caption: 'Hover or focus — the flip is the payday.',
    },
  },
  tile: {
    vpChip: '{vp}VP',
  },
  money: {
    intro: 'At each round’s end your income marker pays you its rung in pounds. Flipping industries climbs the ladder; there is no ceiling worth respecting.',
    li1: 'A loan may be taken in either action slot: drop three rungs, take £30, play on.',
    li2: 'Loans are never repaid. The rungs are simply gone.',
    li3: 'Below £0 the ladder turns creditor — you pay the bank at each round’s end.',
    develop:
      'Develop, the quiet sixth sense of strong players, trades one iron for the removal of a weak tile, uncovering the powerful levels beneath without spending a build.',
    ladderAria:
      'Income track ladder: rungs from minus ten pounds up to sixty, with a brass pawn resting on the thirty-pound rung',
    ladderCaption: 'the income track',
  },
  scoring: {
    thSource: 'Source',
    thCounts: 'Counts',
    thWhen: 'When',
    r1s: 'Flipped industries',
    r1c: 'VP printed on the tile',
    r1w: 'End of each era',
    r2s: 'Links',
    r2c: 'link icons in both locations joined',
    r2w: 'End of each era (canals then rails)',
    r3s: 'Tiebreakers',
    r3c: 'most money → earlier turn order',
    r3w: 'Final reckoning only',
    exampleTitle: 'A worked example',
    exampleBody:
      'Two flipped works (2 and 5 VP) in towns your link joins, plus 3 link VP for the connection itself: {expr} toward the era’s tally.',
    expr: '2 + 5 + 3 = 10',
  },
  scoringSketch: {
    aria:
      'Worked example: two flipped tiles worth 2 and 5 victory points in towns joined by a link, which itself scores 3 link points',
    link: 'link 3',
    vpTotal: 'VP total',
  },
  glossary: {
    network: {
      term: 'Network',
      def: 'Everything your tiles and links touch. Building, delivering coal, and selling all trace along it.',
    },
    connected: {
      term: 'Connected',
      def: 'Reachable through an unbroken chain of your own or rival links and occupied towns.',
    },
    flippedTile: {
      term: 'Flipped tile',
      def: 'A works that has sold or emptied — turned face-down to its ember side, paying income and scoring VP.',
    },
    merchantPort: {
      term: 'Merchant port',
      def: "A harbour tile at the map's edge with demand pips; the only buyer for mills, manufacturers and potteries.",
    },
    demandPip: {
      term: 'Demand pip',
      def: 'A marked space on a merchant; one is claimed each time the matching industry sells there.',
    },
    beer: {
      term: 'Beer / barrel',
      def: "The lubricant of commerce, spent to sell goods. Sourced from breweries or a merchant's own cellar.",
    },
    wildCard: {
      term: 'Wild card',
      def: 'A card standing for any location or any industry, won by scouting.',
    },
    era: {
      term: 'Era',
      def: 'One half of the game — Canal, then Rail — closed by a full scoring of links and flipped tiles.',
    },
    incomeTrack: {
      term: 'Income track',
      def: 'The ladder recording your earnings each round. Building flips raise it; loans lower it three steps.',
    },
    overbuild: {
      term: 'Overbuild',
      def: "Replacing a tile with a higher level of the same industry; rivals' exhausted mines and works may be overbuilt freely.",
    },
    linkVp: {
      term: 'Link VP',
      def: 'At scoring, each link counts the link icons printed on the industry tiles in the two locations it joins (two for a merchant), whoever owns them.',
    },
    market: {
      term: 'The Market',
      def: 'The coal and iron trays where prices climb as stocks are bought and fall as they are sold back.',
    },
    distantSale: {
      term: 'Distant sale',
      def: 'Selling to a merchant you can trace a connection to, however many links lie between.',
    },
    clockworkClub: {
      term: 'The Clockwork Club',
      def: 'The mechanical players — Apprentice, Foreman and Baron bots that fill an empty chair.',
    },
  },
  approx: {
    intro:
      'An honest ledger, kept in plain sight: what this preview plays true, and what it still simplifies. The Setup screen links here wherever a fidelity chip appears.',
    botsRibbon: 'Heuristic',
    botsTitle: 'The Clockwork Club',
    botsBody1: 'Empty chairs are filled by mechanical players. The ',
    botsBody2: ' builds cheaply and sells late; the ',
    botsBody3: ' develops, connects and sells on schedule; the ',
    botsBody4:
      ' borrows boldly and races you to the merchants. They play by appetite and habit, not by deep search — worthy sparring partners, not yet masterminds.',
  },
  approximations: {
    supplyCore: {
      area: 'Supply & scoring core',
      note: 'Deck sizes, 10/9/8 rounds per era, turn order by money spent, the 100-space income track, market prices, mines selling to market, overbuilding, multi-tile sales, double rails and both scorings follow the rulebook.',
    },
    industryValues: {
      area: 'Automatic choices',
      note: 'Where the rules let you choose, the engine picks for you: the nearest mine when two tie, the merchant barrel before your own beer, the first card when you pass or borrow, the cheapest tiles when a negative payday must be covered.',
    },
    map: {
      area: 'The Midlands map',
      note: 'Towns, slots and routes are compressed for the browser board; the geography is faithful in spirit, not in count.',
    },
    deck: {
      area: 'Merchant tiles',
      note: 'The nine merchant tiles are dealt at random as printed; the two tiles added at 3 and 4 players follow the most common published manifest (pottery + goods, then any + cotton).',
    },
    bots: {
      area: 'The Clockwork Club (bots)',
      note: 'Apprentice, Foreman and Baron are heuristics with differing appetites — not deep-search opponents.',
    },
    multiplayer: {
      area: 'Online multiplayer',
      note: 'This preview is local-only: solo versus the Club, or hot-seat at one table. Networked and asynchronous play are on the drawing board.',
    },
  },
  finis: 'Finis · set the table and play',
};
export default rules;
