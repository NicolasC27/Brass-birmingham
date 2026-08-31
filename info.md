# Brief constraints — Brass: Birmingham browser prototype

- Playable browser prototype inspired by Brass: Birmingham; fidelity to core rules matters, but this first preview may mark approximations clearly.
- 2–4 players; two eras (Canal, Rail); scoring between eras; remove level-1 industry tiles after Canal Era.
- Midlands map with cities such as Birmingham, Coventry, Dudley, Walsall; canal/rail links are central.
- Industries: coal mines, iron works, cotton mills, manufacturers, potteries, breweries; multiple levels, costs, effects.
- Core mechanics: hand of cards (location/industry/wild/era), network building, develop, sell goods via merchants, loans, coal/iron market with dynamic prices.
- Supply logic must remain visible: coal/iron access via network or market is the strategic core; do not hide it.
- End-of-era scoring: links + flipped industries.
- UX: main board overview + per-player board (hand, income, loans, resources), always-visible coal/iron market, turn indicator, recent action log, contextual tooltips.
- Modes: solo vs competent bots is desired; online multiplayer is a later phase. This preview should at least support hot-seat/solo-style local play.
- Responsive: desktop first, mobile playable second.
- Visual ambition: premium Industrial Revolution object — brass/copper, coal black, bottle green, parchment cream; tactile paper/metal materials; board-game relief; crisp readability; micro-animations for tile placement, link tracing, card play, score/income movement.
- Suggested stack from user: Go backend + React/TypeScript frontend + WebSocket; for this preview the orchestrator selected frontend-only React/Vite/TS with local game state, structured so backend graft can happen later.
