import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction, withEdition } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { BOT_SKILL, INDUSTRIES } from '@/game/data';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { LANGS, trIn } from '@/i18n';
import { CHAPTER_IDS } from '@/platform/cours';
import { LESSON_IDS } from '../lessons';
import { TAUGHT, reckon } from '../reckoning';
import type { AdviceId, Source } from '../reckoning';

/* the reckoning of a short game played out: you against Wedgwood on seed
   3, one of the guided game's deals, both chairs played to the end by the
   foreman's rule of thumb — a game with passes, a payday missed, barrels
   drunk and tiles of level 2 counted again at the close */

function dealt(eraLength: 'short' | 'standard' = 'short'): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength, marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

function playedOut(): GameState {
  let g = dealt();
  for (let n = 0; g.phase === 'action' && n < 500; n++) {
    const seat = g.current;
    const m = botAction(chooseBotMove(g, seat, BOT_SKILL.foreman));
    g = (m && applyAction(g, seat, m).state) || applyAction(g, seat, fallbackAction(g, seat)).state!;
  }
  /* the era's count, then the close */
  return g.phase === 'scoring-canal' ? applyAction(g, 0, { kind: 'begin-rail' }).state! : g;
}

const over = playedOut();

describe('the reckoning of a short game', () => {
  it('adds each seat\'s points up by source, as the engine counted them', () => {
    expect(over.phase).toBe('game-over');
    for (const seat of [0, 1]) {
      const r = reckon(over, seat)!;
      for (const s of [r.me, r.rival]) {
        expect(s.tiles + s.links + s.barrels + s.books.total - s.owed).toBe(s.vp);
        /* the era's count, split as it kept it */
        expect(s.links).toBe(over.canalSplit![s.seat].links);
        expect(s.tiles).toBe(over.canalSplit![s.seat].tiles);
        expect(s.flips.reduce((n, f) => n + f.vp, 0)).toBe(s.tiles);
        /* every link laid, with what it counted */
        expect(s.laid.reduce((n, l) => n + l.vp, 0)).toBe(s.links);
        expect(s.laid).toHaveLength(over.players[s.seat].stats.links);
        /* the close, as the ledger wrote it */
        const books = over.ledger.find((e) => e.key === 'books' && e.player === s.seat)!;
        expect(Number(books.vars!.extra)).toBe(s.books.total);
      }
    }
    /* the fixture has what the sources are there for */
    const r = reckon(over, 0)!;
    expect(r.me.owed + r.rival.barrels + r.rival.books.again).toBeGreaterThan(0);
  });

  it('measures the reader against whoever beat them, or the runner-up once they won', () => {
    const lost = reckon(over, 0)!;
    expect(over.winner).toBe(1);
    expect(lost.won).toBe(false);
    expect(lost.rival.seat).toBe(1);
    const won = reckon(over, 1)!;
    expect(won.won).toBe(true);
    expect(won.rival.seat).toBe(0);
  });

  it('says what the result was made on, the winner\'s widest gap first', () => {
    const r = reckon(over, 0)!;
    expect(r.gaps.length).toBeGreaterThan(0);
    for (const x of r.gaps) expect(x.gap).toBeGreaterThan(0);
    expect(r.gaps.map((x) => x.gap)).toEqual([...r.gaps.map((x) => x.gap)].sort((a, b) => b - a));
    expect(r.gaps.find((x) => x.source === 'links')?.gap).toBe(r.rival.links - r.me.links);
    /* a payday missed is a gap in the winner's favour */
    if (r.me.owed > 0) expect(r.gaps.find((x) => x.source === 'owed')?.gap).toBe(r.me.owed - r.rival.owed);
  });

  it('says where the other did better too', () => {
    const r = reckon(over, 0)!;
    for (const x of r.leads) expect(x.gap).toBeGreaterThan(0);
    expect(r.leads.map((x) => x.gap)).toEqual([...r.leads.map((x) => x.gap)].sort((a, b) => b - a));
    /* no source is on both sides */
    expect(r.leads.some((x) => r.gaps.some((y) => y.source === x.source))).toBe(false);
    /* seen from the winner's chair, the same lists: the gaps are the winner's */
    const w = reckon(over, 1)!;
    expect(w.gaps).toEqual(r.gaps);
    expect(w.leads).toEqual(r.leads);
    expect(r.tie).toBeNull();
  });

  it('tells a game level on points by what settled it: the income level, then the money', () => {
    /* level on points, the income level settling it for the machine */
    const level = structuredClone(over);
    level.players[0].vp = level.players[1].vp;
    level.players[0].income = level.players[1].income - 3;
    level.winner = 1;
    const r = reckon(level, 0)!;
    expect(r.won).toBe(false);
    expect(r.tie).toEqual({ vp: level.players[1].vp, by: 'level', mine: r.me.books.level, theirs: r.rival.books.level });
    expect(r.tie!.mine).toBeLessThan(r.tie!.theirs);
    /* level on income too: the money settles it, for the reader */
    const purse = structuredClone(level);
    purse.players[0].income = purse.players[1].income;
    purse.players[0].money = purse.players[1].money + 18;
    purse.winner = 0;
    const q = reckon(purse, 0)!;
    expect(q.won).toBe(true);
    expect(q.rival.seat).toBe(1);
    expect(q.tie).toEqual({ vp: purse.players[0].vp, by: 'money', mine: purse.players[0].money, theirs: purse.players[1].money });
    /* level on all three: the seats' order */
    const even = structuredClone(purse);
    even.players[0].money = even.players[1].money;
    expect(reckon(even, 0)!.tie?.by).toBe('seat');
  });

  it('counts what was left on the table: tiles never flipped, cards passed, money past the cap', () => {
    const g = structuredClone(over);
    /* a manufactory of level 2 left unsold, and a purse past what the close counts */
    g.tiles['redditch:1'] = { owner: 0, industry: 'manufacturer', level: 2, flipped: false, cubes: 0 };
    g.players[0].money = 71;
    const r = reckon(g, 0)!;
    const works = r.left.unflipped.find((x) => x.town === 'redditch' && x.industry === 'manufacturer')!;
    /* its points, and at the close again: it is of level 2 */
    expect(works.worth).toBe(2 * INDUSTRIES.manufacturer[1].vp);
    expect(r.left.worth).toBe(r.left.unflipped.reduce((n, x) => n + x.worth, 0));
    expect(r.left.passes).toBe(over.ledger.filter((e) => e.player === 0 && e.verb === 'pass').length);
    expect(r.left.beyond).toBe(11);
    expect(r.me.books.purse).toBe(15);
    expect(r.left.bare.every((l) => l.vp === 0)).toBe(true);
  });

  it('gives at most three things to do better, the costliest first', () => {
    const g = structuredClone(over);
    g.tiles['redditch:1'] = { owner: 0, industry: 'manufacturer', level: 2, flipped: false, cubes: 0 };
    g.players[0].money = 71;
    const r = reckon(g, 0)!;
    expect(r.advice.length).toBeGreaterThan(0);
    expect(r.advice.length).toBeLessThanOrEqual(3);
    for (const a of r.advice) expect(a.stake).toBeGreaterThan(0);
    expect(r.advice.map((a) => a.stake)).toEqual([...r.advice.map((a) => a.stake)].sort((a, b) => b - a));
    /* the unsold works weighs what it would have scored */
    expect(r.advice.find((a) => a.id === 'unsold')).toMatchObject({ stake: 2 * INDUSTRIES.manufacturer[1].vp, lesson: 'reach', chapter: 'selling' });
    /* nothing lost where nothing was: the winner's own purse is no advice */
    expect(reckon(over, 1)!.advice.every((a) => a.id !== 'hoard')).toBe(true);
  });

  it('sends every advice to a lesson of the guided game and a chapter of the rules', () => {
    for (const id of Object.keys(TAUGHT) as AdviceId[]) {
      expect(LESSON_IDS).toContain(TAUGHT[id].lesson);
      expect(CHAPTER_IDS).toContain(TAUGHT[id].chapter);
    }
  });

  it('says nothing of a game still running, given up, or a full one', () => {
    expect(reckon(dealt(), 0)).toBeNull();
    expect(reckon({ ...over, abandoned: true }, 0)).toBeNull();
    expect(reckon({ ...over, eraLength: 'standard' }, 0)).toBeNull();
    expect(reckon(over, 5)).toBeNull();
  });

  it('has its words in the four tongues', () => {
    const sources: Source[] = ['tiles', 'links', 'barrels', 'purse', 'level', 'again', 'owed'];
    const keys = [
      ...(Object.keys(TAUGHT) as AdviceId[]).map((id) => `advice.${id}`),
      ...sources.flatMap((x) => [`source.${x}`, `rows.${x}`, `tips.${x}`]),
      ...['won', 'lost', 'lead', 'yours', 'theirs', 'tie.level', 'tie.money', 'tie.seat', 'gap', 'you', 'canals', 'next', 'lesson', 'chapter', 'chapterAria', 'rows.total'],
      ...['title', 'unflipped', 'tile', 'idle', 'passes', 'bare', 'beyond', 'none'].map((x) => `left.${x}`),
    ];
    for (const lang of LANGS)
      for (const k of keys) {
        const said = trIn(lang, `game.reckoning.${k}`, { n: 2, vp: 4, mine: 1, theirs: 3, rival: 'Wedgwood', money: '£5', cap: '£60', most: 15, list: 'x', what: 'y', source: 'z', gap: 1, title: 't', industry: 'i', level: 'II', town: 'T' });
        expect(said, `${lang} ${k}`).not.toContain('game.reckoning');
        expect(said, `${lang} ${k}`).not.toMatch(/\{[a-z]+\}/);
      }
  });
});
