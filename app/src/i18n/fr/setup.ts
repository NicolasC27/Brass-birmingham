import ensetup from "../en/setup";

const fr: typeof ensetup = {
  backToTitle: "Titre",
  eyebrow: "Préparez la table",
  title: "Nouvelle partie",
  seating: {
    ariaLabel: "Placement",
    heading: "Placement",
    note: "De deux à quatre industriels. Choisir une couleur la prend à qui la détient — les pions sont échangés, pas dupliqués.",
  },
  summary: {
    botName: "{name} ({difficulty})",
  },
  begin: "Lancer l’ère canal",
  beginHint: "Placez au moins deux joueurs — humains ou mécaniques — avant que la première carte ne soit tirée.",
  houseRules: {
    ariaLabel: "Règles maison",
    heading: "Règles maison",
    map: {
      label: "Le plateau",
      ariaLabel: "Le plateau",
      midlands: "Midlands",
      veneto: "Vénétie",
      midlandsHint: "Birmingham et le Pays noir : les canaux de 1770, les rails de 1830.",
      venetoHint: "De la lagune aux Dolomites : le Brenta, la Piave, et la ligne de Vérone à Venise.",
    },
    eraLength: {
      label: "Durée de la partie",
      hint: "Une partie courte se termine et est comptée après l’ère canal.",
      ariaLabel: "Durée de la partie",
      full: "Partie complète",
      canalOnly: "Canal seul",
    },
    marketTemper: {
      label: "Humeur du marché",
      hint: "Stock d’ouverture seulement : standard = les 13 charbons / 8 fers imprimés, calme ouvre les deux marchés pleins, volatil les ouvre presque vides. Les marchés ne se réapprovisionnent jamais seuls — seule une nouvelle mine ou forge les remplit.",
      ariaLabel: "Humeur du marché",
      calm: "Calme",
      standard: "Standard",
      volatile: "Volatil",
      beta: "Bêta",
    },
    assist: {
      label: "Assistance débutant",
      hint: "Pour toute la table : emplacements jouables allumés, prix détaillés, conseils au fil de la partie. Se règle ici pour une table en ligne ; chez soi, c’est aussi un réglage du plateau.",
      on: "Activée",
      off: "Désactivée",
    },
    timer: {
      label: "Chronomètre de tour",
      hint: "Quand il est réglé, le plateau affiche une petite plaque de laiton avec un compte à rebours pour chaque tour — idéal autour d’une même table.",
      ariaLabel: "Chronomètre de tour",
      off: "Sans",
      min: "{n} min",
    },
    fidelity: {
      label: "Fidélité des règles",
      faithful: "Règles de base : fidèles",
      seeApproximations: "Voir les approximations",
    },
  },
  seat: {
    empty: "Chaise vide",
    seatAnother: "Placer un autre joueur à la table.",
    openAria: "Ouvrir la place {n}",
    botPortraitAlt: "Portrait du rival mécanique",
    namePlaceholder: "Nommez cet industriel",
    nameAria: "Nom de la place {n}",
    typeHuman: "Humain",
    typeBot: "Mécanique",
    typeClosed: "Fermée",
    headBadge: "Humain · Vous",
    typeAria: "Type de la place {n}",
    colorAria: "Couleur de la place {n}",
    colorStealTip: "{color} — prise à qui la détient.",
    beta: "Bêta",
    engineTip: "Les machines jouent tout leur tour avant de choisir. Des approximations s’appliquent — voir le Codex des règles.",
  },
  token: {
    ariaLabel: "Pion {color}",
  },
  colors: {
    brass: "Laiton",
    oxblood: "Bordeaux",
    verdigris: "Vert-de-gris",
    steel: "Bleu acier",
  },
  persona: {
    boulton: {
      label: "Mr Boulton",
    },
    wedgwood: {
      label: "Mrs Wedgwood",
    },
    watt: {
      label: "Mr Watt",
    },
    arkwright: {
      label: "Miss Arkwright",
    },
    short: "Joue à votre niveau",
    expert:
      "L’expert — joue à fond et ne se relâche jamais, qui que soit en face.",
    expertShort: "Joue à fond",
    adaptive:
      "Joue à votre niveau — plus affûté quand vous gagnez, plus doux quand vous perdez, jamais au point de s’envoler.",
  },
  defaults: {
    playerOne: "Joueur un",
    playerTwo: "Joueur deux",
    player: "Joueur",
    nameless: "Sans nom",
    engine: "Machine {n}",
  },
};
export default fr;
