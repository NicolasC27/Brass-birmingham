import enHome from '../en/home';

const fr: typeof enHome = {
  hero: {
    ariaTitle: 'Écran titre de Brassworks',
    wordmark: 'Brassworks',
    dioramaAlt: "Panorama gravé d'une vallée industrielle des Midlands au crépuscule",
    eyebrow: 'Un jeu industriel des Midlands · 1770–1850',
    tagline: "Canaux, charbon et fer. Bâtissez l'empire qui a bâti le monde.",
    resume: 'Reprendre — {era}, manche {round}',
    eraCanal: 'Ère canal',
    eraRail: 'Ère rail',
    ctaSetup: 'Dressez la table',
    ctaRules: 'Lisez les règles',
    scrollHint: "Défilez — l'histoire d'une ère",
  },
  modes: {
    aria: 'Choisissez votre partie',
    eyebrow: 'La table vous attend',
    title: 'Comment jouerez-vous ?',
    inTheWorks: 'En chantier',
    solo: {
      title: 'Solo contre le Club Mécanique',
      copy: 'Affrontez 1 à 3 rivaux mécaniques. Trois tempéraments de machine : Apprenti, Contremaître, Baron.',
      cta: 'Jouer en solo',
    },
    hotseat: {
      title: "Autour d'une même table",
      copy: 'Passe-et-joue entre amis sur cet appareil. Passez, jouez, complotez.',
      cta: 'Passe-et-joue',
      tag: 'Disponible',
    },
    correspondence: {
      title: 'La partie par correspondance',
      copy: 'Ouvrez une table, passez son code, retrouvez vos rivaux dans le salon.',
      cta: 'Jouer en ligne',
      tag: 'Salons',
      tooltip:
        "Le jeu en ligne et asynchrone figure sur la feuille de route — cet aperçu propose d'abord le solo local et le passe-et-joue.",
    },
  },
  triptych: {
    aria: 'Contenu de la boîte',
    eyebrow: 'Dans la boîte',
    title: 'Une édition de luxe, dans le navigateur',
    learnMore: 'En savoir plus →',
    market: {
      coal: 'Charbon',
      iron: 'Fer',
      buy: 'Achat £3',
    },
    eras: {
      canalAlt: "Frise gravée de l'ère canal : écluses, narrowboats et chemins de halage",
      railAlt: "Frise gravée de l'ère rail : locomotive, tranchée et poteaux télégraphiques",
      canal: 'Ère canal',
      rail: 'Ère rail',
    },
    map: {
      aria: 'Extrait de carte : trois villes, un lien de canal qui se trace de lui-même et une ligne de ravitaillement en pointillés vers le marché',
      market: 'MARCHÉ',
    },
    rows: {
      market: {
        eyebrow: 'Le marché vivant',
        title: 'Des prix qui respirent',
        body: "Les prix du charbon et du fer évoluent avec l'offre et la demande — chaque achat fait glisser le marché pour toute la table. Achetez à bas prix quand les plateaux sont pleins ; subissez la disette quand ils se vident.",
      },
      eras: {
        eyebrow: "Deux ères d'industrie",
        title: 'Du halage à la gare',
        body: 'Les canaux cèdent la place aux chemins de fer. Entre les deux ères, les manufactures de niveau 1 sont balayées du plateau et les fortunes sont comptées deux fois — une fois à la fin de chaque ère.',
      },
      supply: {
        eyebrow: 'Le ravitaillement, une stratégie',
        title: "Le fer doit atteindre l'usine",
        body: "Le charbon et le fer doivent voyager jusqu'à vos usines par votre propre réseau — ou être achetés au prix fort au marché. Des lignes fantômes montrent exactement d'où viendrait chaque cube.",
      },
    },
  },
  eraStrip: {
    aria: "De l'ère canal à l'ère rail",
    caption: 'Ère canal → Ère rail',
  },
  closing: {
    aria: 'Prenez votre siège',
    title: 'Les fonderies sont allumées.',
    body: "Vos rivaux n'attendront pas une seconde invitation.",
    ctaSetup: 'Dressez la table',
    ctaRules: 'Parcourez le codex des règles',
  },
  footer: {
    tagline: "Canaux, charbon et fer. Bâtissez l'empire qui a bâti le monde.",
    navAria: 'Pied de page',
    gameEyebrow: 'Le jeu',
    setTable: 'Dressez la table',
    board: 'Le plateau',
    rulesCodex: 'Codex des règles',
    bilan: 'Le Bilan',
    colophonEyebrow: 'Colophon',
    colophon1: 'Un prototype hommage créé par des fans — sans affiliation avec Roxley Games.',
    colophon2: 'Un prototype hommage inspiré de Brass: Birmingham — toutes les illustrations sont originales.',
  },
};

export default fr;
