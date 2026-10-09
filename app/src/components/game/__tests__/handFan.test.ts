import { describe, expect, it } from 'vitest';
import { CARD_MAX, CARD_MIN, CARD_PEEK, ENGRAVED_TOWNS, FAN_PAD, cardArt, fanMeasure, fanWidth, lastRound, nextTurnPlace, skylineOf } from '../handFan';
import { newGame } from '@/game/engine';
import { MIDLANDS } from '@/game/boards/midlands';
import type { Card, SetupPayload } from '@/game/types';

describe('the hand is measured on its room', () => {
  it('lays eight cards side by side when the room holds them', () => {
    /* 1440 wide: the fan is given about 736px */
    const m = fanMeasure(8, 736);
    expect(m.step).toBeGreaterThanOrEqual(0);
    expect(m.card).toBeGreaterThanOrEqual(CARD_MIN);
    expect(fanWidth(8, m)).toBeLessThanOrEqual(736);
  });

  it('overlaps by exactly what the room lacks', () => {
    /* a tablet's width: about 430px for eight cards, the siding counted */
    const m = fanMeasure(8, 430);
    expect(m.card).toBe(CARD_MIN);
    expect(fanWidth(8, m)).toBeLessThanOrEqual(430);
    expect(fanWidth(8, { ...m, step: m.step + 1 })).toBeGreaterThan(430);
  });

  it('keeps the siding a lifted card pushes the others into', () => {
    /* 1024 wide: 418px. The cards to the right of the one under the
       pointer slide aside by the whole overlap, and the last one must
       still end inside the fan */
    for (const room of [380, 418, 460, 520, 600, 700]) {
      const m = fanMeasure(8, room);
      if (m.card + m.step < CARD_PEEK + 1) continue;
      const slid = FAN_PAD + 8 * m.card + 7 * m.step + Math.max(0, -m.step);
      expect(slid).toBeLessThanOrEqual(room);
      expect(fanWidth(8, m)).toBeLessThanOrEqual(room);
    }
  });

  it('never hides more of a card than its peek', () => {
    const m = fanMeasure(8, 100);
    expect(m.card + m.step).toBeGreaterThanOrEqual(CARD_PEEK);
  });

  it('never grows a card past the widest', () => {
    expect(fanMeasure(3, 900).card).toBe(CARD_MAX);
  });
});

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'human' },
  { name: 'Bob', color: 'verdigris', type: 'human' },
  { name: 'Cy', color: 'brass', type: 'human' },
  { name: 'Di', color: 'steel', type: 'human' },
];
const deal = (seed = 5) => newGame({ players: SEATS, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } }, seed);

describe('the purse tells its place at the next round', () => {
  it('puts the least spent first', () => {
    const g = deal();
    const [a, b, c, d] = g.order;
    g.players[a].spent = 12;
    g.players[b].spent = 3;
    g.players[c].spent = 0;
    g.players[d].spent = 7;
    expect(nextTurnPlace(g, c)).toBe(1);
    expect(nextTurnPlace(g, b)).toBe(2);
    expect(nextTurnPlace(g, d)).toBe(3);
    expect(nextTurnPlace(g, a)).toBe(4);
  });

  it('keeps this round’s order on a tie', () => {
    const g = deal();
    const [a, b, c, d] = g.order;
    for (const i of [a, b, c, d]) g.players[i].spent = 5;
    expect([a, b, c, d].map((i) => nextTurnPlace(g, i))).toEqual([1, 2, 3, 4]);
    g.players[a].spent = 6;
    expect(nextTurnPlace(g, a)).toBe(4);
    expect(nextTurnPlace(g, b)).toBe(1);
  });

  it('names no place when the game ends with this round', () => {
    const g = deal();
    g.era = 'rail';
    g.round = 6;
    g.actionsLeft = 2;
    g.deck = [];
    for (const p of g.players) p.hand = p.hand.slice(0, 2);
    expect(lastRound(g)).toBe(true);
    expect(nextTurnPlace(g, g.order[0])).toBeNull();
    /* the canal's last round still leads into the rail's first */
    g.era = 'canal';
    expect(lastRound(g)).toBe(false);
    expect(nextTurnPlace(g, g.order[0])).toBe(1);
  });

  it('counts the last round seat by seat when a scout left the hands uneven', () => {
    const g = deal();
    const [a, b, c, d] = g.order;
    g.era = 'rail';
    g.round = 6;
    g.deck = [];
    /* the first seat has played and scouted down to one card: it still
       has a turn to come, so this is not the last round */
    for (const i of [a, b, c, d]) g.players[i].hand = g.players[i].hand.slice(0, 2);
    g.players[a].hand = g.players[a].hand.slice(0, 1);
    g.turnPos = 1;
    g.current = b;
    g.actionsLeft = 2;
    expect(lastRound(g)).toBe(false);
    expect(nextTurnPlace(g, b)).not.toBeNull();
    /* all played out behind the table: now it is */
    g.players[a].hand = [];
    expect(lastRound(g)).toBe(true);
    /* one seat still to come holding three cards: one more round */
    g.players[d].hand = [...g.players[d].hand, g.players[c].hand[0]];
    expect(lastRound(g)).toBe(false);
  });
});

describe('every card carries a picture', () => {
  it('has an engraved plate for each town of the Midlands that deals cards', () => {
    for (const town of MIDLANDS.towns.filter((x) => !x.farm)) expect(ENGRAVED_TOWNS.has(town.id)).toBe(true);
  });

  it('prints the trade’s painting from the table’s set, and the jokers’ own plates', () => {
    expect(cardArt({ id: 'a', kind: 'industry', industry: 'coal' } as Card)).toMatch(/^\/tiles-v3\/tile-coal-cut\.webp$/);
    expect(cardArt({ id: 'b', kind: 'location', town: 'dudley' } as Card)).toBe('/cards/town-dudley.webp');
    expect(cardArt({ id: 'c', kind: 'location', town: 'venezia' } as Card)).toBeNull();
    expect(cardArt({ id: 'd', kind: 'wild-location' } as Card)).toBe('/cards/wild-location.webp');
    expect(cardArt({ id: 'e', kind: 'wild-industry' } as Card)).toBe('/cards/wild-industry.webp');
  });

  it('draws a town with no plate the same way every time, across the whole plate', () => {
    const a = skylineOf('venezia');
    expect(skylineOf('venezia')).toEqual(a);
    expect(skylineOf('padova')).not.toEqual(a);
    const last = a.houses[a.houses.length - 1];
    expect(last.x + last.w).toBeGreaterThanOrEqual(96);
    for (const h of a.houses) expect(h.top).toBeLessThan(a.ground);
  });
});
