import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* Die Titelseite vor der Eröffnung der Linie: das Spiel in wenigen    */
/* Zeilen, die Warteliste und die Briefe, die das Kontor ihr schreibt. */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  ear: 'Vorpremiere',
  eyebrow: 'Bald im Bahnhof',
  headline: 'Baue die Midlands, Kanal um Kanal, Schiene um Schiene.',
  lede: 'Ein Wirtschafts-Strategiespiel für zwei bis vier, im Black Country von 1770 bis 1865. Erst die Kanäle, dann die Eisenbahn: errichte Spinnereien und Zechen, verkaufe an die Händler und halte den Maschinen stand — oder deinen Freunden.',
  trial: {
    title: 'Die Probefahrt',
    text: 'Bevor die Linie öffnet, probieren einige Reisende das Spiel als Erste. Hinterlasse deine Adresse, und wir schreiben dir, sobald dein Platz bereit ist.',
  },
  form: {
    label: 'Deine E-Mail-Adresse',
    placeholder: 'du@beispiel.de',
    submit: 'Platz reservieren',
    sending: 'Wird gesendet…',
    note: 'Ein Brief zur Bestätigung, dann einer, wenn die Probefahrt beginnt. Sonst nichts, und in jedem Brief ein Weg hinaus.',
    privacy: 'Was wir mit deiner Adresse tun',
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
  eras: {
    canal: 'Die Kanal-Ära',
    rail: 'Die Eisenbahn-Ära',
  },
  points: [
    { h: 'Zwei Ären', p: 'Erst die Kanäle, dann die Eisenbahn: Was zuerst gebaut wurde, weicht, und das Netz entscheidet alles.' },
    { h: 'Vier Maschinen', p: 'Boulton, Wedgwood, Arkwright und Watt spielen jeder ihr eigenes Spiel. Watt spielt immer auf Sieg.' },
    { h: 'Tische online', p: 'Spiele mit anderen, schnell oder gewertet, und lies jede Partie Zug um Zug nach.' },
  ],
  confirm: {
    eyebrow: 'Warteliste',
    working: 'Einen Moment…',
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
