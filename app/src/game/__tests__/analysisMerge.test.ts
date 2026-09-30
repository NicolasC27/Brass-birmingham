import { describe, expect, it } from 'vitest';
import type { Reading, Verdict } from '../analysis';
import { CAPS, cleanPart, doneOf, emptyHeld, foldHeld, foldPart, heldOf } from '../analysisMerge';
import type { Facts, Held, ReadingPart } from '../analysisMerge';

/* ------------------------------------------------------------------ */
/* The folding: two readers of one table read a stretch of the game    */
/* each and their figures must come together as one reading, whichever */
/* order they land in — and nothing that is not a figure gets in.      */
/* ------------------------------------------------------------------ */

const facts: Facts = { moves: 20, seats: 2 };

const reading = (c: number, passes = 1): Reading => ({ chance: c, low: c - 0.02, high: c + 0.02, passes });
const verdict = (at: number, loss = 0.02): Verdict => ({ at, round: 1, era: 'canal', roads: [{ action: { kind: 'pass' }, chance: 0.5 }], mine: 0.5 - loss, best: 0.5, loss, grade: 'good' });

/** the positions [lo, hi) read by one reader, and the turns among them */
const slice = (lo: number, hi: number, passes = 1): ReadingPart => ({
  moves: facts.moves,
  seats: Object.fromEntries(Array.from({ length: hi - lo }, (_, i) => [lo + i, [reading(0.5, passes), reading(0.5, passes)]])),
  verdicts: Array.from({ length: hi - lo }, (_, i) => lo + i)
    .filter((at) => at % 2 === 0 && at < facts.moves)
    .map((at) => ({ seat: 0, at, passes, verdict: verdict(at) })),
});

const fold = (parts: ReadingPart[]): Held => parts.reduce((held, part) => foldPart(held, part), emptyHeld());

describe('the folding of a shared reading', () => {
  it('puts two slices of one game back together, in either order', () => {
    const first = fold([slice(0, 10), slice(10, 21)]);
    const other = fold([slice(10, 21), slice(0, 10)]);
    expect(Object.keys(first.seats).length).toBe(21);
    expect(first.seats).toEqual(other.seats);
    expect(first.verdicts).toEqual(other.verdicts);
    /* every position read once, and a verdict at every even turn */
    expect(doneOf(first)).toBe(21 + 10);
    expect(first.moves).toBe(20);
  });

  it('keeps the longer reading of a position and of a turn, whichever comes last', () => {
    const short = slice(0, 4, 1);
    const long = slice(0, 4, 3);
    for (const order of [[short, long], [long, short]]) {
      const held = fold(order);
      expect(held.seats[2][0].passes).toBe(3);
      expect(held.grades[0][2]).toBe(3);
    }
  });

  it('counts what is held, and never past what the reading set out to do', () => {
    const held = fold([{ ...slice(0, 6), total: 8 }]);
    expect(held.total).toBe(8);
    expect(held.done).toBe(8);
    /* nothing posted, nothing counted */
    expect(doneOf(emptyHeld())).toBe(0);
  });

  it('folds a browser’s shelf and the office’s copy into each other', () => {
    const office = fold([slice(0, 8, 3)]);
    const shelf = heldOf({ seats: { 12: [reading(0.4), reading(0.6)] }, verdicts: { 0: { 12: verdict(12) } }, roads: { 0: { '12|': [{ action: { kind: 'pass' }, chance: 0.5 } ] } }, total: 0, done: 0, moves: 20 });
    const both = foldHeld(shelf, office);
    expect(Object.keys(both.seats).length).toBe(9);
    expect(both.seats[0][0].passes).toBe(3);
    expect(both.verdicts[0][12].at).toBe(12);
    expect(both.roads[0]['12|'].length).toBe(1);
    /* the same the other way round: the office's longer figures still win */
    const swapped = foldHeld(office, shelf);
    expect(swapped.seats[0][0].passes).toBe(3);
    expect(swapped.verdicts[0][12].at).toBe(12);
  });
});

describe('what the office will believe', () => {
  const clean = (part: unknown) => cleanPart(part, facts);

  it('takes a part that looks like a reading, as it was sent', () => {
    const part = slice(2, 6);
    expect(clean(part)).toEqual(part);
  });

  it('turns away figures that are not figures', () => {
    expect(clean({ moves: 4, seats: { 0: [reading(Number.NaN), reading(0.5)] } })).toBeNull();
    expect(clean({ moves: 4, seats: { 0: [reading(1.5), reading(0.5)] } })).toBeNull();
    expect(clean({ moves: 4, seats: { 0: [reading(-0.1), reading(0.5)] } })).toBeNull();
    /* a reading is for every seat at the table, no more and no less */
    expect(clean({ moves: 4, seats: { 0: [reading(0.5)] } })).toBeNull();
    expect(clean({ moves: 4, verdicts: [{ seat: 0, at: 0, passes: 0, verdict: verdict(0) }] })).toBeNull();
  });

  it('turns away anything pointing outside the game', () => {
    /* a reading of more moves than the game has been played */
    expect(clean({ moves: facts.moves + 1 })).toBeNull();
    /* a position past the last one, a seat that is not at the table */
    expect(clean({ moves: 4, seats: { 21: [reading(0.5), reading(0.5)] } })).toBeNull();
    expect(clean({ moves: 4, verdicts: [{ seat: 2, at: 0, passes: 1, verdict: verdict(0) }] })).toBeNull();
    expect(clean({ moves: 4, verdicts: [{ seat: 0, at: 20, passes: 1, verdict: verdict(20) }] })).toBeNull();
    /* a verdict filed under a move that is not its own */
    expect(clean({ moves: 4, verdicts: [{ seat: 0, at: 3, passes: 1, verdict: verdict(4) }] })).toBeNull();
    /* a grade of its own invention, and a road going nowhere */
    expect(clean({ moves: 4, verdicts: [{ seat: 0, at: 0, passes: 1, verdict: { ...verdict(0), grade: 'brilliant' } }] })).toBeNull();
    expect(clean({ moves: 4, verdicts: [{ seat: 0, at: 0, passes: 1, verdict: { ...verdict(0), roads: [{ chance: 0.5 }] } }] })).toBeNull();
  });

  it('turns away a frame too big to be one reader’s batch', () => {
    /* a long game, so the positions of the batch are real ones */
    const long: Facts = { moves: CAPS.positions + 8, seats: 2 };
    const many = Object.fromEntries(Array.from({ length: CAPS.positions + 1 }, (_, i) => [i, [reading(0.5), reading(0.5)]]));
    expect(cleanPart({ moves: 4, seats: many }, long)).toBeNull();
    expect(cleanPart({ moves: 4, seats: Object.fromEntries(Object.entries(many).slice(0, CAPS.positions)) }, long)).not.toBeNull();
    expect(clean({ moves: 4, verdicts: Array.from({ length: CAPS.verdicts + 1 }, () => ({ seat: 0, at: 0, passes: 1, verdict: verdict(0) })) })).toBeNull();
    expect(clean({ moves: 4, roads: [{ seat: 0, line: 'x'.repeat(CAPS.line + 1), roads: [] }] })).toBeNull();
  });

  it('turns away what is not a part at all', () => {
    expect(clean(null)).toBeNull();
    expect(clean('a reading')).toBeNull();
    expect(clean({ moves: -1 })).toBeNull();
    expect(clean({ moves: 1.5 })).toBeNull();
    expect(clean({ moves: 4, seats: [] })).toBeNull();
  });
});
