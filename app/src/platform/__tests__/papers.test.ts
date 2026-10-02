import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from './storage';
import { grantFromHistory, listPatents, mergePatents } from '../patents';
import { storyOfGame, storyOfTable, winStreak } from '../chronicle';
import { listLetters, mergeLetters } from '../letters';
import type { PastGame, PublicTable } from '@/online/table';
import { emptyTally } from '@/game/tally';

/* the patents, the chronicle and the post: what the office's history earns and how it is told */

const game = (code: string, winner: number, finishedAt: number, tally: Partial<ReturnType<typeof emptyTally>> = {}): PastGame => ({
  code,
  name: `Table ${code}`,
  finishedAt,
  winner,
  abandoned: false,
  players: [
    { id: 'me', name: 'Nicolas', color: 'brass', vp: 150, bot: false, tally: { ...emptyTally(), ...tally } },
    { id: 'them', name: 'Mr Watt', color: 'steel', vp: 120, bot: true },
  ],
});

describe('the patents', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('are granted once, from the tally, at the game\'s own date', () => {
    const fresh = grantFromHistory([game('A', 0, 1000, { links: 14, loans: 0, industries: { brewery: 4 } }), game('B', 0, 2000, { links: 20, loans: 0 })], 'me');
    const ids = fresh.map((p) => p.id).sort();
    expect(ids).toEqual(['brewer', 'centenary', 'network', 'noBanker']);
    expect(fresh.find((p) => p.id === 'network')?.at).toBe(1000);
    /* read again: nothing new */
    expect(grantFromHistory([game('A', 0, 1000, { links: 14 })], 'me')).toEqual([]);
    /* a loss without the bank is no patent */
    stubStorage();
    expect(grantFromHistory([game('C', 1, 3000, { loans: 0 })], 'me').map((p) => p.id)).not.toContain('noBanker');
  });

  it('fold in papers from elsewhere without doubling', () => {
    mergePatents([{ id: 'potter', at: 5, table: 'X' }, { id: 'potter', at: 9, table: 'Y' }, { id: 'nonsense', at: 1 }]);
    expect(listPatents().map((p) => p.id)).toEqual(['potter']);
    expect(listPatents()[0].at).toBe(5);
  });
});

describe('the chronicle', () => {
  it('tells the same fact the same way at every visit, and a run its own way', () => {
    const g = game('ABCD', 0, 1);
    const a = storyOfGame(g, 'me', 1, 'Forge');
    expect(a).toEqual(storyOfGame(g, 'me', 1, 'Forge'));
    expect(a.key).toMatch(/^platform\.chronicle\.won\.[012]$/);
    expect(storyOfGame(g, 'them', 1, 'Forge').key).toMatch(/^platform\.chronicle\.lost\.[012]$/);
    expect(storyOfGame(g, 'me', 3, 'Forge').key).toBe('platform.chronicle.streak');
    const live = { code: 'LIVE', name: 'x', round: 4, current: 0, seats: [{ name: 'Ada' }] } as unknown as PublicTable;
    expect(storyOfTable(live, 'Quai').vars).toEqual({ table: 'Quai', round: 4, name: 'Ada' });
  });

  it('counts the wins in a row from the latest game', () => {
    expect(winStreak([game('A', 0, 1), game('B', 0, 2), game('C', 1, 3)], 'me')).toBe(0);
    expect(winStreak([game('A', 1, 1), game('B', 0, 2), game('C', 0, 3)], 'me')).toBe(2);
  });
});

describe('the post', () => {
  it('keeps the latest few letters of both sides, by id', () => {
    stubStorage();
    const letter = (id: string, at: number) => ({ id, at, persona: 'watt', kind: 'won', variant: 0, table: 'X', vp: 1, theirs: 2, me: 'N' });
    mergeLetters([letter('a', 1), letter('b', 2)]);
    mergeLetters([letter('b', 2), letter('c', 3), letter('d', 4), letter('e', 5), letter('f', 6), letter('g', 7)]);
    expect(listLetters().map((l) => l.id)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });
});
