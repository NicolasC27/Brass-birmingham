/* The townsfolk: seven people of the Midlands who are heard now and then in
   a town of the board, pleased or grumbling as the game goes, a bubble over
   the town saying what they said. Nothing here makes a sound: what stirred
   a town, and which line is said where, are plain functions of the game and
   of a chance passed in, so the choices can be held to account. sfx.ts says
   the lines; VoiceBubble shows them.

   The lines are English whatever the reader's language, and belong to the
   English Midlands: another board keeps its people quiet. */

import { TOWN_BY_ID, activeBoard, marketBuyPrice } from '@/game/data';
import type { Era, GameState, IndustryType } from '@/game/types';
import { nextOf } from './playlist';
import type { Chance } from './playlist';

/** how a line is said: pleased, grumbling, or neither */
export type Mood = 'glad' | 'grumble' | 'plain';

export interface Character {
  name: string;
  trade: string;
  /** the town they are heard in when nothing else calls them elsewhere */
  home: string;
}

/** the cast, each with a trade and a comic turn (the character sheet is in
 *  tools/assets/sfx/CHOIX.md) */
export const CAST = {
  /* an old collier come down from Wigan: moans about everything */
  ezra: { name: 'Ezra Platt', trade: 'collier', home: 'cannock' },
  /* a boatman on the Trent and Mersey: cheery, sweet on his horse Bess */
  barnaby: { name: 'Barnaby Tuck', trade: 'boatman', home: 'stone' },
  /* a mill girl at the Belper mills: the gossip */
  nellie: { name: 'Nellie Hartley', trade: 'mill girl', home: 'belper' },
  /* the landlady of the Swan: proud of her brew, and tasting it */
  hepzibah: { name: 'Mrs Blewitt', trade: 'landlady', home: 'burton' },
  /* the overseer of a button works: pompous */
  pomfrey: { name: 'Mr Pomfrey', trade: 'overseer', home: 'birmingham' },
  /* a potter's wife: dry, calls everyone duck */
  kezia: { name: 'Kezia Dunn', trade: 'potter’s wife', home: 'stoke' },
  /* a puddler at the iron works: deaf from the hammers, shouts */
  tom: { name: 'Tom Bellows', trade: 'puddler', home: 'dudley' },
} as const satisfies Record<string, Character>;
export type Who = keyof typeof CAST;

export interface Line {
  /** the recording, /sfx/<id> */
  id: string;
  who: Who;
  /** what is shown in the bubble: the line as said, without its stage directions */
  text: string;
  mood: Mood;
  /** a line about a trade (or, grumbling, about the price of coal or iron):
   *  said only where that trade is, or when that price has risen */
  about?: IndustryType;
  /** said in this era only */
  era?: Era;
}

const line = (id: string, who: Who, mood: Mood, text: string, more: { about?: IndustryType; era?: Era } = {}): Line => ({ id: `bark-${who}-${id}`, who, text, mood, ...more });

/** every line, as recorded (tools/assets/sfx/generate.py, VOICES) */
export const LINES: readonly Line[] = [
  line('dear', 'ezra', 'grumble', 'Coal’s gone dear again. Criminal, that is.', { about: 'coal' }),
  line('knees', 'ezra', 'grumble', 'Oh, me knees. Me poor knees.'),
  line('blowup', 'ezra', 'grumble', 'Railways. They’ll all blow up, you’ll see.', { era: 'rail' }),
  line('worse', 'ezra', 'glad', 'Well. Could be worse, I suppose.'),
  line('mud', 'ezra', 'plain', 'In my day we had no coal. We had mud.'),
  line('almost', 'ezra', 'glad', 'Good coal, that. Almost.', { about: 'coal' }),
  line('wages', 'barnaby', 'glad', 'Wages on Friday, lads!'),
  line('bess', 'barnaby', 'plain', 'Walk on, Bess, my beauty. Walk on.', { era: 'canal' }),
  line('lock', 'barnaby', 'grumble', 'Lock’s jammed again! Blast it!', { era: 'canal' }),
  line('load', 'barnaby', 'glad', 'Full load, and early too!', { era: 'canal' }),
  line('engines', 'barnaby', 'grumble', 'Them engines? Bess could beat ’em!', { era: 'rail' }),
  line('rope', 'barnaby', 'plain', 'Mind the rope there!', { era: 'canal' }),
  line('overseer', 'nellie', 'plain', 'Ooh, did you hear about the overseer?'),
  line('vicar', 'nellie', 'plain', 'Never! With the vicar’s wife?'),
  line('hands', 'nellie', 'glad', 'Mill’s taking on hands again!', { about: 'cotton' }),
  line('twelve', 'nellie', 'grumble', 'Twelve hours, and for what?'),
  line('ribbon', 'nellie', 'glad', 'New ribbon for Sunday!'),
  line('fluff', 'nellie', 'grumble', 'Me hair’s all cotton fluff again.', { about: 'cotton' }),
  line('finest', 'hepzibah', 'glad', 'Finest brew in the county, that is!', { about: 'brewery' }),
  line('pints', 'hepzibah', 'glad', 'Pints all round, my loves!'),
  line('watered', 'hepzibah', 'grumble', 'Who’s been watering me ale?', { about: 'brewery' }),
  line('testing', 'hepzibah', 'plain', 'I’m only… testing the barrel.', { about: 'brewery' }),
  line('soot', 'hepzibah', 'grumble', 'Soot on me washing again! I ask you!', { era: 'rail' }),
  line('time', 'pomfrey', 'plain', 'Time is money, gentlemen.'),
  line('london', 'pomfrey', 'glad', 'An order for London. Naturally.', { about: 'manufacturer' }),
  line('idle', 'pomfrey', 'grumble', 'Idleness? In MY workshop?'),
  line('iron', 'pomfrey', 'grumble', 'No iron to be had? Preposterous!', { about: 'iron' }),
  line('triumph', 'pomfrey', 'glad', 'Another triumph of British industry.'),
  line('kiln', 'kezia', 'glad', 'Kiln came out lovely, duck!', { about: 'pottery' }),
  line('bread', 'kezia', 'glad', 'Bread on the table tonight.'),
  line('price', 'kezia', 'grumble', 'Price of bread, honestly.'),
  line('coal', 'kezia', 'grumble', 'Not a lump of coal left in the town!', { about: 'coal' }),
  line('kettle', 'kezia', 'plain', 'Put the kettle on, duck.'),
  line('furnace', 'tom', 'glad', 'Furnace is roaring today!', { about: 'iron' }),
  line('what', 'tom', 'plain', 'What? Can’t hear you!'),
  line('dear', 'tom', 'grumble', 'Iron’s dear as silver now!', { about: 'iron' }),
  line('sweet', 'tom', 'glad', 'She runs sweet, this engine!', { era: 'rail' }),
  line('late', 'tom', 'grumble', 'Train’s late again! What?', { era: 'rail' }),
];

/* ---------------- what stirred a town ---------------- */

/** something happened in a town that its people have a word about */
export interface Stir {
  /** the town (null: the whole country, a voice is heard anywhere) */
  town: string | null;
  mood: Mood;
  about?: IndustryType;
  /** how much it deserves a word: a works paid off or coal bought dear
   *  (2) before a works merely built (1) */
  weight: number;
  /** when it happened (Date.now()) */
  at: number;
}

/** a stir is still worth a word this long after it (ms) */
export const STIR_FRESH_MS = 120_000;
/** a batch this large is a board read back or caught up, not moves played */
const CATCH_UP = 8;
/** from this price a cube bought at the market is dear: coal £4 of £1–£8,
 *  iron £3 of £1–£6 */
const DEAR = { coal: 4, iron: 3 } as const;

const townOfKey = (key: string): string => key.split(':')[0];

/** what the change from `a` to `b` stirred, and where: a works that paid
 *  off (its tile turned) pleases its town; coal or iron bought dear at the
 *  market, or the market emptied, sets the buyer's town grumbling; a works
 *  built pleases its town a little */
export function stirsOf(a: GameState | null, b: GameState | null, at: number): Stir[] {
  if (!a || !b || a.seed !== b.seed || (b.phase !== 'action' && b.phase !== 'scoring-canal')) return [];
  const last = a.ledger.length ? a.ledger[a.ledger.length - 1].id : -1;
  const fresh = b.ledger.filter((e) => e.id > last && e.player !== undefined);
  if (fresh.length > CATCH_UP) return [];
  const out: Stir[] = [];
  for (const [key, t] of Object.entries(b.tiles)) {
    if (t.flipped && !a.tiles[key]?.flipped) out.push({ town: townOfKey(key), mood: 'glad', about: t.industry, weight: 2, at });
  }
  /* the town of the move that bought: a build or a link of this batch */
  const buyer = [...fresh].reverse().find((e) => (e.verb === 'build' || e.verb === 'network') && e.region && TOWN_BY_ID[e.region])?.region ?? null;
  for (const res of ['coal', 'iron'] as const) {
    const before = a.market[res];
    const after = b.market[res];
    if (after >= before) continue;
    /* the price of the last cube taken */
    const paid = marketBuyPrice(res, after + 1);
    if (paid >= DEAR[res] || after === 0) out.push({ town: buyer, mood: 'grumble', about: res, weight: 2, at });
  }
  for (const e of fresh) {
    const ind = e.vars?.industry;
    if (e.verb === 'build' && e.region && TOWN_BY_ID[e.region] && typeof ind === 'string') out.push({ town: e.region, mood: 'glad', about: ind as IndustryType, weight: 1, at });
  }
  return out;
}

/** the stirs still worth a word at `now`, the most deserving first (and,
 *  among equals, the latest) */
export const freshStirs = (stirs: readonly Stir[], now: number): Stir[] =>
  stirs.filter((s) => now - s.at <= STIR_FRESH_MS).sort((x, y) => y.weight - x.weight || y.at - x.at);

/* ---------------- who says what, where ---------------- */

export interface Spoken {
  line: Line;
  town: string;
  /** the stir it answers, if any (spent once said) */
  stir: Stir | null;
}

/** the towns with a works built on them (farms left out: no one lives there) */
const builtTowns = (g: GameState, about?: IndustryType): string[] => {
  const towns = new Set<string>();
  for (const [key, t] of Object.entries(g.tiles)) {
    const id = townOfKey(key);
    if (TOWN_BY_ID[id] && !TOWN_BY_ID[id].farm && (!about || t.industry === about)) towns.add(id);
  }
  return [...towns].sort();
};

const pick = <T>(xs: readonly T[], chance: Chance): T => xs[Math.floor(Math.min(Math.max(chance(), 0), 0.999999) * xs.length)];

/** the voices speak on the English board only, while an era is played */
export const voicesHere = (g: GameState | null): boolean => !!g && g.phase === 'action' && activeBoard().id === 'midlands';

/** is the price of `res` risen enough for a grumble about it */
const dearNow = (g: GameState, res: 'coal' | 'iron'): boolean => marketBuyPrice(res, g.market[res]) >= DEAR[res];

/** the next line heard, and where. With a stir still fresh, the most
 *  deserving: a line of its mood (about its trade if one is recorded) in
 *  its town. Otherwise anyone, anywhere a works stands: pleased or grumbling
 *  or neither, a line about a trade only where that trade is built, a
 *  grumble about coal or iron only when it is dear; half the time in the
 *  speaker's own town. Never the line just heard. Null when no one speaks:
 *  another board, no era being played. */
export function pickVoice(g: GameState | null, stirs: readonly Stir[], last: string | null, chance: Chance): Spoken | null {
  if (!g || !voicesHere(g)) return null;
  const said = LINES.filter((l) => !l.era || l.era === g.era);
  const stir = stirs[0] ?? null;
  if (stir) {
    /* its own line, unless that was the last one heard: then any of its mood */
    const exact = said.filter((l) => l.mood === stir.mood && l.about === stir.about && l.id !== last);
    const open = exact.length ? exact : said.filter((l) => l.mood === stir.mood && !l.about);
    const town = stir.town ?? (builtTowns(g, stir.about)[0] ? pick(builtTowns(g, stir.about), chance) : null);
    if (open.length && town && TOWN_BY_ID[town]) return { line: nextOf(open, said.find((l) => l.id === last) ?? null, chance), town, stir };
  }
  const r = chance();
  const mood: Mood = r < 0.4 ? 'plain' : r < 0.7 ? 'glad' : 'grumble';
  const open = said.filter((l) => {
    if (l.mood !== mood) return false;
    if (!l.about) return true;
    if (l.mood === 'grumble' && (l.about === 'coal' || l.about === 'iron')) return dearNow(g, l.about);
    return builtTowns(g, l.about).length > 0;
  });
  if (!open.length) return null;
  const chosen = nextOf(open, said.find((l) => l.id === last) ?? null, chance);
  const home = CAST[chosen.who].home;
  const trade = chosen.about && !(chosen.mood === 'grumble' && (chosen.about === 'coal' || chosen.about === 'iron')) ? builtTowns(g, chosen.about) : [];
  const anywhere = builtTowns(g);
  const town = trade.length ? pick(trade, chance) : chance() < 0.5 || !anywhere.length ? home : pick(anywhere, chance);
  return TOWN_BY_ID[town] ? { line: chosen, town, stir: null } : null;
}

/** where a voice is heard, left to right: a town at the board's west edge
 *  a little to the left, at its east edge a little to the right */
export const panOf = (town: string, worldWidth: number): number => {
  const t = TOWN_BY_ID[town];
  return t ? Math.max(-1, Math.min(1, (t.x / worldWidth) * 2 - 1)) * 0.5 : 0;
};
