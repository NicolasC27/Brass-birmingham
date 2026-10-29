import { LOAN_AMOUNT, MERCHANTS, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { merchantDemand, merchantOpen, reachable } from '@/game/engine';
import { ledgerText } from '@/game/ledgerText';
import type { GameState, LedgerEntry } from '@/game/types';
import { getLang, localeOf } from '@/i18n';
import type { Lang } from '@/i18n';
import { loanWords } from './lessonWords';

/* ------------------------------------------------------------------ */
/* What the machine did and why a player would, and the turns of the   */
/* table a beginner would not notice on their own: the plate under its */
/* move and the news. Pure: the table and the tongue in, the words out; */
/* the guide shows them, and files them in its thread.                 */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, string | number>) => string;

/** the plate under a machine's move */
export interface BotPlate {
  /** the ledger entry of the move */
  id: number;
  seat: number;
  name: string;
  what: string;
  why: string;
  turn: string;
  /** the move is the latest action of the log — the one being played through */
  fresh: boolean;
}

/* ---------------------------- the machine ---------------------------- */

const WORKS = ['cotton', 'manufacturer', 'pottery'];

/** the merchants a place reaches over the links laid — the table as it
 *  stands, or without one link — that buy this industry */
function buyersFrom(g: GameState, town: string, industry: string, without?: string): string[] {
  const s = without ? { ...g, links: Object.fromEntries(Object.entries(g.links).filter(([id]) => id !== without)) } : g;
  const near = reachable(s, town, g.era, null);
  return MERCHANTS.filter((m) => near.has(m.id) && merchantOpen(g, m.id) && (merchantDemand(g, m.id) as string[]).includes(industry)).map((m) => m.id);
}

/** the entries a machine's move writes under its own name: not a tile of
 *  its flipping, nor what a payday took from it — its plate stays on its
 *  move whatever followed */
const MOVES = new Set(['build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass', 'candle']);

/** the last move a machine made, said as a player would reason it */
export function botReason(g: GameState, me: number, t: T, lang: Lang = getLang()): BotPlate | null {
  const e = [...g.ledger].reverse().find((x) => x.player !== undefined && x.player !== me && g.players[x.player]?.isBot && !!x.key && MOVES.has(x.key));
  if (!e || e.player === undefined) return null;
  const p = g.players[e.player];
  const v = e.vars ?? {};
  const list = (items: string[]) => new Intl.ListFormat(localeOf(lang), { type: 'conjunction' }).format(items);
  /* the entries of that same action: a development clearing two tiles,
     a sale of several, write one line per tile, and are one move all the same */
  const same = g.ledger.filter((x) => x.at === e.at && x.player === e.player && x.key === e.key);
  const industryOf = (x: LedgerEntry) => t(`game.log.industry.${x.vars?.industry}`);
  const what =
    e.key === 'develop' && same.length > 1 ? t('game.guide.developTwo', { name: p.name, list: same.map((x) => t('game.log.developed', { industry: industryOf(x), level: x.vars?.level ?? '' })).join(', '), n: same.length })
    : e.key === 'sell' && same.length > 1 ? t('game.guide.sellMany', { name: p.name, list: same.map((x) => t('game.log.head.sell', { industry: industryOf(x), level: x.vars?.level ?? '', merchant: x.vars?.merchant ?? '' })).join(', ') })
    : ledgerText(e, t);
  const facts = { name: p.name, money: p.money, level: incomeLevel(p.income), industry: typeof v.industry === 'string' ? t(`game.log.industry.${v.industry}`) : '', town: v.town ?? '', merchant: v.merchant ?? '', a: v.a ?? '', b: v.b ?? '', sale: v.saleN ?? 0, gain: v.saleGain ?? 0, to: v.to ?? 0 };
  /* the places a cube or a barrel was drawn from, each named once: the
     machine's own tile, the reader's, another player's, the market, a
     merchant's barrel */
  const seat = e.player;
  const fromOne = (src: string, tile: string): string => {
    if (src === 'market') return t('game.guide.bot.from.market');
    const [owner, town] = src.split(':');
    const vars = { tile, town: TOWN_BY_ID[town]?.name ?? town, owner: g.players[Number(owner)]?.name ?? '' };
    return t(Number(owner) === seat ? 'game.guide.bot.from.own' : Number(owner) === me ? 'game.guide.bot.from.yours' : 'game.guide.bot.from.theirs', vars);
  };
  const sourcesOf = (drawn: string, res: 'coal' | 'iron'): string[] => [...new Set(drawn.split(','))].map((x) => fromOne(x, t(`game.guide.bot.tile.${res}`)));
  const beerOf = (sales: LedgerEntry[]): string | null => {
    if (sales.some((x) => x.vars?.barrels === undefined)) return null;
    const brewery = t('game.guide.bot.tile.brewery');
    const parts: string[] = [];
    let own = 0;
    for (const x of sales) {
      const w = x.vars ?? {};
      const others = String(w.beerFrom ?? '').split(',').filter(Boolean);
      if (Number(w.barrels) > 0) parts.push(t('game.guide.bot.from.barrel', { merchant: String(w.merchant ?? '') }));
      parts.push(...others.map((o) => fromOne(o, brewery)));
      own += Math.max(0, Number(w.beer ?? 0) - Number(w.barrels ?? 0) - others.length);
    }
    if (own > 0) parts.push(t('game.guide.bot.from.ownSome', { tile: brewery }));
    return parts.length ? t('game.guide.bot.beerFrom', { from: list([...new Set(parts)]) }) : null;
  };
  let why = '';
  switch (e.key) {
    case 'build': {
      const ind = String(v.industry);
      const base = ind === 'coal' ? 'coal' : ind === 'iron' ? 'iron' : ind === 'brewery' ? 'brewery' : 'works';
      const said = [t(`game.guide.bot.build.${base}`, facts)];
      /* the coal and the iron it drew, by where they came from (an older
         line of the ledger did not say) */
      for (const res of ['coal', 'iron'] as const) {
        const drawn = String(v[`${res}From`] ?? '');
        if (drawn) said.push(t(`game.guide.bot.${res}From`, { from: list(sourcesOf(drawn, res)) }));
      }
      const tile = Object.entries(g.tiles).find(([k, x]) => k.startsWith(`${e.region}:`) && x.owner === e.player && x.industry === ind && x.level === v.level)?.[1];
      if (base === 'coal' || base === 'iron') {
        /* a mine sells its cubes as it is laid only when a merchant is in
           reach; an iron works sells its bars wherever it stands */
        const soldOut = g.ledger.some((x) => x.at === e.at && x.key === 'flip' && x.region === e.region && x.vars?.why === 'market');
        const left = tile?.cubes ?? 0;
        if (Number(v.saleN) > 0) said.push(t(base === 'iron' ? 'game.guide.bot.build.soldIron' : 'game.guide.bot.build.sold', facts), soldOut ? t('game.guide.bot.build.soldOut') : t(base === 'iron' ? 'game.guide.bot.build.leftIron' : 'game.guide.bot.build.left', { left }));
        else if (left > 0) said.push(t(base === 'iron' ? 'game.guide.bot.build.ironFull' : 'game.guide.bot.build.noMerchant', { ...facts, left }));
      } else if (base === 'works' && e.region) {
        /* a works sells only to a merchant its town reaches: said as it
           stands, never promised */
        const buyers = buyersFrom(g, e.region, ind).map((id) => MERCHANT_BY_ID[id].name);
        said.push(buyers.length ? t('game.guide.bot.build.reaches', { ...facts, list: list(buyers) }) : t('game.guide.bot.build.noBuyer', facts));
      }
      if (v.overName) said.push(t('game.guide.bot.build.over', facts));
      why = said.join(' ');
      break;
    }
    case 'network': {
      const said = [t('game.guide.bot.network', facts)];
      /* what the link reached: a merchant at one of its ends, and a works
         of the machine's that can now be sold through it */
      const ends = [v.townA, v.townB].map(String);
      const market = ends.find((x) => MERCHANT_BY_ID[x]);
      if (market) {
        const goods = merchantDemand(g, market);
        said.push(goods.length ? t('game.guide.bot.linkMerchant', { merchant: MERCHANT_BY_ID[market].name, goods: list(goods.map((x) => t(`game.guide.buyers.${x}`))) }) : t('game.guide.suggest.closedMerchant', { merchant: MERCHANT_BY_ID[market].name }));
      }
      const opened = Object.entries(g.tiles)
        .filter(([, x]) => x.owner === e.player && !x.flipped && WORKS.includes(x.industry))
        .map(([k, x]) => ({ town: k.split(':')[0], industry: x.industry, now: buyersFrom(g, k.split(':')[0], x.industry), before: buyersFrom(g, k.split(':')[0], x.industry, String(v.linkId)) }))
        .find((x) => x.now.some((m) => !x.before.includes(m)));
      if (opened) said.push(t('game.guide.bot.linkBuyer', { industry: t(`game.log.industry.${opened.industry}`), town: TOWN_BY_ID[opened.town]?.name ?? opened.town, merchant: MERCHANT_BY_ID[opened.now.find((m) => !opened.before.includes(m))!].name }));
      why = said.join(' ');
      break;
    }
    case 'sell': {
      /* every tile the sale flipped, and to whom: one merchant named once */
      const merchants = [...new Set(same.map((x) => String(x.vars?.merchant ?? '')))];
      const place = (x: LedgerEntry) => (x.region ? (TOWN_BY_ID[x.region]?.name ?? x.region) : '');
      const tiles = same.map((x) => t(merchants.length > 1 ? 'game.guide.bot.soldTileTo' : 'game.guide.bot.soldTile', { industry: industryOf(x), town: place(x), merchant: String(x.vars?.merchant ?? '') }));
      why = t(merchants.length > 1 ? 'game.guide.bot.sellEach' : same.length > 1 ? 'game.guide.bot.sellSome' : 'game.guide.bot.sell', { ...facts, list: list(tiles), merchant: merchants[0] });
      /* the beer it drank, told by the sale's own lines: the merchants'
         barrels, the breweries of others, and the rest its own */
      why += ` ${beerOf(same) ?? t('game.guide.bot.beerAny')}`;
      const bits = same.flatMap((x) => {
        const w = x.vars ?? {};
        return [w.bonusVp ? t('game.log.bonusVp', { n: w.bonusVp }) : '', w.bonusIncome ? t('game.log.bonusIncome', { n: w.bonusIncome }) : '', w.bonusMoney ? t('game.log.bonusMoney', { n: w.bonusMoney }) : '', w.bonusDevelop ? t('game.log.bonusDevelop') : ''].filter(Boolean);
      });
      if (bits.length) why += ` ${t('game.guide.bot.sellBonus', { ...facts, bits: bits.join(' · ') })}`;
      break;
    }
    case 'loan': {
      /* told by the purse it was taken from: the ledger keeps it, and an
         older line did not — today's purse still holds the loan on top */
      const purse = typeof v.purse === 'number' ? v.purse : p.money - LOAN_AMOUNT;
      why = t(`game.guide.bot.${loanWords(g, e.player, purse)}`, { ...facts, before: purse });
      break;
    }
    case 'develop':
      why = t('game.guide.bot.develop', facts);
      break;
    case 'scout':
      why = t('game.guide.bot.scout', facts);
      break;
    case 'pass':
    case 'candle':
      why = t('game.guide.bot.pass', facts);
      break;
    default:
      return null;
  }
  /* the turn: why the machine is the one moving — its first or second action, and the round's order */
  const played = new Set(g.ledger.filter((x) => x.era === e.era && x.round === e.round && x.player === e.player && x.verb !== 'system' && x.verb !== 'score').map((x) => x.at)).size;
  const you = g.players[me]?.name ?? '';
  const spentBot = g.lastSpent?.[e.player];
  const spentMe = g.lastSpent?.[me];
  let turn: string;
  if (e.round === 1 && e.era === 'canal') turn = t('game.guide.turn.first', { name: p.name });
  else if (played <= 1)
    turn =
      spentBot !== undefined && spentMe !== undefined
        ? spentBot === spentMe
          ? t('game.guide.turn.orderTie', { name: p.name, you, spentMe, round: e.round })
          : t(spentBot < spentMe ? 'game.guide.turn.orderBefore' : 'game.guide.turn.orderAfter', { name: p.name, you, spentBot, spentMe, round: e.round })
        : t('game.guide.turn.order', { name: p.name, round: e.round });
  else if (g.round !== e.round || g.era !== e.era) {
    /* the next round's order, set on what the round just ended cost each
       seat — and on a tie, this round's order stands (§5.11): who opens
       the next did not then spend less than the one tied with them */
    const opener = g.order[0];
    const spent = g.lastSpent;
    const tied = !!spent && g.players.some((_, i) => i !== opener && spent[i] === spent[opener]);
    const two = g.players.length === 2;
    const key =
      opener === e.player ? (tied ? (two ? 'roundOverTieBot' : 'roundOver') : 'roundOverBot')
      : opener === me ? (tied ? (two ? 'roundOverTieYou' : 'roundOver') : 'roundOverYou')
      : 'roundOver';
    turn = t(`game.guide.turn.${key}`, { name: p.name, you });
  }
  else turn = t(g.current === me ? 'game.guide.turn.secondThenYou' : 'game.guide.turn.second', { name: p.name, you });
  /* what a turn costs is said on the first two plates of the first round
     with two actions, and not again */
  if (e.era === 'canal' && e.round === 2 && g.round === 2) turn += ` ${t('game.guide.turn.cards')}`;
  /* fresh: the machine's move is the latest action of the log — the one being played through */
  return { id: e.id, seat: e.player, name: p.name, what, why, turn, fresh: e.at === g.actions.length - 1 };
}

/* ------------------------ what just happened ------------------------- */

/** the turns of the table a beginner would not notice on their own: a
 *  tile of theirs flipped by someone else's use, the exchange restocked,
 *  a merchant's bonus taken, a debt paid in tiles. Read from the entries
 *  of the action just played (and the payday that may follow it). */
export function happenings(g: GameState, me: number, t: T): { id: number; text: string }[] {
  const at = g.actions.length - 1;
  if (at < 0) return [];
  const actor = g.ledger.find((e) => e.at === at && e.player !== undefined && e.verb !== 'system' && e.verb !== 'score')?.player;
  const out: { id: number; text: string }[] = [];
  for (const e of g.ledger) {
    if ((e.at ?? -1) < at || !e.key) continue;
    const v = e.vars ?? {};
    const town = e.region ? (TOWN_BY_ID[e.region]?.name ?? e.region) : '';
    const industry = typeof v.industry === 'string' ? t(`game.log.industry.${v.industry}`) : '';
    const vars = { name: typeof v.name === 'string' ? v.name : '', industry, town, income: v.income ?? 0, n: v.saleN ?? 0, gain: v.saleGain ?? 0, merchant: v.merchant ?? '', value: v.value ?? 0, amount: v.amount ?? 0, bits: v.bonusBits ?? '' };
    switch (e.key) {
      case 'flip':
        /* a sale of one's own is the lesson's business, not a surprise */
        if (v.why === 'merchant') break;
        if (e.player === me) out.push({ id: e.id, text: t(`game.guide.happens.${v.why === 'barrel' ? 'barrel' : v.why === 'market' ? 'market' : 'empties'}`, vars) });
        else if (actor === me) out.push({ id: e.id, text: t('game.guide.happens.theirs', vars) });
        break;
      case 'build':
        if (Number(v.saleN) > 0) out.push({ id: e.id, text: t(e.player === me ? 'game.guide.happens.restockMine' : 'game.guide.happens.restock', vars) });
        break;
      case 'sell': {
        const bits = [v.bonusVp ? t('game.log.bonusVp', { n: v.bonusVp }) : '', v.bonusIncome ? t('game.log.bonusIncome', { n: v.bonusIncome }) : '', v.bonusMoney ? t('game.log.bonusMoney', { n: v.bonusMoney }) : '', v.bonusDevelop ? t('game.log.bonusDevelop') : ''].filter(Boolean);
        if (e.player === me && bits.length) out.push({ id: e.id, text: t('game.guide.happens.bonus', { ...vars, bits: bits.join(' · ') }) });
        break;
      }
      case 'sellOff':
        /* a rival's tile gone from the board at payday is news too: the
           reader sees it vanish */
        if (e.player === me) out.push({ id: e.id, text: t('game.guide.happens.sellOff', vars) });
        else if (e.player !== undefined) out.push({ id: e.id, text: t('game.guide.happens.theirsSellOff', { ...vars, name: g.players[e.player]?.name ?? '' }) });
        break;
      case 'short':
        /* only a short game counts the income level at its close */
        if (e.player === me) out.push({ id: e.id, text: t(g.eraLength === 'short' ? 'game.guide.happens.shortBooks' : 'game.guide.happens.short', vars) });
        else if (e.player !== undefined) out.push({ id: e.id, text: t('game.guide.happens.theirsShort', { ...vars, name: g.players[e.player]?.name ?? '' }) });
        break;
      default:
        break;
    }
  }
  return out;
}
