import enresults from "../en/results";

const fr: typeof enresults = {
  empty: {
    eyebrow: "Le Bilan",
    title: "Les registres ne sont pas encore clos",
    body: "Aucune partie terminée ne repose sur cette table. Quand la dernière ère sera décomptée, le podium, le décompte et la frise seront gravés ici.",
    setTable: "Préparer la table",
    backTitle: "Retour au titre",
  },
  page: {
    curvesTitle: "Le livre de comptes",
    curvesAria: "Points de victoire, revenu et argent manche par manche",
    curvesMoney: "Argent en caisse",
    curvesVp: "Points de victoire",
    curvesIncome: "Niveau de revenu",
    curvesCanal: "Canal",
    curvesRail: "Rail",
    curvesRound: "M{n}",
    back: "Titre",
    title: "Le Bilan — 1870",
    skip: "Cliquez pour passer la cérémonie",
    podiumAria: "Podium final",
    scoringAria: "Décompte détaillé",
    scoringTitle: "Décompte détaillé",
  },
  tiebreak: "départage : revenu £{hi} > £{lo}",
  share: {
    text: "BRASSWORKS — Le Bilan : {summary}",
    share: "Partager le bilan",
    copied: "Copié",
  },
  actions: {
    revanche: "Revanche",
    backToMenu: "Retour au menu",
    consultManual: "Consulter le manuel",
  },
  podium: {
    standingsAria: "Classement actuel",
    podiumAria: "Podium final",
    ranks: { 0: "1re", 1: "2e", 2: "3e", 3: "4e" },
    places: { 0: "1re place", 1: "2e place", 2: "3e place", 3: "4e place" },
    vp: "{vp} PV",
    incomeShort: "rev. £{income}",
    winnerHuman: "Votre empire prospère.",
    winnerAi: "L'empire de {name} prospère… cette fois.",
    finalIncome: "Revenu final £{income}",
    victoryPoints: "points de victoire",
  },
  table: {
    header: "Décompte",
    eraCanal: "Ère du Canal",
    eraRail: "Ère du Rail",
    vpScored: "Points de victoire marqués",
    total: "Total",
    finalIncome: "Revenu final",
    linksBuilt: "Liaisons posées",
    tilesBuilt: "Tuiles construites / flippées",
  },
  frieze: {
    title: "Frise de la partie",
    railBannerAlt: "L'ère du Rail commence",
  },
  nameless: "Sans nom",
};

export default fr;
