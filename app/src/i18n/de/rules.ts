import enrules from "../en/rules";

const de: typeof enrules = {
  status: {
    faithful: "Regeltreu",
    approximate: "Angenähert",
    planned: "Geplant",
  },
  chapters: {
    quickstart: "Das Wesentliche",
    eras: "Die zwei Zeitalter",
    actions: "Die sechs Aktionen",
    industries: "Die Industrien",
    network: "Das Netzwerk",
    supply: "Kohle und Eisen, geliefert",
    market: "Der lebendige Markt",
    selling: "Verkauf und Händler",
    money: "Geld und Kredite",
    scoring: "Wertung und Sieg",
    glossary: "Das Glossar",
    approximations: "Aktuelle Näherungen",
  },
  hero: {
    eyebrow: "Das Kompendium der Midlands",
    title: "Von Handel und Manufaktur",
    lede:
      "Getreuer Bericht über die Regeln von Blackrail — Kanäle, Kohle, Eisen und die zwei großen Zeitalter der Industrie.",
    wholeOfIt: "Das Ganze",
  },
  rail: {
    chapters: "Kapitel",
    jumpAria: "Zum Kapitel springen",
    navAria: "Kapitel des Kodex",
    index: "Kapitelverzeichnis",
    footnote:
      "Kapitel XII ist das ehrliche Register dessen, was dieser Prototyp vereinfacht — verlinkt überall dort, wo eine Treue-Marke erscheint.",
  },
  quickstart: {
    note: "Jede Aktion beginnt mit einer Karte. Alles Weitere folgt daraus, wohin sie dich reichen lässt.",
  },
  quick: {
    goal: {
      title: "Das Ziel",
      body: "Sammle nach zwei großen Zeitaltern die meisten Siegpunkte. Die Punkte kommen von umgedrehten Industrien und von jeder Verbindung deines Netzwerks.",
    },
    turn: {
      title: "Dein Zug",
      body: "Führe zwei Aktionen aus, jede mit einer Karte aus deiner Hand bezahlt — Bauen, Netzwerk, Verkaufen, Kredit, Entwickeln oder Erkunden. Die erste Runde der Partie erlaubt nur eine.",
    },
    build: {
      title: "Baue Industrien",
      body: "Spiele eine Orts- oder Industriekarte, um ein Plättchen von deinem Tableau auf ein passendes Feld zu legen. Bezahle seine Kosten in Geld, Kohle und Eisen.",
    },
    connect: {
      title: "Verbinde das Netzwerk",
      body: "Lege Kanäle, dann Bahnstrecken zwischen den Städten. Alles, was du baust, versorgst und verkaufst, muss über dein Netzwerk laufen.",
    },
    sell: {
      title: "Verkaufe, leihe, entwickle",
      body: "Verkaufe deine Waren an ferne Händler, um Plättchen umzudrehen und Einkommen zu gewinnen, nimm Kredite, wenn das Geld knapp wird, und entwickle, um schwache Werke loszuwerden.",
    },
    supply: {
      title: "Versorgung und Wertung",
      body: "Kohle und Eisen müssen dich physisch erreichen — per Kanal, per Bahn oder teuer auf dem Markt gekauft. Jedes Zeitalter endet mit einer vollständigen Wertung.",
    },
  },
  eras: {
    canalAlt: "Gravierter Fries der Kanalzeit",
    railAlt: "Gravierter Fries der Eisenbahnzeit",
    canalTitle: "Die Kanalzeit, 1770–1830",
    canalBody:
      "Die Züge folgen Runde für Runde: eine Karte für jede deiner zwei Aktionen (nur eine Aktion in der ersten Runde), dann ziehst du auf eine volle Hand nach. Kanäle kosten 3 £ pro Verbindung und sind die einzigen Wege des Zeitalters. Wenn der Nachziehstapel und alle Hände aufgebraucht sind, wird das Zeitalter gewertet — umgedrehte Industrien bringen ihre SP, und jede Verbindung zählt die Verbindungssymbole der Industrieplättchen an den Orten, die sie verbindet, und zwei pro Händler.",
    railTitle: "Die Eisenbahnzeit, 1830–1870",
    railBody:
      "Ein neuer Nachziehstapel, frische Hände, und Bahnstrecken für 5 £ plus eine Kohle pro Verbindung — zwei Verbindungen lassen sich in einer Aktion für 15 £, zwei Kohle und ein Bier legen. Kein neuer Kanal darf mehr gegraben werden, und Brauereien kommen jetzt mit zwei Fässern statt einem. Wenn auch dieser Stapel aufgebraucht ist, wird der Spielplan ein zweites Mal gewertet, und das reichste Register gewinnt.",
    betweenTitle: "Zwischen den Zeitaltern",
    betweenBody:
      "Werke der Stufe 1 werden vom Spielplan gefegt, wenn das Wasser zurückweicht — plane, sie vor dem Ende der Kanalzeit umzudrehen, oder sieh zu, wie sie ungezählt verschwinden. Alle Verbindungsplättchen werden nach der Wertung ebenfalls entfernt: Die Eisenbahnzeit beginnt allein von deinen Industrien aus.",
  },
  actionsIntro:
    "Jede Aktion kostet eine Karte aus deiner Hand — zwei Aktionen, zwei Karten. Klapp eine der sechs Zeilen unten auf, um ihre Kosten, ihre Schritte und die Grenzfälle zu sehen, die enge Partien entscheiden.",
  actionsUi: {
    edgeCases: "Grenzfälle",
    diagram: {
      town: "Stadt",
      yourTown: "deine Stadt",
      newTown: "neue Stadt",
      minusIron: "−1 Eisen",
      perTile: "pro Plättchen",
      mill: "Spinnerei",
      beer: "Bier",
      merchant: "Händler",
      loanLabel: "−3 Stufen · +30 £",
    },
  },
  actions: {
    build: {
      name: "Bauen",
      cost: "£-Kosten des Plättchens + angegebene Kohle und Eisen",
      steps: {
        s1: "Spiele eine Ortskarte (baue in dieser Stadt) oder eine Industriekarte (baue diese Industrie irgendwo in deinem Netzwerk).",
        s2: "Nimm das passende Plättchen der niedrigsten Stufe von deinem Tableau und lege es auf ein freies Feld.",
        s3: "Bezahle die Geldkosten, dann liefere die benötigte Kohle und das Eisen (siehe Kapitel VI).",
      },
      edges: {
        e1: "Eine Ortskarte baut in ihrer Stadt, ob diese in deinem Netzwerk liegt oder nicht; eine Industriekarte verlangt eine Stadt deines Netzwerks. Solange du nichts auf dem Spielplan hast, ist dein Netzwerk die ganze Karte.",
        e2: "Eine Jokerkarte kann für jeden Ort oder jede Industrie stehen.",
        e3: "Ein Plättchen pro Feld. Dein eigenes Plättchen darf von einer höheren Stufe derselben Industrie überbaut werden; die Kohlemine oder Eisenhütte eines Rivalen nur, wenn nirgends mehr ein Würfel dieser Ressource übrig ist — den Markt eingeschlossen. In der Kanalzeit nur ein Plättchen pro Stadt und Spieler.",
      },
    },
    network: {
      name: "Netzwerk",
      cost: "Kanal 3 £ · Bahnstrecke 5 £ + 1 Kohle · Doppelte Bahnstrecke 15 £ + 2 Kohle + 1 Bier",
      steps: {
        s1: "Spiele eine beliebige Karte und lege eine Kanalverbindung (Kanalzeit) oder eine Bahnverbindung (Eisenbahnzeit) auf eine freie Strecke zwischen zwei Städten.",
        s2: "Die Verbindung muss dein bestehendes Netzwerk berühren — eine Stadt mit einem deiner Plättchen oder das Ende einer deiner Verbindungen.",
        s3: "Bezahle die Kosten; Bahnverbindungen verbrauchen zusätzlich eine Kohle, geliefert wie in Kapitel VI.",
      },
      edges: {
        e1: "In der Eisenbahnzeit kannst du zwei Bahnverbindungen in einer einzigen Aktion für 15 £, 2 Kohle und ein Bier legen — aus einer Brauerei, nie aus einem Händlerfass.",
        e2: "Sobald die Eisenbahnzeit begonnen hat, darf kein neuer Kanal mehr gebaut werden; bestehende Kanäle bleiben.",
        e3: "Händlerhäfen zählen für Verbindungen als Städte.",
      },
    },
    develop: {
      name: "Entwickeln",
      cost: "1 Eisen pro entferntem Plättchen (max. 2)",
      steps: {
        s1: "Spiele eine beliebige Karte und entferne ein oder zwei Plättchen von der Spitze der Industriestapel auf deinem Tableau.",
        s2: "Bezahle ein Eisen für jedes entfernte Plättchen, wie üblich an das Tableau geliefert.",
        s3: "Entfernte Plättchen kommen zurück in die Schachtel und legen die stärkeren Stufen darunter frei.",
      },
      edges: {
        e1: "Entwickeln ist der kürzeste Weg zu deinen starken Werken; Bauen verbraucht den Stapel ebenfalls, und der Bonus des Händlers von Gloucester entfernt ein Plättchen gratis.",
        e2: "Du kannst in einer einzigen Entwickeln-Aktion Plättchen von zwei verschiedenen Industrien entfernen.",
      },
    },
    sell: {
      name: "Verkaufen",
      cost: "Bier: wie auf dem Plättchen gedruckt (1, oder 2 für die großen Werke)",
      steps: {
        s1: "Spiele eine beliebige Karte und wähle eine oder mehrere deiner Baumwollspinnereien, Manufakturen oder Töpfereien.",
        s2: "Jede muss eine Verbindung zu einem Händlerplättchen haben, das ihre Ware zeigt — Baumwolle, Manufakturwaren, Töpferware oder beliebige Ware.",
        s3: "Gib das nötige Bier aus — das Fass des Händlers, deine Brauereien oder eine verbundene Brauerei — und drehe dann jedes verkaufte Plättchen um.",
      },
      edges: {
        e1: "Umgedrehte Plättchen bringen ihren Einkommensbonus sofort und zählen am Ende des Zeitalters SP.",
        e2: "Der Appetit eines Händlers ist nie gestillt: Sein Plättchen kauft wieder und wieder. Nur sein Bonusfass wird einmal pro Zeitalter getrunken.",
        e3: "Wie viel Bier ein Plättchen trinkt, steht darauf: zwei Fässer für die Manufaktur der Stufe 5 und die Töpfereien der Stufen 3 und 5, in beiden Zeitaltern.",
      },
    },
    loan: {
      name: "Kredit",
      cost: "Einkommen −3 Stufen · nimm 30 £",
      steps: {
        s1: "Spiele eine beliebige Karte, setze deinen Einkommensmarker drei Stufen auf der Leiste zurück und nimm 30 £ aus der Bank.",
      },
      edges: {
        e1: "Ein Kredit kann in jedem der beiden Aktionsfelder deines Zuges genommen werden — auch als zweite Aktion.",
        e2: "Kredite werden nie zurückgezahlt; der Einkommensverlust ist endgültig.",
        e3: "Fällt dein Einkommen unter 0 £, zahlst du am Ende jeder Runde an die Bank. Ein Kredit, der dich unter Stufe −10 bringen würde, wird verweigert.",
      },
    },
    scout: {
      name: "Erkunden",
      cost: "Wirf 3 Karten ab · zieh 2 Joker",
      steps: {
        s1: "Wirf drei Karten aus deiner Hand ab.",
        s2: "Nimm die zwei Jokerkarten auf die Hand — einen Orts-Joker, einen Industrie-Joker.",
      },
      edges: {
        e1: "Erkunden ist eine Aktion wie jede andere — aber unmöglich, solange ein Joker in deiner Hand liegt oder sobald ein Jokerstapel leer ist.",
        e2: "Jokerkarten können danach für jede Stadt oder jede Industrie gespielt werden.",
      },
    },
  },
  industriesIntro:
    "Sechs Gewerbe halten die Midlands in Gang. Jedes klettert seine eigene Spalte auf deinem Tableau hinauf — vier Stufen für die meisten, fünf für die Töpferei, acht für die Manufaktur; du baust immer die niedrigste verbliebene Stufe und entwickelst, um die stärkeren zu erreichen. Lerne, ein Plättchen zu lesen: Die Punkte markieren die Stufe, die Messingmarke das Einkommen beim Umdrehen, die cremefarbene Marke die Siegpunkte.",
  industries: {
    tuningTag: "Gedruckte Plättchen",
    tuningNote:
      "— jeder Wert unten ist vom offiziellen Spielertableau abgelesen: 45 Plättchen pro Spieler, Stufen nur für Kanal oder nur für Bahn, zum Verkauf nötiges Bier, Verbindungssymbole und Glühbirnen.",
    headers: {
      tile: "Plättchen",
      lvl: "Stufe",
      build: "Kosten",
      coalIron: "Kohle / Eisen",
      beerToFlip: "Bier zum Umdrehen",
      income: "Einkommen Δ",
      vp: "SP",
      notes: "Hinweise",
    },
    resource: {
      coal: "{n} Kohle",
      iron: "{n} Eisen",
      none: "—",
    },
    beer: {
      count: "{n} Bier",
      onEmpty: "wenn leer",
    },
    coalMine: {
      name: "Kohlemine",
      blurb:
        "Das schwarze Fundament von allem. Minen kommen beladen mit Kohlewürfeln, die das ganze Netzwerk nähren; ist das Flöz erschöpft, dreht sich das Plättchen von selbst um.",
      notes: {
        n1: "Nur Kanalzeit. 2 Kohle; 2 Verbindungssymbole; dreht sich um, wenn leer.",
        n2: "3 Kohle; dreht sich um, wenn leer.",
        n3: "4 Kohle; kostet 1 Eisen zum Bauen.",
        n4: "5 Kohle; kostet 1 Eisen zum Bauen.",
      },
    },
    ironWorks: {
      name: "Eisenhütte",
      blurb:
        "Hütten, die Eisenbarren zum Bauen und Entwickeln lagern. Wie Minen drehen sie sich um, wenn ihr Vorrat erschöpft ist — eine leergearbeitete Hütte ist eine bezahlte Hütte.",
      notes: {
        n1: "Nur Kanalzeit. 4 Eisen; kostet 1 Kohle.",
        n2: "4 Eisen; kostet 1 Kohle.",
        n3: "5 Eisen; kostet 1 Kohle.",
        n4: "6 Eisen; kostet 1 Kohle.",
      },
    },
    cottonMill: {
      name: "Baumwollspinnerei",
      blurb:
        "Die große Gewinnmaschine der Midlands. Spinnereien drehen sich nur durch Verkauf an einen fernen Händler um — und sie belohnen die Mühe großzügig.",
      notes: {
        n1: "Nur Kanalzeit. 1 Verbindungssymbol; ×3 auf dem Tableau.",
        n2: "Kostet 1 Kohle; 2 Verbindungssymbole; ×2.",
        n3: "Kostet 1 Kohle + 1 Eisen; ×3.",
        n4: "Kostet 1 Kohle + 1 Eisen; ×3 — die reichste Spinnerei.",
      },
    },
    manufacturer: {
      name: "Manufaktur",
      blurb:
        "Werkstätten, die Fertigwaren herstellen. Billiger als Spinnereien und beständiger — das stille Rückgrat vieler siegreicher Register.",
      notes: {
        n1: "Nur Kanalzeit. Kostet 1 Kohle; 2 Verbindungssymbole.",
        n2: "Kostet 1 Eisen; ×2.",
        n3: "Kostet 2 Kohle; kein Verbindungssymbol.",
        n4: "Kostet 1 Eisen; billig und schnell.",
        n5: "Kostet 1 Kohle; verkauft sich für 2 Bier; 2 Verbindungssymbole; ×2.",
        n6: "Keine Ressourcen nötig.",
        n7: "Kostet 1 Kohle + 1 Eisen; kein Verbindungssymbol.",
        n8: "Kostet 2 Eisen; ×2 — die Spitze des Tableaus.",
      },
    },
    pottery: {
      name: "Töpferei",
      blurb:
        "Öfen mit bescheidenem Appetit und bemerkenswertem Wert. Die Töpferei punktet über ihrer Gewichtsklasse, ist im zweiten Zeitalter aber teuer zu verkaufen.",
      notes: {
        n1: "Beide Zeitalter. Kostet 1 Eisen. Glühbirne: nicht entwickelbar.",
        n2: "Gratis; kostet 1 Kohle. Zum Wegentwickeln.",
        n3: "Kostet 2 Kohle; verkauft sich für 2 Bier. Glühbirne: nicht entwickelbar.",
        n4: "Gratis; kostet 1 Kohle.",
        n5: "Nur Eisenbahnzeit. Kostet 2 Kohle; verkauft sich für 2 Bier; 20 SP.",
      },
    },
    brewery: {
      name: "Brauerei",
      blurb:
        "Bier lässt die Verkäufe laufen. Brauereien kommen mit einem Fass in der Kanalzeit und zwei in der Eisenbahnzeit und drehen sich um, wenn sie leer sind — deine von überall, die der anderen nur, wenn verbunden.",
      notes: {
        n1: "Nur Kanalzeit. Kostet 1 Eisen; 2 Verbindungssymbole; ×2.",
        n2: "Kostet 1 Eisen; ×2.",
        n3: "Kostet 1 Eisen; ×2.",
        n4: "Nur Eisenbahnzeit. Kostet 1 Eisen.",
      },
    },
  },
  network: {
    intro:
      "Dein Netzwerk ist die Gesamtheit der Städte mit einem deiner Plättchen und der Verbindungen, die du gelegt hast — plus alles, was es über die Strecken der anderen Spieler berührt. Bauen jenseits deines ersten Zuges, Kohle und Eisen liefern und an Händler verkaufen läuft entlang dieses Netzwerks.",
    canalChip: "Kanalverbindung · 3 £ · Kanalzeit",
    railChip: "Bahnverbindung · 5 £ + 1 Kohle · Eisenbahnzeit",
    doubleRailChip: "Doppelte Bahnstrecke · 15 £ + 2 Kohle + 1 Bier · eine Aktion",
    outro:
      "Verbindungen werden gewertet, nicht nur genutzt: Am Ende jedes Zeitalters zählt jede Verbindung die Verbindungssymbole, die auf den Industrieplättchen der von ihr verbundenen Orte gedruckt sind — egal, wem die Plättchen gehören — und zwei pro Händler. Ein gut gelegter Kanal durch die blühende Stadt eines Rivalen ist dir so viel wert wie ihm.",
  },
  supply: {
    intro: "Das ist das Herz des Spiels, und es ist nicht abstrakt. Jeder Kohlewürfel, den ein Bau verlangt, muss physisch ankommen: aus einer verbundenen Mine — deiner oder der eines Rivalen, kostenlos für dich (sein Plättchen leert sich — ein Geschenk, das seine Industrie umdreht!) — oder auf dem Markt gekauft, was selbst eine Verbindung zu einem Händler verlangt. Ist keine Quelle erreichbar, ist der Bau unmöglich.",
    note: "Eisen braucht keinen Weg: Jede Eisenhütte auf dem Spielplan dient dir, dann der Eisenmarkt, mit oder ohne Verbindung. Bier kommt aus deinen eigenen Brauereien, wo immer sie stehen, aus denen eines Rivalen nur, wenn verbunden, oder aus dem Fass des Händlers, wenn du an ihn verkaufst.",
    aria:
      "Schema der Kohleversorgung: Eine verbundene Mine liefert kostenlose Kohle entlang deiner Kanäle, der Markt verkauft zum aktuellen Preis, und eine unterbrochene Verbindung verweigert den Bau.",
    groupAria: "Versorgungsszenarien",
    modes: {
      mine: {
        label: "Verbundene Mine",
        hint: "Dein Bau zieht eine Kette von Verbindungen bis zu deiner eigenen Kohlemine. Die Kohle reist kostenlos über deine Kanäle — die Mine verliert einen Würfel.",
      },
      market: {
        label: "Kauf auf dem Markt",
        hint: "Keine verbundene Mine? Dann wird die Kohle auf dem Markttableau gekauft: Zahl den aktuellen Preis (hier 3 £), und der billigste Würfel verschwindet — der nächste Käufer zahlt also mehr.",
      },
      none: {
        label: "Keine Quelle",
        hint: "Die Mine liegt jenseits einer unterbrochenen Kette: Keine Verbindung erreicht sie, und ein leerer Markt bietet nichts. Der Bau wird glatt verweigert — Versorgung ist Gesetz, kein Vorschlag.",
      },
    },
    chips: {
      mine: "Kohle 0 £ — deine eigene Mine",
      market: "1 Kohle kaufen · 3 £",
      none: "Keine Kohle erreichbar",
    },
    yourMine: "deine Kohlemine",
    marketLabel: "der Markt",
    buildSlot: "Bau · 1 Kohle",
  },
  marketTray: {
    title: "Das Kohletableau",
    buy: "Kaufen 3 £",
    caption: "← Kaufen leert zuerst die billigen Felder · Verkaufen füllt vom teuren Ende auf →",
  },
  market: {
    p1:
      "Wenn das Angebot knapp wird, antwortet der Markt — zu einem Preis. Kohle liegt in vierzehn Feldern zu 1 £ bis 7 £, Eisen in zehn Feldern zu 1 £ bis 5 £; ein leeres Tableau verkauft noch, zu 8 £ und 6 £. Kaufen nimmt den billigsten Würfel, und der Preis steigt. Nichts füllt die Tableaus von allein: Eine frisch gebaute, mit einem Händler verbundene Mine oder Hütte verkauft ihre überzähligen Würfel an den Markt, der sich vom teuren Ende her auffüllt, und der Preis sinkt wieder.",
    p2:
      "Ein leerer Markt ist eine Mauer, keine Unannehmlichkeit: Kohle, die man weder kaufen noch erreichen kann, ist schlicht außer Reichweite. Behalte die Tableaus im Auge wie ein Vorarbeiter den Himmel.",
  },
  selling: {
    intro: "Baumwollspinnereien, Manufakturen und Töpfereien drehen sich nur durch Verkauf an einen Händlerhafen am Kartenrand um. Der Hafen muss deine Ware zeigen (oder beliebige Ware), du musst eine Verbindung zu ihm haben, und jedes Plättchen trinkt das darauf gedruckte Bier, bevor es sich verkauft — ein Fass für die meisten, zwei für die großen Werke.",
    li1: "Bier kommt zuerst aus dem Fass des Händlers, wenn du an ihn verkaufst — das löst seinen Bonus aus —, dann aus deinen Brauereien, dann aus jeder verbundenen Brauerei.",
    li2: "Umdrehen zahlt den Einkommensbonus sofort aus und legt die SP des Plättchens für die Wertung des Zeitalters zurück.",
    li3: "Jedes Händlerplättchen hält ein Fass pro Zeitalter; trink es, und sein Bonus fällt an, und das Fass wird zu Beginn der Eisenbahnzeit neu aufgestellt.",
    choice:
      "Die Wahl ist das Spiel im Kleinen: Einkommen füllt ab sofort die Börse jeder künftigen Runde, während die SP brav auf die Endabrechnung warten.",
    flip: {
      aria: "Demonstrationsplättchen: Fahre darüber oder gib ihm den Fokus, um es von seiner Pergamentseite auf seine verkaufte Glutseite zu drehen",
      tileName: "Baumwollspinnerei I",
      vp: "Siegpunkte",
      sold: "verkauft · umgedreht",
      caption: "Darüberfahren oder Fokus geben — das Umdrehen ist der Zahltag.",
    },
  },
  tile: {
    vpChip: "{vp}SP",
  },
  money: {
    intro: "Am Ende jeder Runde zahlt dir dein Einkommensmarker seine Stufe in Pfund. Industrien umdrehen lässt dich die Leiter hinaufsteigen, die bei Stufe 30 endet.",
    li1: "Ein Kredit kann in jedem der beiden Aktionsfelder genommen werden: drei Stufen zurück, 30 £ nehmen, weiterspielen.",
    li2: "Kredite werden nie zurückgezahlt. Die Stufen sind einfach weg.",
    li3: "Unter 0 £ wird die Leiter zum Gläubiger — du zahlst am Ende jeder Runde an die Bank.",
    develop:
      "Entwickeln, dieser stille sechste Sinn guter Spieler, tauscht ein Eisen gegen das Entfernen eines schwachen Plättchens und legt die starken Stufen darunter frei, ohne einen Bau auszugeben.",
    ladderAria:
      "Leiter der Einkommensleiste: Stufen von minus zehn Pfund bis dreißig, der Obergrenze, mit einer Messingfigur auf der Sprosse der zehn Pfund",
    ladderCaption: "die Einkommensleiste",
  },
  scoring: {
    thSource: "Quelle",
    thCounts: "Zählt",
    thWhen: "Wann",
    r1s: "Umgedrehte Industrien",
    r1c: "auf dem Plättchen gedruckte SP",
    r1w: "Ende jedes Zeitalters",
    r2s: "Verbindungen",
    r2c: "Verbindungssymbole an beiden verbundenen Orten",
    r2w: "Ende jedes Zeitalters (Kanäle, dann Bahnstrecken)",
    r3s: "Gleichstand",
    r3c: "höchste Einkommensstufe → meistes Geld",
    r3w: "Nur bei der Endabrechnung",
    exampleTitle: "Ein Rechenbeispiel",
    exampleBody:
      "Zwei umgedrehte Werke (2 und 5 SP) in Städten, die deine Verbindung verbindet, plus 3 Verbindungs-SP für die Verbindung selbst: {expr} für die Wertung des Zeitalters.",
    expr: "2 + 5 + 3 = 10",
  },
  scoringSketch: {
    aria:
      "Rechenbeispiel: zwei umgedrehte Plättchen im Wert von 2 und 5 Siegpunkten in Städten, die eine Verbindung verbindet, die selbst 3 Verbindungspunkte zählt",
    link: "Verbindung 3",
    vpTotal: "SP gesamt",
  },
  glossary: {
    network: {
      term: "Netzwerk",
      def: "Alles, was deine Plättchen und Verbindungen berühren. Bauen, Kohle liefern und Verkaufen laufen entlang des Netzwerks.",
    },
    connected: {
      term: "Verbunden",
      def: "Erreichbar über eine ununterbrochene Kette deiner eigenen oder rivalischer Verbindungen und besetzter Städte.",
    },
    flippedTile: {
      term: "Umgedrehtes Plättchen",
      def: "Ein Werk, das verkauft hat oder leer ist — auf seine Glutseite gedreht, bringt Einkommen und zählt SP.",
    },
    merchantPort: {
      term: "Händlerhafen",
      def: "Ein Hafenplättchen am Kartenrand, das die Ware zeigt, die es kauft; der einzige Abnehmer für Spinnereien, Manufakturen und Töpfereien.",
    },
    demandPip: {
      term: "Händlerware",
      def: "Das Symbol auf einem Händlerplättchen — Baumwolle, Manufakturwaren, Töpferware oder beliebige Ware. Es ist nie ausverkauft.",
    },
    beer: {
      term: "Bier / Fass",
      def: "Das Schmiermittel des Handels, ausgegeben, um Waren zu verkaufen. Stammt aus Brauereien oder dem Keller des Händlers.",
    },
    wildCard: {
      term: "Jokerkarte",
      def: "Eine Karte, die für jeden Ort oder jede Industrie steht, gewonnen durch Erkunden.",
    },
    era: {
      term: "Zeitalter",
      def: "Eine Hälfte der Partie — Kanal, dann Eisenbahn — abgeschlossen durch eine vollständige Wertung der Verbindungen und umgedrehten Plättchen.",
    },
    incomeTrack: {
      term: "Einkommensleiste",
      def: "Die Leiter, die deine Einnahmen jeder Runde festhält. Umdrehen lässt sie steigen; Kredite senken sie um drei Stufen.",
    },
    overbuild: {
      term: "Überbauen",
      def: "Ein Plättchen durch eine höhere Stufe derselben Industrie ersetzen — dein eigenes frei, die Kohlemine oder Eisenhütte eines Rivalen nur, wenn nirgends mehr ein Würfel dieser Ressource übrig ist, den Markt eingeschlossen.",
    },
    linkVp: {
      term: "Verbindungs-SP",
      def: "Bei der Wertung zählt jede Verbindung die Verbindungssymbole der Industrieplättchen an den beiden Orten, die sie verbindet (zwei pro Händler), egal, wem sie gehören.",
    },
    market: {
      term: "Der Markt",
      def: "Die Kohle- und Eisentableaus, auf denen die Preise steigen, wenn Vorräte gekauft, und fallen, wenn sie zurückverkauft werden.",
    },
    distantSale: {
      term: "Fernverkauf",
      def: "An einen Händler verkaufen, zu dem du eine Verbindung hast, egal wie viele Verbindungen dazwischenliegen.",
    },
    clockworkClub: {
      term: "The Clockwork Club",
      def: "Die mechanischen Spieler — die Bots Vorarbeiter, Industrieller und Magnat, die einen leeren Stuhl besetzen.",
    },
  },
  approx: {
    intro:
      "Ein ehrliches Register, für alle sichtbar geführt: was diese Vorschau regeltreu spielt und was sie noch vereinfacht. Der Einrichtungsbildschirm verweist überall hierher, wo eine Treue-Marke erscheint.",
    botsRibbon: "Beta",
    botsTitle: "The Clockwork Club",
    botsBody1: "Leere Stühle werden von mechanischen Spielern besetzt: ",
    botsBody2: ", ",
    botsBody3: ", ",
    botsBody4: " und ",
    botsBody5: ". Keiner ist an ein Handwerk gebunden — jeder spielt, was der Tisch verlangt, denkt seinen ganzen Zug durch, bevor er wählt, und blickt bei voller Stärke ein oder zwei Runden voraus. Ihre Stärke folgt deiner: der Cote online, deinen Ergebnissen zu Hause.",
  },
  approximations: {
    supplyCore: {
      area: "Kern von Versorgung und Wertung",
      note: "Größe der Nachziehstapel, 10/9/8 Runden pro Zeitalter, Zugreihenfolge nach ausgegebenem Geld, Einkommensleiste mit 100 Feldern, Marktpreise, Minen, die an den Markt verkaufen, Überbauen, Mehrfachverkäufe, doppelte Bahnstrecke und beide Wertungen folgen dem Regelheft.",
    },
    industryValues: {
      area: "Automatische Entscheidungen",
      note: "Wo die Regeln dir die Wahl lassen, entscheidet die Engine für dich: die nächste Mine, dann die vollere, wenn zwei dienen könnten; das Fass des Händlers vor deinem eigenen Bier; die erste Karte, wenn du passt oder leihst; die billigsten Plättchen, um eine negative Auszahlung zu decken.",
    },
    map: {
      area: "Die Karte der Midlands",
      note: "Der Spielplan trägt die gedruckte Geografie: zwanzig Städte, zwei Bauernbrauereien, fünf Händler und neununddreißig Strecken, Feld für Feld.",
    },
    deck: {
      area: "Händlerplättchen",
      note: "Die neun Händlerplättchen werden zufällig wie gedruckt verteilt; die zwei bei 3 und 4 Spielern hinzukommenden Plättchen folgen dem gängigsten veröffentlichten Manifest (Töpferware + Manufakturware, dann beliebige Ware + Baumwolle).",
    },
    bots: {
      area: "The Clockwork Club (Bots)",
      note: "Vorarbeiter, Industrieller und Magnat sind Heuristiken mit unterschiedlichem Appetit — keine Gegner mit tiefer Suche.",
    },
    multiplayer: {
      area: "Online-Mehrspieler",
      note: "Tische leben in Wartezimmern: Eröffne eines, reich seinen Code aus vier Zeichen herum und spiel über die Leitung, wenn ein Server antwortet — oder sonst zwischen zwei Tabs desselben Browsers.",
    },
  },
  finis: "Finis · deck den Tisch und spiel",
};
export default de;
