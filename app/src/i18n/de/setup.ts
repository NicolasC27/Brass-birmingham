import ensetup from "../en/setup";

const de: typeof ensetup = {
  backToTitle: "Titel",
  eyebrow: "Bereite den Tisch vor",
  title: "Neue Partie",
  seating: {
    ariaLabel: "Sitzordnung",
    heading: "Sitzordnung",
    note: "Zwei bis vier Industrielle. Wer eine Farbe wählt, nimmt sie dem, der sie hat — die Spielsteine werden getauscht, nicht verdoppelt.",
  },
  summary: {
    botName: "{name} ({difficulty})",
  },
  begin: "Die Kanalzeit beginnen",
  beginHint: "Setzen Sie mindestens zwei Spieler an den Tisch — Menschen oder Maschinen —, bevor die erste Karte gezogen wird.",
  houseRules: {
    ariaLabel: "Hausregeln",
    heading: "Hausregeln",
    map: {
      label: "Das Spielbrett",
      ariaLabel: "Das Spielbrett",
      midlands: "Midlands",
      veneto: "Venetien",
      midlandsHint: "Birmingham und das Black Country: die Kanäle von 1770, die Schienen von 1830.",
      venetoHint: "Von der Lagune zu den Dolomiten: die Brenta, die Piave und die Linie von Verona nach Venedig.",
    },
    eraLength: {
      label: "Spieldauer",
      hint: "Eine kurze Partie endet und wird nach der Kanalzeit gewertet.",
      ariaLabel: "Spieldauer",
      full: "Volle Partie",
      canalOnly: "Nur Kanalzeit",
    },
    marketTemper: {
      label: "Marktlaune",
      hint: "Nur der Anfangsbestand: Standard sind die aufgedruckten 13 Kohle / 8 Eisen, ruhig öffnet beide Märkte voll, unruhig öffnet sie fast leer. Die Märkte füllen sich nie von selbst — nur eine neue Kohlemine oder Eisenhütte füllt sie auf.",
      ariaLabel: "Marktlaune",
      calm: "Ruhig",
      standard: "Standard",
      volatile: "Unruhig",
      beta: "Beta",
    },
    assist: {
      label: "Anfängerhilfe",
      hint: "Für den ganzen Tisch: bespielbare Felder leuchten auf, Preise werden aufgeschlüsselt, Tipps im Laufe der Partie. Hier eingestellt gilt sie für einen Online-Tisch; zu Hause ist sie auch eine Einstellung des Spielplans.",
      on: "An",
      off: "Aus",
    },
    timer: {
      label: "Zugtimer",
      hint: "Wenn gesetzt, zeigt der Spielplan für jeden Zug eine kleine Messingplakette mit Countdown — ideal am gemeinsamen Tisch.",
      ariaLabel: "Zugtimer",
      off: "Ohne",
      min: "{n} Min",
    },
    fidelity: {
      label: "Regeltreue",
      faithful: "Grundregeln: regeltreu",
      seeApproximations: "Näherungen ansehen",
    },
  },
  seat: {
    empty: "Leerer Stuhl",
    seatAnother: "Einen weiteren Spieler an den Tisch setzen.",
    openAria: "Platz {n} öffnen",
    botPortraitAlt: "Porträt des mechanischen Rivalen",
    namePlaceholder: "Geben Sie diesem Industriellen einen Namen",
    nameAria: "Name von Platz {n}",
    typeHuman: "Mensch",
    typeBot: "Maschine",
    typeClosed: "Geschlossen",
    headBadge: "Mensch · Sie",
    typeAria: "Typ von Platz {n}",
    colorAria: "Farbe von Platz {n}",
    colorStealTip: "{color} — wird dem abgenommen, der sie hat.",
    beta: "Beta",
    engineTip: "Die Maschinen spielen ihren ganzen Zug durch, bevor sie wählen. Es gelten Näherungen — siehe den Regelkodex.",
  },
  token: {
    ariaLabel: "Spielstein {color}",
  },
  colors: {
    brass: "Messing",
    oxblood: "Ochsenblut",
    verdigris: "Grünspan",
    steel: "Stahlblau",
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
    short: "Spielt auf Ihrem Niveau",
    expert:
      "Der Experte — spielt mit voller Kraft und lässt nie nach, wer auch immer gegenübersitzt.",
    expertShort: "Spielt mit voller Kraft",
    adaptive:
      "Spielt auf Ihrem Niveau — schärfer, wenn Sie gewinnen, sanfter, wenn Sie verlieren, nie so, dass eine Partie davonläuft.",
  },
  defaults: {
    playerOne: "Spieler eins",
    playerTwo: "Spieler zwei",
    player: "Spieler",
    nameless: "Namenlos",
    engine: "Maschine {n}",
  },
};
export default de;
