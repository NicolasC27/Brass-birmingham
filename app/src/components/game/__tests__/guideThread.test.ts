import { describe, expect, it } from 'vitest';
import { EMPTY_THREAD, askThread, fileThread } from '../guideThread';

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

  it('files each piece of news once', () => {
    const news = [{ id: 1, text: 'a' }, { id: 2, text: 'b' }];
    const a = fileThread(EMPTY_THREAD, { lesson: null, bot: null, news });
    expect(a.said.map((s) => s.key)).toEqual(['n1', 'n2']);
    expect(fileThread(a, { lesson: null, bot: null, news })).toBe(a);
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
});
