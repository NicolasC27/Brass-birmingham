import { describe, expect, it } from 'vitest';
import { MAX_SHOWN, enqueue, lifeFor, ordered, shownOf } from '../noticeQueue';
import type { Incoming } from '../noticeQueue';

const flip = (id: string, owner: number, rank: 1 | 2 = 1, detail = 'sold'): Incoming => ({ id, kind: 'flip', rank, owner, industry: 'coal', title: `works of ${owner} flip`, detail });

describe('the table notices queue', () => {
  it('puts what touches the reader ahead, first come first shown within a rank', () => {
    let { notes, seq } = enqueue([], [flip('a', 1), flip('b', 2)], 0);
    ({ notes, seq } = enqueue(notes, [{ id: 'o', kind: 'overbuilt', rank: 2, owner: 3, title: 'built over', detail: 'Dudley' }], seq));
    expect(ordered(notes).map((n) => n.id)).toEqual(['o', 'a', 'b']);
    expect(seq).toBe(3);
  });

  it('gathers the flips of one other seat into a single notice, its clock started over', () => {
    const first = enqueue([], [flip('a', 1, 1, 'first')], 0);
    const next = enqueue(first.notes, [flip('b', 1, 1, 'second'), flip('c', 2)], first.seq);
    expect(next.notes).toHaveLength(2);
    const gathered = next.notes.find((n) => n.id === 'a')!;
    expect(gathered.count).toBe(2);
    expect(gathered.detail).toBe('second');
    expect(gathered.stamp).toBe(1);
  });

  it('never gathers the reader\'s own flips, nor says a notice twice', () => {
    const first = enqueue([], [flip('a', 0, 2), flip('b', 0, 2)], 0);
    expect(first.notes).toHaveLength(2);
    const again = enqueue(first.notes, [flip('a', 0, 2)], first.seq);
    expect(again.notes).toHaveLength(2);
  });

  it('shows three at most and counts the rest waiting', () => {
    const many = enqueue([], [flip('a', 1), flip('b', 2), flip('c', 3), flip('d', 4), flip('e', 5)], 0).notes;
    const { shown, waiting } = shownOf(many);
    expect(shown).toHaveLength(MAX_SHOWN);
    expect(waiting).toBe(2);
    expect(shownOf(many, 1).waiting).toBe(4);
  });

  it('lets a notice stay as long as it takes to read, within bounds', () => {
    expect(lifeFor('a', 'b', 1)).toBe(5500);
    expect(lifeFor('x'.repeat(400), '', 1)).toBe(12000);
    const mid = lifeFor('Manufacture N1 se retourne', 'Miss Arkwright · vente à Oxford · revenu +5', 1);
    expect(mid).toBeGreaterThan(5500);
    expect(mid).toBeLessThan(12000);
    expect(lifeFor('Manufacture N1 se retourne', 'Miss Arkwright · vente à Oxford · revenu +5', 2)).toBe(Math.round(mid * 1.5));
  });
});
