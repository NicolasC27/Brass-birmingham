import { DEFAULT_BOARD } from '@/game/boards';
import { foldGame, pickPs } from '@/game/rivalry';
import type { PsKey } from '@/game/rivalry';
import type { BotPersona, GameState } from '@/game/types';
import { paper, writePaper } from './papers';
import { rivalsNow } from './rivals';

/* ------------------------------------------------------------------ */
/* The post. When a game at home ends, one of the machines writes to   */
/* the player — the winner to crow, or the best-placed of the beaten   */
/* to grumble — three lines in its own voice, printed in the journal's */
/* courrier. The lines live in the dictionaries under                  */
/* platform.letters.<persona>.<won|lost>.<n>; the last few letters     */
/* are one of the office's papers. The writer closes on a postscript   */
/* when the office has told what it remembers of the player: a first   */
/* game, a run of results, or the count between them.                  */
/* ------------------------------------------------------------------ */

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
  /** the postscript: the history between the writer and the player, this
   *  game counted in (the line under rivals.<persona>.ps.<key>) */
  ps?: { key: PsKey; vars: Record<string, number> };
}

/** the key of a letter's postscript, when it has one */
export const psKey = (l: Letter): string | null => (l.ps ? `rivals.${l.persona}.ps.${l.ps.key}` : null);

const readAll = (): Letter[] => {
  const v = paper<unknown>('letters', null);
  return Array.isArray(v) ? (v as Letter[]) : [];
};

/** the letters received, the latest first */
export const listLetters = (): Letter[] => readAll().sort((a, b) => b.at - a.at);

/** letters kept elsewhere, folded in: the latest few of both, by id */
export function mergeLetters(list: unknown[]): void {
  const have = readAll();
  const ids = new Set(have.map((l) => l.id));
  const fresh = list.filter((l): l is Letter => !!l && typeof l === 'object' && typeof (l as Letter).id === 'string' && typeof (l as Letter).at === 'number' && !ids.has((l as Letter).id));
  if (!fresh.length) return;
  writePaper('letters', [...have, ...fresh].sort((a, b) => b.at - a.at).slice(0, KEPT));
}

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
  /* the writer's memory of the player, as the office told it when the
     game was opened, with this game folded in. None heard, no postscript */
  const rivals = rivalsNow();
  if (rivals) {
    const had = rivals.find((r) => r.persona === best.p.persona) ?? null;
    const now = foldGame(had, best.p.persona, { code: table, at: letter.at, map: g.board ?? DEFAULT_BOARD, won: !won, vp: letter.vp, theirs: letter.theirs });
    letter.ps = pickPs(now);
  }
  writePaper('letters', [letter, ...readAll().filter((l) => l.id !== letter.id)].slice(0, KEPT));
  return letter;
}
