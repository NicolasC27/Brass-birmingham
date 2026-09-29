import { describe, expect, it } from 'vitest';
import { motifOf, recurring } from '../progress';
import type { Played } from '../progress';

describe('the motifs of a miss', () => {
  it('names what was played against what was better', () => {
    expect(motifOf({ kind: 'network', card: 'c', link: 'a--b' }, { kind: 'network', card: 'c', link: 'a--b', second: 'b--c' })).toBe('singleRail');
    expect(motifOf({ kind: 'loan', card: 'c' }, { kind: 'build', card: 'c', town: 'derby', slot: 0, industry: 'coal' })).toBe('loanOverBuild');
    expect(motifOf({ kind: 'pass' }, { kind: 'network', card: 'c', link: 'a--b' })).toBe('passed');
    expect(motifOf({ kind: 'build', card: 'c', town: 'derby', slot: 0, industry: 'coal' }, { kind: 'build', card: 'c', town: 'leek', slot: 0, industry: 'coal' })).toBe('wrongTown');
    expect(motifOf({ kind: 'build', card: 'c', town: 'derby', slot: 0, industry: 'coal' }, { kind: 'build', card: 'd', town: 'derby', slot: 1, industry: 'coal' })).toBeNull();
    expect(motifOf({ kind: 'build', card: 'c', town: 'derby', slot: 0, industry: 'coal' }, { kind: 'sell', card: 'c', sales: [] })).toBe('sellLate');
  });
  it('keeps what comes back over the last games', () => {
    const line = (id: string, motifs: Played['motifs']): Played => ({ id, at: 0, table: 't', seed: 1, seat: 0, players: 2, vp: 0, rank: 1, moves: 10, lost: 3, by: { top: 5, good: 2, inaccuracy: 1, mistake: 1, blunder: 1 }, plan: null, planScore: 0, motifs });
    const back = recurring([line('a', { singleRail: 2, passed: 1 }), line('b', { singleRail: 1 }), line('c', { wrongTown: 1 })]);
    expect(back[0]).toEqual({ motif: 'singleRail', games: 2, times: 3 });
    expect(back.some((r) => r.motif === 'wrongTown')).toBe(false);
  });
});
