import { describe, expect, it } from 'vitest';
import { NOTHING_READ, SAID_KEPT, TABLES_KEPT, readAt, shelve, threadOf } from '../guideRead';
import { EMPTY_THREAD, askThread, fileThread } from '../guideThread';
import type { Read } from '../guideRead';

const lesson = (at: number) => ({ at, word: () => ({ head: `h${at}`, body: `b${at}` }) });
const bot = (id: number) => ({ id, head: `move ${id}`, body: `why ${id}`, seat: 1 });

/* a table read a while: two lessons filed, two plates of hers, a question */
function played(): Read {
  let th = EMPTY_THREAD;
  for (const [at, id] of [[0, 3], [1, 7], [2, 9]]) th = fileThread(th, { lesson: lesson(at), bot: bot(id), news: [] });
  th = askThread(th, 'combien ?', '12 £');
  return { plate: 9, news: 11, said: th.said, filed: th.filed };
}

describe('what the reader has read, kept over a reload', () => {
  it('gives the table its plate, its news and its thread back', () => {
    const read = played();
    const back = readAt(shelve(null, 'JG8G', read), 'JG8G');
    expect(back.plate).toBe(9);
    expect(back.news).toBe(11);
    expect(back.said.map((s) => [s.kind, s.head ?? '', s.body])).toEqual(read.said.map((s) => [s.kind, s.head ?? '', s.body]));
    /* her plates keep the seat the look back at the board needs */
    expect(back.said.find((s) => s.kind === 'bot')?.seat).toBe(1);
  });

  it('starts a table it does not know, or a shelf it cannot read, with nothing read', () => {
    expect(readAt(null, 'JG8G')).toEqual(NOTHING_READ);
    expect(readAt(shelve(null, 'JG8G', played()), 'A5GK')).toEqual(NOTHING_READ);
    for (const junk of ['{', '[]', '{"v":2,"tables":[]}', '{"v":1,"tables":[{"plate":3}]}']) expect(readAt(junk, 'JG8G')).toEqual(NOTHING_READ);
  });

  it('leaves out a turn it cannot read, and keeps the rest', () => {
    const raw = JSON.stringify({ v: 1, tables: [{ code: 'JG8G', plate: 'x', news: 4, filed: 4, said: [{ kind: 'lesson', body: 'b0' }, { kind: 'shout', body: 'x' }, { kind: 'ask' }, null] }] });
    const back = readAt(raw, 'JG8G');
    expect(back.plate).toBe(-1);
    expect(back.news).toBe(4);
    expect(back.said.map((s) => s.body)).toEqual(['b0']);
  });

  it('keeps the tables sat at last, this one on top', () => {
    let raw: string | null = null;
    for (let i = 0; i < TABLES_KEPT + 2; i++) raw = shelve(raw, `T${i}`, { ...NOTHING_READ, plate: i });
    raw = shelve(raw, 'T3', { ...NOTHING_READ, plate: 33 });
    expect(readAt(raw, 'T3').plate).toBe(33);
    expect(readAt(raw, `T${TABLES_KEPT + 1}`).plate).toBe(TABLES_KEPT + 1);
    /* the first tables sat at are let go */
    expect(readAt(raw, 'T0')).toEqual(NOTHING_READ);
    expect((JSON.parse(raw!) as { tables: unknown[] }).tables).toHaveLength(TABLES_KEPT);
  });

  it('keeps the latest turns of a long thread', () => {
    let th = EMPTY_THREAD;
    for (let i = 0; i < SAID_KEPT + 30; i++) th = askThread(th, `q${i}`, `a${i}`);
    const back = readAt(shelve(null, 'JG8G', { ...NOTHING_READ, said: th.said }), 'JG8G');
    expect(back.said).toHaveLength(SAID_KEPT);
    expect(back.said[back.said.length - 1].body).toBe(`a${SAID_KEPT + 29}`);
  });

  it('never hands a key out twice once the thread goes on', () => {
    /* cut to its latest turns, a thread's own keys, which count its
       turns, would come round again: the turns read back have their own */
    let th = EMPTY_THREAD;
    for (let i = 0; i < SAID_KEPT + 10; i++) th = askThread(th, `q${i}`, `a${i}`);
    let again = threadOf(readAt(shelve(null, 'JG8G', { ...NOTHING_READ, said: th.said }), 'JG8G'));
    for (let i = 0; i < 20; i++) again = askThread(again, `more${i}`, `yes${i}`);
    again = fileThread(again, { lesson: lesson(4), bot: bot(12), news: [] });
    again = fileThread(again, { lesson: lesson(5), bot: bot(13), news: [] });
    const keys = again.said.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('opens the thread on what was said, nothing live yet', () => {
    const read = played();
    const th = threadOf(readAt(shelve(null, 'JG8G', read), 'JG8G'));
    expect(th.lesson).toBeNull();
    expect(th.bot).toBeNull();
    expect(th.news).toEqual([]);
    expect(th.filed).toBe(read.filed);
    /* the live lesson and plate taken in again are not filed twice */
    const next = fileThread(th, { lesson: lesson(3), bot: bot(9), news: [] });
    expect(next.said).toHaveLength(read.said.length);
  });
});
