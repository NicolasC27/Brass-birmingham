import { describe, expect, it } from 'vitest';
import { MAX_SHOWN, enqueue, fileWhere, filedOf, ordered, shownOf } from '../noticeQueue';
import type { Incoming } from '../noticeQueue';

const flip = (id: string, owner: number, rank: 1 | 2 = 1, detail = 'sold'): Incoming => ({ id, kind: 'flip', rank, owner, industry: 'coal', title: `works of ${owner} flip`, detail });
const turn = (id: string): Incoming => ({ id, kind: 'turn', rank: 2, owner: 0, title: 'your turn', detail: '3 moves' });

describe('the table notices book', () => {
  it('puts what touches the reader ahead, first come first shown within a rank', () => {
    let { notes, seq } = enqueue([], [flip('a', 1), flip('b', 2)], 0);
    ({ notes, seq } = enqueue(notes, [{ id: 'o', kind: 'overbuilt', rank: 2, owner: 3, title: 'built over', detail: 'Dudley' }], seq));
    expect(ordered(notes).map((n) => n.id)).toEqual(['o', 'a', 'b']);
    expect(seq).toBe(3);
  });

  it('gathers the flips of one other seat into a single open notice', () => {
    const first = enqueue([], [flip('a', 1, 1, 'first')], 0);
    const next = enqueue(first.notes, [flip('b', 1, 1, 'second'), flip('c', 2)], first.seq);
    expect(next.notes).toHaveLength(2);
    const gathered = next.notes.find((n) => n.id === 'a')!;
    expect(gathered.count).toBe(2);
    expect(gathered.detail).toBe('second');
  });

  it('never gathers the reader\'s own flips, nor says a notice twice, even once filed', () => {
    const first = enqueue([], [flip('a', 0, 2), flip('b', 0, 2)], 0);
    expect(first.notes).toHaveLength(2);
    const again = enqueue(first.notes, [flip('a', 0, 2)], first.seq);
    expect(again.notes).toHaveLength(2);
    const filed = fileWhere(again.notes, (n) => n.id === 'a');
    expect(enqueue(filed, [flip('a', 0, 2)], again.seq).notes).toHaveLength(2);
  });

  it('shows three at most and counts the rest waiting', () => {
    const many = enqueue([], [flip('a', 1), flip('b', 2), flip('c', 3), flip('d', 4), flip('e', 5)], 0).notes;
    const { shown, waiting } = shownOf(many);
    expect(shown).toHaveLength(MAX_SHOWN);
    expect(waiting).toBe(2);
    expect(shownOf(many, 1).waiting).toBe(4);
  });

  it('keeps a notice open until it is filed, and keeps it in the book after', () => {
    const { notes } = enqueue([], [flip('a', 1), flip('b', 2)], 0);
    const filed = fileWhere(notes, (n) => n.id === 'a');
    expect(ordered(filed).map((n) => n.id)).toEqual(['b']);
    expect(filedOf(filed).map((n) => n.id)).toEqual(['a']);
    /* nothing to file: the very same book, so no state changes hands */
    expect(fileWhere(filed, (n) => n.id === 'zz')).toBe(filed);
  });

  it('files the stale notice of a kind when a newer one arrives, and gathers no flip into a filed one', () => {
    let { notes, seq } = enqueue([], [turn('t1'), flip('a', 1)], 0);
    ({ notes, seq } = enqueue(notes, [turn('t2')], seq));
    expect(ordered(notes).map((n) => n.id)).toEqual(['t2', 'a']);
    expect(filedOf(notes).map((n) => n.id)).toEqual(['t1']);
    notes = fileWhere(notes, (n) => n.id === 'a');
    ({ notes } = enqueue(notes, [flip('b', 1)], seq));
    expect(notes.find((n) => n.id === 'a')!.count).toBe(1);
    expect(ordered(notes).map((n) => n.id)).toEqual(['t2', 'b']);
  });

  it('keeps every open notice and drops the oldest filed pages first', () => {
    let { notes, seq } = enqueue([], [flip('a', 1), flip('b', 2), flip('c', 3)], 0);
    notes = fileWhere(notes, (n) => n.id !== 'c');
    ({ notes, seq } = enqueue(notes, [flip('d', 4)], seq, 3));
    expect(notes.map((n) => n.id).sort()).toEqual(['b', 'c', 'd']);
    ({ notes } = enqueue(notes, [flip('e', 5), flip('f', 6)], seq, 3));
    expect(ordered(notes).map((n) => n.id)).toEqual(['c', 'd', 'e', 'f']);
    expect(filedOf(notes)).toHaveLength(0);
  });
});
