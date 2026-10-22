import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { LINKS, START_MONEY } from '@/game/data';
import { newGame } from '@/game/engine';
import { passagesOf } from '@/game/faq';
import type { Card, GameState, SetupPayload } from '@/game/types';
import { dictOf, reasonText, setLang, trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { answerQuestion, answerTo, blockedBy, intentOf } from '../tableAnswers';

/* the table's answers, on the guided table itself: you against Wedgwood,
   the canal era only, the deal of seed 3 — asked in French and English */

function guided(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

const tIn = (lang: Lang) => (k: string, v?: Record<string, string | number>) => trIn(lang, k, v);
const fr = tIn('fr');
const en = tIn('en');
const passages = (lang: Lang) => passagesOf((dictOf(lang) as { rules?: unknown }).rules);

describe('a question about the table', () => {
  it('is told from the rules\' own questions by its words', () => {
    expect(intentOf('combien j ai d argent', fr, 'fr')?.id).toBe('money');
    expect(intentOf('je peux vendre ?', fr, 'fr')?.id).toBe('sell');
    expect(intentOf('il reste combien de manches', fr, 'fr')?.id).toBe('rounds');
    expect(intentOf('how much money do i have', en, 'en')?.id).toBe('money');
    /* "what is beer" asks the rules, not the table */
    expect(intentOf('c est quoi la biere', fr, 'fr')).toBeNull();
  });

  it('is answered with the table\'s own figures', () => {
    const g = guided();
    expect(answerTo('money', g, 0, fr)).toContain(String(START_MONEY));
    expect(answerTo('rounds', g, 0, en)).toContain('Round 1 of 10');
    /* nothing to sell on a bare board: the block says why */
    expect(answerTo('sell', g, 0, fr)).toBe(blockedBy('sell', g, 0, fr)!.text);
  });

  it('promises no payday in the last round', () => {
    const g = guided();
    expect(answerTo('money', g, 0, fr)).toBe(fr('game.guide.ask.answer.money', { money: START_MONEY, level: 0, pay: 0 }));
    /* the short game's last round: the purse and the level count at its close */
    const last = { ...g, round: 10 };
    expect(answerTo('money', last, 0, fr)).toBe(fr('game.guide.ask.answer.moneyLastShort', { money: START_MONEY, level: 0 }));
    expect(answerTo('money', last, 0, fr)).toContain('aucune paie');
    expect(answerTo('money', last, 0, en)).not.toMatch(/next payday/);
    /* a full game's last round is the rail's: money counts for nothing */
    const rail = { ...last, era: 'rail' as const, eraLength: 'standard' as const };
    expect(answerTo('money', rail, 0, fr)).toBe(fr('game.guide.ask.answer.moneyLast', { money: START_MONEY, level: 0 }));
    expect(answerTo('money', rail, 0, fr)).toContain('ne compte pas');
    /* the canal's last round of a full game still ends on a payday */
    expect(answerTo('money', { ...last, eraLength: 'standard' as const }, 0, fr)).toBe(answerTo('money', g, 0, fr));
  });

  it('goes to the table while a game is on, and to the rules otherwise', () => {
    const g = guided();
    const asked = answerQuestion('combien j ai d argent', { g, me: 0 }, fr, 'fr', passages('fr'));
    expect(asked).toMatchObject({ intent: 'money', near: [] });
    expect(asked.answer).toContain(String(START_MONEY));
    /* no table: the same words find the rules' answer on money */
    const away = answerQuestion('combien j ai d argent', null, fr, 'fr', passages('fr'));
    expect(away.intent).toBeNull();
    expect(away.answer.length).toBeGreaterThan(0);
    expect(away.answer).not.toBe(asked.answer);
    /* a rules question at the table is the rules' */
    expect(answerQuestion('comment marche le fer', { g, me: 0 }, fr, 'fr', passages('fr')).intent).toBeNull();
  });
});

describe('a deed the table does not allow', () => {
  it('names money only when money is what stops it', () => {
    const g = guided();
    /* the first mine is within reach of the purse */
    expect(blockedBy('coal', g, 0, fr)).toBeNull();
    const broke = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    expect(blockedBy('coal', broke, 0, fr)).toMatchObject({ money: true });
    /* the last round has no payday to wait for */
    const last = { ...broke, round: 10 };
    expect(blockedBy('coal', last, 0, fr)!.text).toContain(fr('game.guide.blocked.loanAdviceLast', { amount: 30, hit: 3 }));
  });

  it('gives the table\'s own reason when money is not what stops it', () => {
    const g = guided();
    const now = fr('game.guide.blocked.ironNow');
    /* the forge on a bare board: no coal reaches any town it could go to */
    const bare = blockedBy('iron', g, 0, fr, 'fr')!;
    expect(bare).toMatchObject({ money: false });
    expect(bare.text).toBe(`${now} ${fr('game.guide.blocked.why', { why: reasonText('No connected coal — reach a mine or a merchant', 'fr') })}`);
    expect(bare.text).toContain('Pas de charbon relié');
    /* a mine of the reader's at Coalbrookdale, and that town's card alone:
       one tile to a town, told at the town */
    const held = structuredClone(g);
    held.tiles['coalbrookdale:2'] = { owner: 0, industry: 'coal', level: 1, flipped: false, cubes: 2 };
    held.players[0].hand = [{ id: 'x1', kind: 'location', town: 'coalbrookdale' } as Card];
    expect(blockedBy('iron', held, 0, fr, 'fr')!.text).toBe(`${now} ${fr('game.guide.blocked.whyAt', { town: 'Coalbrookdale', why: reasonText('Canal Era: one tile per location', 'fr') })}`);
    /* the same mine, and the forge card: Coalbrookdale, in the network, is
       nearer than the forge towns out of it */
    held.players[0].hand = [{ id: 'x3', kind: 'industry', industry: 'iron' } as Card];
    expect(blockedBy('iron', held, 0, fr, 'fr')!.text).toContain('À Coalbrookdale, la table répond');
    /* every card names another industry: no card will do, and the lesson's criteria say why */
    const brewer = structuredClone(g);
    brewer.players[0].hand = [{ id: 'x2', kind: 'industry', industry: 'brewery' } as Card];
    expect(blockedBy('iron', brewer, 0, fr, 'fr')!.text).toBe(fr('game.guide.blocked.ironCard'));
  });

  it('names the towns the cards reach, and the one a card would open', () => {
    /* a mine at Belper, a canal to Derby and its free forge slot — and cards
       for three towns no coal reaches */
    const g = structuredClone(guided());
    g.tiles['belper:1'] = { owner: 0, industry: 'coal', level: 1, flipped: false, cubes: 1 };
    g.links[LINKS.find((l) => l.canal && [l.a, l.b].includes('belper') && [l.a, l.b].includes('derby'))!.id] = { owner: 0, era: 'canal' };
    g.players[0].hand = ['redditch', 'coventry', 'dudley'].map((town) => ({ id: town, kind: 'location', town }) as Card);
    const b = blockedBy('iron', g, 0, fr, 'fr')!;
    const why = fr('game.guide.blocked.whyAt', { town: 'Redditch, Coventry et Dudley', why: reasonText('No connected coal — reach a mine or a merchant', 'fr') });
    expect(b.text).toBe(`${fr('game.guide.blocked.ironNow')} ${why} ${fr('game.guide.blocked.cardAt', { towns: 'Derby' })}`);
    /* with the Derby card in hand the forge can be built: nothing blocks */
    g.players[0].hand.push({ id: 'derby', kind: 'location', town: 'derby' } as Card);
    expect(blockedBy('iron', g, 0, fr, 'fr')).toBeNull();
  });

  it('tells a works joined to its buyer that it lacks its beer, and answers so', () => {
    /* the page may be read in another tongue: the question's own is kept */
    setLang('en');
    const dry = structuredClone(guided());
    dry.tiles['redditch:0'] = { owner: 0, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    dry.merchantTiles['m-oxford'] = ['all'];
    dry.merchantBeer = {};
    /* not joined yet: the works and who buys it */
    expect(blockedBy('sell', dry, 0, fr)!.text).toContain(fr('game.guide.blocked.sell'));
    dry.links[LINKS.find((l) => l.a === 'redditch' && l.b === 'm-oxford')!.id] = { owner: 1, era: 'canal' };
    const b = blockedBy('sell', dry, 0, fr, 'fr')!;
    expect(b.text.startsWith(`${fr('game.guide.blocked.sellNow')} À Redditch,`)).toBe(true);
    expect(b.text).toContain('Il faut 1 bière');
    expect(answerTo('sell', dry, 0, fr, 'fr')).toBe(b.text);
    expect(answerQuestion('je peux vendre ?', { g: dry, me: 0 }, fr, 'fr', passages('fr')).answer).toBe(b.text);
  });
});
