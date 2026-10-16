import type { Tongue } from './notions';

/* ------------------------------------------------------------------ */
/* The guide's case, in German. The same plates as the French, the      */
/* same figures, read off brass/game-data.md and the engine.            */
/* ------------------------------------------------------------------ */

export const DE: Tongue = {
  near: 'Diese Frage finde ich so nicht in den Regeln. Meintest du:',
  self: 'ich mir mich mein meine meinen meiner habe kann'.split(' '),
  define: 'was wozu erklar erklare erklaren bedeutet bedeutung woher sinn funktioniert'.split(' '),
  alias: {
    wiso: 'wieso', warum: 'warum', wiviel: 'wie viel', wieviele: 'wie viele', wieviel: 'wie viel', gehts: 'geht es', kanns: 'kann es', nich: 'nicht', ned: 'nicht',
    net: 'nicht', bitte: '', danke: '', sp: 'sp', vp: 'sp', lvl: 'stufe',
  },
  stop: (
    'der die das den dem des ein eine einen einem einer eines und oder ist sind war waren sein bin bist es sie er ich du wir ihr mein meine meinen dein deine sein seine ' +
    'was wer wen wem wie wo wohin woher wann warum wieso weshalb welche welcher welches welchen kann kannst konnen darf darfst muss musst soll sollte ' +
    'mit ohne fur von zu zum zur im in am an auf aus bei nach vor uber unter um nicht kein keine keinen ja nein wenn dann auch noch schon sehr mehr weniger ' +
    'alle alles man sich mir mich dir dich uns euch denn doch mal jetzt hier dort etwas gibt geben heisst bedeutet bedeutung genau eigentlich ' +
    'erklare erklaren sag sagen weiss wissen funktioniert funktionieren tun tut mache machen macht habe hast hat haben werde wird werden ' +
    'dieser diese dieses diesen hallo gut schlecht immer nie oft viel viele wieder eben also so da nur'
  ).split(' '),
  cues: {
    whyNot: ['kann nicht', 'kannst nicht', 'warum nicht', 'wieso nicht', 'geht nicht', 'nicht moglich', 'unmoglich', 'verboten', 'gesperrt', 'darf nicht', 'klappt nicht', 'funktioniert nicht', 'ausgegraut', 'grau', 'abgelehnt', 'nicht erlaubt'],
    gain: ['bringt', 'bringen', 'lohnt', 'wert', 'gewinn', 'ertrag', 'einbringt', 'verdient', 'verdienen', 'belohnung', 'vorteil', 'nutzen', 'punktet'],
    cost: ['kostet', 'kosten', 'preis', 'preise', 'teuer', 'wie viel', 'wieviel', 'bezahlen', 'zahlen', 'gebuhr'],
    how: ['wie', 'art weise', 'schritte'],
  },
  notions: {
    coalMine: {
      topic: 'die Kohlebergwerke',
      words: ['kohlemine', 'kohleminen', 'mine', 'minen', 'bergwerk', 'bergwerke', 'zeche', 'zechen', 'grube', 'gruben', 'kohlebergwerk', 'kohlengrube', 'kohle mine', 'kohle verkaufen', 'kohle verkauft'],
      what: 'Eine Kohlemine erzeugt Kohlewürfel: 2 bis 5 je nach Stufe, beim Bau auf das Plättchen gelegt. Jeder Spieler, der mit deiner Mine verbunden ist, nimmt sich dort kostenlos Kohle, um zu bauen oder eine Schiene zu legen. Die Mine wird umgedreht, wenn ihr letzter Würfel geht — egal wer ihn nimmt —, und erst dann steigt dein Einkommen und zählen ihre Punkte. Ist sie beim Bau mit einem Händlerfeld verbunden, gehen ihre Würfel sofort gegen Geld auf den Kohlemarkt.',
      how: 'Du brauchst eine passende Karte (die Ortskarte der Stadt, die Industriekarte Kohle für eine Stadt deines Netzes oder einen Joker), ein freies Feld mit dem Kohlesymbol und das Geld — auf Stufe III und IV dazu ein Eisen. Wähle die Karte, die Aktion Bauen, dann das Feld, das aufleuchtet, und bestätige.',
      cost: 'Stufe I: £5, nur Kanalzeit, 2 Würfel. Stufe II: £7, 3 Würfel. Stufe III: £8 und 1 Eisen, 4 Würfel. Stufe IV: £10 und 1 Eisen, 5 Würfel. Du hast sieben auf deinem Tableau (eine auf Stufe I, je zwei auf den anderen), und gebaut wird immer die niedrigste Stufe, die übrig ist.',
      gain: 'Umgedreht rückt eine Mine dein Einkommen um 4, 7, 6 oder 5 Felder vor (Stufe I bis IV) und bringt 1, 2, 3 oder 4 SP bei jeder Epochenwertung, solange sie steht. Beim Bau bringt sie zudem den Preis der Würfel, die auf den Markt gehen, wenn sie mit einem Händler verbunden ist. Eine von Rivalen geleerte Mine zahlt dir so viel wie eine selbst geleerte.',
    },
    ironWorks: {
      topic: 'die Eisenhütten',
      words: ['eisenhutte', 'eisenhutten', 'hutte', 'hutten', 'giesserei', 'giessereien', 'hochofen', 'schmiede', 'schmieden', 'stahlwerk', 'eisenwerk', 'iron works', 'eisen verkaufen', 'eisen verkauft'],
      what: 'Eine Eisenhütte erzeugt Eisen: 4 bis 6 Barren, beim Bau auf das Plättchen gelegt. Sie verkauft sofort an den Eisenmarkt, was dort Platz hat, mit einem Händler verbunden oder nicht, und du kassierst den Preis jedes gefüllten Feldes. Das übrige Eisen dient jedem, der es braucht, überall auf dem Plan, und die Hütte wird umgedreht, wenn ihr letzter Barren geht.',
      how: 'Eine passende Karte (die Ortskarte der Stadt, eine Eisenhüttenkarte für eine Stadt deines Netzes oder einen Joker), ein freies Feld mit dem Eisensymbol, das Geld und eine mit der Baustelle verbundene Kohle. Wähle die Karte, Bauen, das Feld, und bestätige.',
      cost: 'Stufe I: £5 und 1 Kohle, nur Kanalzeit, 4 Barren. Stufe II: £7 und 1 Kohle, 4 Barren. Stufe III: £9 und 1 Kohle, 5 Barren. Stufe IV: £12 und 1 Kohle, 6 Barren. Ein Plättchen je Stufe, vier insgesamt auf deinem Tableau.',
      gain: 'Umgedreht rückt eine Eisenhütte dein Einkommen um 3, 3, 2 oder 1 Feld vor (Stufe I bis IV) und bringt am Ende der Epoche 3, 5, 7 oder 9 SP. Beim Bau bringt sie zudem den Preis der Barren, die auf den Eisenmarkt gehen.',
    },
    brewery: {
      topic: 'die Brauereien',
      words: ['brauerei', 'brauereien', 'brauer', 'brauhaus', 'malzerei', 'brennerei', 'brauerei eisenbahn', 'brauerei fasser'],
      what: 'Eine Brauerei erzeugt das Bier, das Verkäufe und die Doppelschiene brauchen: 1 Fass beim Bau in der Kanalzeit, 2 in der Eisenbahnzeit, gleich welche Stufe. Deine eigenen Fässer werden überall getrunken, ohne Verbindung; die eines Rivalen nur, wenn seine Brauerei verbunden ist. Sie wird umgedreht, wenn ihr letztes Fass getrunken ist, von dir oder einem anderen.',
      how: 'Eine passende Karte (Ortskarte der Stadt, Brauereikarte für eine Stadt deines Netzes oder ein Joker), ein freies Feld mit dem Brauereisymbol, das Geld und ein Eisen — Eisen braucht keine Verbindung. Wähle die Karte, Bauen, das Feld, und bestätige.',
      cost: 'Stufe I: £5 und 1 Eisen, nur Kanalzeit. Stufe II: £7 und 1 Eisen. Stufe III: £9 und 1 Eisen. Stufe IV: £9 und 1 Eisen, nur Eisenbahnzeit. Sieben Brauereien auf deinem Tableau; jede bekommt 1 Fass in der Kanalzeit und 2 in der Eisenbahnzeit.',
      gain: 'Umgedreht rückt eine Brauerei dein Einkommen um 4 Felder (Stufe I) oder 5 (Stufen II bis IV) vor und bringt 4, 5, 7 oder 9 SP. Jede trägt 2 Verbindungssymbole, die für die Verbindungen an ihrer Stadt zählen.',
    },
    farmBrewery: {
      topic: 'die Hofbrauereien',
      words: ['hofbrauerei', 'hofbrauereien', 'bauernhof', 'hof', 'hofe', 'farm', 'nordhof', 'sudhof', 'farm brewery', 'landbrauerei'],
      what: 'Zwei einzelne Felder ohne Stadtnamen, die nur eine Brauerei nehmen. Dort baut man nur mit einer Industriekarte Brauerei oder einem Industriejoker — nie mit einer Ortskarte oder einem Ortsjoker. Auf der Midlands-Karte wird der nördliche Hof über die Verbindung Cannock–Hof angeschlossen; der südliche ist durch die Verbindung Kidderminster–Worcester selbst angeschlossen, ohne weiteres Plättchen.',
    },
    cotton: {
      topic: 'die Baumwollspinnereien',
      words: ['baumwollspinnerei', 'baumwollspinnereien', 'spinnerei', 'spinnereien', 'baumwolle', 'textil', 'textilien', 'weberei', 'garn', 'cotton'],
      what: 'Die Baumwollspinnerei ist ein Gewerbe: Sie erzeugt nichts, sie wird verkauft. Gebaut wartet sie; die Aktion Verkaufen dreht sie um, wenn sie mit einem Händler verbunden ist, der Baumwolle (oder „alle Waren“) kauft, und du 1 Bier trinkst. Erst dann steigt dein Einkommen und zählen ihre Punkte. Eine reine Baumwollkarte gibt es nicht: Baumwolle und Manufaktur teilen sich Doppelkarten.',
      how: 'Zum Bauen: eine Ortskarte der Stadt, eine Doppelkarte Baumwolle/Manufaktur für eine Stadt deines Netzes oder ein Joker, auf einem Feld mit dem Baumwollsymbol. Zum Umdrehen danach: die Aktion Verkaufen, ein verbundener Händler, der Baumwolle kauft, und 1 Bier.',
      cost: 'Stufe I: £12, nur Kanalzeit. Stufe II: £14 und 1 Kohle. Stufe III: £16, 1 Kohle und 1 Eisen. Stufe IV: £18, 1 Kohle und 1 Eisen. Elf Spinnereien auf deinem Tableau (3, 2, 3 und 3), jede wird für 1 Bier verkauft.',
      gain: 'Verkauft rückt eine Spinnerei dein Einkommen um 5, 4, 3 oder 2 Felder vor (Stufe I bis IV) und bringt am Ende der Epoche 5, 5, 9 oder 12 SP. Solange sie nicht verkauft ist, bringt sie nichts.',
    },
    manufacturer: {
      topic: 'die Manufakturen',
      words: ['manufaktur', 'manufakturen', 'fabrik', 'fabriken', 'werkstatt', 'werkstatten', 'fertigwaren', 'waren', 'manufacturer', 'kiste', 'kisten'],
      what: 'Die Manufaktur ist ein Gewerbe wie die Spinnerei: Sie wird durch die Aktion Verkaufen umgedreht, verbunden mit einem Händler, der Fertigwaren (oder „alle Waren“) kauft. Sie hat acht Stufen mit sehr ungleichen Kosten und Erträgen: Jedes Plättchen liest man auf seinem Tableau. Ihre Karten sind die Doppelkarten Baumwolle/Manufaktur.',
      how: 'Zum Bauen: eine Ortskarte der Stadt, eine Doppelkarte Baumwolle/Manufaktur für eine Stadt deines Netzes oder ein Joker, auf einem Feld mit dem Manufaktursymbol. Zum Umdrehen: die Aktion Verkaufen, ein verbundener Händler, der diese Waren kauft, und das verlangte Bier.',
      cost: 'Die acht Stufen: I, £8 und 1 Kohle (nur Kanal); II, £10 und 1 Eisen; III, £12 und 2 Kohle; IV, £8 und 1 Eisen; V, £16 und 1 Kohle; VI, £20; VII, £16, 1 Kohle und 1 Eisen; VIII, £20 und 2 Eisen. Alle verkaufen sich für 1 Bier, außer Stufe V, die 2 verlangt.',
      gain: 'Verkauft rückt eine Manufaktur dein Einkommen je nach Stufe (I bis VIII) um 5, 1, 4, 6, 2, 6, 4 oder 1 Feld vor und bringt 3, 5, 4, 3, 8, 7, 9 oder 11 SP. Die Stufen III und VII haben kein Verbindungssymbol.',
    },
    pottery: {
      topic: 'die Töpfereien',
      words: ['topferei', 'topfereien', 'keramik', 'porzellan', 'steingut', 'topfer', 'brennofen', 'gluhbirne', 'gluhbirnen', 'birne', 'lampe', 'kostenlose topferei'],
      what: 'Die Töpferei ist ein Gewerbe, das wie die Spinnerei verkauft wird, an einen Händler, der Keramik oder „alle Waren“ kauft. Auf der Midlands-Karte hat sie nur vier Städte zum Bauen: Belper, Coventry, Stoke-on-Trent und Stafford. Die Stufen I und III tragen eine Glühbirne: Sie lassen sich nicht entwickeln, man muss sie bauen. Und ausnahmsweise darf Töpferei I auch in der Eisenbahnzeit gebaut werden.',
      how: 'Eine Ortskarte einer Stadt mit Töpfereifeld, die Töpfereikarte für eine solche Stadt deines Netzes oder ein Joker; danach dreht die Aktion Verkaufen sie um, verbunden mit einem Händler, der Keramik oder „alle Waren“ kauft.',
      cost: 'Stufe I: £17 und 1 Eisen. Stufe II: £0 und 1 Kohle. Stufe III: £22 und 2 Kohle. Stufe IV: £0 und 1 Kohle. Stufe V: £24 und 2 Kohle, nur Eisenbahnzeit. Die Stufen I, II und IV verkaufen sich für 1 Bier, III und V für 2.',
      gain: 'Verkauft rückt eine Töpferei dein Einkommen auf den Stufen I, III und V um 5 Felder vor, auf II und IV um 1. Sie bringt 10, 1, 11, 1 oder 20 SP: Stufe V ist das schwerste Plättchen des Spiels.',
      whyNot: 'Zwei Ablehnungen kommen immer wieder. Die Töpfereien I und III tragen eine Glühbirne und lassen sich nicht entwickeln: Man muss sie bauen, um sie vom Tableau zu bekommen. Und zum Verkaufen braucht es einen verbundenen Händler, der Keramik oder „alle Waren“ kauft — zu zweit nimmt sie nur das Plättchen „alle Waren“.',
    },
    coal: {
      topic: 'die Kohle',
      words: ['kohle', 'kohlen', 'kohlewurfel', 'kohle wurfel', 'schwarzer wurfel', 'schwarze wurfel', 'brennstoff', 'steinkohle', 'kohle rivale', 'kohle gegner'],
      what: 'Kohle verlangen manche Bauten und jede Schiene. Sie muss die Baustelle erreichen: Sie kommt kostenlos aus der nächsten nicht umgedrehten Mine, die damit verbunden ist, egal wem sie gehört. Sonst wird sie am Markt gekauft, aber nur, wenn die Baustelle mit einem Händlerfeld verbunden ist. Andernfalls ist der Bau unmöglich.',
      cost: 'Aus einer verbundenen Mine ist Kohle kostenlos, auch aus der Mine eines Rivalen. Am Markt kostet sie £1 bis £7, je nachdem, was übrig ist, das billigste Feld zuerst, und £8, wenn der Markt leer ist.',
      whyNot: 'Kohle muss verbunden sein: Keine nicht umgedrehte Mine erreicht diesen Ort über Verbindungen, und der Ort erreicht auch kein Händlerfeld, um am Markt zu kaufen. Eine Verbindung zu einer Mine oder zu einem Händler öffnet den Weg.',
    },
    iron: {
      topic: 'das Eisen',
      words: ['eisen', 'eisenbarren', 'barren', 'eisenwurfel', 'eisen wurfel', 'metall', 'stahl', 'erz', 'eisenerz'],
      what: 'Eisen verlangen manche Bauten und jedes entwickelte Plättchen. Es braucht überhaupt keine Verbindung: Man nimmt es kostenlos von jeder nicht umgedrehten Eisenhütte auf dem Plan, egal wem sie gehört. Ohne Hütte wird es am Eisenmarkt gekauft, ebenfalls ohne Verbindung.',
      cost: 'Von einer Eisenhütte ist Eisen kostenlos, auch bei einem Rivalen. Am Markt kostet es £1 bis £5, je nachdem, was übrig ist, das billigste Feld zuerst, und £6, wenn der Markt leer ist.',
      whyNot: 'Eisen fehlt nur, wenn es nirgends mehr welches gibt: Keine nicht umgedrehte Hütte hat noch Barren, und du kannst es am Markt nicht bezahlen (£6 pro Barren, wenn er leer ist). Eine Verbindung braucht Eisen nie.',
    },
    beer: {
      topic: 'das Bier',
      words: ['bier', 'biere', 'fass', 'fasser', 'bierfass', 'krug', 'hopfen', 'ale', 'handlerbier', 'handler fass', 'bier handler', 'bier rivale', 'bier gegner', 'eigenes bier'],
      what: 'Bier wird zum Verkaufen getrunken (1 oder 2 Fässer je Plättchen) und für die Doppelschiene. Drei Quellen, Fass für Fass: deine eigenen nicht umgedrehten Brauereien, überall und ohne Verbindung; die Brauerei eines Rivalen, nur wenn sie mit dem verkauften Plättchen verbunden ist; oder das Fass beim Händler, an den du verkaufst, das zudem seinen Bonus bringt. Die Doppelschiene trinkt nie das Bier eines Händlers.',
      whyNot: 'Ohne das verlangte Bier wird der Verkauf abgelehnt. Deine Brauereien müssen noch Fässer haben; die Brauerei eines Rivalen hilft nur, wenn sie mit dem verkauften Plättchen verbunden ist; und das Fass eines Händlers dient nur dem, der an genau diesen Händler verkauft, einmal pro Epoche.',
      cost: 'Bier wird nie gekauft: Es wird kostenlos getrunken, aus deinen Brauereien, aus der eines Rivalen, die mit dem verkauften Plättchen verbunden ist, oder beim Händler. Was es kostet, ist die Brauerei, die gebaut werden musste.',
    },
    market: {
      topic: 'der Kohle- und Eisenmarkt',
      words: ['markt', 'markte', 'kohlemarkt', 'eisenmarkt', 'kohlepreis', 'eisenpreis', 'kohle kaufen', 'eisen kaufen', 'borse', 'leerer markt'],
      what: 'Zwei Märkte am Rand des Plans: 14 Kohlefelder, je zwei zu jedem Preis von £1 bis £7, und 10 Eisenfelder, je zwei zu jedem Preis von £1 bis £5. Man kauft immer zuerst das billigste Feld; leer verkauft der Markt weiter, Kohle für £8 und Eisen für £6. Er füllt sich nie von selbst auf: Nur neu gebaute Minen und Hütten verkaufen ihre Würfel hinein und füllen dabei die teuersten Felder zuerst.',
      cost: 'Der Preis hängt davon ab, was übrig ist: das billigste noch volle Feld, £1 bis £7 für Kohle, £1 bis £5 für Eisen, danach £8 und £6, wenn alles weg ist. Kohle kaufen verlangt eine Verbindung zu einem Händlerfeld; Eisen nicht. In der Standardeinstellung beginnt die Partie mit 13 Kohle und 8 Eisen.',
      gain: 'Baust du eine mit einem Händler verbundene Mine oder irgendeine Eisenhütte, gehen die Würfel, die Platz finden, auf den Markt, und du kassierst den aufgedruckten Preis jedes gefüllten Feldes, die teuersten zuerst. Das ist der einzige Weg, an den Markt zu verkaufen, und er geschieht nur beim Bau.',
      whyNot: 'Marktkohle erreicht nur Orte, die mit einem Händlerfeld verbunden sind, gleich welchem der fünf. Eisen kauft man ohne Bedingung; wird es verweigert, fehlt das Geld.',
    },
    build: {
      topic: 'die Aktion Bauen',
      words: ['bauen', 'baue', 'baut', 'gebaut', 'bau', 'errichten', 'plattchen legen', 'plattchen setzen', 'build', 'industrie', 'industrien', 'graues feld', 'feld grau'],
      what: 'Bauen legt ein Industrieplättchen auf ein freies Feld: Wirf eine passende Karte ab, bezahle das Plättchen mit Geld und Rohstoffen und nimm immer die niedrigste Stufe dieser Industrie von deinem Tableau. Eine Ortskarte baut in ihrer Stadt, auch außerhalb deines Netzes; eine Industriekarte baut diese Industrie in einer Stadt deines Netzes. In der Kanalzeit nur eines deiner Plättchen pro Ort.',
      how: 'Wähle eine Karte aus deiner Hand, dann die Aktion Bauen: Die möglichen Felder leuchten auf der Karte auf. Klicke das gewünschte an, lies die Notiz (Preis, Kohle und Eisen und woher sie kommen) und bestätige. Nimmt das Feld zwei Industrien, wechselt ein weiterer Klick zwischen ihnen.',
      cost: 'Der Preis ist der des niedrigsten Plättchens auf deinem Tableau: Geld, manchmal Kohle und Eisen. Kohle aus einer verbundenen Mine und Eisen aus einer Hütte sind kostenlos; vom Markt kosten sie den Feldpreis. Das Tableau (Taste P) zeigt die Kosten jedes nächsten Plättchens.',
      whyNot: 'Die häufigsten Ablehnungen: Die Karte nennt weder diese Stadt noch diese Industrie, oder die Stadt liegt nicht in deinem Netz; dem Feld fehlt das Symbol oder es ist belegt; du hast schon ein Plättchen an diesem Ort (Kanalzeit); das nächste Plättchen deines Tableaus gehört nicht in diese Epoche; die Kohle erreicht die Baustelle nicht; oder das Geld reicht nicht. Klicke das Feld an: Der Tisch nennt dir den Grund.',
    },
    network: {
      topic: 'die Aktion Netzwerk',
      words: ['netzwerk', 'netz', 'mein netz', 'mein netzwerk', 'aktion netzwerk', 'verbindung legen', 'kanal legen', 'kanal bauen', 'schiene legen', 'schiene bauen', 'verbinden', 'anschliessen', 'netz erweitern', 'network'],
      what: 'Die Aktion Netzwerk legt ein Verbindungsplättchen auf eine freie Strecke, die dein Netz berührt: einen Kanal in der Kanalzeit, eine Schiene in der Eisenbahnzeit. Dein Netz sind alle Orte, an denen du ein Plättchen hast, und alle, die deine Verbindungen berühren; dort dürfen deine Industriekarten bauen. Solange du nichts auf dem Plan hast, darf deine erste Verbindung überallhin.',
      how: 'Wähle eine beliebige Karte, die Aktion Netzwerk, dann eine Strecke, die auf der Karte aufleuchtet, und bestätige. In der Eisenbahnzeit darfst du in derselben Aktion eine zweite Schiene legen.',
      cost: 'In der Kanalzeit: £3 pro Kanal, einer pro Aktion. In der Eisenbahnzeit: £5 und 1 Kohle pro Schiene, oder zwei in derselben Aktion für £15, je 1 Kohle und 1 Bier aus einer Brauerei. Die Kohle einer Schiene muss mit der gelegten Verbindung verbunden sein.',
      whyNot: 'Die Strecke muss frei sein und dein Netz berühren — eine Strecke trägt nur eine Verbindung. In der Kanalzeit sind die reinen Schienenstrecken gesperrt; in der Eisenbahnzeit auch die reine Kanalstrecke Burton–Walsall. Eine Schiene braucht zudem mit der Verbindung verbundene Kohle, die Doppelschiene ein Brauereibier, und das Geld muss reichen.',
    },
    develop: {
      topic: 'die Aktion Entwickeln',
      words: ['entwickeln', 'entwickle', 'entwickelt', 'entwicklung', 'plattchen entfernen', 'stufe uberspringen', 'stufen uberspringen', 'verbessern', 'aufwerten', 'develop'],
      what: 'Entwickeln entfernt ein oder zwei Plättchen von deinem Tableau, ohne sie zu bauen, um schneller die höheren Stufen zu erreichen. Jedes entfernte Plättchen ist das niedrigste seiner Spalte und kostet 1 Eisen; es geht zurück in die Schachtel und bringt nichts. Töpfereien mit Glühbirne (Stufe I und III) lassen sich nicht entwickeln.',
      how: 'Wähle eine Karte, die Aktion Entwickeln, dann das oder die Plättchen, die du entfernst: eines oder zwei, aus derselben Industrie oder aus zweien. Die Notiz zeigt, woher das Eisen kommt; bestätige.',
      cost: 'Eine Karte und 1 Eisen pro entferntem Plättchen — kostenlos aus jeder Eisenhütte, sonst am Eisenmarkt gekauft (£1 bis £5, £6 wenn leer). Sonst nichts: Zwei Plättchen in derselben Aktion kosten zwei Eisen.',
      gain: 'Entwickeln bringt im Moment nichts: kein Geld, kein Einkommen, keine Punkte. Es ändert das nächste Plättchen der Spalte, das eine Stufe höher liegt.',
      whyNot: 'Es braucht Eisen: irgendwo eine nicht umgedrehte Eisenhütte oder das Geld, es am Markt zu kaufen. Das Plättchen muss zudem entwickelbar sein — die Töpfereien I und III mit Glühbirne sind es nicht —, und in der Spalte muss noch ein Plättchen liegen.',
    },
    sell: {
      topic: 'die Aktion Verkaufen',
      words: ['verkaufen', 'verkaufe', 'verkauft', 'verkauf', 'verkaufe waren', 'handeln', 'handel', 'liefern', 'absetzen', 'sell'],
      what: 'Verkaufen dreht deine Gewerbe um — Spinnereien, Manufakturen, Töpfereien. Wirf eine beliebige Karte ab, wähle ein nicht umgedrehtes Plättchen, das mit einem Händler verbunden ist, der diese Waren kauft, und trinke das verlangte Bier. Das Plättchen wird umgedreht: Dein Einkommen steigt sofort, seine Punkte kommen am Ende der Epoche. Eine Aktion kann mehrere Plättchen verkaufen, solange das Bier reicht.',
      how: 'Wähle eine Karte, die Aktion Verkaufen, dann das Plättchen: Der Tisch zeigt die erreichbaren Händler und das verfügbare Bier. Füge nach Belieben weitere Plättchen hinzu und bestätige.',
      gain: 'Jedes verkaufte Plättchen rückt dein Einkommen um die aufgedruckten Felder vor und zählt am Ende der Epoche seine Punkte. Das Händlerfass zu trinken bringt seinen Bonus dazu. Der Verkauf selbst zahlt kein Geld.',
      cost: 'Eine beliebige Karte und das Bier jedes verkauften Plättchens: meist 1 Fass, 2 für Manufaktur V und die Töpfereien III und V. Kein Geld.',
      whyNot: 'Zum Verkaufen muss das Plättchen ein nicht umgedrehtes Gewerbe sein (Minen, Hütten und Brauereien werden nicht verkauft, sie werden geleert), über Verbindungen mit einem Händler verbunden, der diese Ware kauft — ein leeres Händlerplättchen kauft nichts. Dazu braucht es das Bier: deine Brauereien, eine verbundene Brauerei eines Rivalen oder das Händlerfass.',
    },
    loan: {
      topic: 'der Kredit',
      words: ['kredit', 'kredite', 'darlehen', 'leihen', 'ausleihen', 'bank', 'banker', 'schulden', 'schuld', 'zuruckzahlen', 'ruckzahlung', 'tilgen', 'loan'],
      what: 'Einen Kredit aufnehmen ist eine Aktion: Wirf eine Karte ab, erhalte £30, und dein Einkommen fällt um 3 Stufen (nicht 3 Felder), auf das höchste Feld der neuen Stufe. Ein Kredit wird nie zurückgezahlt: Sein Preis ist das Einkommen, das dir bei jeder Auszahlung bis zum Ende fehlt. Unmöglich, wenn dein Einkommen unter Stufe −10 fiele.',
      how: 'Wähle eine Karte, die Aktion Kredit und bestätige: Die £30 kommen sofort, und die Einkommensleiste zeigt, wo dein Marker landet.',
      cost: 'Ein Kredit bringt £30 und kostet 3 Einkommensstufen, also bei jeder verbleibenden Auszahlung, was diese drei Stufen gezahlt hätten. Er wird nie zurückgezahlt: Die £30 gibt man nie zurück, weder während noch am Ende der Partie.',
      whyNot: 'Ein Kredit senkt dein Einkommen um 3 Stufen, und das Einkommen fällt nie unter −10. Steht dein Marker schon auf Stufe −8 oder tiefer, lehnt die Bank ab.',
    },
    scout: {
      topic: 'das Erkunden',
      words: ['erkunden', 'erkundung', 'erkunde', 'kundschaften', 'kundschafter', 'scout', 'zwei joker', 'beide joker'],
      what: 'Erkunden gibt dir beide Joker auf einmal: Wirf drei Karten ab (die der Aktion und zwei weitere) und nimm einen Ortsjoker und einen Industriejoker. Es ist verboten, solange du schon einen Joker hältst. Abgeworfene Joker kehren auf ihren Stapel zurück, der vier von jeder Sorte hat.',
      how: 'Wähle eine Karte, die Aktion Erkunden, dann zwei weitere Karten zum Abwerfen; bestätige, und beide Joker kommen in deine Hand.',
      cost: 'Drei Karten aus deiner Hand und sonst nichts: kein Geld. Zwei bekommst du zurück, die Joker, also wird deine Hand um eine Karte leichter.',
      whyNot: 'Drei mögliche Gründe: Du hältst schon einen Joker, dir fehlen Karten (drei müssen abgeworfen werden), oder einer der beiden Jokerstapel ist leer.',
    },
    pass: {
      topic: 'das Passen',
      words: ['passen', 'passe', 'aussetzen', 'nichts tun', 'keine aktion', 'zug auslassen'],
      what: 'Passen heißt, eine Karte abzuwerfen und nichts zu tun: Die Aktion ist verloren, die Karte geht trotzdem. Man darf eine Aktion oder beide passen. Es kostet kein Geld, und was nicht ausgegeben wird, zählt für die Reihenfolge der nächsten Runde.',
      cost: 'Passen kostet eine Karte pro gepasster Aktion, sonst nichts.',
    },
    canal: {
      topic: 'die Kanalzeit',
      words: ['kanal', 'kanale', 'kanalzeit', 'kanal epoche', 'lastkahn', 'kahn', 'schleuse', 'schleusen', 'wasserweg', 'doppelkanal'],
      what: 'Die Kanalzeit ist die erste der beiden. Es werden nur Kanäle gelegt (£3, einer pro Aktion), nur eines deiner Plättchen pro Ort, und Plättchen der Stufe 1 dürfen gebaut werden. Die allererste Runde gibt jedem nur eine Aktion. Am Ende werten Verbindungen und umgedrehte Plättchen, dann verlassen Kanäle und Plättchen der Stufe 1 den Plan.',
      cost: 'Ein Kanal kostet £3, ohne Kohle, und eine Verbindung pro Aktion — einen Doppelkanal gibt es nicht.',
      whyNot: 'In der Kanalzeit eine Verbindung pro Aktion und nur auf Strecken, die für Kanäle offen sind; reine Schienenstrecken bleiben gesperrt. Du brauchst £3 und eine freie Strecke, die dein Netz berührt.',
    },
    rail: {
      topic: 'die Eisenbahnzeit',
      words: ['schiene', 'schienen', 'eisenbahn', 'eisenbahnen', 'bahn', 'eisenbahnzeit', 'lok', 'lokomotive', 'lokomotiven', 'doppelschiene', 'zwei schienen', 'gleis', 'gleise', 'rail'],
      what: 'Die Eisenbahnzeit ist die zweite und letzte. Es werden Schienen gelegt: £5 und 1 Kohle pro Stück, oder zwei in derselben Aktion für £15, 2 Kohle und 1 Brauereibier. Plättchen der Stufe 1 (außer Töpferei I) werden nicht mehr gebaut, Brauereien bekommen 2 Fässer, und mehrere deiner Plättchen dürfen sich einen Ort teilen. Die Schlusswertung folgt auf ihre letzte Runde.',
      cost: 'Eine Schiene: £5 und 1 Kohle, verbunden mit der gelegten Verbindung. Zwei in derselben Aktion: £15, je 1 Kohle und 1 Bier aus einer Brauerei — nie aus dem Fass eines Händlers.',
      whyNot: 'In der Kanalzeit gibt es noch keine Schienen: Sie kommen mit der zweiten Epoche. In der Eisenbahnzeit braucht eine Schiene eine freie Strecke, die dein Netz berührt, £5 und mit der Verbindung verbundene Kohle — eine verbundene Mine oder den Markt über einen Händler.',
    },
    links: {
      topic: 'die Verbindungen',
      words: ['verbindung', 'verbindungen', 'verbunden', 'verbindungsplattchen', 'strecke', 'strecken', 'route', 'routen', 'link', 'verbindungssymbol', 'verbindung punkte', 'verbindungen punkte'],
      what: 'Eine Verbindung ist ein Kanal oder eine Schiene auf einer Strecke zwischen zwei Orten. Sie erweitert dein Netz und verbindet Orte für alle: Kohle, das Bier eines Rivalen und Verkäufe an Händler laufen über die Verbindungen jedes Spielers. Am Ende einer Epoche bringt jede 1 Punkt pro Verbindungssymbol an den berührten Orten, 2 für einen Händler, und verlässt dann den Plan.',
      gain: 'Am Ende jeder Epoche wertet eine Verbindung die Verbindungssymbole jedes Plättchens an den Orten, die sie verbindet — 0 bis 2 je Plättchen, gleich wem es gehört, umgedreht oder nicht — und 2 Punkte für ein Händlerfeld. Dann wird sie entfernt.',
      cost: 'Ein Kanal kostet £3. Eine Schiene £5 und 1 Kohle; zwei in derselben Aktion £15, 2 Kohle und 1 Brauereibier.',
    },
    eras: {
      topic: 'Epochen und Runden',
      words: ['epoche', 'epochen', 'zeit', 'zeitalter', 'runde', 'runden', 'dauer', 'wie lange', 'anzahl runden', 'rundenende'],
      what: 'Eine Partie hat zwei Epochen: die Kanalzeit, dann die Eisenbahnzeit. Jede dauert 8 Runden zu viert, 9 zu dritt und 10 zu zweit — sie endet, wenn Nachziehstapel und alle Hände leer sind. In jeder Runde spielt jeder einen Zug mit zwei Aktionen (in der allerersten nur einer), dann kommen die neue Zugreihenfolge und die Auszahlung.',
    },
    firstRound: {
      topic: 'die erste Runde',
      words: ['erste runde', 'erster zug', 'spielbeginn', 'beginn', 'anfang', 'anfangen', 'start', 'eroffnung', 'eine aktion', 'erste aktion', 'erstes plattchen'],
      what: 'In der allerersten Runde der Kanalzeit macht jeder nur eine Aktion statt zwei, und die Reihenfolge dieses ersten Zuges wird ausgelost. Alle beginnen mit £17, Einkommen auf Stufe 0 und acht Handkarten. Solange du kein Plättchen auf dem Plan hast, baut eine Industriekarte überall, und deine erste Verbindung darf überallhin.',
    },
    eraEnd: {
      topic: 'das Ende einer Epoche',
      words: ['epochenende', 'ende epoche', 'ende kanalzeit', 'ubergang', 'zwischen epochen', 'epochenwechsel', 'neue epoche', 'stufe 1 plattchen', 'plattchen verschwunden', 'plattchen weg', 'kanale weg', 'verbindungen weg', 'verbindungen entfernt'],
      what: 'Sind Stapel und Hände leer, endet die Epoche: Jede Verbindung wertet, jedes umgedrehte Plättchen wertet seine Punkte, dann verlassen alle Verbindungen den Plan. Nach der Kanalzeit werden zusätzlich die Plättchen der Stufe 1 vom Plan genommen, die Händlerfässer aufgefüllt und alle Ablagen zu einem neuen Stapel gemischt, acht Karten pro Spieler. Geld, Einkommen, Punkte und Plättchen ab Stufe 2 bleiben.',
    },
    scoring: {
      topic: 'die Wertung',
      words: ['wertung', 'wertungen', 'punkte zahlen', 'punkte berechnen', 'punktezahlung', 'abrechnung', 'schlusswertung', 'endwertung', 'epochenwertung', 'scoring'],
      what: 'Gewertet wird am Ende jeder Epoche. Zuerst die Verbindungen: Jede bringt 1 Punkt pro Verbindungssymbol an den berührten Orten (die Plättchen aller, 2 für einen Händler). Dann wertet jedes umgedrehte Plättchen die unten aufgedruckte Zahl; ein nie umgedrehtes Plättchen bringt nichts. Plättchen ab Stufe 2 bleiben für die Eisenbahnzeit und werten dort ein zweites Mal, wenn sie noch stehen.',
    },
    ties: {
      topic: 'Gleichstände',
      words: ['gleichstand', 'gleichstande', 'unentschieden', 'patt', 'stichentscheid', 'gleich viele punkte', 'punktgleich'],
      what: 'Bei Punktgleichheit am Ende gewinnt die höhere Einkommensstufe, dann das Geld in der Kasse. Für die Zugreihenfolge behält ein Gleichstand beim Ausgegebenen die relative Reihenfolge der Vorrunde.',
    },
    gameEnd: {
      topic: 'das Spielende',
      words: ['spielende', 'ende spiel', 'gewinnen', 'gewinnt', 'gewinner', 'sieger', 'sieg', 'partie ende', 'letzte runde', 'ende', 'schluss'],
      what: 'Die Partie endet nach der Wertung der Eisenbahnzeit, und wer die meisten Siegpunkte hat, gewinnt. Die letzte Runde der Partie hat keine Auszahlung. Bei Gleichstand entscheidet die höhere Einkommensstufe, dann das Geld in der Kasse.',
      how: 'Man gewinnt mit den meisten Punkten am Ende der Eisenbahnzeit. Die Punkte kommen von umgedrehten Plättchen und Verbindungen, gezählt bei jeder Epochenwertung, und von einigen Händlerboni; ein Fehlbetrag kostet Punkte.',
    },
    initiation: {
      topic: 'die Einführungspartie',
      words: ['einfuhrung', 'einfuhrungspartie', 'kurze partie', 'kurz', 'nur kanal', 'schnelle partie', 'anfangerpartie', 'erste partie', 'tutorial'],
      what: 'Die Einführungspartie spielt nur die Kanalzeit. Nach ihrer normalen Wertung zählt jeder 1 Punkt pro £4 dazu (höchstens 15), Punkte in Höhe seiner Einkommensstufe (abgezogen, wenn sie negativ ist), und wertet seine umgedrehten Plättchen ab Stufe 2 ein zweites Mal. Nach ihrer letzten Runde gibt es keine Auszahlung.',
    },
    merchants: {
      topic: 'die Händler und ihre Boni',
      words: ['handler', 'handlerbonus', 'kaufmann', 'kaufleute', 'abnehmer', 'kaufer', 'shrewsbury', 'warrington', 'nottingham', 'gloucester', 'oxford', 'handlerplattchen', 'bonus', 'alle waren', 'leerer handler'],
      what: 'Die Händler am Kartenrand kaufen deine Gewerbe: Jedes Händlerplättchen zeigt, was es nimmt (Baumwolle, Fertigwaren, Keramik, „alle Waren“ oder nichts, wenn es leer ist). Zum Verkaufen muss dein Plättchen mit einem von ihnen verbunden sein. Jedes nicht leere Plättchen hat ein Bierfass, und wer es beim Verkauf trinkt, bekommt den Bonus des Ortes. Ein Händlerfeld zählt zudem 2 Verbindungssymbole und öffnet den Kohlemarkt für jeden, der damit verbunden ist.',
      gain: 'Auf der Midlands-Karte: Shrewsbury gibt 4 SP, Warrington £5, Nottingham 3 SP, Gloucester eine kostenlose Entwicklung (ohne Eisen) und Oxford 2 Einkommensfelder. Der Bonus kommt mit dem bei einem Verkauf getrunkenen Fass, eines pro Händlerplättchen und Epoche; die Fässer kehren zu Beginn der Eisenbahnzeit zurück.',
    },
    income: {
      topic: 'das Einkommen und seine Leiste',
      words: ['einkommen', 'einkommensleiste', 'einkommensstufe', 'auszahlung', 'zahltag', 'lohn', 'gehalt', 'fortschritt', 'fortschrittsleiste', 'einkommen erhohen', 'einkommensfelder'],
      what: 'Das Einkommen ist das Geld, das du am Ende jeder Runde bekommst. Die Leiste hat 100 Felder, jedes zeigt eine Stufe von −10 bis 30: Du beginnst auf Stufe 0. Ein umgedrehtes Plättchen rückt deinen Marker um die aufgedruckten Felder vor — nach oben werden die Felder enger —, und ein Kredit senkt ihn um 3 Stufen. Negatives Einkommen zahlt man an die Bank.',
      how: 'Das Einkommen steigt nur durch umgedrehte Plättchen — ein verkauftes Gewerbe, eine geleerte Mine, Hütte oder Brauerei — und durch den Bonus von Oxford (2 Felder). Es sinkt nur durch den Kredit (3 Stufen). Ausgezahlt wird am Ende jeder Runde, außer der allerletzten der Partie.',
      gain: 'Am Ende jeder Runde bekommst du so viele Pfund wie deine Einkommensstufe — oder zahlst sie, wenn sie negativ ist. Die letzte Runde der Partie hat keine Auszahlung.',
      whyNot: 'Die Zahl auf einem umgedrehten Plättchen zählt Felder der Leiste, keine Pfund: Dein Marker rückt so viele Felder vor, und die Auszahlung steigt erst, wenn er die Grenze einer Stufe überschreitet. Bis Feld 10 ist jedes Feld eine Stufe; danach umfasst eine Stufe 2 Felder, ab Feld 31 dann 3 und ab Feld 61 4. Ein Plättchen mit +2 kann die Auszahlung also unverändert lassen, wenn der Marker in derselben Stufe bleibt. Fahre mit dem Zeiger über die Einkommensleiste: Jede Stufe zeigt ihre Felder, und jeder Stein, wie viele ihm bis zur nächsten fehlen.',
    },
    shortfall: {
      topic: 'der Bankrott',
      words: ['bankrott', 'pleite', 'ruin', 'ruiniert', 'zahlungsunfahig', 'fehlbetrag', 'negatives einkommen', 'negatives geld', 'kein geld', 'genug geld', 'ausgeschieden', 'insolvent'],
      what: 'Niemand scheidet aus. Ist die Auszahlung negativ und reicht deine Kasse nicht, nimmst du eigene Industrieplättchen vom Plan (nie Verbindungen), jedes für die Hälfte seiner Kosten, abgerundet; der Tisch nimmt die billigsten zuerst. Fehlt dann noch Geld, verlierst du 1 Siegpunkt pro fehlendem Pfund. Aus keinem anderen Grund wird ein Plättchen verkauft.',
    },
    money: {
      topic: 'das Geld',
      words: ['geld', 'pfund', 'munzen', 'munze', 'kasse', 'bargeld', 'kapital', 'startgeld', 'geld verdienen', 'geld bekommen', 'sterling'],
      what: 'Alle beginnen mit £17. Geld kommt durch die Auszahlung am Rundenende, durch Kredite (£30), durch die Würfel, die deine Minen und Hütten an den Markt verkaufen, und durch den Bonus von Warrington. Es wird für Plättchen, Verbindungen und Marktkäufe ausgegeben, und was du in einer Runde ausgibst, bestimmt deinen Platz in der nächsten Reihenfolge. Es bleibt über die Epochen hinweg und entscheidet einen Gleichstand erst ganz zuletzt.',
    },
    turnOrder: {
      topic: 'die Zugreihenfolge',
      words: ['zugreihenfolge', 'reihenfolge', 'wer beginnt', 'startspieler', 'erster spieler', 'spielt zuerst', 'letzter spieler', 'ausgegebenes geld', 'ausgegeben', 'ausgaben', 'ausgeben', 'personenplattchen', 'spielt zuletzt', 'fangt', 'wer fangt'],
      what: 'Am Ende jeder Runde wird die Reihenfolge nach dem in dieser Runde ausgegebenen Geld neu gelegt: Wer am wenigsten ausgab, spielt zuerst, wer am meisten ausgab, zuletzt. Bei Gleichstand bleibt die relative Reihenfolge der Vorrunde. Alles zählt — Plättchen, Verbindungen, Marktkäufe —, aber nicht erhaltenes Geld.',
    },
    actions: {
      topic: 'die Aktionen eines Zuges',
      words: ['aktion', 'aktionen', 'zwei aktionen', 'anzahl aktionen', 'aktionen pro zug', 'mein zug', 'zug', 'zuge', 'gleiche aktion', 'zweimal'],
      what: 'In deinem Zug spielst du zwei Aktionen — in der allerersten Runde der Kanalzeit nur eine. Es gibt sechs, dazu das Passen: Bauen, Netzwerk, Entwickeln, Verkaufen, Kredit und Erkunden. Jede kostet eine abgeworfene Karte, und dieselbe darf zweimal gespielt werden.',
    },
    flip: {
      topic: 'umgedrehte Plättchen',
      words: ['umdrehen', 'umgedreht', 'umgedrehte', 'drehen', 'wenden', 'gewendet', 'ruckseite', 'umgedrehtes plattchen', 'nicht umgedreht', 'flip'],
      what: 'Ein Plättchen wird umgedreht, wenn es seine Arbeit getan hat: eine Mine oder Hütte, wenn ihr letzter Würfel geht, eine Brauerei, wenn ihr letztes Fass getrunken ist — von wem auch immer —, und ein Gewerbe, wenn du es verkaufst. Umgedreht rückt es dein Einkommen sofort um die aufgedruckten Felder vor, und seine Punkte zählen bei jeder Epochenwertung, solange es steht. Ein nie umgedrehtes Plättchen bringt nichts.',
      how: 'Minen, Hütten und Brauereien werden umgedreht, wenn all ihre Würfel oder Fässer weg sind, gleich wer sie nahm. Spinnereien, Manufakturen und Töpfereien werden nur durch die Aktion Verkaufen umgedreht.',
      gain: 'Umgedreht rückt ein Plättchen dein Einkommen sofort um die aufgedruckten Felder vor, und seine Siegpunkte zählen bei der Epochenwertung. Nicht umgedreht bringt es nichts.',
    },
    levels: {
      topic: 'die Stufen der Plättchen',
      words: ['stufe', 'stufen', 'level', 'stufe 1', 'hohere stufe', 'niedrigstes plattchen', 'romische zahl', 'kanalsymbol', 'schienensymbol', 'spalte'],
      what: 'Jede Industrie liegt auf deinem Tableau von der niedrigsten zur höchsten Stufe gestapelt, und man nimmt immer das niedrigste übrige Plättchen, zum Bauen wie zum Entwickeln. Weiter oben kostet ein Plättchen meist mehr und bringt mehr Punkte. Ein Kanalsymbol markiert Plättchen, die in der Eisenbahnzeit nicht gebaut werden (die Stufe 1, außer Töpferei I); ein Schienensymbol die, die nur in der Eisenbahnzeit gebaut werden (Brauerei IV, Töpferei V).',
    },
    overbuild: {
      topic: 'das Überbauen',
      words: ['uberbauen', 'uberbaut', 'uberbauung', 'druberbauen', 'ersetzen', 'plattchen ersetzen', 'neu bauen', 'overbuild'],
      what: 'Überbauen heißt, ein Plättchen derselben Industrie und höherer Stufe auf ein schon liegendes zu bauen. Auf eigenen Plättchen ist das frei. Auf dem eines Rivalen nur eine Mine oder Hütte, und nur, wenn kein einziger Würfel dieses Rohstoffs mehr auf dem Plan oder am Markt liegt. Das ersetzte Plättchen verlässt das Spiel, aber Einkommen und Punkte, die es schon gab, bleiben.',
      whyNot: 'Es braucht dieselbe Industrie und eine echt höhere Stufe. Auf einem Rivalenplättchen lassen sich nur Mine und Hütte ersetzen, und nur, wenn diese Kohle oder dieses Eisen überall verschwunden ist, Markt eingeschlossen. In der Kanalzeit darfst du weiterhin nur ein Plättchen pro Ort haben.',
    },
    mat: {
      topic: 'das Spielertableau',
      words: ['tableau', 'spielertableau', 'spielerbrett', 'stapel', 'meine plattchen', 'ubrige plattchen', 'plattchen ubrig', 'wie viele plattchen'],
      what: 'Das Tableau trägt deine 45 Industrieplättchen, nach Industrie von der niedrigsten zur höchsten Stufe gestapelt: 11 Spinnereien, 11 Manufakturen, 7 Brauereien, 7 Minen, 5 Töpfereien und 4 Eisenhütten. Für jedes nächste Plättchen zeigt es Kosten, Ertrag und Epochengrenzen. Taste P öffnet es; 1 bis 4 wechseln den Spieler.',
    },
    towns: {
      topic: 'Städte und Felder',
      words: ['stadt', 'stadte', 'ort', 'orte', 'feld', 'felder', 'bauplatz', 'bauplatze', 'industriefeld', 'ein plattchen pro ort', 'zwei plattchen gleiche stadt'],
      what: 'Die Midlands-Karte hat 20 Städte, zwei Hofbrauereien und fünf Händlerfelder. Jede Stadt hat zwei bis vier Felder, und jedes zeigt die Industrien, die es annimmt, ein oder zwei Symbole. In der Kanalzeit darfst du nur ein Plättchen pro Ort haben; in der Eisenbahnzeit mehrere.',
    },
    vp: {
      topic: 'die Siegpunkte',
      words: ['punkte', 'punkt', 'siegpunkte', 'siegpunkt', 'sp', 'vp', 'punktestand', 'punkteleiste', 'siegpunktleiste'],
      what: 'Siegpunkte entscheiden die Partie. Sie werden bei jeder Epochenwertung gezählt: Verbindungen (1 Punkt pro Verbindungssymbol an den berührten Orten, 2 für einen Händler) und umgedrehte Plättchen (die aufgedruckte Zahl). Dazu kommen die Boni von Shrewsbury und Nottingham; ein Fehlbetrag zieht Punkte ab. Die Leiste läuft bei 100 wieder herum.',
      gain: 'Punkte kommen von umgedrehten Plättchen (die Zahl unten auf dem Plättchen, bei jeder Wertung, bei der es steht), von Verbindungen (die Verbindungssymbole der berührten Orte, 2 pro Händler) und von den Boni von Shrewsbury (4) und Nottingham (3).',
    },
    cards: {
      topic: 'die Karten',
      words: ['karte', 'karten', 'ortskarte', 'ortskarten', 'stadtkarte', 'industriekarte', 'industriekarten', 'doppelkarte', 'welche karte'],
      what: 'Jede Aktion wird mit einer abgeworfenen Karte bezahlt. Eine Ortskarte baut jede Industrie in der Stadt, die sie nennt, auch außerhalb deines Netzes; eine Industriekarte baut diese Industrie in einer Stadt deines Netzes, und überall, solange du nichts auf dem Plan hast. Spinnereien und Manufakturen teilen sich Doppelkarten. Für die anderen Aktionen taugt jede Karte.',
      whyNot: 'Eine Ortskarte baut nur in der Stadt, die sie nennt; eine Industriekarte nur ihre Industrie, und nur in einer Stadt deines Netzes; keine Ortskarte und kein Ortsjoker baut auf einer Hofbrauerei. Für Netzwerk, Entwickeln, Verkaufen, Kredit oder Passen taugt jede Karte: Wird die Aktion abgelehnt, liegt der Grund woanders.',
    },
    wild: {
      topic: 'die Joker',
      words: ['joker', 'jokerkarte', 'ortsjoker', 'industriejoker', 'wild', 'wildcard', 'jokerstapel'],
      what: 'Ein Ortsjoker gilt als jede Ortskarte, außer für die beiden Hofbrauereien; ein Industriejoker gilt als jede Industriekarte. Man bekommt sie nur durch Erkunden, beide auf einmal, und nie, wenn man schon einen hält. Abgeworfen kehren sie auf ihren Stapel zurück statt auf die Ablage.',
    },
    hand: {
      topic: 'Hand und Nachziehstapel',
      words: ['hand', 'meine hand', 'hande', 'nachziehstapel', 'ziehstapel', 'ziehen', 'nachziehen', 'ablage', 'abwerfen', 'auffullen', 'karte ziehen', 'acht karten', 'leerer stapel', 'handkarten'],
      what: 'Du hältst acht Karten. Jede Aktion wirft eine ab, und am Ende deines Zuges ziehst du vom Stapel auf acht nach. Ist der Stapel leer, schrumpfen die Hände von Runde zu Runde, und die Epoche endet, wenn alle Hände leer sind. Der Stapel hat 40 Karten zu zweit, 54 zu dritt und 64 zu viert, Joker nicht mitgezählt.',
    },
    players: {
      topic: 'die Spielerzahl',
      words: ['spieler', 'spielerzahl', 'anzahl spieler', 'zwei spieler', 'drei spieler', 'vier spieler', '2 spieler', '3 spieler', '4 spieler', 'solo', 'gegner', 'mitspieler', 'wie viele spieler'],
      what: 'Es spielen zwei bis vier. Die Zahl ändert den Stapel (40, 54 oder 64 Karten: mit weniger als 4 verlieren manche Städte ihre Karten), die offenen Händler (Warrington ab 3 Spielern, Nottingham zu viert) und die Länge der Epochen: 10 Runden zu zweit, 9 zu dritt, 8 zu viert. Städte ohne Karte lassen sich weiter mit Industriekarten oder Jokern bebauen.',
    },
    undo: {
      topic: 'einen Zug zurücknehmen',
      words: ['zurucknehmen', 'ruckgangig', 'zuruck', 'undo', 'fehler', 'verklickt', 'vertan', 'falscher zug', 'strg z'],
      what: 'Taste Z oder der Knopf Zurück nimmt deinen letzten Zug zurück, solange du noch am Zug bist: Ist ein anderer Spieler dran, bleibt der Zug stehen. Vor dem Bestätigen verwirft Escape einfach den vorbereiteten Zug.',
      whyNot: 'Zurücknehmen geht nur für deinen letzten Zug, und nur, solange du noch am Zug bist. Sobald ein anderer Spieler, Maschine oder Mensch, gespielt hat, steht der Zug.',
    },
    confirm: {
      topic: 'einen Zug bestätigen',
      words: ['bestatigen', 'bestatigung', 'bestatigt', 'absenden', 'eingabe', 'enter', 'bestatigen knopf', 'karte spielen', 'karte wahlen'],
      what: 'Ein Zug entsteht in drei Handgriffen: eine Handkarte, eine Aktion, dann ein Ziel auf der Karte. Die Notiz oben zeigt dann, was er kostet und woher Kohle, Eisen und Bier kommen. Gespielt wird erst mit Bestätigen (oder Enter); Escape verwirft ihn.',
    },
    prepare: {
      topic: 'einen Zug vorbereiten',
      words: ['vorbereiten', 'vorbereitet', 'vorbereitung', 'vorab', 'im voraus', 'warteschlange', 'ausser wenn', 'vorbereiteter zug'],
      what: 'Während die anderen am Zug sind, kannst du deinen Zug vorbereiten: Karte, Aktion, Ziel, dann „Vorbereiten“. Er läuft in deinem Zug von selbst, wenn er noch passt; sonst wird er verworfen, und der Tisch sagt dir, warum. Eine „außer wenn“-Klausel kann ihn vorab abbrechen, etwa wenn ein Rivale auf dem angepeilten Feld baut.',
    },
    ledger: {
      topic: 'das Register',
      words: ['register', 'protokoll', 'verlauf', 'logbuch', 'journal', 'fruhere zuge', 'letzter zug', 'letzte zuge', 'log'],
      what: 'Das Register (Taste L) hält jeden Zug der Partie fest, Runde für Runde und Spieler für Spieler, mit seinen Kosten. Filter zeigen nur deine Züge, die Wirtschaft oder das Netz, und jede Zeile lässt sich auf dem Plan noch einmal ansehen. Taste D zeigt den letzten Zug eines Spielers.',
    },
    notebook: {
      topic: 'das Notizbuch',
      words: ['notizbuch', 'notizen', 'notiz', 'notizblock', 'aufschreiben', 'schreiben', 'merkzettel', 'feder'],
      what: 'Das Notizbuch ist eine eigene Seite für die ganze Partie: Pläne, was man sich merken will, was ein Rivale vorzuhaben scheint. Es wird im Büro bei der Partie aufbewahrt, folgt dir auf ein anderes Gerät, und niemand sonst liest es. Es öffnet sich über den Federknopf bei den Werkzeugen.',
    },
    marketPanel: {
      topic: 'das Marktpanel',
      words: ['marktpanel', 'markt anzeigen', 'markt offnen', 'marktfenster', 'preistafel', 'marktanzeige'],
      what: 'Das Marktpanel (Taste M) zeigt beide Märkte: die übrigen Kohle- und Eisenwürfel und den Preis des nächsten. Kauft der vorbereitete Zug am Markt, zeigt es den Preis nach dem Kauf. Es klappt sich ein, wenn du es nicht brauchst.',
    },
    minimap: {
      topic: 'die Minikarte',
      words: ['minikarte', 'mini karte', 'kleine karte', 'ubersichtskarte', 'navigieren', 'ansicht verschieben', 'zoom', 'zoomen', 'hineinzoomen', 'herauszoomen'],
      what: 'Die Minikarte unten rechts zeigt den ganzen Plan und den Rahmen dessen, was du gerade ansiehst. Klicke oder ziehe darin, um die Ansicht zu verschieben; der Eckknopf oder die Einstellungen machen sie klein, mittel oder groß. Leere Städte sind dort graue Punkte; eine bebaute Stadt trägt die Form ihres Besitzers. Das Mausrad zoomt, und 0 zeigt den ganzen Plan.',
    },
    keys: {
      topic: 'die Tastenkürzel',
      words: ['tastenkurzel', 'kurzel', 'tastatur', 'taste', 'tasten', 'shortcut', 'shortcuts', 'hotkey', 'tastenbelegung'],
      what: 'Die wichtigsten: 1 bis 8 wählen eine Karte, Enter bestätigt, Escape bricht ab, Z nimmt deinen letzten Zug zurück, M öffnet den Markt, L das Register, P das Tableau, S die Einstellungen, H heftet die Hand an, F Vollbild, 0 zeigt den ganzen Plan, D den letzten Zug eines Spielers und ? die Regeln. Alles lässt sich in den Einstellungen, Abschnitt Tastenkürzel, ändern.',
    },
    settings: {
      topic: 'die Einstellungen',
      words: ['einstellung', 'einstellungen', 'optionen', 'option', 'sprache', 'anzeige', 'farbenblind', 'farbenblindheit', 'vollbild', 'ton', 'tone', 'sound', 'lautstarke', 'thema'],
      what: 'Die Einstellungen (Taste S) regeln, wie der Tisch auf diesem Gerät aussieht: Sprache, Kartenhintergrund, Plättchengrafik, Farbenblind-Modus, Minikarte, Leisten, Töne, Vollbild und Tastenkürzel. Alles wirkt sofort und ändert nichts an den Regeln.',
    },
    aid: {
      topic: 'die Bauhilfe',
      words: ['hilfe', 'hilfen', 'bauhilfe', 'anfangerhilfe', 'anfangermodus', 'anfanger', 'unterstutzung', 'neuling', 'einsteiger'],
      what: 'Die Bauhilfe ist eine Einstellung für Anfänger: Mit einer Karte in der Hand verblassen unspielbare Felder, und der Preis schlüsselt die am Markt gekaufte Kohle und das Eisen auf. Man aktiviert sie in den Einstellungen; an einem Online-Tisch stellt sie der Gastgeber für alle ein. Sie sagt nie, was zu spielen ist.',
    },
    machines: {
      topic: 'die Maschinen und ihre Figuren',
      words: ['maschine', 'maschinen', 'bot', 'bots', 'computer', 'ki', 'roboter', 'automat', 'watt', 'boulton', 'wedgwood', 'arkwright', 'figuren', 'charaktere', 'schwierigkeit', 'computergegner'],
      what: 'Vier Figuren besetzen die Plätze der Maschinen: Mr Boulton, der großzügig ausgibt und noch großzügiger verkauft; Mrs Wedgwood, geduldig mit ihren Töpfereien; Miss Arkwright, die schnell verkauft und ihre Schienen verdoppelt; und Mr Watt, der Experte, der immer mit voller Kraft spielt. Die ersten drei spielen auf deinem Niveau, schärfer, wenn du gewinnst, sanfter, wenn du verlierst. Alle folgen denselben Regeln wie du.',
    },
    overview: {
      topic: 'das Spiel in Kürze',
      words: ['brass', 'blackrail', 'birmingham brass', 'spiel', 'ziel', 'spielziel', 'prinzip', 'spielregeln', 'spielen', 'spielt', 'lernen', 'zusammenfassung', 'grundlagen'],
      what: 'Blackrail spielt Brass: Birmingham, in zwei Epochen: erst die Kanäle, dann die Eisenbahn. Du baust Industrien — Minen, Eisenhütten, Brauereien, Spinnereien, Manufakturen, Töpfereien —, verbindest sie mit Kanälen und dann mit Schienen und verkaufst deine Gewerbe an die Händler. Punkte kommen von umgedrehten Plättchen und Verbindungen, gezählt am Ende jeder Epoche, und wer die meisten hat, gewinnt.',
      how: 'In deinem Zug zwei Aktionen (in der allerersten Runde nur eine): Bauen, Netzwerk, Entwickeln, Verkaufen, Kredit, Erkunden oder Passen. Jede kostet eine Karte: Wähle sie aus der Hand, dann die Aktion, dann das Ziel auf der Karte, und bestätige. Der Kodex (Taste ?) enthält jede Regel, und hier kannst du mich nach jeder fragen.',
    },
    rules: {
      topic: 'der Regelkodex',
      words: ['regeln', 'regelbuch', 'kodex', 'anleitung', 'handbuch', 'spielanleitung', 'vollstandige regeln'],
      what: 'Der Regelkodex öffnet sich mit der Taste ?: Er enthält die vollständigen Regeln, Abschnitt für Abschnitt. Du kannst mir die Frage auch hier stellen, in deinen eigenen Worten.',
    },
  },
};
