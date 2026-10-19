import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* Die Titelseite vor der Eröffnung der Linie: was man an einem Tisch  */
/* tut, auf dem Brett selbst gezeigt, die Warteliste zweimal, und die  */
/* Briefe, die das Kontor ihr schreibt.                                */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  motto: 'Kanäle, Kohle & Eisen — Journal der Midlands',
  hero: {
    eyebrow: 'Geschlossene Beta · Anmeldung offen',
    title: 'Baue die Midlands im Zeitalter der Kanäle. Baue sie neu für die Eisenbahn.',
    subhead: 'Anspruchsvolle Wirtschaftsstrategie für 2 bis 4 Spieler, im Browser. Bauen, verbinden, verkaufen — gegen deine Freunde oder gegen Mr Watt, der nichts verschenkt.',
    watt: 'Mr Watt spielt immer mit voller Kraft. Nimmst du an seinem Tisch Platz?',
    plate: 'Tafel I — die Kanal-Ära',
    alt: 'Das Blackrail-Brett in der Kanal-Ära: Städte der Midlands, Miniaturfabriken und Kanäle auf gemalter Landschaft',
  },
  form: {
    label: 'Deine E-Mail-Adresse',
    placeholder: 'du@beispiel.de',
    submit: 'Mein Ticket für die Probefahrt',
    sending: 'Wird gesendet…',
    note: 'Zwei Briefe, sonst nichts: die Bestätigung, dann der Start. Computer und Tablet.',
    privacy: 'Was wir mit deiner Adresse tun',
  },
  table: {
    plate: 'Tafel II — ein Tisch',
    title: 'Jeder Zug: zwei Karten, zwei Aktionen.',
    text: 'Bauen, verbinden, entwickeln, verkaufen, leihen, erkunden. Deine Karten nennen den Ort; alles andere entscheidest du.',
    alt: 'Eine laufende Partie: acht Handkarten, die sechs Aktionen, die Spieler und die Übersichtskarte',
    marks: [
      { h: 'Deine Hand', p: 'Städte und Industrien zum Ausspielen, sechs Aktionen dafür.' },
      { h: 'Deine Rivalen', p: 'Geld, Punkte und Einkommen aller, immer im Blick.' },
      { h: 'Die Übersicht', p: 'Das ganze Netz auf einen Blick: Nichts, was sich anbahnt, entgeht dir.' },
    ],
  },
  twist: {
    plate: 'Tafel III — die Wende',
    title: 'Ende der Kanal-Ära: Das erste Netz kommt auf den Schrott.',
    text: 'Kanäle und Industrien der ersten Stufe werden weggefegt. Die Eisenbahn beginnt auf geräumtem Feld: Was du vorbereitet hast, überlebt, der Rest geht in Rauch auf.',
    slider: 'Schieben, um von den Kanälen zur Eisenbahn zu wechseln',
    canalCaption: 'Die Kanal-Ära',
    railLabel: 'Die Eisenbahn-Ära',
    canalAlt: 'Das Brett in der Kanal-Ära: ein Netz farbiger Kanäle verbindet die Städte',
    ceremonyAlt: 'Die Wertung am Ende der Ära: „Und so weicht das Wasser dem Dampf…“, die Punkte jedes Spielers',
    ceremonyCaption: 'Die Wertung der Kanal-Ära',
    railAlt: 'Das Brett in der Eisenbahn-Ära: Bahnlinien verbinden die Städte',
    railCaption: 'Die Eisenbahn-Ära: das Feld geräumt, das Rennen beginnt von vorn',
  },
  economy: {
    plate: 'Tafel IV — die Geschäfte',
    title: 'Eine echte Wirtschaft, keine Kulisse.',
    points: [
      { h: 'Echte Städte', p: 'Stoke, Dudley, Coventry, Birmingham: errichte Zechen, Eisenhütten, Spinnereien, Manufakturen, Töpfereien und Brauereien.' },
      { h: 'Märkte, die sich bewegen', p: 'Kohle und Eisen werden auf gemeinsamen Märkten gehandelt: Jeder Kauf treibt den Preis für deine Rivalen.' },
      { h: 'Händler zu erobern', p: 'Baumwolle, Waren und Keramik gehen nach Warrington, Oxford, Gloucester, Nottingham oder Shrewsbury.' },
      { h: 'Plättchen, die sich wenden', p: 'Eine Industrie, die gedient hat, wird umgedreht: Sie bringt Einkommen und Siegpunkte.' },
    ],
    stokeAlt: 'Nahaufnahme: die Töpferei von Stoke-on-Trent und der Händler von Warrington',
  },
  machines: {
    plate: 'Tafel V — die Maschinen',
    title: 'Vier mechanische Rivalen. Einer von ihnen lässt dir nichts.',
    text: 'Mr Boulton, Mrs Wedgwood, Miss Arkwright und Mr Watt haben jeder ihren eigenen Charakter. Hinter ihnen berechnet eine echte Such-Intelligenz jeden Zug — und Mr Watt spielt immer mit voller Kraft.',
    portrait: 'Gemaltes Porträt von {name}',
    cta: 'Tritt in der Probefahrt gegen Mr Watt an',
    watt: 'immer mit voller Kraft',
  },
  line: {
    title: 'Die Partie ist vorbei; die Linie fährt weiter.',
    points: [
      { h: 'Schnell oder gewertet', p: 'Eine Rangliste jede Saison, Gesellschaften zum Beitreten, Freunde zum Einladen.' },
      { h: 'Die Wochen-Herausforderung', p: 'Dieselbe Verteilung für alle, harte Bedingungen, und Mr Watt immer am Tisch.' },
      { h: 'Der Richter', p: 'Spiele jede Partie Zug um Zug nach; der Richter zeigt dir, wo sie kippte.' },
      { h: 'Post von den Maschinen', p: 'Nach der Partie schreiben dir deine mechanischen Gegner.' },
    ],
  },
  levels: {
    title: 'Noch nie ein Spiel dieses Kalibers gespielt?',
    text: 'Der Abendkurs bringt dir die Regeln bei, das Glossar begleitet dich überall, und deine erste Partie ist geführt. Erfahrene behalten den ganzen Nebel des Tisches: keine Hilfe, die schummelt.',
  },
  faq: {
    title: 'Fragen am Schalter',
    items: [
      { q: 'Worauf spielt man?', a: 'Im Browser, auf Computer und Tablet. Nicht auf dem Handy.' },
      { q: 'Brauche ich Freunde zum Spielen?', a: 'Nein. Spiele gegen die vier Maschinen oder online, schnell oder gewertet.' },
      { q: 'Ist es für Einsteiger?', a: 'Ja, mit dem Abendkurs und einer geführten ersten Partie. Aber es ist ein anspruchsvolles Strategiespiel, mit Absicht.' },
      { q: 'Wie viele Briefe bekomme ich?', a: 'Zwei: einen zur Bestätigung deiner Adresse, einen, wenn die Probefahrt beginnt.' },
      { q: 'Wann, und zu welchem Preis?', a: 'Weder Datum noch Preis stehen fest. Wer auf der Liste steht, erfährt es zuerst.' },
    ],
  },
  bar: 'Mein Ticket',
  final: {
    title: 'Der erste Zug fährt bald. Sichere dir deinen Platz.',
  },
  discord: {
    join: 'Dem Discord beitreten',
    wait: 'Während du wartest, sprich mit den anderen Reisenden über Kanäle und Schienen.',
    seat: 'Der Bahnsteig ist auf Discord: Neuigkeiten zur Probefahrt, die ersten Spieler und das Team bei der Arbeit.',
  },
  sent: {
    title: 'Ein Brief ist unterwegs',
    text: 'Öffne ihn und folge dem Link, um deinen Platz zu bestätigen. Nichts angekommen? Sieh im Spam-Ordner nach.',
    again: 'Eine andere Adresse angeben',
  },
  errors: {
    email: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    busy: 'Zu viele Versuche von hier. Versuche es in ein paar Minuten wieder.',
    down: 'Das Kontor antwortet gerade nicht. Versuche es gleich noch einmal.',
  },
  confirm: {
    eyebrow: 'Warteliste',
    working: 'Einen Moment…',
    badTitle: 'Dieser Link funktioniert nicht mehr',
    title: 'Dein Platz ist reserviert',
    text: 'Danke. Wir schreiben an diese Adresse, sobald die Probefahrt beginnt.',
    bad: 'Dieser Link funktioniert nicht mehr: Er wurde vielleicht schon benutzt, oder die Adresse wurde nach einer Woche ohne Antwort gelöscht.',
  },
  leave: {
    title: 'Die Warteliste verlassen',
    text: 'Deine Adresse wird gelöscht, und wir schreiben dir nicht mehr.',
    button: 'Mich von der Liste nehmen',
    done: 'Erledigt: Deine Adresse ist gelöscht.',
    bad: 'Dieser Link funktioniert nicht mehr: Die Adresse wurde wohl schon gelöscht.',
  },
  back: 'Zurück zur Vorpremiere',
  letter: {
    confirmSubject: 'Blackrail — bestätige deinen Platz',
    confirmText: 'Hallo,\n\ndiese Adresse wurde auf der Warteliste von Blackrail hinterlassen. Folge diesem Link, um deinen Platz zu bestätigen:\n\n{link}\n\nWarst du es nicht, ignoriere diesen Brief: Die Adresse wird in einer Woche gelöscht.\n\n— Das Telegrafenamt von Blackrail',
    footer: 'Du erhältst diesen Brief, weil du dich auf der Warteliste von Blackrail eingetragen hast.\nUm keine mehr zu erhalten: {link}',
  },
};

export default landing;
