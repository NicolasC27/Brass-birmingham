/* The order of the table's tunes, of each era's small events and of the
   townsfolk's voices: which comes next, and after how long. Nothing here
   makes a sound; the chance is passed in, so the choices can be held to
   account. sfx.ts plays them. */

import type { Era } from '@/game/types';

/** a number drawn evenly in [0, 1), as Math.random gives */
export type Chance = () => number;

/** one of the tunes of an era, as served under /sfx/ */
export interface Tune {
  name: string;
  /** a file folded into a seamless loop of this many seconds, played
   *  `turns` times over; a tune without it is played through once */
  loop?: number;
  turns?: number;
}

/** each era's playlist. The canal's first tune is a loop of four phrases
 *  of an air (68.5 s), heard twice; the others are played from their first
 *  note to their own last chord, about a minute and a half each */
export const TUNES: Record<Era, readonly Tune[]> = {
  canal: [{ name: 'music-canal', loop: 68.5346, turns: 2 }, { name: 'music-canal-ii' }, { name: 'music-canal-iii' }],
  rail: [{ name: 'music-rail-i' }, { name: 'music-rail-ii' }, { name: 'music-rail-iii' }],
};

/** the first tune comes a few seconds after the era opens */
export const TUNE_FIRST: readonly [number, number] = [4, 10];
/** between two tunes, the ambience alone for a while */
export const TUNE_PAUSE: readonly [number, number] = [45, 150];
/** between two of an era's events: something somewhere off, now and then */
export const LIFE_GAP: readonly [number, number] = [40, 120];

/** each era's events, heard over its ambience. The canal: a horse on the
 *  towpath, a lock's gates and sluice, a village smith, a church bell,
 *  geese going over. The rail: a whistle, a train going by, wagons
 *  shunted, an engine leaving, a steam hammer, an engine blowing off */
export const LIFE = {
  canal: ['life-horse', 'life-lock', 'life-forge', 'life-bell', 'life-geese'],
  rail: ['life-whistle', 'life-passing', 'life-couple', 'life-depart', 'life-hammer', 'life-steam'],
} as const;
export type Life = (typeof LIFE)[keyof typeof LIFE][number];

/** a span drawn evenly between the two bounds */
export const spanOf = ([lo, hi]: readonly [number, number], chance: Chance): number => lo + (hi - lo) * Math.min(Math.max(chance(), 0), 0.999999);

/** one of `names`, drawn evenly, but never `last` again while there is
 *  another to choose */
export function nextOf<T>(names: readonly T[], last: T | null, chance: Chance): T {
  const open = names.length > 1 ? names.filter((n) => n !== last) : names;
  return open[Math.floor(Math.min(Math.max(chance(), 0), 0.999999) * open.length)];
}

/** the tune of this name in an era's playlist */
export const tuneOf = (era: Era, name: string): Tune | undefined => TUNES[era].find((t) => t.name === name);

/** how long a tune is heard: its loop as many turns as it is given, or the
 *  file through once */
export const tuneLength = (t: Tune, fileSeconds: number): number => (t.loop ? t.loop * (t.turns ?? 1) : fileSeconds);

/** between two of the townsfolk's voices: sparse, a minute to three */
export const VOICE_GAP: readonly [number, number] = [60, 180];
/** something just happened in a town (a works paid off, coal bought
 *  dear): a voice is heard there this soon after, if the last one is at
 *  least VOICE_GAP's shortest span behind */
export const VOICE_REACT: readonly [number, number] = [3, 8];
/** the bubble stays up this long after the voice has finished */
export const BUBBLE_AFTER_S = 1.5;

/** when the next voice is due (ms): as planned; or, when a town has just
 *  stirred, a few seconds after it — never sooner than the planned time
 *  would have been allowed after the last voice, and never later than
 *  planned */
export function voiceAt(planned: number, lastEnd: number, stirAt: number | null, react: number): number {
  if (stirAt === null) return planned;
  const allowed = lastEnd + VOICE_GAP[0] * 1000;
  return Math.min(planned, Math.max(stirAt + react * 1000, allowed));
}

/** how long a line's bubble is shown, in seconds */
export const bubbleSpan = (voiceSeconds: number): number => voiceSeconds + BUBBLE_AFTER_S;

/** when an event planned for `at` may sound: not while a moment of the game
 *  (the bell of a turn, the era's whistle, the band) is heard, nor just
 *  after it — it waits until `hushUntil` has passed */
export const lifeAt = (at: number, hushUntil: number): number => Math.max(at, hushUntil);
