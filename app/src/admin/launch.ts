import { forgetHomeGame, homeSnapshot, openHomeGame } from '@/game/home';
import { onlineWire } from '@/online/net';
import type { BotPersona } from '@/game/types';
import { chunks, playForward, scenarioSetup } from './scenario';
import type { Preset } from './scenario';

/* ------------------------------------------------------------------ */
/* A scenario set on the office: the game dealt under the account      */
/* signed in (a guest's as well), played forward here by the machines, */
/* then handed over in slices through the bench's way in — which the   */
/* office opens only when it was started with DEV_LETTERS=1, and only  */
/* to this machine. It reads every move with its engine all the same.  */
/* ------------------------------------------------------------------ */

/** every game the bench deals is named so, to be put away together */
export const BENCH_PREFIX = 'Banc';
/** the moves in one frame of the wire (well under its 64 KB) */
const SLICE = 80;

export interface LaunchAsk {
  preset: Preset;
  seats: number;
  owner: number;
  personas: readonly BotPersona[];
  /** the deal's seed; a fresh one when absent */
  seed?: number;
}

export type LaunchStep = { stage: 'play' | 'send'; share: number };

/** the game dealt, played to the moment and written at the office: its code */
export async function launchScenario(ask: LaunchAsk, onStep: (s: LaunchStep) => void): Promise<{ code: string; moves: number; seed: number }> {
  const wire = onlineWire();
  if (!wire) throw new Error('aucun office configuré (VITE_ONLINE_URL)');
  const seed = ask.seed ?? Math.floor(Math.random() * 1e9);
  /* the account the game is written under, a guest's opened if need be:
     its name is the owner's at the table */
  const { name } = await wire.need();
  const setup = scenarioSetup({ seats: ask.seats, owner: ask.owner, name, personas: ask.personas });
  onStep({ stage: 'play', share: 0 });
  const played = await playForward(setup, seed, ask.preset, ask.owner, (share) => onStep({ stage: 'play', share }));
  if (!played.reached) throw new Error(`le moment « ${ask.preset.label} » n’a pas été atteint avec la graine ${seed} ; essayer une autre graine`);
  const table = await openHomeGame(seed, setup, `${BENCH_PREFIX} · ${ask.preset.label}`.slice(0, 60));
  const parts = chunks(played.actions, SLICE);
  for (const [k, part] of parts.entries()) {
    onStep({ stage: 'send', share: k / parts.length });
    /* the office's engine reads each move; a refusal throws with its words */
    await wire.ask((rid) => ({ t: 'dev.home.play', rid, code: table.code, from: k * SLICE, actions: part }));
  }
  onStep({ stage: 'send', share: 1 });
  return { code: table.code, moves: played.actions.length, seed };
}

/** the bench's games on the register (played out ones included) */
export const benchGames = () => homeSnapshot().filter((t) => t.name.startsWith(`${BENCH_PREFIX} · `));

/** every game the bench dealt, put away: the register holds 200 at most */
export async function forgetBenchGames(): Promise<number> {
  const mine = benchGames();
  for (const t of mine) await forgetHomeGame(t.code);
  return mine.length;
}
