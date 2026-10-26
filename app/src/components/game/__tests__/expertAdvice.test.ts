import { describe, expect, it } from 'vitest';
import { applyAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { buildTargets, eraRounds, newGame } from '@/game/engine';
import { onlyMoney, sparedFirst } from '@/game/search';
import type { Card, GameState, SetupPayload } from '@/game/types';
import { keepOf, keepsFor, placeLens, spareFor, spentBy } from '../expertAdvice';
import { LESSON_IDS, freshProgress, lessonIndex, roundOf } from '../lessons';

/* What an expert would play, set up without spending a card the guided
   game asks the reader to keep — on its deal (seed 3, two seats), as the
   reviews found it: the canal to Oxford that opens the first round, and
   the canal of the second after a mine at Dudley, both paid by the search
   with the forge card */

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

const played = (g: GameState, a: GameAction): GameState => {
  const r = applyAction(g, g.current, a);
  if (!r.state) throw new Error(`refused: ${JSON.stringify(a)} (${r.error})`);
  return r.state;
};
const hand = (g: GameState): Card[] => g.players[0].hand;
const cardOf = (g: GameState, pred: (c: Card) => boolean): string => hand(g).find(pred)!.id;
const forge = (g: GameState) => cardOf(g, (c) => c.kind === 'industry' && c.industry === 'iron');
const coalCard = (g: GameState) => cardOf(g, (c) => c.kind === 'industry' && c.industry === 'coal');

const coventry = (c: Card) => c.kind === 'location' && c.town === 'coventry';
const WORKS = ['cotton', 'manufacturer', 'pottery'];

/** an opening: the reader's mine built, the machine passing until the
 *  reader's first turn of the second round */
function opened(town: string, slot: number, card: (c: Card) => boolean): GameState {
  let g = table();
  g = played(g, { kind: 'build', card: cardOf(g, card), town, slot, industry: 'coal' });
  while (g.current !== 0) g = played(g, { kind: 'pass', card: g.players[g.current].hand[0].id });
  return g;
}
/** the Dudley opening, with the Dudley card: two Coventry cards in hand */
const dudley = (): GameState => opened('dudley', 0, (c) => c.kind === 'location' && c.town === 'dudley');
/** the Coventry opening, with the coal card, as the lesson asks: the
 *  two Coventry cards left build nothing new there in the canal era */
const coventryOpening = (): GameState => opened('coventry', 1, (c) => c.kind === 'industry' && c.industry === 'coal');
/** the guided game's progress with every lesson before this one passed */
const upTo = (id: string) => ({ ...freshProgress('TEST'), passed: LESSON_IDS.slice(0, lessonIndex(id)) });

describe('the cards a lesson keeps', () => {
  it('keeps the forge card through the canal, and the card of the deed itself', () => {
    const g = dudley();
    expect(g.round).toBe(2);
    /* named by the lesson whose deed it is kept for: the forge's */
    expect(keepOf('link', g, 0)).toMatchObject({ lesson: 'iron', cards: [forge(g)], every: false });
    expect(keepOf('iron', g, 0)).toMatchObject({ lesson: 'iron', cards: [forge(g)] });
    expect(keepOf('coal', g, 0)).toMatchObject({ lesson: 'coal', cards: [coalCard(g)] });
    /* a works: the cards that build one as the table stands, or will once paid for */
    const works = keepOf('works', g, 0)!;
    expect(works.lesson).toBe('works');
    expect(works.cards.length).toBeGreaterThan(0);
    for (const id of works.cards) expect(buildTargets(g, 0, hand(g).find((c) => c.id === id)!).some((t) => (t.valid || onlyMoney(t)) && WORKS.includes(t.industry))).toBe(true);
    /* a page, a sale, an aim: nothing to keep */
    expect(keepOf('sell', g, 0)).toBeNull();
    expect(keepOf('beer', g, 0)).toBeNull();
    expect(keepOf('reach', g, 0)).toBeNull();
  });

  it('with no forge card in hand, keeps for the forge the cards that build one now', () => {
    const g = dudley();
    g.players[0].hand = hand(g).filter((c) => c.id !== forge(g));
    const cards = keepOf('iron', g, 0)?.cards ?? [];
    for (const id of cards) expect(buildTargets(g, 0, hand(g).find((c) => c.id === id)!).some((t) => t.valid && t.industry === 'iron')).toBe(true);
    expect(cards.length).toBe(hand(g).filter((c) => buildTargets(g, 0, c).some((t) => t.valid && t.industry === 'iron')).length);
  });

  it('keeps the cards a short purse alone stops from building', () => {
    const g = dudley();
    const rich = keepOf('works', g, 0)!.cards;
    g.players[0].money = 0;
    /* nothing builds now, yet the same cards will once the purse allows */
    expect(hand(g).some((c) => buildTargets(g, 0, c).some((t) => t.valid))).toBe(false);
    expect(keepOf('works', g, 0)?.cards).toEqual(rich);
    const noCoal = dudley();
    noCoal.players[0].hand = hand(noCoal).filter((c) => c.id !== coalCard(noCoal));
    const mines = keepOf('coal', noCoal, 0)!.cards;
    noCoal.players[0].money = 0;
    expect(keepOf('coal', noCoal, 0)?.cards).toEqual(mines);
  });

  it('under the loan, keeps every card of a town already linked to a merchant', () => {
    const g = dudley();
    /* anyone's canal will do: a sale runs along any player's links */
    g.links['redditch--m-oxford'] = { owner: 1, era: 'canal' } as GameState['links'][string];
    const redditch = cardOf(g, (c) => c.kind === 'location' && c.town === 'redditch');
    /* kept for a works that sells there: the works lesson is named */
    expect(keepOf('loan', g, 0)).toMatchObject({ lesson: 'works', cards: [redditch], every: true });
    /* no town linked to a merchant yet: nothing to keep */
    expect(keepOf('loan', dudley(), 0)).toBeNull();
    /* the last round: the loan's page asks for no card */
    expect(keepOf('loan', { ...g, round: eraRounds(2) }, 0)).toBeNull();
  });
});

describe('the cards the guided game keeps as it stands', () => {
  it('keeps the coal and forge cards from the first page of the opening', () => {
    const g = table();
    expect(g.current).toBe(0);
    const keeps = keepsFor(upTo('coal'), g, 0, 'coal', false);
    expect(keeps.map((k) => [k.lesson, k.cards])).toEqual([['coal', [coalCard(g)]], ['iron', [forge(g)]]]);
    /* a page read before the mine keeps them just the same */
    expect(keepsFor(upTo('welcome'), g, 0, null, false).map((k) => k.lesson)).toEqual(['coal', 'iron']);
  });

  it('pays the expert\'s first canal with another card than the forge card', () => {
    /* round 1 of the guided deal, the coal lesson due: the search opens
       with a canal to Oxford, paid with the forge card */
    const g = table();
    const canal: GameAction = { kind: 'network', card: forge(g), link: 'birmingham--m-oxford' };
    const got = spareFor(g, 0, canal, keepsFor(upTo('coal'), g, 0, 'coal', false));
    expect(got.action).toMatchObject({ kind: 'network', link: 'birmingham--m-oxford' });
    expect(spentBy(got.action!)).not.toContain(forge(g));
    expect(spentBy(got.action!)).not.toContain(coalCard(g));
    expect(got).toMatchObject({ kept: [forge(g)], lesson: 'iron' });
    expect(applyAction(g, 0, got.action!).state).not.toBeNull();
  });

  it('lets each opening card go once its deed is done, passed or set aside', () => {
    const g = dudley();
    /* the mine stands: the coal card is free, the forge card is not */
    expect(keepsFor(upTo('link'), g, 0, 'link', false).map((k) => k.lesson)).toEqual(['iron']);
    /* the forge lesson passed, or set aside this round: free as well */
    expect(keepsFor({ ...upTo('develop') }, g, 0, null, false)).toEqual([]);
    expect(keepsFor({ ...upTo('iron'), later: { iron: roundOf(g) } }, g, 0, null, false)).toEqual([]);
    /* set aside last round, it is back: the card is kept again */
    expect(keepsFor({ ...upTo('iron'), later: { iron: roundOf(g) - 1 } }, g, 0, null, false).map((k) => k.lesson)).toEqual(['iron']);
    /* a forge of the reader's standing: nothing left to keep it for */
    const built = dudley();
    built.tiles['birmingham:2'] = { owner: 0, industry: 'iron', level: 1, flipped: false, cubes: 0 };
    expect(keepsFor(upTo('iron'), built, 0, null, false)).toEqual([]);
  });

  it('keeps the loan\'s cards in the detour to it, before the lesson due\'s', () => {
    const g = dudley();
    g.links['redditch--m-oxford'] = { owner: 1, era: 'canal' } as GameState['links'][string];
    const keeps = keepsFor(upTo('link'), g, 0, 'link', true);
    expect(keeps.map((k) => [k.lesson, k.every])).toEqual([['works', true], ['iron', false]]);
  });
});

describe('the move set up in the hand', () => {
  it('pays the canal with another card than the forge card the link lesson keeps', () => {
    const g = dudley();
    const canal: GameAction = { kind: 'network', card: forge(g), link: 'birmingham--dudley' };
    const got = spareFor(g, 0, canal, [keepOf('link', g, 0)]);
    expect(got.action).not.toBeNull();
    expect(got.action).toMatchObject({ kind: 'network', link: 'birmingham--dudley' });
    expect(spentBy(got.action!)).not.toContain(forge(g));
    /* the second of the two Coventry cards: the hand does without it */
    expect(hand(g).filter(coventry)).toHaveLength(2);
    expect(coventry(hand(g).find((c) => c.id === got.played[0])!)).toBe(true);
    expect(got.kept).toEqual([forge(g)]);
    expect(got.lesson).toBe('iron');
    /* and the engine takes it */
    expect(applyAction(g, 0, got.action!).state).not.toBeNull();
  });

  it('pays with the card of a town the canal era closes, not the works card', () => {
    const g = coventryOpening();
    const pottery = cardOf(g, (c) => c.kind === 'industry' && c.industry === 'pottery');
    const canal: GameAction = { kind: 'network', card: forge(g), link: 'coventry--birmingham' };
    /* the search's own order would spend the pottery card: it builds nothing yet */
    const pool = hand(g).filter((c) => c.id !== forge(g) && !(c.kind === 'industry' && c.industry === 'brewery'));
    expect(sparedFirst(g, 0, pool)[0].id).toBe(pottery);
    const got = spareFor(g, 0, canal, [keepOf('link', g, 0)]);
    expect(coventry(hand(g).find((c) => c.id === got.played[0])!)).toBe(true);
    /* one Coventry card only, no pair: the mine there still closes the town */
    const one = coventryOpening();
    const second = hand(one).filter(coventry)[1].id;
    one.players[0].hand = hand(one).filter((c) => c.id !== second);
    const alone = spareFor(one, 0, canal, [keepOf('link', one, 0)]);
    expect(alone.played).toEqual([hand(one).find(coventry)!.id]);
    expect(applyAction(one, 0, alone.action!).state).not.toBeNull();
  });

  it('pays with the brewery card only when no other card will do, or a brewery stands', () => {
    const g = dudley();
    const beer = cardOf(g, (c) => c.kind === 'industry' && c.industry === 'brewery');
    const canal: GameAction = { kind: 'network', card: forge(g), link: 'birmingham--dudley' };
    const pottery = cardOf(g, (c) => c.kind === 'industry' && c.industry === 'pottery');
    /* the brewery card is the one the search would spare first */
    expect(sparedFirst(g, 0, hand(g).filter((c) => c.id !== forge(g)))[0].id).toBe(beer);
    expect(spareFor(g, 0, canal, [keepOf('link', g, 0)]).played).not.toContain(beer);
    /* the forge card and the brewery card alone: the brewery card pays */
    const two = dudley();
    two.players[0].hand = hand(two).filter((c) => c.id === forge(two) || c.id === beer);
    expect(spareFor(two, 0, canal, [keepOf('link', two, 0)]).played).toEqual([beer]);
    /* with the pottery card beside them, the pottery card pays — until a
       brewery of the reader's stands: the card is spared like any other */
    const three = dudley();
    three.players[0].hand = hand(three).filter((c) => c.id === forge(three) || c.id === beer || c.id === pottery);
    expect(spareFor(three, 0, canal, [keepOf('link', three, 0)]).played).toEqual([pottery]);
    three.tiles['birmingham:0'] = { owner: 0, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    expect(spareFor(three, 0, canal, [keepOf('link', three, 0)]).played).toEqual([sparedFirst(three, 0, hand(three).filter((c) => c.id !== forge(three)))[0].id]);
  });

  it('spares the forge card from a loan and a pass as well', () => {
    const g = dudley();
    const keep = [keepOf('link', g, 0)];
    for (const a of [{ kind: 'loan', card: forge(g) }, { kind: 'pass', card: forge(g) }] as GameAction[]) {
      const got = spareFor(g, 0, a, keep);
      expect(got.action?.kind).toBe(a.kind);
      expect(spentBy(got.action!)).not.toContain(forge(g));
      expect(applyAction(g, 0, got.action!).state).not.toBeNull();
    }
  });

  it('leaves a move as it is when it spends no card the lesson keeps', () => {
    const g = dudley();
    const other = cardOf(g, (c) => c.kind === 'location' && c.town === 'worcester');
    const canal: GameAction = { kind: 'network', card: other, link: 'birmingham--dudley' };
    expect(spareFor(g, 0, canal, [keepOf('link', g, 0)])).toEqual({ action: canal, played: [], kept: [], lesson: null });
    /* nor when no lesson keeps anything */
    const loan: GameAction = { kind: 'loan', card: forge(g) };
    expect(spareFor(g, 0, loan, [keepOf('sell', g, 0), null])).toEqual({ action: loan, played: [], kept: [], lesson: null });
  });

  it('lets the forge card build the forge: that is what it is kept for', () => {
    let g = dudley();
    g = played(g, { kind: 'network', card: cardOf(g, (c) => c.kind === 'industry' && c.industry === 'brewery'), link: 'birmingham--dudley' });
    const forgeAt = buildTargets(g, 0, hand(g).find((c) => c.id === forge(g))!).find((t) => t.valid && t.industry === 'iron')!;
    const build: GameAction = { kind: 'build', card: forge(g), town: forgeAt.town, slot: forgeAt.slot, industry: 'iron' };
    expect(spareFor(g, 0, build, [keepOf('link', g, 0), keepOf('iron', g, 0)]).action).toBe(build);
  });

  it('keeps one of the cards that build the deed, not all of them', () => {
    const g = dudley();
    g.players[0].hand = hand(g).filter((c) => c.id !== coalCard(g));
    const keep = keepOf('coal', g, 0)!;
    /* two cards or more build a mine: one may go, the others still build it */
    expect(keep.cards.length).toBeGreaterThan(1);
    const canal: GameAction = { kind: 'network', card: keep.cards[0], link: 'birmingham--dudley' };
    expect(spareFor(g, 0, canal, [keep]).action).toBe(canal);
    /* the last of them may not */
    g.players[0].hand = hand(g).filter((c) => c.id === keep.cards[0] || !keep.cards.includes(c.id));
    const last = spareFor(g, 0, canal, [keepOf('coal', g, 0)]);
    expect(spentBy(last.action!)).not.toContain(keep.cards[0]);
    expect(last.kept).toEqual([keep.cards[0]]);
  });

  it('under the loan, spares every card of a town linked to a merchant, save for a works there', () => {
    const g = dudley();
    g.links['redditch--m-oxford'] = { owner: 1, era: 'canal' } as GameState['links'][string];
    const redditch = cardOf(g, (c) => c.kind === 'location' && c.town === 'redditch');
    const keep = [keepOf('loan', g, 0)];
    const loan = spareFor(g, 0, { kind: 'loan', card: redditch }, keep);
    expect(loan.action).toMatchObject({ kind: 'loan' });
    expect(spentBy(loan.action!)).not.toContain(redditch);
    /* a works built with it at Redditch is what it is kept for */
    const works: GameAction = { kind: 'build', card: redditch, town: 'redditch', slot: 0, industry: 'manufacturer' };
    expect(spareFor(g, 0, works, keep).action).toBe(works);
  });

  it('sets nothing up when no other card of the hand plays the move, and says which card it keeps', () => {
    const g = dudley();
    g.players[0].hand = hand(g).filter((c) => c.id === forge(g));
    const canal: GameAction = { kind: 'network', card: forge(g), link: 'birmingham--dudley' };
    expect(spareFor(g, 0, canal, [keepOf('link', g, 0)])).toEqual({ action: null, played: [], kept: [forge(g)], lesson: 'iron' });
  });

  it('changes a scout\'s kept card for another', () => {
    const g = dudley();
    const others = hand(g).filter((c) => c.id !== forge(g));
    const scout: GameAction = { kind: 'scout', cards: [forge(g), others[0].id, others[1].id] };
    const got = spareFor(g, 0, scout, [keepOf('link', g, 0)]);
    expect(got.action?.kind).toBe('scout');
    expect(spentBy(got.action!)).toHaveLength(3);
    expect(spentBy(got.action!)).not.toContain(forge(g));
    expect(spentBy(got.action!)).toEqual(expect.arrayContaining([others[0].id, others[1].id]));
  });
});

describe('the place of the move', () => {
  it('lights the slot of a build under a lamp, and brings the camera to its town', () => {
    expect(placeLens({ kind: 'build', card: 'x', town: 'dudley', slot: 1, industry: 'iron' })).toEqual({ first: ['dudley:1'], at: 'dudley' });
  });

  it('lights the link of a canal, or both of a double rail', () => {
    expect(placeLens({ kind: 'network', card: 'x', link: 'birmingham--dudley' })).toEqual({ links: ['birmingham--dudley'], at: 'birmingham--dudley' });
    expect(placeLens({ kind: 'network', card: 'x', link: 'a--b', second: 'b--c' })?.links).toEqual(['a--b', 'b--c']);
  });

  it('lights the works sold and their buyers', () => {
    const sale: GameAction = { kind: 'sell', card: 'x', sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }, { town: 'worcester', slot: 1, merchant: 'm-oxford' }] };
    expect(placeLens(sale)).toEqual({ first: ['redditch:0', 'worcester:1'], merchants: ['m-oxford'], at: 'redditch' });
  });

  it('rings the button of a move off the map, and shows nothing for a pass', () => {
    expect(placeLens({ kind: 'develop', card: 'x', industries: ['pottery'] })).toEqual({ hud: 'develop' });
    expect(placeLens({ kind: 'loan', card: 'x' })).toEqual({ hud: 'loan' });
    expect(placeLens({ kind: 'scout', cards: ['x', 'y', 'z'] })).toEqual({ hud: 'scout' });
    expect(placeLens({ kind: 'pass', card: 'x' })).toBeNull();
  });
});
