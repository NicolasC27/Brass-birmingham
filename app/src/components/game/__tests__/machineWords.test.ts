import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { LINKS } from '@/game/data';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { setLang, tr } from '@/i18n';
import { botReason, happenings } from '../machineWords';

/* the machine's plate and the news, on the guided table — you against
   Wedgwood, the canal era only, the deal of seed 3 — with the board set
   by hand where a move needs it */

const ME = 0;
const BOT = 1;

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return structuredClone(newGame(withEdition(setup), 3));
}

/** the key said, and its figures: the words are the dictionaries' business */
const keys = (k: string, v?: Record<string, string | number>) => (v ? `${k}${JSON.stringify(v)}` : k);

/** the machine plays `a`, whoever's turn the deal left it at */
function botPlays(g: GameState, a: GameAction): GameState {
  g.current = BOT;
  const r = applyAction(g, BOT, a);
  expect(r.error).toBeUndefined();
  return r.state!;
}

const link = (a: string, b: string) => LINKS.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))!.id;

describe('the machine’s plate', () => {
  afterEach(() => setLang('fr'));

  it('stays on its move when the payday that follows takes a tile of its', () => {
    const g = table();
    /* deep in debt, one tile to give up, and the round's last action */
    g.players[BOT].income = 0;
    g.players[BOT].money = 0;
    g.tiles['leek:0'] = { owner: BOT, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    const first = applyAction(g, ME, { kind: 'pass', card: g.players[ME].hand[0].id }).state!;
    const after = botPlays(first, { kind: 'pass', card: first.players[BOT].hand[0].id });
    expect(after.ledger.some((e) => e.key === 'sellOff' && e.player === BOT)).toBe(true);
    const plate = botReason(after, ME, keys, 'fr');
    expect(plate?.why).toMatch(/^game\.guide\.bot\.pass/);
    /* and the debt itself comes as news */
    expect(happenings(after, ME, keys).map((x) => x.text).join('\n')).toMatch(/game\.guide\.happens\.theirsSellOff/);
  });

  it('tells every tile of a sale, and the merchant once', () => {
    const g = table();
    g.tiles['redditch:0'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.tiles['birmingham:1'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
    g.links[link('birmingham', 'm-oxford')] = { owner: BOT, era: 'canal' };
    g.merchantTiles['m-oxford'] = ['all', 'all'];
    g.merchantBeer['m-oxford:0'] = 1;
    g.merchantBeer['m-oxford:1'] = 1;
    const after = botPlays(g, { kind: 'sell', card: g.players[BOT].hand[0].id, sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }, { town: 'birmingham', slot: 1, merchant: 'm-oxford' }] });
    const plate = botReason(after, ME, keys, 'fr')!;
    expect(plate.what).toMatch(/^game\.guide\.sellMany/);
    expect(plate.why).toMatch(/^game\.guide\.bot\.sellSome\{/);
    /* said in French, both tiles and Oxford, elided */
    setLang('fr');
    const said = botReason(after, ME, tr, 'fr')!;
    expect(said.what).toContain('Wedgwood vend');
    expect(said.why).toContain('Vendre sa manufacture de Redditch et sa manufacture de Birmingham à Oxford les retourne');
    /* the two barrels gave the bonus twice */
    expect(said.why.match(/\+2 cases de revenu/g)).toHaveLength(2);
  });
});
