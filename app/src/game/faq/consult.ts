/* ------------------------------------------------------------------ */
/* The guide's reading desk: a question comes in as the reader typed   */
/* it — accents or none, words run together or split apart, spelt by   */
/* ear — and leaves as the notion it points at, told the way it was    */
/* asked. Four passes, like a proof through the press:                 */
/*                                                                     */
/*   1. fold: lower case, no accents, the reader's shorthand set right; */
/*   2. mend: a word the case does not know is read as the nearest one  */
/*      it does — by sound, then by one or two slips of the pen — and a */
/*      word split or run together is joined or parted;                 */
/*   3. weigh: every notion scores on the longest of its phrases the    */
/*      question carries, the written answers of faq.ts beside them;    */
/*   4. tell: the notion's own telling for how the question was put —   */
/*      what, how, how much, what for, why not.                         */
/*                                                                     */
/* Nothing is generated: every answer was written and checked. When no */
/* notion is close, the desk offers the nearest two or three by name.  */
/* ------------------------------------------------------------------ */

import type { Lang } from '@/i18n';
import { faqFor, plain, rulesMatch } from '../faq';
import type { FaqEntry, Passage } from '../faq';
import { FAQ_NOTION, NOTION_IDS, PULL } from './notions';
import type { Asked, NotionId, Tongue } from './notions';
import { FR } from './fr';
import { EN } from './en';
import { ES } from './es';
import { DE } from './de';

const TONGUES: Record<Lang, Tongue> = { fr: FR, en: EN, es: ES, de: DE };

/** the tongue's case, whole */
export const tongueOf = (lang: Lang): Tongue => TONGUES[lang] ?? EN;

/* ------------------------------- fold -------------------------------- */

/** lower case, no accents, apostrophes and hyphens as spaces */
export const fold = (s: string): string =>
  plain(
    s
      .replace(/ß/g, 'ss')
      .replace(/[œŒ]/g, 'oe')
      .replace(/[æÆ]/g, 'ae')
      .replace(/[’'`´‐-―-]/g, ' '),
  );

/** a word as it sounds, near enough for French spelt by ear and the
 *  commonest slips of the other three: "koi" is "quoi", "charbont" is
 *  "charbon", "bierre" is "biere", "minne" is "mine" */
export const sound = (w: string): string => {
  let s = w
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'k')
    .replace(/q/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/c(?=[aou])/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/ch/g, 'x')
    .replace(/g(?=[ei])/g, 'j')
    .replace(/h/g, '')
    .replace(/y/g, 'i')
    .replace(/eau/g, 'o')
    .replace(/au/g, 'o')
    .replace(/[ae]i/g, 'e')
    .replace(/w/g, 'v')
    .replace(/(.)\1+/g, '$1');
  /* the silent tail of a French word */
  s = s.replace(/(ent|es|ez|er|et)$/, 'e').replace(/[sxtdzp]$/, '');
  s = s.replace(/e$/, '');
  s = s.replace(/[sxtdz]$/, '');
  return s.length >= 2 ? s : w;
};

/** Damerau–Levenshtein (adjacent swaps count one), given up past `max` */
export function slips(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i += 1) {
    const cur: number[] = [i];
    let low = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

/** a word without its inflection, in the four tongues and near enough
 *  for all of them: "construit" and "construire" share "constru(i)",
 *  "selling" and "sells" share "sell" */
export const root = (w: string): string => {
  let r = w.length > 4 ? w.replace(/[sx]$/, '') : w;
  for (const end of ['issent', 'aient', 'ement', 'ations', 'ation', 'tion', 'ions', 'ings', 'ing', 'ent', 'ons', 'ait', 'ais', 'ant', 'ees', 'ern', 'ee', 'ez', 'er', 'ir', 're', 'it', 'is', 'es', 'ed', 'en', 'e', 'o', 'a']) {
    if (r.endsWith(end) && r.length - end.length >= 4) {
      r = r.slice(0, -end.length);
      break;
    }
  }
  return r;
};

/** two words are one when they share their root, or when one root runs
 *  one letter past the other: never "charbon" for "charbonnage" */
export const sameWord = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  const x = root(a);
  const y = root(b);
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.length - short.length <= 1 && long.startsWith(short);
};

/** the rows of the keyboards the readers type on, qwerty and azerty */
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'azertyuiop', 'qsdfghjklm', 'wxcvbn', 'qwertzuiop', 'yxcvbnm'];

/** two letters side by side on a keyboard row */
const beside = (a: string, b: string): boolean => ROWS.some((r) => Math.abs(r.indexOf(a) - r.indexOf(b)) === 1 && r.includes(a) && r.includes(b));

/** how many slips a word of this length may carry and still be itself */
const slack = (len: number): number => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

/* ------------------------------ the case ----------------------------- */

interface Phrase {
  toks: string[];
  notion: NotionId;
  /** the written answer this phrase belongs to, when it is one of faq.ts */
  entry?: FaqEntry;
}

interface Case {
  tongue: Tongue;
  stop: Set<string>;
  /** every word a notion or a written answer is found by */
  content: string[];
  contentSet: Set<string>;
  /** every word the desk knows, stop words and cues included */
  known: Set<string>;
  /** the words a notion is found by on their own */
  lone: Set<string>;
  /** the known words by how they sound */
  bySound: Map<string, string[]>;
  phrases: Phrase[];
  cues: [Exclude<Asked, 'what'>, string[][]][];
}

const cases = new Map<Lang, Case>();

const words = (s: string): string[] => fold(s).split(' ').filter(Boolean);

function caseOf(lang: Lang): Case {
  const had = cases.get(lang);
  if (had) return had;
  const tongue = tongueOf(lang);
  const stop = new Set(tongue.stop.flatMap(words));
  const toks = (s: string) => words(s).filter((w) => !stop.has(w));
  /* the words of asking are not words of a notion: "cout canal" is the
     canal, asked about its price */
  const cueWords = new Set((['whyNot', 'gain', 'cost', 'how'] as const).flatMap((k) => tongue.cues[k].map(words).filter((w) => w.length === 1).flat()));
  const phrases: Phrase[] = [];
  for (const id of NOTION_IDS) {
    for (const w of tongue.notions[id].words) {
      const t = toks(w);
      if (t.length) phrases.push({ toks: t, notion: id });
    }
  }
  /* the written answers of faq.ts, in the tongues that have their own:
     a phrase of theirs must carry two words to stand against a notion */
  if (lang === 'fr' || lang === 'en') {
    for (const entry of faqFor(lang)) {
      const notion = FAQ_NOTION[entry.id];
      if (!notion) continue;
      for (const w of entry.words) {
        const t = toks(w).filter((x) => !cueWords.has(x));
        if (t.length >= 2) phrases.push({ toks: t, notion, entry });
      }
    }
  }
  const cues: Case['cues'] = (['whyNot', 'gain', 'cost', 'how'] as const).map((k) => [k, tongue.cues[k].map(words)]);
  const contentSet = new Set(phrases.flatMap((p) => p.toks));
  const known = new Set([...contentSet, ...stop, ...cues.flatMap(([, list]) => list.flat()), ...tongue.self.flatMap(words), ...tongue.define.flatMap(words)]);
  const bySound = new Map<string, string[]>();
  for (const w of known) {
    if (w.length < 2) continue;
    const k = sound(w);
    bySound.set(k, [...(bySound.get(k) ?? []), w]);
  }
  const lone = new Set(phrases.filter((p) => !p.entry && p.toks.length === 1).map((p) => p.toks[0]));
  const made: Case = { tongue, stop, content: [...contentSet], contentSet, known, lone, bySound, phrases, cues };
  cases.set(lang, made);
  return made;
}

/* -------------------------------- mend ------------------------------- */

/** the known words that sound like this one — only when the sound is long
 *  enough to tell words apart: "vi" would be "vient" and "vide" at once */
function heardAs(c: Case, w: string): string[] {
  const s = sound(w);
  /* and only a word near it on the page too: "monde" is not "monnaie" */
  return s.length >= 3 ? (c.bySound.get(s) ?? []).filter((k) => slips(w, k, 2) <= 2) : [];
}

/** the known words a stray word may stand for, nearest first */
function nearest(c: Case, w: string): string[] {
  if (w.length < 2 || /^\d+$/.test(w)) return [];
  const heard = heardAs(c, w);
  if (heard.length) return heard;
  if (w.length < 3) return [];
  let best = Infinity;
  let out: string[] = [];
  for (const k of c.known) {
    if (k.length < 4) continue;
    const max = slack(Math.max(k.length, w.length));
    const d = slips(w, k, max);
    if (d > max) continue;
    if (d < best) {
      best = d;
      out = [k];
    } else if (d === best) out.push(k);
  }
  if (out.length > 1) {
    /* a tie is broken by the keyboard: "mamches" is "manches", m beside n */
    const near = out.map((k) => ({ k, n: k.length === w.length ? [...k].filter((ch, i) => ch !== w[i] && beside(ch, w[i])).length : 0 }));
    const most = Math.max(...near.map((x) => x.n));
    out = near.filter((x) => x.n === most).map((x) => x.k);
  }
  if (out.length) return out;
  /* one slip in the sound of it: "charbonn" → "xarbon" is "charbon" */
  const s = sound(w);
  if (s.length >= 5) {
    for (const [k, list] of c.bySound) if (k.length >= 5 && slips(s, k, 1) <= 1) out.push(...list);
  }
  return out;
}

/** does a word stand for a known one, as written or near enough */
const knows = (c: Case, w: string): boolean => c.known.has(w) || heardAs(c, w).length > 0;

/** a mended word, and which word of the question it was read from */
interface Mended {
  w: string;
  at: number;
}

/** the question's words once mended: every word as typed, and beside it
 *  the known word it stands for, the halves of two words run together,
 *  the whole of a word split in two */
function mendGroups(question: string, lang: Lang): Mended[] {
  const c = caseOf(lang);
  const alias = c.tongue.alias;
  const raw = words(question).flatMap((w) => (w in alias ? words(alias[w]) : [w]));
  /* "ça marche" is how French asks how a thing works, not the market */
  if (lang === 'fr') {
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] !== 'marche') continue;
      const before = raw[i - 1];
      const after = raw[i + 1];
      if (before === 'ca' || before === 'sa' || before === 'cela' || before === 'comment' || after === 'pas' || after === 'comment' || after === 'bien') raw[i] = 'fonctionne';
    }
  }
  const out: Mended[] = [];
  const add = (w: string, at: number) => {
    if (!out.some((m) => m.w === w && m.at === at)) out.push({ w, at });
  };
  raw.forEach((w, at) => {
    if (c.known.has(w)) {
      add(w, at);
      return;
    }
    /* a word that sounds exactly like a known one is that word, and only
       that: "marchants" is "marchands", not a form of "marche" */
    const heard = heardAs(c, w);
    if (heard.length) {
      heard.forEach((k) => add(k, at));
      return;
    }
    add(w, at);
    const near = nearest(c, w);
    if (near.length) {
      near.forEach((k) => add(k, at));
      return;
    }
    /* two words run together: "lesmines", "cestquoi", "koisert" */
    if (w.length < 5) return;
    for (let i = 1; i < w.length; i += 1) {
      const a = w.slice(0, i);
      const b = w.slice(i);
      if (!(knows(c, a) || (a.length === 1 && c.stop.has(a)))) continue;
      if (!knows(c, b)) continue;
      for (const part of [a, b]) {
        if (c.known.has(part)) add(part, at);
        else heardAs(c, part).forEach((k) => add(k, at));
      }
      break;
    }
  });
  /* one word split in two: "char bon", "sur construire" */
  for (let i = 0; i + 1 < raw.length; i += 1) {
    /* never two small words of the sentence: "j'ai de" is not "aide" */
    if (c.stop.has(raw[i]) && c.stop.has(raw[i + 1])) continue;
    const whole = raw[i] + raw[i + 1];
    if (c.contentSet.has(whole)) add(whole, i);
    else if (whole.length >= 6) heardAs(c, whole).filter((k) => c.contentSet.has(k)).forEach((k) => add(k, i));
  }
  return out;
}

/** the question's words once mended, each once */
export const mendWords = (question: string, lang: Lang): string[] => [...new Set(mendGroups(question, lang).map((m) => m.w))];

/** the question with every stray word read as the one it stands for:
 *  the shape the table's own questions are matched in */
export const mend = (question: string, lang: Lang): string => mendWords(question, lang).join(' ');

/* ------------------------------- weigh ------------------------------- */

/** a word without its plural: "canaux" is "canal", "mines" is "mine" */
const single = (w: string): string => (w.length > 3 ? w.replace(/aux$/, 'al').replace(/[sx]$/, '') : w);

/** does a word of the question stand for this word of a phrase: itself,
 *  its plural, or a word of the same root — unless both are words a notion
 *  is found by on their own, which are two words, not one: "mercaderes"
 *  never reads as "mercado" */
const reads = (c: Case, q: string, k: string): boolean => q === k || single(q) === single(k) || (!(c.lone.has(q) && c.lone.has(k)) && sameWord(q, k));

/** how the question is put */
export function askedOf(question: string, lang: Lang): Asked {
  const c = caseOf(lang);
  const all = new Set(mendWords(question, lang));
  for (const [kind, list] of c.cues) if (list.some((cue) => cue.every((w) => all.has(w)))) return kind;
  return 'what';
}

interface Weighed {
  notion: NotionId;
  /** how sure the match is: the better of the notion's own phrases and
   *  the written answers filed under it */
  score: number;
  /** the notion's own phrases alone */
  own: number;
  /** the written answer with the most of the question, and how much */
  entry?: FaqEntry;
  entryScore: number;
}

/** every notion the question touches, the surest first */
function weigh(question: string, lang: Lang): Weighed[] {
  const c = caseOf(lang);
  const groups = mendGroups(question, lang).filter((m) => !c.stop.has(m.w));
  const asked = [...new Set(groups.map((m) => m.w))];
  if (!asked.length) return [];
  /* the word that tells how the question is put says less about what it
     is about: in "how to win points", "win" asks, "points" is the matter */
  const how = askedOf(question, lang);
  const cue = new Set(how === 'what' ? [] : c.cues.find(([k]) => k === how)![1].filter((w) => w.length === 1).flat());
  const weight = (toks: string[]) => toks.reduce((a, k) => a + (cue.has(k) ? 0.5 : 1), 0);
  const by = new Map<NotionId, { own: number; best: number; covered: Set<number>; entry?: FaqEntry; entryScore: number }>();
  for (const p of c.phrases) {
    if (!p.toks.every((k) => asked.some((q) => reads(c, q, k)))) continue;
    const row = by.get(p.notion) ?? { own: 0, best: 0, covered: new Set<number>(), entryScore: 0 };
    if (p.entry) {
      if (weight(p.toks) > row.entryScore) {
        row.entryScore = weight(p.toks);
        row.entry = p.entry;
      }
    } else {
      row.own = Math.max(row.own, weight(p.toks) + (PULL[p.notion] ?? 1) - 1);
      row.best = Math.max(row.best, p.toks.length);
      for (const k of p.toks) for (const m of groups) if (reads(c, m.w, k)) row.covered.add(m.at);
    }
    by.set(p.notion, row);
  }
  const rank = (id: NotionId) => NOTION_IDS.indexOf(id);
  return [...by.entries()]
    .map(([notion, r]) => {
      /* a word of the question its best phrase left out, caught by another
         phrase of the same notion, firms it up a little */
      const own = r.own > 0 ? r.own + Math.min(0.3, Math.max(0, r.covered.size - r.best) * 0.1) : 0;
      /* a written answer stands behind its notion; it lifts it above
         another only when it carries clearly more of the question */
      return { notion, own, entry: r.entry, entryScore: r.entryScore, score: Math.max(own, r.entryScore - 0.4) };
    })
    .sort((a, b) => b.score - a.score || b.own - a.own || rank(a.notion) - rank(b.notion));
}

/* -------------------------------- tell ------------------------------- */

export interface NearNotion {
  id: NotionId;
  topic: string;
}

export interface Consulted {
  /** what answered: a notion, one of the written answers, the codex, or
   *  nothing close — then `near` names what might have been meant */
  kind: 'notion' | 'entry' | 'passage' | 'near';
  notion: NotionId | null;
  /** how the question was put */
  asked: Asked;
  answer: string;
  near: NearNotion[];
}

/** a notion's telling for the way it was asked, its plain one otherwise */
export function tell(id: NotionId, lang: Lang, asked: Asked = 'what'): string {
  const n = tongueOf(lang).notions[id];
  return (asked !== 'what' && n[asked]) || n.what;
}

/** the notion's name, as offered under "did you mean" */
export const topicOf = (id: NotionId, lang: Lang): string => tongueOf(lang).notions[id].topic;

/** a notion taken up from the ones offered, as the reader's own line: its
 *  name, a capital at its head */
export const askedAs = (n: NearNotion): string => n.topic.charAt(0).toLocaleUpperCase() + n.topic.slice(1);

/** the notions nearest a question nothing matched: the closest spelling
 *  of any of its words to any word a notion is found by */
function nearTo(question: string, lang: Lang): NearNotion[] {
  const c = caseOf(lang);
  const asked = mendWords(question, lang).filter((w) => w.length >= 3 && !c.stop.has(w));
  const scored = NOTION_IDS.map((id) => {
    let best = 0;
    for (const p of c.phrases) {
      if (p.notion !== id || p.entry) continue;
      for (const k of p.toks) {
        for (const q of asked) {
          const len = Math.max(q.length, k.length);
          const d = slips(q, k, len);
          best = Math.max(best, 1 - d / len);
        }
      }
    }
    return { id, best };
  })
    .filter((x) => x.best >= 0.5)
    .sort((a, b) => b.best - a.best || NOTION_IDS.indexOf(a.id) - NOTION_IDS.indexOf(b.id))
    .slice(0, 3)
    .map((x) => x.id);
  /* nothing near at all: the three a newcomer asks about first */
  const fill: NotionId[] = ['build', 'sell', 'coalMine', 'beer', 'network'];
  for (const id of fill) if (scored.length < 3 && !scored.includes(id)) scored.push(id);
  return scored.map((id) => ({ id, topic: topicOf(id, lang) }));
}

/** Whether a question the table could answer from the position is rather
 *  a question of the rules. The table's phrases are short and lose their
 *  small words on the way ("j'ai de la bière" keeps only "bière"), so they
 *  catch more than they mean. The rules take the question back when it
 *  names a notion the table's phrase does not reach ("où est le charbon"
 *  does not reach the mine in "une mine de charbon"), or when it asks what
 *  a thing is without speaking of the reader's own seat ("c'est quoi la
 *  bière", not "c'est quoi mon revenu"). */
export function asksTheRules(question: string, lang: Lang, phrase: string): boolean {
  const c = caseOf(lang);
  const held = words(phrase);
  const cueWords = new Set(c.cues.flatMap(([, list]) => list.filter((w) => w.length === 1).flat()));
  const byAt = new Map<number, string[]>();
  for (const m of mendGroups(question, lang)) byAt.set(m.at, [...(byAt.get(m.at) ?? []), m.w]);
  for (const read of byAt.values()) {
    if (read.some((w) => c.stop.has(w) || cueWords.has(w) || w.length < 3)) continue;
    if (read.some((w) => held.some((k) => w === k || single(w) === single(k) || sameWord(w, k)))) continue;
    if (read.some((w) => c.contentSet.has(w))) return true;
  }
  const said = new Set(mendWords(question, lang));
  if (c.tongue.self.flatMap(words).some((w) => said.has(w))) return false;
  /* a phrase down to one word says nothing of the seat: "le charbon"; and
     a word that asks what a thing is counts only when the table's phrase
     does not carry it itself, as "what now" does */
  return held.filter((w) => w.length >= 3).length < 2 || c.tongue.define.flatMap(words).some((w) => said.has(w) && !held.includes(w));
}

/** the closest notion of the question in any tongue but its own, for a
 *  reader who writes in one tongue and reads the table in another */
function elsewhere(question: string, lang: Lang): Weighed | null {
  /* a question that carries words of its own tongue's case was asked in it */
  const c = caseOf(lang);
  if (mendWords(question, lang).some((w) => c.contentSet.has(w))) return null;
  for (const other of Object.keys(TONGUES) as Lang[]) {
    if (other === lang) continue;
    const top = weigh(question, other).find((w) => w.own >= 1);
    if (top) return { ...top, entry: undefined, entryScore: 0, score: top.own };
  }
  return null;
}

/** a question to the guide, answered from what it has written: the
 *  notion it points at, told as it was asked; a written answer when one
 *  carries more of the question; the rules codex after that; and when
 *  nothing is close, the notions it might have meant */
export function consult(question: string, lang: Lang, passages: Passage[] = []): Consulted {
  const asked = askedOf(question, lang);
  const found = weigh(question, lang);
  const notions = tongueOf(lang).notions;
  let top: Weighed | null = found[0] ?? elsewhere(question, lang);
  if (top) {
    /* a notion that cannot say why not hands over to a close runner-up
       that can: "why can't I build a mine" is about building */
    if (asked === 'whyNot' && !notions[top.notion].whyNot && top.own > 0) {
      const lead = top.score;
      const close = found.slice(1).find((w) => w.own > 0 && w.own >= lead - 0.35 && !!notions[w.notion].whyNot);
      if (close) top = close;
    }
    /* the written answer speaks when it carried more of the question than
       the notion's own words did — by a clear margin when the notion has a
       telling of its own for the way the question was put */
    const typed = asked !== 'what' && !!notions[top.notion][asked];
    if (top.entry && top.entryScore > top.own + (typed ? 0.6 : 0)) {
      return { kind: 'entry', notion: top.notion, asked, answer: top.entry.answer, near: [] };
    }
    return { kind: 'notion', notion: top.notion, asked, answer: tell(top.notion, lang, asked), near: [] };
  }
  const passage = passages.length ? rulesMatch(mend(question, lang), passages) : null;
  if (passage) return { kind: 'passage', notion: null, asked, answer: passage.title ? `${passage.title} — ${passage.body}` : passage.body, near: [] };
  return { kind: 'near', notion: null, asked, answer: tongueOf(lang).near, near: nearTo(question, lang) };
}
