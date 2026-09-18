import { afterEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@/online/protocol';
import { serve } from '../index';
import type { Serving } from '../index';
import { costOf } from '../translate';
import type { Translator } from '../translate';
import { Guest, post } from './guest';

/* The forum over the wire: who may open where, the doorman at the door,
   the pace, the moderators' hand, and the push that tells every page
   the forum moved. */

describe('the forum over the wire', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  async function arrive(name: string, verify = true): Promise<Guest> {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    await g.signUp(verify);
    return g;
  }
  /** the frame answering a request, once it is there */
  async function answer(g: Guest, rid: number): Promise<ServerMessage> {
    await g.until(`the answer to ${rid}`, () => g.frames.some((f) => 'rid' in f && f.rid === rid));
    return g.frames.find((f) => 'rid' in f && f.rid === rid)!;
  }
  const pushes = (g: Guest) => g.frames.filter((f) => f.t === 'forum');

  it('keeps the boards, refuses what the doorman refuses, and tells the pages', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:', moderators: ['ada'], translator: null });
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const carl = await arrive('Carl', false);
    expect(ada.me?.moderator).toBe(true);
    expect(bob.me?.moderator).toBe(false);

    /* the notices are the house's to open */
    bob.send({ t: 'forum.open', rid: 10, board: 'annonces', title: 'Hello there', body: 'A word.', lang: 'en' });
    expect(await answer(bob, 10)).toMatchObject({ t: 'refused', error: 'forum-mods-only' });
    /* a thread on strategy: everyone signed in hears the forum move */
    bob.send({ t: 'forum.open', rid: 11, board: 'strategie', title: 'Two mines first', body: 'Coal first, always.', lang: 'en' });
    const opened = await answer(bob, 11);
    expect(opened.t).toBe('forum.opened');
    const id = opened.t === 'forum.opened' ? opened.id : '';
    await ada.until('the push', () => pushes(ada).length > 0);
    expect(pushes(ada)[0]).toMatchObject({ t: 'forum', board: 'strategie', thread: id });

    /* an unanswered letter reads, but does not write */
    carl.send({ t: 'forum.reply', rid: 12, id, body: 'May I?' , lang: 'en' });
    expect(await answer(carl, 12)).toMatchObject({ t: 'refused', error: 'forum-verified' });
    carl.send({ t: 'forum.thread', rid: 13, id, page: 0 });
    expect((await answer(carl, 13)).t).toBe('forum.thread');

    /* the doorman */
    ada.send({ t: 'forum.reply', rid: 14, id, body: 'What a c0nnard move' , lang: 'en' });
    expect(await answer(ada, 14)).toMatchObject({ t: 'refused', error: 'forum-words' });
    ada.send({ t: 'forum.reply', rid: 15, id, body: 'Or **iron**, when Derby is free.' , lang: 'en' });
    expect((await answer(ada, 15)).t).toBe('forum.posted');
    /* the pace: a member, not a moderator, waits twenty seconds between posts —
       Bob just opened the thread; Dan, arriving now, may say one thing */
    bob.send({ t: 'forum.reply', rid: 16, id, body: 'And me again, too soon.' , lang: 'en' });
    expect(await answer(bob, 16)).toMatchObject({ t: 'refused', error: 'forum-cooldown' });
    const dan = await arrive('Dan');
    dan.send({ t: 'forum.reply', rid: 17, id, body: 'First.' , lang: 'en' });
    expect((await answer(dan, 17)).t).toBe('forum.posted');
    dan.send({ t: 'forum.reply', rid: 18, id, body: 'Second, too soon.' , lang: 'en' });
    expect(await answer(dan, 18)).toMatchObject({ t: 'refused', error: 'forum-cooldown' });

    /* a member cannot moderate; a report reaches the moderator */
    const view = await answer(carl, 13);
    const adaPost = view.t === 'forum.thread' ? view.view.posts[0].id : '';
    bob.send({ t: 'forum.thread', rid: 30, id, page: 0 });
    const full = await answer(bob, 30);
    const target = full.t === 'forum.thread' ? full.view.posts.find((p) => p.by.name === 'Ada')!.id : adaPost;
    bob.send({ t: 'forum.mod', rid: 19, action: 'hide', id: target });
    expect(await answer(bob, 19)).toMatchObject({ t: 'refused', error: 'forum-not-mod' });
    bob.send({ t: 'forum.report', rid: 20, post: target, reason: 'offtopic', text: 'iron is not the question' });
    expect((await answer(bob, 20)).t).toBe('done');
    ada.send({ t: 'forum.reports', rid: 21 });
    const reports = await answer(ada, 21);
    expect(reports.t === 'forum.reports' ? reports.reports.length : 0).toBe(1);
    bob.send({ t: 'forum.reports', rid: 22 });
    expect(await answer(bob, 22)).toMatchObject({ t: 'refused', error: 'forum-not-mod' });

    /* the moderator takes the post down: members see a gap, the queue empties */
    ada.send({ t: 'forum.mod', rid: 23, action: 'hide', id: target });
    expect((await answer(ada, 23)).t).toBe('done');
    bob.send({ t: 'forum.thread', rid: 24, id, page: 0 });
    const after = await answer(bob, 24);
    const hidden = after.t === 'forum.thread' ? after.view.posts.find((p) => p.id === target)! : null;
    expect(hidden).toMatchObject({ hidden: true, body: '' });
    ada.send({ t: 'forum.reports', rid: 25 });
    const left = await answer(ada, 25);
    expect(left.t === 'forum.reports' ? left.reports.length : -1).toBe(0);

    /* the boards count what stands; the thread list knows its page */
    bob.send({ t: 'forum.boards', rid: 26 });
    const boards = await answer(bob, 26);
    expect(boards.t === 'forum.boards' ? boards.boards.find((b) => b.key === 'strategie')?.threads : 0).toBe(1);
    bob.send({ t: 'forum.threads', rid: 27, board: 'strategie', page: 1 });
    const list = await answer(bob, 27);
    expect(list.t === 'forum.threads' ? list.threads[0].title : '').toBe('Two mines first');
    bob.send({ t: 'forum.threads', rid: 28, board: 'nowhere' as never, page: 1 });
    expect(await answer(bob, 28)).toMatchObject({ t: 'refused', error: 'forum-board' });
  });

  it("renders a thread in the reader's tongue, once, within the budget", async () => {
    /* an interpreter that renders by marking the tongue, and counts what it costs */
    const calls: string[] = [];
    const interpreter: Translator = {
      model: 'claude-opus-5',
      async translate(text, from, to) {
        calls.push(`${from}>${to}:${text}`);
        return { text: `[${to}] ${text}`, tokensIn: 400, tokensOut: 250 };
      },
    };
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:', moderators: ['ada'], translator: interpreter, translateBudget: 0.016 });
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    ada.send({ t: 'forum.open', rid: 40, board: 'regles', title: 'La bière sur une brasserie retournée', body: 'Elle coule encore ?', lang: 'fr' });
    const opened = await answer(ada, 40);
    const id = opened.t === 'forum.opened' ? opened.id : '';
    /* Bob reads in English: nothing rendered yet, two renderings on their way */
    bob.send({ t: 'forum.translate', rid: 41, id, page: 0, lang: 'en' });
    const first = await answer(bob, 41);
    expect(first.t === 'forum.translated' ? first.rendered : null).toMatchObject({ title: null, posts: {}, pending: 2, on: true });
    /* the office tells the thread's readers when the interpreter is done */
    await bob.until('the renderings', () => pushes(bob).some((f) => f.t === 'forum' && f.thread === id));
    bob.send({ t: 'forum.translate', rid: 42, id, page: 0, lang: 'en' });
    const second = await answer(bob, 42);
    const r = second.t === 'forum.translated' ? second.rendered : null;
    expect(r?.title).toBe('[en] La bière sur une brasserie retournée');
    expect(Object.values(r?.posts ?? {})).toEqual(['[en] Elle coule encore ?']);
    expect(r?.pending).toBe(0);
    expect(calls).toHaveLength(2);
    /* the board's list carries the title in Bob's tongue too, before he enters */
    bob.send({ t: 'forum.threads', rid: 47, board: 'regles', page: 1, lang: 'en' });
    const listed = await answer(bob, 47);
    expect(listed.t === 'forum.threads' ? listed.threads[0].rendered : null).toBe('[en] La bière sur une brasserie retournée');
    expect(listed.t === 'forum.threads' ? listed.threads[0].title : null).toBe('La bière sur une brasserie retournée');
    /* Ada reads French: her own words, no rendering asked */
    ada.send({ t: 'forum.translate', rid: 43, id, page: 0, lang: 'fr' });
    const own = await answer(ada, 43);
    expect(own.t === 'forum.translated' ? own.rendered : null).toMatchObject({ title: null, posts: {}, pending: 0 });
    /* two renderings at 400 in and 250 out spent the budget: the next reader gets the original */
    expect(costOf('claude-opus-5', 400, 250)).toBeCloseTo(0.00825, 5);
    ada.send({ t: 'forum.reply', rid: 44, id, body: "Oui, tant qu'il reste un baril.", lang: 'fr' });
    await answer(ada, 44);
    bob.send({ t: 'forum.translate', rid: 45, id, page: 0, lang: 'en' });
    const third = await answer(bob, 45);
    const r3 = third.t === 'forum.translated' ? third.rendered : null;
    expect(r3?.on).toBe(false);
    expect(r3?.pending).toBe(0);
    expect(Object.keys(r3?.posts ?? {})).toHaveLength(1);
    expect(calls).toHaveLength(2);
    /* the moderators see the running total */
    ada.send({ t: 'forum.reports', rid: 46 });
    const reports = await answer(ada, 46);
    expect(reports.t === 'forum.reports' ? reports.translation : null).toMatchObject({ budget: 0.016, on: true });
    expect(reports.t === 'forum.reports' ? reports.translation.spent : 0).toBeCloseTo(0.0165, 4);
  });
});
