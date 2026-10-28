import { LOAN_AMOUNT, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { ledgerText } from '@/game/ledgerText';
import type { GameState } from '@/game/types';
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

/** the last move a machine made, said as a player would reason it */
export function botReason(g: GameState, me: number, t: T): BotPlate | null {
  const e = [...g.ledger].reverse().find((x) => x.player !== undefined && x.player !== me && g.players[x.player]?.isBot && x.key && x.key !== 'flip');
  if (!e || e.player === undefined) return null;
  const p = g.players[e.player];
  const v = e.vars ?? {};
  /* the entries of that same action: a development clearing two tiles
     writes one line per tile, and is one move all the same */
  const same = g.ledger.filter((x) => x.at === e.at && x.player === e.player && x.key === e.key);
  const what = e.key === 'develop' && same.length > 1 ? t('game.guide.developTwo', { name: p.name, list: same.map((x) => t('game.log.developed', { industry: t(`game.log.industry.${x.vars?.industry}`), level: x.vars?.level ?? '' })).join(', '), n: same.length }) : ledgerText(e, t);
  const facts = { name: p.name, money: p.money, level: incomeLevel(p.income), industry: typeof v.industry === 'string' ? t(`game.log.industry.${v.industry}`) : '', town: v.town ?? '', merchant: v.merchant ?? '', a: v.a ?? '', b: v.b ?? '', sale: v.saleN ?? 0, gain: v.saleGain ?? 0, to: v.to ?? 0 };
  let why = '';
  switch (e.key) {
    case 'build': {
      const ind = String(v.industry);
      const base = ind === 'coal' ? 'coal' : ind === 'iron' ? 'iron' : ind === 'brewery' ? 'brewery' : 'works';
      why = t(`game.guide.bot.build.${base}`, facts);
      /* a mine sells its spare cubes only when a merchant is in reach; a
         forge sells them wherever it stands, and restocks the market at once */
      if (Number(v.saleN) > 0) why += ' ' + t(base === 'iron' ? 'game.guide.bot.build.soldIron' : 'game.guide.bot.build.sold', facts);
      if (v.overName) why += ' ' + t('game.guide.bot.build.over', facts);
      break;
    }
    case 'network':
      why = t('game.guide.bot.network', facts);
      break;
    case 'sell': {
      const bits = [v.bonusVp ? t('game.log.bonusVp', { n: v.bonusVp }) : '', v.bonusIncome ? t('game.log.bonusIncome', { n: v.bonusIncome }) : '', v.bonusMoney ? t('game.log.bonusMoney', { n: v.bonusMoney }) : '', v.bonusDevelop ? t('game.log.bonusDevelop') : ''].filter(Boolean);
      why = t('game.guide.bot.sell', facts) + (bits.length ? ` ${t('game.guide.bot.sellBonus', { ...facts, bits: bits.join(' · ') })}` : '');
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
  else if (g.round !== e.round || g.era !== e.era) turn = t(g.current === e.player ? 'game.guide.turn.roundOverBot' : g.current === me ? 'game.guide.turn.roundOverYou' : 'game.guide.turn.roundOver', { name: p.name, you });
  else turn = t(g.current === me ? 'game.guide.turn.secondThenYou' : 'game.guide.turn.second', { name: p.name, you });
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
        if (e.player === me) out.push({ id: e.id, text: t('game.guide.happens.sellOff', vars) });
        break;
      case 'short':
        /* only a short game counts the income level at its close */
        if (e.player === me) out.push({ id: e.id, text: t(g.eraLength === 'short' ? 'game.guide.happens.shortBooks' : 'game.guide.happens.short', vars) });
        break;
      default:
        break;
    }
  }
  return out;
}
