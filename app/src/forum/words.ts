/* ------------------------------------------------------------------ */
/* The doorman's list.                                                 */
/*                                                                     */
/* A post is read the way a reader would read it, not the way it was   */
/* typed: accents dropped, digits and signs standing for letters put   */
/* back, stuttered letters collapsed, so that "c0nnard", "connnard"    */
/* and "c.o.n.n.a.r.d" are the same word. Words are then matched       */
/* whole, never as parts of other words — an "assassin" or a           */
/* "Scunthorpe" walks in. The office and the page share this file; the */
/* page warns before sending, the office refuses whatever comes.       */
/* ------------------------------------------------------------------ */

/** signs a writer uses for letters */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '€': 'e', '!': 'i', '|': 'l', '+': 't' };

/** the text as it reads: lower, plain letters, at most two of a letter in a row */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457 8@$€!|+]/g, (ch) => LEET[ch] ?? ch)
    .replace(/(.)\1{2,}/g, '$1$1');
}
/** every run of a letter down to one: the form the list is kept in */
const squeeze = (s: string): string => s.replace(/(.)\1+/g, '$1');

/* the words themselves: insults and slurs aimed at a person, and what is
   said to hurt — not the swearing a game table hears every evening.
   Single words and short phrases; French and English, the club's tongues. */
const WORDS = [
  // français
  'connard',
  'connasse',
  'conasse',
  'encule',
  'enculer',
  'enculee',
  'salope',
  'salaud',
  'salopard',
  'pute',
  'putes',
  'fdp',
  'ntm',
  'niquer',
  'nique',
  'batard',
  'batards',
  'pd',
  'pede',
  'pedes',
  'tapette',
  'tafiole',
  'tarlouze',
  'gouine',
  'negro',
  'negre',
  'negresse',
  'bougnoule',
  'youpin',
  'bicot',
  'chintok',
  'niakoue',
  'crouille',
  'attarde',
  'trisomique',
  'mongolien',
  'enfoire',
  'trouduc',
  'suceur',
  'suceuse',
  'branleur',
  'branleuse',
  'bite',
  'couillon',
  // english
  'fuck',
  'fucking',
  'fucker',
  'fuckers',
  'motherfucker',
  'bitch',
  'bitches',
  'bastard',
  'asshole',
  'arsehole',
  'cunt',
  'dickhead',
  'prick',
  'twat',
  'wanker',
  'slut',
  'whore',
  'faggot',
  'fag',
  'dyke',
  'nigger',
  'nigga',
  'chink',
  'spic',
  'kike',
  'retard',
  'retarded',
  'paki',
  'gook',
  'tranny',
  'cocksucker',
  'wog',
  'coon',
  'kys',
];
const PHRASES = [
  'nique ta mere',
  'fils de pute',
  'ta gueule',
  'ferme ta gueule',
  'trou du cul',
  'va te faire foutre',
  'va crever',
  'sale arabe',
  'sale juif',
  'sale noir',
  'sale blanc',
  'sale race',
  'suck my dick',
  'kill yourself',
  'go die',
];

const LIST = new Set(WORDS.map(squeeze));
const PHRASE_LIST = PHRASES.map((p) => p.split(' ').map(squeeze));
/** the long ones, also looked for with the spaces and dots taken out */
const SPACED = WORDS.map(squeeze).filter((w) => w.length >= 6);

/** the first word the doorman stops, or null when the text may go in */
export function offends(text: string): string | null {
  const plain = normalise(text);
  const tokens = plain.split(/[^a-z]+/).filter(Boolean).map(squeeze);
  for (const tk of tokens) if (LIST.has(tk)) return tk;
  for (const phrase of PHRASE_LIST) {
    for (let i = 0; i + phrase.length <= tokens.length; i++) {
      let hit = true;
      for (let j = 0; j < phrase.length; j++) if (tokens[i + j] !== phrase[j]) hit = false;
      if (hit) return phrase.join(' ');
    }
  }
  /* letters spaced or dotted out, only for words long enough not to hide in others */
  const joined = squeeze(tokens.join(''));
  const spaced = tokens.length > 3 && tokens.filter((tk) => tk.length <= 2).length > tokens.length / 2;
  if (spaced) for (const w of SPACED) if (joined.includes(w)) return w;
  return null;
}
