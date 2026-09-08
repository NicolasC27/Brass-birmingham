export default {
  backToTitle: "Title",
  eyebrow: "Prepare the Table",
  title: "A New Game",
  seating: {
    ariaLabel: "Seating",
    heading: "Seating",
    note: "Two to four industrialists. Choosing a color takes it from whoever holds it — counters are swapped, not duplicated.",
  },
  summary: {
    botName: "{difficulty} {name}",
  },
  begin: "Begin the Canal Era",
  beginHint: "Seat at least two players — human or clockwork — before the first card is drawn.",
  houseRules: {
    ariaLabel: "House rules",
    heading: "House Rules",
    eraLength: {
      label: "Era length",
      hint: "A short game ends and scores after the Canal Era.",
      ariaLabel: "Era length",
      full: "Full game",
      canalOnly: "Canal only",
    },
    marketTemper: {
      label: "Market temper",
      hint: "Opening stock only: standard is the printed 13 coal / 8 iron, calm opens both markets full, volatile opens them closer to empty. Markets never restock on their own — only a new mine or iron works fills them.",
      ariaLabel: "Market temper",
      calm: "Calm",
      standard: "Standard",
      volatile: "Volatile",
      beta: "Beta",
    },
    assist: {
      label: "Beginner assistance",
      hint: "For everyone at the table: playable slots lit up, prices itemised, tips as the game goes. Set here for an online table; at home it is also a board setting.",
      on: "On",
      off: "Off",
    },
    timer: {
      label: "Turn timer",
      hint: "When set, the board shows a small brass countdown plate for each turn — best around one table.",
      ariaLabel: "Turn timer",
      off: "Off",
      min: "{n} min",
    },
    fidelity: {
      label: "Rules fidelity",
      faithful: "Core rules: faithful",
      seeApproximations: "See approximations",
    },
  },
  seat: {
    empty: "Empty chair",
    seatAnother: "Seat another player at the table.",
    openAria: "Open seat {n}",
    botPortraitAlt: "Clockwork rival portrait",
    namePlaceholder: "Name this industrialist",
    nameAria: "Seat {n} name",
    typeHuman: "Human",
    typeBot: "Clockwork",
    typeClosed: "Closed",
    headBadge: "Human · You",
    typeAria: "Seat {n} type",
    colorAria: "Seat {n} color",
    colorStealTip: "{color} — taken from whoever holds it.",
    beta: "Beta",
    engineTip: "Heuristic engine — approximations apply. See the Rules Codex for the current simplifications.",
  },
  token: {
    ariaLabel: "{color} counter",
  },
  colors: {
    brass: "Brass",
    oxblood: "Oxblood",
    verdigris: "Verdigris",
    steel: "Steel Blue",
  },
  difficulty: {
    foreman: {
      label: "Foreman",
      tendency:
        "Keeps the works running — builds steadily and sells when it can, but misreads the market now and then.",
    },
    industrialist: {
      label: "Industrialist",
      tendency:
        "Balanced — competes for network and market share, planning one era at a time.",
    },
    magnate: {
      label: "Magnate",
      tendency:
        "Sharp — contests the merchants, denies you coal, and plans both eras ahead.",
    },
  },
  defaults: {
    playerOne: "Player One",
    playerTwo: "Player Two",
    player: "Player",
    nameless: "Nameless",
    engine: "Engine {n}",
  },
};
