import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { offends } from '@/forum/words';
import { excerpt, inline, parse } from '@/forum/markup';
import { Store } from '../store';

/* The club's forum: threads and posts in the register, the doorman at
   the door, and the little markup a post may carry. */

describe('the doorman', () => {
  it('stops an insult however it is spelled', () => {
    expect(offends('Espèce de connard')).toBe('conard');
    expect(offends('t es un C0NNNARD')).toBe('conard');
    expect(offends('c.o.n.n.a.r.d va')).toBe('conard');
    expect(offends('nique ta mère')).toBe('nique');
    expect(offends('what a f u c k i n g move')).toBe('fucking');
  });
  it('lets ordinary words in, even the ones with a bad word inside', () => {
    expect(offends('Un assassinat à Scunthorpe, classe.')).toBeNull();
    expect(offends('La brasserie de Burton vend 3 cubes à £5.')).toBeNull();
    expect(offends('Coal at Coalbrookdale, then Derby: 12 VP')).toBeNull();
    expect(offends('')).toBeNull();
  });
});

describe('the markup', () => {
  it('picks out bold, italic, code and addresses', () => {
    expect(inline('a **b** _c_ `d` https://x.test/e.')).toEqual([
      { k: 'text', s: 'a ' },
      { k: 'b', s: 'b' },
      { k: 'text', s: ' ' },
      { k: 'i', s: 'c' },
      { k: 'text', s: ' ' },
      { k: 'code', s: 'd' },
      { k: 'text', s: ' ' },
      { k: 'link', href: 'https://x.test/e' },
      { k: 'text', s: '.' },
    ]);
  });
  it('parts paragraphs and quotes, and keeps no tag', () => {
    const blocks = parse('> quoted\n> twice\n\nthen <b>not bold</b>\nsecond line');
    expect(blocks.map((b) => b.k)).toEqual(['quote', 'p']);
    expect(blocks[0].lines).toHaveLength(2);
    expect(blocks[1].lines[0]).toEqual([{ k: 'text', s: 'then <b>not bold</b>' }]);
    expect(excerpt('> **hello** there\nworld', 12)).toBe('hello there…');
  });
});

describe('the forum in the register', () => {
  const dirs: string[] = [];
  const open = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'brassworks-'));
    dirs.push(dir);
    const store = new Store(path.join(dir, 'test.db'));
    const ada = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace');
    const bob = store.signUp('Bob', 'bob@example.test', 'another-password-1');
    if (!('account' in ada) || !('account' in bob)) throw new Error('accounts');
    return { store, ada: ada.account.id, bob: bob.account.id };
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('opens a thread, takes replies, counts and marks what is read', () => {
    const { store, ada, bob } = open();
    const id = store.forumOpen(ada, 'strategie', 'Opening with two mines', 'Coal first, always.');
    const r = store.forumReply(bob, id, 'Or iron, when Derby is free.');
    expect(typeof r).toBe('object');
    const boards = store.forumBoards(ada);
    const strat = boards.find((b) => b.key === 'strategie')!;
    expect(strat.threads).toBe(1);
    expect(strat.posts).toBe(2);
    expect(strat.last?.by).toBe('Bob');
    /* Bob answered after Ada last read: the thread is new to her, not to him */
    expect(strat.unread).toBe(1);
    expect(store.forumBoards(bob).find((b) => b.key === 'strategie')!.unread).toBe(0);
    store.forumSeen(ada, id);
    expect(store.forumBoards(ada).find((b) => b.key === 'strategie')!.unread).toBe(0);
    const view = store.forumThread(id, 0, ada, false)!;
    expect(view.posts.map((p) => p.by.name)).toEqual(['Ada', 'Bob']);
    expect(view.thread.replies).toBe(1);
  });

  it('lets the author correct, and nobody else', () => {
    const { store, ada, bob } = open();
    const id = store.forumOpen(ada, 'regles', 'Beer on a flipped brewery?', 'Does it still pour?');
    const post = store.forumThread(id, 1, ada, false)!.posts[0];
    expect(store.forumEdit(bob, post.id, 'no', false)).toBe('forum-not-yours');
    expect(store.forumEdit(ada, post.id, 'Does it still pour, once flipped?', false)).toBeNull();
    expect(store.forumEdit(bob, post.id, 'a moderator may', true)).toBeNull();
    expect(store.forumThread(id, 1, ada, false)!.posts[0].editedAt).not.toBeNull();
  });

  it('locks, pins, hides and answers reports', () => {
    const { store, ada, bob } = open();
    const id = store.forumOpen(ada, 'tables', 'A table on Friday', 'Who is in?');
    expect(store.forumMod(bob, 'lock', id)).toBeNull();
    expect(store.forumReply(bob, id, 'me')).toBe('forum-locked');
    expect(store.forumMod(bob, 'unlock', id)).toBeNull();
    const reply = store.forumReply(bob, id, 'me, and I bring beer');
    if (typeof reply === 'string') throw new Error(reply);
    expect(store.forumReport(ada, reply.post.id, 'spam', 'twice already')).toBeNull();
    expect(store.forumReport(ada, reply.post.id, 'spam', 'again')).toBe('forum-reported');
    expect(store.forumReports()).toHaveLength(1);
    expect(store.forumReports()[0].thread.title).toBe('A table on Friday');
    /* hiding the post closes the reports on it; members no longer read it, moderators do */
    expect(store.forumMod(ada, 'hide', reply.post.id)).toBeNull();
    expect(store.forumReports()).toHaveLength(0);
    const asMember = store.forumThread(id, 1, ada, false)!.posts[1];
    expect(asMember.hidden).toBe(true);
    expect(asMember.body).toBe('');
    expect(store.forumThread(id, 1, ada, true)!.posts[1].body).toBe('me, and I bring beer');
    expect(store.forumMod(ada, 'pin', id)).toBeNull();
    expect(store.forumThreads('tables', 1, ada, false).threads[0].pinned).toBe(true);
    expect(store.forumMod(ada, 'resolve', 'r-nothing')).toBe('forum-not-found');
  });
});
