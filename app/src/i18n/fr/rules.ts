import enrules from "../en/rules";

const fr: typeof enrules = {
  status: {
    faithful: "Fidèle",
    approximate: "Approximatif",
    planned: "Prévu",
  },
  chapters: {
    quickstart: "L'essentiel",
    eras: "Les deux ères",
    actions: "Les six actions",
    industries: "Les industries",
    network: "Le réseau",
    supply: "Charbon et fer, livrés",
    market: "Le marché vivant",
    selling: "Vente et négociants",
    money: "Argent et emprunts",
    scoring: "Décompte et victoire",
    glossary: "Le glossaire",
    approximations: "Approximations actuelles",
  },
  hero: {
    eyebrow: "Le Compendium des Midlands",
    title: "Du commerce et de la manufacture",
    lede:
      "Fidèle relation des règles de Brassworks — canaux, charbon, fer, et les deux grandes ères de l'industrie.",
    wholeOfIt: "L'intégralité",
  },
  rail: {
    chapters: "Chapitres",
    jumpAria: "Aller au chapitre",
    navAria: "Chapitres du codex",
    index: "Index des chapitres",
    footnote:
      "Le chapitre XII est le registre honnête de ce que ce prototype simplifie — cité partout où une pastille de fidélité apparaît.",
  },
  quickstart: {
    note: "Chaque tour commence par une carte. Tout le reste découle de ce qu'elle vous permet d'atteindre.",
  },
  quick: {
    goal: {
      title: "Le but",
      body: "Amassez le plus de points de victoire au terme de deux grandes ères. Les points viennent des industries retournées et de chaque liaison de votre réseau.",
    },
    turn: {
      title: "Votre tour",
      body: "Jouez une carte de votre main, puis effectuez une ou deux actions — construire, connecter, vendre, emprunter, développer ou prospecter.",
    },
    build: {
      title: "Construisez des industries",
      body: "Jouez une carte lieu ou industrie pour placer une tuile de votre plateau sur un emplacement correspondant. Payez son coût en argent, charbon et fer.",
    },
    connect: {
      title: "Connectez le réseau",
      body: "Posez des canaux, puis des rails, entre les villes. Tout ce que vous construisez, alimentez et vendez doit passer par votre réseau.",
    },
    sell: {
      title: "Vendez, empruntez, développez",
      body: "Vendez vos marchandises à des négociants lointains pour retourner des tuiles et gagner du revenu, contractez des emprunts quand l'argent manque, et développez pour écarter les ouvrages faibles.",
    },
    supply: {
      title: "Approvisionnement et décompte",
      body: "Le charbon et le fer doivent physiquement arriver jusqu'à vous — par canal, par rail, ou achetés au prix fort au marché. Chaque ère se termine par un décompte complet.",
    },
  },
  eras: {
    canalAlt: "Frise gravée de l'ère canal",
    railAlt: "Frise gravée de l'ère rail",
    canalTitle: "L'ère canal, 1770–1830",
    canalBody:
      "Les tours s'enchaînent manche par manche : jouez une carte, effectuez une ou deux actions, puis repiochez jusqu'à une main complète. Les canaux coûtent 3 £ par liaison et sont les seules voies de l'ère. Quand la pioche et toutes les mains sont épuisées, l'ère est comptée — les industries retournées rapportent leurs PV, et chaque liaison compte les icônes lien des tuiles d'industrie dans les lieux qu'elle relie, et deux par marchand.",
    railTitle: "L'ère rail, 1830–1850",
    railBody:
      "Une nouvelle pioche, des mains fraîches, et des rails à 5 £ plus un charbon par liaison — deux liaisons peuvent être posées en une seule action pour 15 £ et deux charbons. Aucun nouveau canal ne peut être creusé. Les ouvrages plus puissants se vendent plus cher et exigent deux bières. Quand cette pioche aussi est épuisée, le plateau est compté une seconde fois et le registre le plus riche l'emporte.",
    betweenTitle: "Entre les ères",
    betweenBody:
      "Les ouvrages de niveau 1 sont balayés du plateau quand les eaux se retirent — prévoyez de les retourner avant la fin de l'ère canal, ou regardez-les disparaître sans être comptés.",
  },
  actionsIntro:
    "Chaque carte jouée vous offre une ou deux des six actions ci-dessous. Ouvrez une ligne pour voir ses coûts, ses étapes et les cas limites qui décident des parties serrées.",
  actionsUi: {
    edgeCases: "Cas limites",
    diagram: {
      town: "Ville",
      yourTown: "votre ville",
      newTown: "nouvelle ville",
      minusIron: "−1 fer",
      perTile: "par tuile",
      mill: "filature",
      beer: "bière",
      merchant: "négociant",
      loanLabel: "−3 crans · +30 £",
    },
  },
  actions: {
    build: {
      name: "Construire",
      cost: "Coût £ de la tuile + charbon et fer indiqués",
      steps: {
        s1: "Jouez une carte lieu (construisez dans cette ville) ou une carte industrie (construisez cette industrie n'importe où sur votre réseau).",
        s2: "Prenez la tuile correspondante de plus bas niveau sur votre plateau joueur et placez-la sur un emplacement libre.",
        s3: "Payez le coût en argent, puis livrez le charbon et le fer requis (voir chapitre VI).",
      },
      edges: {
        e1: "Votre première construction de la partie peut aller n'importe où ; ensuite, vous devez construire sur votre réseau — ou en connexion avec lui.",
        e2: "Une carte joker peut tenir lieu de n'importe quel lieu ou industrie.",
        e3: "Une tuile par emplacement ; la tuile d'un adversaire ne peut être surconstruite que par un niveau supérieur de la même industrie.",
      },
    },
    network: {
      name: "Réseau",
      cost: "Canal 3 £ · Rail 5 £ + 1 charbon",
      steps: {
        s1: "Jouez une carte quelconque et placez une liaison canal (ère canal) ou une liaison rail (ère rail) sur une route libre entre deux villes.",
        s2: "La liaison doit toucher votre réseau existant — une ville tenant une de vos tuiles, ou l'extrémité d'une de vos liaisons.",
        s3: "Payez le coût ; les liaisons rail consomment aussi un charbon, livré comme au chapitre VI.",
      },
      edges: {
        e1: "À l'ère rail, vous pouvez poser deux liaisons rail en une seule action pour 15 £ et 2 charbons.",
        e2: "Aucun nouveau canal ne peut être construit une fois l'ère rail commencée ; les canaux existants demeurent.",
        e3: "Les ports négociants comptent comme des villes pour les connexions.",
      },
    },
    develop: {
      name: "Développer",
      cost: "1 fer par tuile retirée (max 2)",
      steps: {
        s1: "Jouez une carte quelconque et retirez une ou deux tuiles du sommet des piles d'industries de votre plateau joueur.",
        s2: "Payez un fer pour chaque tuile retirée, livré au plateau comme à l'accoutumée.",
        s3: "Les tuiles retirées retournent dans la boîte, révélant les niveaux plus puissants en dessous.",
      },
      edges: {
        e1: "Développer est le seul moyen d'atteindre tôt vos ouvrages de niveau 3 et 4.",
        e2: "Vous pouvez retirer des tuiles de deux industries différentes en une seule action de développement.",
      },
    },
    sell: {
      name: "Vendre",
      cost: "Bière : 1 par tuile (2 pour les ouvrages tardifs)",
      steps: {
        s1: "Jouez une carte quelconque et choisissez une ou plusieurs de vos filatures de coton, manufactures ou poteries.",
        s2: "Chacune doit relier un port négociant dont les marques de demande correspondent encore à l'industrie.",
        s3: "Dépensez la bière requise — de vos propres brasseries, d'une brasserie connectée ou de la réserve du négociant — puis retournez chaque tuile vendue.",
      },
      edges: {
        e1: "Les tuiles retournées rapportent leur bonus de revenu immédiatement et marquent des PV à la fin de l'ère.",
        e2: "La demande d'un négociant s'épuise à mesure que les marques sont prises ; les retardataires trouvent des étals vides.",
        e3: "À l'ère rail, les ouvrages plus puissants exigent deux bières pour être vendus.",
      },
    },
    loan: {
      name: "Emprunt",
      cost: "Revenu −3 crans · prenez 30 £",
      steps: {
        s1: "Jouez une carte quelconque, descendez votre marqueur de revenu de trois crans sur la piste, et prenez 30 £ à la banque.",
      },
      edges: {
        e1: "Un emprunt peut être pris dans l'un ou l'autre emplacement d'action de votre tour — même en seconde action.",
        e2: "Les emprunts ne sont jamais remboursés ; la perte de revenu est définitive.",
        e3: "Si votre revenu tombe sous 0 £, vous payez la banque à la fin de chaque manche.",
      },
    },
    scout: {
      name: "Prospection",
      cost: "Défaussez 3 cartes · piochez 2 jokers",
      steps: {
        s1: "Défaussez trois cartes de votre main.",
        s2: "Prenez en main les deux cartes jokers — un lieu joker, une industrie joker.",
      },
      edges: {
        e1: "La prospection consomme toute la carte jouée de votre tour ; choisissez-la quand votre main n'a plus d'avenir honnête.",
        e2: "Les cartes jokers peuvent ensuite être jouées pour n'importe quelle ville ou industrie.",
      },
    },
  },
  industriesIntro:
    "Six métiers font tourner les Midlands. Chacun existe en quatre niveaux sur votre plateau joueur ; vous construisez toujours le niveau restant le plus bas, et développez pour atteindre les plus puissants. Apprenez à lire une tuile : les pastilles marquent le niveau, le jeton de laiton le revenu gagné au retournement, le jeton crème les points de victoire.",
  industries: {
    tuningTag: "Tuiles imprimées",
    tuningNote:
      "— chaque valeur ci-dessous est lue sur le tapis de joueur officiel : 45 tuiles par joueur, niveaux réservés au canal ou au rail, bière nécessaire à la vente, icônes lien et ampoules.",
    headers: {
      tile: "Tuile",
      lvl: "Niv",
      build: "Coût",
      coalIron: "Charbon / Fer",
      beerToFlip: "Bière pour retourner",
      income: "Revenu Δ",
      vp: "PV",
      notes: "Notes",
    },
    resource: {
      coal: "{n} charbon",
      iron: "{n} fer",
      none: "—",
    },
    beer: {
      count: "{n} bière(s)",
      onEmpty: "à vide",
    },
    coalMine: {
      name: "Mine de charbon",
      blurb:
        "Le noir fondement de tout. Les mines arrivent chargées de cubes de charbon qui nourrissent tout le réseau ; quand le filon est épuisé, la tuile se retourne d'elle-même.",
      notes: {
        n1: "Ère canal uniquement. 2 charbons ; 2 icônes lien ; se retourne une fois vidée.",
        n2: "3 charbons ; se retourne une fois vidée.",
        n3: "4 charbons ; coûte 1 fer à construire.",
        n4: "5 charbons ; coûte 1 fer à construire.",
      },
    },
    ironWorks: {
      name: "Forge",
      blurb:
        "Des forges qui stockent des barres de fer pour construire et développer. Comme les mines, elles se retournent quand leur stock est épuisé — une fonderie travaillée à froid est une fonderie payée.",
      notes: {
        n1: "Ère canal uniquement. 4 fers ; coûte 1 charbon.",
        n2: "4 fers ; coûte 1 charbon.",
        n3: "5 fers ; coûte 1 charbon.",
        n4: "6 fers ; coûte 1 charbon.",
      },
    },
    cottonMill: {
      name: "Filature de coton",
      blurb:
        "La grande machine à profits des Midlands. Les filatures ne se retournent qu'en vendant à un négociant lointain — et elles paient généreusement la peine.",
      notes: {
        n1: "Ère canal uniquement. 1 icône lien ; ×3 sur le tapis.",
        n2: "Coûte 1 charbon ; 2 icônes lien ; ×2.",
        n3: "Coûte 1 charbon + 1 fer ; ×3.",
        n4: "Coûte 1 charbon + 1 fer ; ×3 — la filature la plus riche.",
      },
    },
    manufacturer: {
      name: "Manufacture",
      blurb:
        "Des ateliers produisant des biens finis. Moins chers que les filatures et plus réguliers — la discrète colonne vertébrale de bien des registres gagnants.",
      notes: {
        n1: "Ère canal uniquement. Coûte 1 charbon ; 2 icônes lien.",
        n2: "Coûte 1 fer ; ×2.",
        n3: "Coûte 2 charbons ; aucune icône lien.",
        n4: "Coûte 1 fer ; peu chère et rapide.",
        n5: "Coûte 1 charbon ; se vend pour 2 bières ; 2 icônes lien ; ×2.",
        n6: "Aucune ressource nécessaire.",
        n7: "Coûte 1 charbon + 1 fer ; aucune icône lien.",
        n8: "Coûte 2 fers ; ×2 — le sommet du tapis.",
      },
    },
    pottery: {
      name: "Poterie",
      blurb:
        "Des fours à l'appétit modeste et à la valeur remarquable. La poterie marque au-dessus de son poids mais coûte cher à vendre dans la seconde ère.",
      notes: {
        n1: "Les deux ères. Coûte 1 fer. Ampoule : non développable.",
        n2: "Gratuite ; coûte 1 charbon. À développer.",
        n3: "Coûte 2 charbons ; se vend pour 2 bières. Ampoule : non développable.",
        n4: "Gratuite ; coûte 1 charbon.",
        n5: "Ère rail uniquement. Coûte 2 charbons ; se vend pour 2 bières ; 20 PV.",
      },
    },
    brewery: {
      name: "Brasserie",
      blurb:
        "La bière fait glisser les ventes. Les brasseries arrivent garnies de barils et se retournent une fois vidées — les vôtres, ou celles des autres, si elles sont connectées.",
      notes: {
        n1: "Ère canal uniquement. Coûte 1 fer ; 2 icônes lien ; ×2.",
        n2: "Coûte 1 fer ; ×2.",
        n3: "Coûte 1 fer ; ×2.",
        n4: "Ère rail uniquement. Coûte 1 fer.",
      },
    },
  },
  network: {
    intro:
      "Votre réseau est l'ensemble des villes tenant une de vos tuiles et des liaisons que vous avez posées — plus tout ce qu'il touche par les routes des autres joueurs. Construire au-delà de votre premier coup, livrer charbon et fer, et vendre aux négociants se tracent le long de ce réseau.",
    canalChip: "Liaison canal · 3 £ · ère canal",
    railChip: "Liaison rail · 5 £ + 1 charbon · ère rail",
    doubleRailChip: "Double rail · 15 £ + 2 charbons · une action",
    outro:
      "Les liaisons sont comptées, pas seulement utilisées : à la fin de chaque ère, chaque liaison compte les icônes lien imprimées sur les tuiles d'industrie des lieux qu'elle relie — peu importe à qui sont les tuiles — et deux par marchand. Un canal bien placé à travers la ville florissante d'un rival vaut autant pour vous que pour lui.",
  },
  supply: {
    intro: "Voici le cœur du jeu, et il n'est pas abstrait. Chaque cube de charbon ou de fer qu'une construction exige doit physiquement arriver : gratuitement depuis vos propres mines et forges connectées, depuis les ouvrages connectés d'un rival sans frais pour vous (sa tuile se vide — un cadeau qui retourne son industrie !), ou acheté au marché au prix courant. Si aucune source n'est accessible, la construction est impossible.",
    note: "Le fer emprunte les mêmes routes que le charbon ; la bière obéit à la même loi, tirée des brasseries ou de la cave du négociant lors des ventes.",
    aria:
      "Schéma de l'approvisionnement en charbon : une mine connectée livre du charbon gratuit le long de vos canaux, le marché vend au prix courant, et une connexion rompue refuse la construction.",
    groupAria: "Scénarios d'approvisionnement",
    modes: {
      mine: {
        label: "Mine connectée",
        hint: "Votre construction trace une chaîne de liaisons jusqu'à votre propre mine de charbon. Le charbon voyage gratuitement sur vos canaux — la mine perd un cube.",
      },
      market: {
        label: "Achat au marché",
        hint: "Pas de mine connectée ? Le charbon est alors acheté au plateau du marché : payez le prix courant (3 £ ici) et le cube le moins cher disparaît — l'acheteur suivant paiera donc plus cher.",
      },
      none: {
        label: "Aucune source",
        hint: "La mine se trouve au-delà d'une chaîne rompue : aucune liaison ne l'atteint, et un marché épuisé n'offre rien. La construction est refusée net — l'approvisionnement est une loi, pas une suggestion.",
      },
    },
    chips: {
      mine: "Charbon 0 £ — votre propre mine",
      market: "Acheter 1 charbon · 3 £",
      none: "Aucun charbon accessible",
    },
    yourMine: "votre mine de charbon",
    marketLabel: "le marché",
    buildSlot: "construction · 1 charbon",
  },
  marketTray: {
    title: "Le plateau du charbon",
    buy: "Acheter 3 £",
    caption: "← acheter vide d'abord les cases bon marché · vendre regarnit par le bout cher →",
  },
  market: {
    p1:
      "Quand l'offre vient à manquer, le marché répond — à un prix. Charbon et fer reposent chacun dans un plateau de cases cotées de 1 £ à 8 £. Acheter prend le cube le moins cher et le prix monte ; revendre des ressources (ou le réapprovisionnement de fin d'ère) regarnit par le bout cher et le prix redescend.",
    p2:
      "Un marché vide est un mur, pas un inconvénient : le charbon qu'on ne peut ni acheter ni atteindre est tout simplement hors de portée. Surveillez les plateaux comme un contremaître surveille le ciel.",
  },
  selling: {
    intro: "Filatures de coton, manufactures et poteries ne se retournent qu'en vendant à un port négociant au bord de la carte. Le port doit encore porter une marque de demande pour votre industrie, vous devez tracer une connexion jusqu'à lui, et chaque tuile boit de la bière avant de se vendre — un baril à l'ère canal, deux pour les grands ouvrages tardifs.",
    li1: "La bière vient d'abord de vos propres brasseries, puis de toute brasserie connectée, puis de la cave du négociant.",
    li2: "Retourner paie le bonus de revenu immédiatement et met en banque les PV de la tuile pour le décompte de l'ère.",
    li3: "Les marques prises sont perdues pour de bon — un négociant épuisé n'est plus qu'une vue sur la mer.",
    choice:
      "Le choix est le jeu en miniature : le revenu gonfle dès maintenant la bourse de chaque manche future, tandis que les PV attendent sagement le règlement final.",
    flip: {
      aria: "Tuile de démonstration : survolez ou donnez-lui le focus pour la retourner de sa face parchemin vers sa face braise vendue",
      tileName: "filature de coton II",
      vp: "points de victoire",
      sold: "vendue · retournée",
      caption: "Survolez ou donnez le focus — le retournement, c'est le jour de paie.",
    },
  },
  tile: {
    vpChip: "{vp}PV",
  },
  money: {
    intro: "À la fin de chaque manche, votre marqueur de revenu vous paie son échelon en livres. Retourner des industries fait grimper l'échelle ; il n'y a pas de plafond digne d'être respecté.",
    li1: "Un emprunt peut être pris dans l'un ou l'autre emplacement d'action : descendez trois échelons, prenez 30 £, jouez.",
    li2: "Les emprunts ne sont jamais remboursés. Les échelons ont simplement disparu.",
    li3: "Sous 0 £, l'échelle se fait créancière — vous payez la banque à la fin de chaque manche.",
    develop:
      "Développer, ce discret sixième sens des bons joueurs, échange un fer contre le retrait d'une tuile faible, découvrant les niveaux puissants en dessous sans dépenser de construction.",
    ladderAria:
      "Échelle de la piste de revenu : échelons de moins dix livres jusqu'à soixante, avec un pion de laiton posé sur l'échelon des trente livres",
    ladderCaption: "la piste de revenu",
  },
  scoring: {
    thSource: "Source",
    thCounts: "Compte",
    thWhen: "Quand",
    r1s: "Industries retournées",
    r1c: "PV imprimés sur la tuile",
    r1w: "Fin de chaque ère",
    r2s: "Liaisons",
    r2c: "icônes lien dans les deux lieux reliés",
    r2w: "Fin de chaque ère (canaux puis rails)",
    r3s: "Départages",
    r3c: "plus d'argent → ordre du tour plus tôt",
    r3w: "Règlement final uniquement",
    exampleTitle: "Un exemple chiffré",
    exampleBody:
      "Deux ouvrages retournés (2 et 5 PV) dans des villes que votre liaison relie, plus 3 PV de liaison pour la connexion elle-même : {expr} au compte de l'ère.",
    expr: "2 + 5 + 3 = 10",
  },
  scoringSketch: {
    aria:
      "Exemple chiffré : deux tuiles retournées valant 2 et 5 points de victoire dans des villes reliées par une liaison, qui marque elle-même 3 points de liaison",
    link: "liaison 3",
    vpTotal: "total PV",
  },
  glossary: {
    network: {
      term: "Réseau",
      def: "Tout ce que vos tuiles et liaisons touchent. Construire, livrer du charbon et vendre se tracent le long du réseau.",
    },
    connected: {
      term: "Connecté",
      def: "Accessible par une chaîne ininterrompue de vos liaisons ou de celles des rivaux et de villes occupées.",
    },
    flippedTile: {
      term: "Tuile retournée",
      def: "Un ouvrage qui a vendu ou s'est vidé — tourné sur sa face braise, rapportant du revenu et marquant des PV.",
    },
    merchantPort: {
      term: "Port négociant",
      def: "Une tuile portuaire au bord de la carte, avec des marques de demande ; le seul acheteur pour les filatures, manufactures et poteries.",
    },
    demandPip: {
      term: "Marque de demande",
      def: "Un espace marqué sur un négociant ; l'une est prise chaque fois que l'industrie correspondante y vend.",
    },
    beer: {
      term: "Bière / baril",
      def: "Le lubrifiant du commerce, dépensé pour vendre des marchandises. Tirée des brasseries ou de la cave du négociant.",
    },
    wildCard: {
      term: "Carte joker",
      def: "Une carte tenant lieu de n'importe quel lieu ou industrie, gagnée par la prospection.",
    },
    era: {
      term: "Ère",
      def: "Une moitié de la partie — canal, puis rail — close par un décompte complet des liaisons et des tuiles retournées.",
    },
    incomeTrack: {
      term: "Piste de revenu",
      def: "L'échelle qui enregistre vos gains à chaque manche. Les retournements la font monter ; les emprunts la font descendre de trois crans.",
    },
    overbuild: {
      term: "Surconstruction",
      def: "Remplacer une tuile par un niveau supérieur de la même industrie ; les mines et ouvrages épuisés des rivaux peuvent être surconstruits librement.",
    },
    linkVp: {
      term: "PV de liaison",
      def: "Au décompte, chaque liaison compte les icônes lien des tuiles d'industrie dans les lieux qu'elle relie, et deux par marchand.",
    },
    market: {
      term: "Le marché",
      def: "Les plateaux de charbon et de fer où les prix montent quand les stocks sont achetés et baissent quand ils sont revendus.",
    },
    distantSale: {
      term: "Vente lointaine",
      def: "Vendre à un négociant auquel vous pouvez tracer une connexion, quel que soit le nombre de liaisons entre vous.",
    },
    clockworkClub: {
      term: "The Clockwork Club",
      def: "Les joueurs mécaniques — les bots Apprentice, Foreman et Baron qui occupent une chaise vide.",
    },
  },
  approx: {
    intro:
      "Un registre honnête, tenu à la vue de tous : ce que cet aperçu joue fidèlement, et ce qu'il simplifie encore. L'écran de préparation renvoie ici partout où une pastille de fidélité apparaît.",
    botsRibbon: "Heuristique",
    botsTitle: "The Clockwork Club",
    botsBody1: "Les chaises vides sont occupées par des joueurs mécaniques. ",
    botsBody2: " construit à bas prix et vend tard ; ",
    botsBody3: " développe, connecte et vend selon un rythme réglé ; ",
    botsBody4:
      " emprunte hardiment et vous devance chez les négociants. Ils jouent à l'appétit et à l'habitude, non par recherche profonde — de dignes partenaires d'entraînement, pas encore des génies.",
  },
  approximations: {
    supplyCore: {
      area: "Cœur d'approvisionnement et de décompte",
      note: "Taille des pioches, 10/9/8 manches par ère, ordre du tour selon l'argent dépensé, piste de revenu à 100 cases, prix du marché, mines vendant au marché, sur-construction, ventes multiples, double rail et les deux décomptes suivent le livret.",
    },
    industryValues: {
      area: "Choix automatiques",
      note: "Là où les règles vous laissent choisir, le moteur tranche pour vous : la mine la plus proche en cas d'égalité, le baril du marchand avant votre propre bière, la première carte quand vous passez ou empruntez, les tuiles les moins chères pour couvrir une paie négative.",
    },
    map: {
      area: "La carte des Midlands",
      note: "Villes, emplacements et routes sont compressés pour le plateau navigateur ; la géographie est fidèle en esprit, pas en nombre.",
    },
    deck: {
      area: "Tuiles marchand",
      note: "Les neuf tuiles marchand sont distribuées au hasard comme imprimées ; les deux tuiles ajoutées à 3 et 4 joueurs suivent le manifeste publié le plus courant (céramique + manufacture, puis tous biens + coton).",
    },
    bots: {
      area: "The Clockwork Club (bots)",
      note: "Apprentice, Foreman et Baron sont des heuristiques aux appétits différents — pas des adversaires à recherche profonde.",
    },
    multiplayer: {
      area: "Multijoueur en ligne",
      note: "Cet aperçu est uniquement local : solo contre le Club, ou tour à tour autour d'une même table. Le jeu en réseau et asynchrone est sur la planche à dessin.",
    },
  },
  finis: "Finis · dressez la table et jouez",
};
export default fr;
