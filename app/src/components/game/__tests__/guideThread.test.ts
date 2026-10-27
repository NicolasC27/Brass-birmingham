import { describe, expect, it } from 'vitest';
import { EMPTY_THREAD, askThread, fileThread, noteThread } from '../guideThread';

const lesson = (at: number) => ({ at, word: () => ({ head: `h${at}`, body: `b${at}` }) });

describe("the guide's thread", () => {
  it('hands back the same thread when nothing has moved', () => {
    const a = fileThread(EMPTY_THREAD, { lesson: lesson(0), bot: null, news: [] });
    expect(fileThread(a, { lesson: lesson(0), bot: null, news: [] })).toBe(a);
  });

  it('files the lesson it replaces, worded as it was read', () => {
    const a = fileThread(EMPTY_THREAD, { lesson: lesson(0), bot: null, news: [] });
    const b = fileThread(a, { lesson: lesson(1), bot: null, news: [] });
    expect(b.said).toEqual([{ key: 'l0.0', kind: 'lesson', head: 'h0', body: 'b0' }]);
    expect(b.lesson?.at).toBe(1);
  });

  it('files a lesson shown twice under two keys', () => {
    /* a lesson set aside comes back the next round: filed once as it
       went, once more when it is passed */
    let th = EMPTY_THREAD;
    for (const at of [14, 15, 14, 16]) th = fileThread(th, { lesson: lesson(at), bot: null, news: [] });
    expect(th.said.map((s) => s.head)).toEqual(['h14', 'h15', 'h14']);
    expect(new Set(th.said.map((s) => s.key)).size).toBe(3);
  });

  it('files the last lesson read when only one set aside is left', () => {
    const a = fileThread(EMPTY_THREAD, { lesson: lesson(21), bot: null, news: [] });
    /* the note folded or undocked: nothing is filed */
    expect(fileThread(a, { lesson: null, bot: null, news: [] })).toBe(a);
    /* at rest: the page read last joins the thread, once */
    const b = fileThread(a, { lesson: null, rest: true, bot: null, news: [] });
    expect(b.said.map((s) => s.head)).toEqual(['h21']);
    expect(b.lesson).toBeNull();
    expect(fileThread(b, { lesson: null, rest: true, bot: null, news: [] })).toBe(b);
    /* the lesson set aside back the next round: live again */
    const c = fileThread(b, { lesson: lesson(14), bot: null, news: [] });
    expect(c.lesson?.at).toBe(14);
    expect(c.said).toHaveLength(1);
  });

  it('files each piece of news once', () => {
    const news = [{ id: 1, text: 'a' }, { id: 2, text: 'b' }];
    const a = fileThread(EMPTY_THREAD, { lesson: null, bot: null, news });
    expect(a.said.map((s) => s.key)).toEqual(['n1', 'n2']);
    expect(fileThread(a, { lesson: null, bot: null, news })).toBe(a);
  });

  it('files the news the table played on past unread', () => {
    const news = [{ id: 5, text: 'a' }, { id: 6, text: 'b' }];
    /* on show, not read: nothing filed yet */
    const a = fileThread(EMPTY_THREAD, { lesson: null, bot: null, news: [], unread: news });
    expect(a.said).toEqual([]);
    expect(fileThread(a, { lesson: null, bot: null, news: [], unread: news })).toBe(a);
    /* the machine played on: they are gone from the table, filed as they were */
    const b = fileThread(a, { lesson: null, bot: null, news: [], unread: [{ id: 9, text: 'c' }] });
    expect(b.said.map((s) => s.key)).toEqual(['n5', 'n6']);
    expect(b.said.map((s) => s.body)).toEqual(['a', 'b']);
    /* read at last, the next ones are filed once, not twice */
    const c = fileThread(b, { lesson: null, bot: null, news: [{ id: 9, text: 'c' }], unread: [] });
    expect(c.said.map((s) => s.key)).toEqual(['n5', 'n6', 'n9']);
    expect(fileThread(c, { lesson: null, bot: null, news: [], unread: [] }).said).toHaveLength(3);
  });

  it('files news read on show once, when they are read', () => {
    const news = [{ id: 3, text: 'a' }];
    const a = fileThread(EMPTY_THREAD, { lesson: null, bot: null, news: [], unread: news });
    const b = fileThread(a, { lesson: null, bot: null, news, unread: [] });
    expect(b.said.map((s) => s.key)).toEqual(['n3']);
    /* and gone from the table afterwards, not again */
    expect(fileThread(b, { lesson: null, bot: null, news: [], unread: [] }).said).toHaveLength(1);
  });

  it('keeps the news on show unfiled while the lane is away', () => {
    /* the tablet turned: the lane goes and comes back with the news still
       unread — filed once, when read, never beside its own live plate */
    const n = [{ id: 25, text: 'a mine' }];
    const now = (lane: boolean, read: boolean) => ({ lesson: lane ? lesson(9) : null, bot: null, news: read ? n : [], unread: read ? [] : n });
    let th = fileThread(EMPTY_THREAD, now(true, false));
    th = fileThread(th, now(false, false));
    expect(th.said).toEqual([]);
    th = fileThread(th, now(true, false));
    expect(th.said).toEqual([]);
    expect(th.news).toEqual(n);
    th = fileThread(th, now(true, true));
    expect(th.said.map((s) => s.key)).toEqual(['n25']);
    expect(th.news).toEqual([]);
  });

  it("files the machine's last move when a new one comes", () => {
    const a = fileThread(EMPTY_THREAD, { lesson: null, bot: { id: 3, head: 'w', body: 'y', seat: 1 }, news: [] });
    const b = fileThread(a, { lesson: null, bot: { id: 4, head: 'w2', body: 'y2', seat: 2 }, news: [] });
    expect(b.said).toEqual([{ key: 'b3', kind: 'bot', head: 'w', body: 'y', seat: 1 }]);
  });

  it('keeps a question and its answer together', () => {
    const a = askThread(EMPTY_THREAD, 'q?', 'a.');
    expect(a.said.map((s) => s.kind)).toEqual(['ask', 'answer']);
  });

  it('adds a word of its own under a key of its own', () => {
    const a = noteThread(askThread(EMPTY_THREAD, 'q?', 'a.'), 'n.');
    const b = noteThread(a, 'n.');
    expect(b.said.map((s) => s.kind)).toEqual(['ask', 'answer', 'note', 'note']);
    expect(new Set(b.said.map((s) => s.key)).size).toBe(4);
    /* and the live items are left as they were */
    expect(fileThread(b, { lesson: null, bot: null, news: [] })).toBe(b);
  });
});
