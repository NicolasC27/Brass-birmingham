import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { LINKS, START_MONEY } from '@/game/data';
import { buildTargets, newGame } from '@/game/engine';
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

  it('hears the question put in other words, in the four tongues', () => {
    const de = tIn('de');
    const es = tIn('es');
    /* once read as the mines and the sale */
    expect(intentOf('Qui mène ?', fr, 'fr')?.id).toBe('win');
    expect(intentOf('Un conseil ?', fr, 'fr')?.id).toBe('do');
    expect(intentOf('Combien d’actions il me reste ?', fr, 'fr')?.id).toBe('rounds');
    expect(intentOf('How many actions left?', en, 'en')?.id).toBe('rounds');
    expect(intentOf('¿Qué debo hacer?', es, 'es')?.id).toBe('do');
    expect(intentOf('Hast du einen Tipp?', de, 'de')?.id).toBe('do');
    /* a phrase that asks where wants the question to ask it */
    expect(intentOf('Où construire ?', fr, 'fr')?.id).toBe('build');
    expect(intentOf('Wo bauen?', de, 'de')?.id).toBe('build');
    expect(intentOf('wie baue ich', de, 'de')).toBeNull();
    expect(intentOf('comment construire', fr, 'fr')).toBeNull();
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

  it('answers for the tile the question names', () => {
    const g = guided();
    expect(intentOf('Où bâtir ma forge ?', fr, 'fr')).toMatchObject({ id: 'build', about: 'ironWorks' });
    expect(intentOf('Where should I build my iron works?', en, 'en')).toMatchObject({ id: 'build', about: 'ironWorks' });
    expect(intentOf('Je peux vendre ma poterie ?', fr, 'fr')).toMatchObject({ id: 'sell', about: 'pottery' });
    expect(intentOf('où je peux construire', fr, 'fr')?.about).toBeUndefined();
    /* the slots the hand opens, each counted once */
    const slots = (industry?: string) => new Set(g.players[0].hand.flatMap((c) => buildTargets(g, 0, c)).filter((x) => x.valid && (!industry || x.industry === industry)).map((x) => `${x.town}:${x.slot}`)).size;
    expect(answerTo('build', g, 0, fr)).toBe(fr('game.guide.ask.answer.buildYes', { n: slots() }));
    expect(answerTo('build', g, 0, fr, 'fr', 'coalMine')).toBe(fr('game.guide.ask.answer.buildYesOf', { n: slots('coal'), industry: 'mine de charbon' }));
    /* a forge on a bare board: its lesson's own reason */
    expect(answerTo('build', g, 0, fr, 'fr', 'ironWorks')).toBe(blockedBy('iron', g, 0, fr, 'fr')!.text);
    /* a pottery the reader has not built */
    expect(answerQuestion('Je peux vendre ma poterie ?', { g, me: 0 }, fr, 'fr', passages('fr')).answer).toBe(fr('game.guide.ask.answer.sellNoneOf', { industry: 'poterie' }));
    /* a manufactory that sells beside a pottery that cannot */
    const two = structuredClone(g);
    two.tiles['redditch:0'] = { owner: 0, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    two.tiles['stoke:0'] = { owner: 0, industry: 'pottery', level: 1, flipped: false, cubes: 0 };
    two.merchantTiles['m-oxford'] = ['all'];
    two.merchantBeer = { [Object.keys(g.merchantBeer).find((k) => k.startsWith('m-oxford')) ?? 'm-oxford:0']: 1 };
    two.links[LINKS.find((l) => l.a === 'redditch' && l.b === 'm-oxford')!.id] = { owner: 1, era: 'canal' };
    expect(answerTo('sell', two, 0, fr, 'fr')).toContain('manufacture de Redditch');
    expect(answerTo('sell', two, 0, fr, 'fr', 'manufacturer')).toContain('manufacture de Redditch');
    expect(answerTo('sell', two, 0, fr, 'fr', 'pottery')).toBe(fr('game.guide.ask.answer.sellNoOf', { industry: 'poterie' }));
  });

  it('says who plays before whom, and why', () => {
    const g = guided();
    expect(intentOf('Pourquoi Wedgwood joue avant moi ?', fr, 'fr')?.id).toBe('order');
    expect(intentOf('Qui commence ?', fr, 'fr')?.id).toBe('order');
    expect(intentOf('Why does Wedgwood play before me?', en, 'en')?.id).toBe('order');
    /* the first round's order is drawn */
    expect(g.order).toEqual([0, 1]);
    expect(answerTo('order', g, 0, en)).toBe('In the first round the order is drawn at random: you and Wedgwood. After that, whoever spends least in a round plays first in the next. This round you have spent £0 so far: the next round’s order is set on that.');
    /* later, the money spent in the round before, the least first */
    const later = { ...g, round: 4, order: [1, 0], lastSpent: [13, 4], players: g.players.map((x, i) => ({ ...x, spent: i === 0 ? 8 : 0 })) };
    expect(answerTo('order', later, 0, en)).toBe('This round’s order follows the money spent in the last one, the least spent first: Wedgwood (£4) and you (£13). This round you have spent £8 so far: the next round’s order is set on that.');
    expect(answerTo('order', later, 0, fr, 'fr')).toContain('Wedgwood (4\u00a0£) et vous (13\u00a0£)');
    /* no round follows the short game's last */
    expect(answerTo('order', { ...later, round: 10 }, 0, en)).not.toMatch(/next round/);
  });

  it('counts the rounds left after this one, and says when the game stops', () => {
    const g = guided();
    const said = (x: GameState, lang = en, me = 0) => answerTo('rounds', x, me, lang);
    /* the first round: one action, the reader's own turn */
    expect(said(g)).toBe('Round 1 of 10: 9 more rounds after this one. You have 1 action left this turn.');
    expect(said(g, fr)).toBe(`${fr('game.guide.ask.answer.rounds', { round: 1, total: 10, left: 9 })} ${fr('game.guide.ask.answer.roundsTurn', { actions: 1 })}`);
    /* off the reader's turn, the actions are the machine's: not told */
    expect(said({ ...g, current: 1 })).toBe('Round 1 of 10: 9 more rounds after this one.');
    expect(said({ ...g, round: 9, actionsLeft: 2 })).toMatch(/^Round 9 of 10: 1 more round after this one\. You have 2 actions left/);
    /* the short game's last round: nothing after it, and no payday */
    expect(said({ ...g, round: 10, current: 1 })).toBe('Round 10 of 10: this is the last. The game stops at its end, and no payday follows.');
    /* a full game's canal era leads to the rail's */
    const full = { ...g, eraLength: 'standard' as const, current: 1 };
    expect(said({ ...full, round: 4 })).toBe('Round 4 of 10: 6 more rounds after this one. Then comes the Rail Era, 10 rounds long as well.');
    expect(said({ ...full, round: 10 })).toBe('Round 10 of 10: this is the last. Then comes the Rail Era, 10 rounds long as well.');
    expect(said({ ...full, round: 10, era: 'rail' as const })).toBe('Round 10 of 10: this is the last. The game stops at its end, and no payday follows.');
  });

  it('says the points are not counted yet in the canal era', () => {
    const g = guided();
    const win = fr('game.guide.ask.answer.win', { mine: 0, best: 0 });
    /* 0 to 0 all through the era is not the score: the close is to come */
    expect(answerTo('win', g, 0, fr)).toBe(`${win} ${fr('game.guide.ask.answer.winYetShort')}`);
    expect(answerTo('win', g, 0, fr)).toContain('clôture');
    expect(answerTo('win', { ...g, eraLength: 'standard' as const }, 0, en)).toBe(`${en('game.guide.ask.answer.win', { mine: 0, best: 0 })} ${en('game.guide.ask.answer.winYet')}`);
    expect(en('game.guide.ask.answer.winYet')).not.toMatch(/close|money/);
    /* in the rail era the canal's count stands on the track */
    const rail = { ...g, era: 'rail' as const, eraLength: 'standard' as const, players: g.players.map((x, i) => ({ ...x, vp: i === 0 ? 31 : 27 })) };
    expect(answerTo('win', rail, 0, fr)).toBe(fr('game.guide.ask.answer.win', { mine: 31, best: 31 }));
  });

  it('promises the expert\'s plate on the reader\'s turn only', () => {
    const g = guided();
    expect(g.current).toBe(0);
    expect(answerTo('do', g, 0, fr)).toBe(fr('game.guide.ask.answer.do'));
    /* the machine's turn: the note asks nothing, the answer says when to */
    const theirs = { ...g, current: 1 };
    expect(answerTo('do', theirs, 0, fr)).toBe(fr('game.guide.ask.answer.doTool', { ask: fr('game.guide.suggest.ask') }));
    expect(answerTo('do', theirs, 0, fr)).not.toContain('plaque');
    expect(answerTo('do', theirs, 0, en)).toContain('What would an expert play?');
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

  it('speaks only while moves are played, to a seat, with the assistance on', () => {
    const g = guided();
    const ask = (at: Parameters<typeof answerQuestion>[1]) => answerQuestion('combien j ai d argent', at, fr, 'fr', passages('fr')).intent;
    expect(ask({ g, me: 0 })).toBe('money');
    expect(ask({ g, me: 0, aid: true })).toBe('money');
    /* the assistance off, a spectator, a finished game: the rules answer */
    expect(ask({ g, me: 0, aid: false })).toBeNull();
    expect(ask({ g, me: -1 })).toBeNull();
    expect(ask({ g: { ...g, phase: 'game-over' }, me: 0 })).toBeNull();
  });

  it('answers a short game as one, whether the table speaks or not', () => {
    const g = guided();
    const end = (at: Parameters<typeof answerQuestion>[1]) => answerQuestion('comment je gagne', at, fr, 'fr', passages('fr'));
    /* the canal era alone, and its close */
    expect(end({ g, me: 0, aid: false })).toMatchObject({ intent: null, notion: 'initiation' });
    expect(end({ g: { ...g, phase: 'game-over' }, me: 0 }).notion).toBe('initiation');
    /* a full game ends on the rail; no game at all reads the rules as written */
    expect(end({ g: { ...g, eraLength: 'standard' }, me: 0, aid: false }).notion).toBe('gameEnd');
    expect(end(null).notion).toBe('gameEnd');
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
    /* no card in hand for a forge at all: the criteria, and the town all the same */
    const brewer = structuredClone(g);
    brewer.players[0].hand = [{ id: 'x4', kind: 'industry', industry: 'brewery' } as Card];
    expect(blockedBy('iron', brewer, 0, fr, 'fr')!.text).toBe(`${fr('game.guide.blocked.ironCard')} ${fr('game.guide.blocked.cardAt', { towns: 'Derby' })}`);
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
