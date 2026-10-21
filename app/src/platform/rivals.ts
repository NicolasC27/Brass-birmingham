import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_BOARD } from '@/game/boards';
import { RIVAL_KEYS, chooseRival, pickWord } from '@/game/rivalry';
import type { RivalKey, RivalWord, Rivalry } from '@/game/rivalry';
import type { BotPersona, GameState } from '@/game/types';
import { onlineWire } from '@/online/net';
import { paper, writePaper } from './papers';

/* ------------------------------------------------------------------ */
/* The rivalries, as this browser hears them: the office counts what   */
/* each character remembers of the account's games at home, and the   */
/* page asks for it as a game at home is opened or a portrait is hung. */
/*                                                                     */
/* What the characters said is one of the papers: the last word each   */
/* said to the account, so it never says the same twice running, and   */
/* the games it has spoken at, so a table read again is not greeted    */
/* twice.                                                              */
/* ------------------------------------------------------------------ */

/** the games a word is remembered at */
const SPOKEN_KEPT = 30;

interface Said {
  /** the last word each character said to the account */
  said: Partial<Record<BotPersona, RivalKey>>;
  /** the games at home a word was said at, the latest first */
  spoken: string[];
}

/** what the office last said, and the account it said it of */
let held: { of: string; list: Rivalry[] } | null = null;
let asking: Promise<Rivalry[] | null> | null = null;
const watchers = new Set<() => void>();

const told = (): void => {
  for (const cb of watchers) cb();
};

/** the rivalries last heard from the office for the account signed in
 *  (null: none heard yet — another account's are not this one's) */
export const rivalsNow = (): Rivalry[] | null => (held && held.of === onlineWire()?.session?.id ? held.list : null);

/** the rivalries, asked of the office again; what was held when it cannot answer */
export function loadRivals(): Promise<Rivalry[] | null> {
  const wire = onlineWire();
  const of = wire?.session?.id;
  if (!wire || !of) return Promise.resolve(rivalsNow());
  if (asking) return asking;
  asking = wire
    .askRivals()
    .then((list) => {
      held = { of, list };
      told();
      return list;
    })
    .catch(() => rivalsNow())
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** the rivalries, asked for as the component is mounted */
export function useRivals(): Rivalry[] | null {
  useEffect(() => {
    void loadRivals();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      watchers.add(cb);
      return () => watchers.delete(cb);
    },
    rivalsNow,
    rivalsNow,
  );
}

function readSaid(): Said {
  const v = paper<Partial<Said> | null>('rivals', null);
  const said: Said['said'] = {};
  for (const [persona, key] of Object.entries(v?.said ?? {})) if ((RIVAL_KEYS as readonly string[]).includes(key as string)) said[persona as BotPersona] = key as RivalKey;
  return { said, spoken: Array.isArray(v?.spoken) ? v.spoken.filter((c): c is string => typeof c === 'string') : [] };
}

/** the word a rival says as this game at home opens, or nothing: a game a
 *  word was said at already, a game under way, a table with no character */
export function rivalWordFor(g: GameState, code: string, rivals: readonly Rivalry[], o: { now?: number; random?: () => number } = {}): { word: RivalWord; seat: number } | null {
  if (g.phase === 'game-over' || g.era !== 'canal' || g.round > 1) return null;
  const kept = readSaid();
  if (kept.spoken.includes(code)) return null;
  const me = g.players.find((p) => !p.isBot);
  if (!me) return null;
  const seated = g.players.filter((p) => p.isBot && !p.resigned).map((p) => p.persona);
  const pick = chooseRival(seated, rivals);
  if (!pick) return null;
  const word = pickWord(pick.persona, pick.rivalry, { now: o.now ?? Date.now(), map: g.board ?? DEFAULT_BOARD, name: me.name, said: kept.said[pick.persona] ?? null, random: o.random });
  return { word, seat: g.players.findIndex((p) => p.isBot && p.persona === pick.persona) };
}

/** a word said at that game: remembered, so it is neither said again there
 *  nor said the next time */
export function noteSpoken(code: string, word: RivalWord): void {
  const kept = readSaid();
  if (kept.spoken.includes(code)) return;
  writePaper('rivals', { said: { ...kept.said, [word.persona]: word.key }, spoken: [code, ...kept.spoken].slice(0, SPOKEN_KEPT) });
}

/** a word's values as a sentence wants them: the industries named in the
 *  reader's tongue */
export function spokenVars(vars: Record<string, string | number>, t: (key: string) => string): Record<string, string | number> {
  const out = { ...vars };
  if (typeof vars.industry === 'string') out.industry = t(`rivals.yours.${vars.industry}`);
  if (typeof vars.own === 'string') out.own = t(`rivals.mine.${vars.own}`);
  return out;
}
