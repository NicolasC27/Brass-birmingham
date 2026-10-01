import type { BotPersona, GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The post. When a game at home ends, one of the machines writes to   */
/* the player — the winner to crow, or the best-placed of the beaten   */
/* to grumble — three lines in its own voice, printed in the journal's */
/* courrier. The lines live in the dictionaries under                  */
/* platform.letters.<persona>.<won|lost>.<n>; the last few letters     */
/* are kept in this browser.                                           */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.letters.v1';
const KEPT = 5;
const VARIANTS = 2;

export interface Letter {
  id: string;
  at: number;
  persona: BotPersona;
  /** the machine won, or the player did */
  kind: 'won' | 'lost';
  variant: number;
  table: string;
  /** the player's points and the writer's */
  vp: number;
  theirs: number;
  /** the player's name, as the letter addresses it */
  me: string;
}

const readAll = (): Letter[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) ? (v as Letter[]) : [];
  } catch {
    return [];
  }
};

/** the letters received, the latest first */
export const listLetters = (): Letter[] => readAll().sort((a, b) => b.at - a.at);

/** the key of a letter's text */
export const letterKey = (l: Letter): string => `platform.letters.${l.persona}.${l.kind}.${l.variant}`;

/** a game at home is over: the machine that has something to say writes */
export function writeLetter(g: GameState, table: string): Letter | null {
  if (g.phase !== 'game-over' || g.abandoned) return null;
  const me = g.players.findIndex((p) => !p.isBot);
  if (me < 0) return null;
  const bots = g.players.map((p, i) => ({ p, i })).filter((x) => x.p.isBot && !x.p.resigned);
  if (!bots.length) return null;
  const best = bots.sort((a, b) => b.p.vp - a.p.vp)[0];
  const won = best.p.vp > g.players[me].vp;
  const letter: Letter = {
    id: `${table}:${g.seed}`,
    at: Date.now(),
    persona: best.p.persona,
    kind: won ? 'won' : 'lost',
    variant: g.seed % VARIANTS,
    table,
    vp: g.players[me].vp,
    theirs: best.p.vp,
    me: g.players[me].name,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([letter, ...readAll().filter((l) => l.id !== letter.id)].slice(0, KEPT)));
  } catch {
    /* non-fatal */
  }
  return letter;
}
