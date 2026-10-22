import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, GraduationCap, Lightbulb, Minus, Newspaper, Sparkles, X } from 'lucide-react';
import { aidOn, getBoardOptions, setBoardOption } from '@/components/game/boardOptions';
import { GUIDE_RAIL, MINI_KEY, POS_KEY } from '@/components/game/guideKeys';
import LessonLens from './LessonLens';
import { getKeybindings, keyLabel } from '@/components/game/keybindings';
import { INCOME_PAYOUT, INDUSTRIES, LOAN_AMOUNT, LOAN_INCOME_HIT, MERCHANT_BY_ID, START_INCOME_SPACE, START_MONEY, TOWN_BY_ID, incomeLevel, LINKS } from '@/game/data';
import { buildTargets, canLoan, eraRounds, linkTargets, marketSaleOnBuild, sellTargets } from '@/game/engine';
import { ledgerText } from '@/game/ledgerText';
import { carries, faqBest, faqFor, passagesOf } from '@/game/faq';
import { askedAs, asksTheRules, consult, mend, tell } from '@/game/faq/consult';
import type { NearNotion } from '@/game/faq/consult';
import { describeAction, useGame } from '@/game/store';
import { searchTurn } from '@/game/search';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { dictOf, getLang, localeOf, useLang, useT } from '@/i18n';
import { roman } from '@/gl/roman';
import { cn } from '@/lib/utils';
import { useHudRects } from './useHudRects';
import { EMPTY_THREAD, askThread, fileThread } from './guideThread';
import { NearList } from './AskGuide';
import type { Thread } from './guideThread';
import { listProgress, recurring } from '@/game/progress';
import type { Motif } from '@/game/progress';
import { LAST_LESSON, LESSONS, back as readBack, cheapestWorks, detourOf, due as dueNow, forward as readForward, freshProgress, lastRound, lessonIndex, lessonOf, onProgress, optionalNow, pass, progressAt, reread, saveProgress, see, setAside, settle, wayOn } from './lessons';
import type { LessonCtx, Review, Show } from './lessons';
import { barrelBonuses, buyersOf, closingWords, dryRound, firstPayday, forgeWays, forgesFromMines, loanWords, stepKeyOf, worksOnMat } from './lessonWords';

/* ------------------------------------------------------------------ */
/* The guide — a parchment note under the top bar.                     */
/*                                                                     */
/* Three voices, one note. The lessons of the guided game: what the   */
/* board is, what money and income are, what the mat holds, and then  */
/* the first turns, each done by playing it. The machine's reasons:   */
/* after every move a bot makes, why a player would make it. And the  */
/* assistance: what the selected card allows right now, a warning     */
/* when money runs short, a word when payday comes or a tile flips.   */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, string | number>) => string;

interface Ctx {
  g: GameState;
  me: number;
  /** the lesson on show, when one is */
  step: string | null;
  card: GameState['players'][number]['hand'][number] | null;
  verb: string | null;
  buildPick: { industry: string; level: number; town: string } | null;
}

/* ------------------------------- lessons ----------------------------- */

/* the lessons themselves, and how far the reader has come, are kept in
   lessons.ts: by id, for the guided table */

const WORKS = ['cotton', 'manufacturer', 'pottery'];
/** the progress outside the guided game: nothing to settle, nothing to write */
const NO_PROGRESS = freshProgress(null);

type Pos = { x: number; y: number };
const readPos = (): Pos => {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Pos | null;
    if (v && typeof v.x === 'number' && typeof v.y === 'number') return fit(v);
  } catch {
    /* fresh table */
  }
  return { x: 0, y: 0 };
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** a spot the note can still be read at, in this window */
const fit = (p: Pos, w = window.innerWidth, h = window.innerHeight): Pos => {
  /* a window too small to measure (a hidden tab) must not move the note */
  const left = Math.max(0, w - laneWidth(w) - 40);
  const down = Math.max(0, h - 220);
  return { x: clamp(p.x, -left, 0), y: clamp(p.y, Math.min(0, -90), down) };
};
/** words listed as the reader's language lists them: "A, B ou C" */
const listed = (items: string[], type: 'conjunction' | 'disjunction'): string => new Intl.ListFormat(localeOf(getLang()), { type }).format(items);
/** towns named so */
const townList = (ids: string[], type: 'conjunction' | 'disjunction'): string => listed(ids.map((id) => TOWN_BY_ID[id]?.name ?? id), type);

/** the figures a lesson's text is written with: the table as it stands,
 *  and what it started from — a lesson read again later still says how
 *  the game began. `need` is what the next works would cost, worked out
 *  only for the lesson that speaks of it */
function stepVarsOf(game: GameState, me: number, t: (key: string, vars?: Record<string, string | number>) => string, need: number | null = null): Record<string, string | number> {
  const p = game.players[me];
  const k = getKeybindings();
  const first = firstPayday(game, me) ?? incomeLevel(p.income);
  /* what each merchant's barrel gives at this table */
  const barrels = barrelBonuses(game).map(({ merchant, bonus }) =>
    bonus.vp ? t('game.guide.barrels.vp', { merchant, n: bonus.vp })
    : bonus.income ? t('game.guide.barrels.income', { merchant, n: bonus.income })
    : bonus.money ? t('game.guide.barrels.money', { merchant, n: bonus.money })
    : t('game.guide.barrels.develop', { merchant }),
  );
  /* where a first mine feeds a forge of the reader's, read off the board */
  const ways = forgeWays(game, me);
  const avoid = ways.deadEnds.length ? t('game.guide.coalAvoid', { list: townList(ways.deadEnds, 'disjunction') }) : '';
  /* and where the reader's own mine sends its canal (a mine no canal
     leads from to a forge has a lesson of its own: stepKeyOf) */
  const toward = forgesFromMines(game, me);
  /* who buys what at this table: "Shrewsbury le coton, Oxford tout" */
  const buyers = buyersOf(game).map(({ merchant, goods }) =>
    goods === 'all' ? t('game.guide.buyers.all', { merchant }) : t('game.guide.buyers.some', { merchant, goods: listed(goods.map((x) => t(`game.guide.buyers.${x}`)), 'conjunction') }),
  );
  /* the works the mat offers next, priced: "filature I (12 £), …" */
  const tiles = worksOnMat(game, me).map(({ industry, level, cost, coal, iron }) =>
    t('game.guide.worksTile.line', { industry: t(`game.guide.worksTile.${industry}`), level: roman(level), cost: listed([t('game.guide.worksTile.money', { n: cost }), ...(coal ? [t('game.guide.worksTile.coal', { n: coal })] : []), ...(iron ? [t('game.guide.worksTile.iron', { n: iron })] : [])], 'conjunction') }),
  );
  /* who else lays links and drinks barrels: the one rival by name — the
     machine, at the guided table — else another player, never a blank */
  const others = game.players.filter((_, i) => i !== me);
  const rival = others.length === 1 ? others[0].name : t('game.guide.rival');
  return { bonuses: barrels.length ? t('game.guide.barrels.line', { list: barrels.join(', ') }) : '', need: need ?? '', forgeTowns: townList(ways.forges, 'disjunction'), avoid, toward: toward.length ? ` (${townList(toward, 'disjunction')})` : '', buyers: buyers.join(', '), tiles: listed(tiles, 'disjunction'), name: p.name, money: p.money, level: incomeLevel(p.income), startMoney: START_MONEY, startLevel: incomeLevel(START_INCOME_SPACE), firstLevel: first, firstPay: Math.abs(first), pay: Math.abs(INCOME_PAYOUT[p.income]), rounds: eraRounds(game.players.length), dry: dryRound(game.players.length), bot: game.players.find((x) => x.isBot)?.name ?? '', rival, nth: t(game.actionsLeft === 1 ? 'game.guide.nth.second' : 'game.guide.nth.first'), keyMat: keyLabel(k.mat), keyLedger: keyLabel(k.ledger), keyMarket: keyLabel(k.market), keyVp: keyLabel(k.vpTrack) };
}

/** a sentence that follows a colon starts low */
const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const place = (p: Pos) => `translate(${p.x}px, ${p.y}px)`;
/** the lane the note keeps down the right edge of the table */
const laneWidth = (w = typeof window === 'undefined' ? 1280 : window.innerWidth): number => Math.max(300, Math.min(380, Math.round(w * 0.34)));

/* ---------------------------- the machine ---------------------------- */

/** the last move a machine made, said as a player would reason it */
function botReason(g: GameState, me: number, t: T): { id: number; seat: number; name: string; what: string; why: string; turn: string; fresh: boolean } | null {
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
function happenings(g: GameState, me: number, t: T): { id: number; text: string }[] {
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

/* ------------------------------ the thread --------------------------- */

/* the thread itself is kept in guideThread.ts */

/** the questions the guide knows, in the order they are tried */
const ASKS = ['do', 'sell', 'build', 'coal', 'beer', 'money', 'rounds', 'win'] as const;
type Ask = (typeof ASKS)[number];

/* ----------------------------- the block ----------------------------- */

const money = (r?: string) => !!r && r.startsWith('Needs £');

/** the reason alone, and the reason with the advice that follows it */
type Block = { short: string; text: string; money: boolean };

/** why the lesson's deed cannot be done at this table right now, said
 *  with the player's own figures, and whether money is what is missing;
 *  null when it can */
function blockedBy(id: string, g: GameState, me: number, t: T): Block | null {
  const p = g.players[me];
  const vars = { money: p.money, amount: LOAN_AMOUNT, hit: LOAN_INCOME_HIT };
  /* the loan, or the payday to come back after — none follows the last round */
  const advice = () => t(lastRound(g) ? 'game.guide.blocked.loanAdviceLast' : 'game.guide.blocked.loanAdvice', vars);
  if (id === 'coal' || id === 'iron' || id === 'works') {
    const inds = id === 'coal' ? ['coal'] : id === 'iron' ? ['iron'] : WORKS;
    const targets = p.hand.flatMap((c) => buildTargets(g, me, c)).filter((x) => inds.includes(x.industry));
    if (targets.some((x) => x.valid)) return null;
    const short = targets.filter((x) => money(x.reason));
    if (short.length) {
      const why = t(`game.guide.blocked.${id}Money`, { ...vars, need: Math.min(...short.map((x) => x.total)) });
      return { short: why, text: `${why} ${advice()}`, money: true };
    }
    const why = t(`game.guide.blocked.${id}Card`, vars);
    return { short: why, text: why, money: false };
  }
  if (id === 'link') {
    const targets = linkTargets(g, me);
    if (targets.some((x) => x.valid)) return null;
    const short = targets.some((x) => money(x.reason));
    const why = t(short ? 'game.guide.blocked.linkMoney' : 'game.guide.blocked.link', vars);
    return { short: why, text: short ? `${why} ${advice()}` : why, money: short };
  }
  const plain = (why: string): Block => ({ short: why, text: why, money: false });
  if (id === 'sell') {
    if (sellTargets(g, me).some((x) => x.valid)) return null;
    /* the unsold works, and the merchants who buy their goods */
    const mine = Object.entries(g.tiles).filter(([, x]) => x.owner === me && !x.flipped && WORKS.includes(x.industry));
    const lines = mine.map(([key, x]) => {
      const buyers = Object.entries(g.merchantTiles)
        .filter(([, tiles]) => tiles.some((m) => m === 'all' || m === x.industry))
        .map(([id]) => MERCHANT_BY_ID[id]?.name ?? id);
      return t('game.guide.blocked.sellWorks', { industry: t(`game.log.industry.${x.industry}`), town: TOWN_BY_ID[key.split(':')[0]]?.name ?? key, buyers: buyers.join(', ') || '—' });
    });
    return plain([t('game.guide.blocked.sell', vars), ...lines].join(' '));
  }
  if (id === 'loan') return canLoan(g, me).ok ? null : plain(t('game.guide.blocked.loan', vars));
  return null;
}

/* ----------------------------- the alerts ---------------------------- */

/** what the assistance says on its own: money, payday, a tile flipped, the era */
function alerts(c: Ctx, t: T): { id: string; text: string }[] {
  const { g, me } = c;
  const p = g.players[me];
  const out: { id: string; text: string }[] = [];
  const last = g.ledger[g.ledger.length - 1];
  const level = incomeLevel(p.income);
  /* the era's last rounds come first: two lines to a page, and they must
     not fall to the second */
  const closing = closingWords(g, me);
  if (closing) {
    out.push({ id: 'eraEnd', text: t(`game.guide.alerts.${closing.era}`, { total: eraRounds(g.players.length) }) });
    const named = closing.mine;
    if (named) out.push({ id: 'eraEndMine', text: t(`game.guide.alerts.${named.key}`, { list: named.tiles.map((x) => `${t(`game.log.industry.${x.industry}`)} (${TOWN_BY_ID[x.town]?.name ?? x.town})`).join(', '), n: named.tiles.length, unsold: named.unflipped }) });
  }
  /* a short game counts the purse and the income level at its close: a loan
     is weighed there, not written off as late */
  if (p.money < 8 && p.loans === 0) out.push({ id: 'broke', text: t(g.eraLength === 'short' ? 'game.guide.alerts.brokeShort' : 'game.guide.alerts.broke', { money: p.money, amount: LOAN_AMOUNT, hit: LOAN_INCOME_HIT, level, after: Math.max(-10, level - LOAN_INCOME_HIT) }) });
  else if (p.money < 8) out.push({ id: 'brokeAgain', text: t('game.guide.alerts.brokeAgain', { money: p.money, level }) });
  if (last?.key === 'payday') out.push({ id: 'payday', text: t(level >= 0 ? 'game.guide.alerts.payday' : 'game.guide.alerts.paydayOwed', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  if (g.deck.length === 0 && p.hand.length > 0) out.push({ id: 'deckOut', text: t('game.guide.alerts.deckOut', { cards: p.hand.length }) });
  if (level < 0) out.push({ id: 'negative', text: t('game.guide.alerts.negative', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  return out;
}

/* ------------------------------ the tips ----------------------------- */

/** the tips that speak to the move being prepared rather than to the game at
 *  large: under a lesson, the rest is what the lesson itself is for */
const AT_HAND = new Set(['coalMarket', 'ironMarket', 'buildCost', 'network', 'sell', 'unsold', 'noLinks']);

const TIPS: { id: string; when: (c: Ctx) => boolean; vars?: (c: Ctx) => Record<string, string | number> }[] = [
  { id: 'firstRound', when: ({ g }) => g.era === 'canal' && g.round === 1 },
  { id: 'select', when: ({ card, g, me }) => !card && g.current === me },
  { id: 'location', when: ({ card }) => card?.kind === 'location', vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }) },
  { id: 'industry', when: ({ card }) => card?.kind === 'industry', vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }) },
  { id: 'wild', when: ({ card }) => !!card && card.kind.startsWith('wild') },
  {
    id: 'coalMarket',
    when: ({ g, buildPick }) => !!buildPick && buildPick.industry === 'coal' && marketSaleOnBuild(g, buildPick.town, 'coal', buildPick.level).sold > 0,
    vars: ({ g, buildPick }) => marketSaleOnBuild(g, buildPick!.town, 'coal', buildPick!.level),
  },
  {
    id: 'ironMarket',
    when: ({ g, buildPick }) => !!buildPick && buildPick.industry === 'iron' && marketSaleOnBuild(g, buildPick.town, 'iron', buildPick.level).sold > 0,
    vars: ({ g, buildPick }) => marketSaleOnBuild(g, buildPick!.town, 'iron', buildPick!.level),
  },
  { id: 'buildCost', when: ({ buildPick }) => !!buildPick, vars: ({ buildPick }) => ({ cost: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].cost, income: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].incomeDelta, vp: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].vp }) },
  { id: 'network', when: ({ g, me, verb, step }) => verb === 'network' && step !== 'link' && linkTargets(g, me).some((l) => l.valid) },
  { id: 'sell', when: ({ verb }) => verb === 'sell' },
  { id: 'noLinks', when: ({ g, me }) => g.round >= 2 && !Object.values(g.links).some((l) => l.owner === me) },
  { id: 'unsold', when: ({ g, me }) => Object.values(g.tiles).some((t) => t.owner === me && !t.flipped && WORKS.includes(t.industry)) && sellTargets(g, me).some((x) => x.valid) },
  { id: 'develop', when: ({ g, me }) => g.players[me].stacks.pottery?.[0] === 1 },
  { id: 'links', when: ({ g }) => g.round >= 3 },
];

/* ------------------------------ the note ----------------------------- */

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={cn('font-serif text-[13.5px] leading-snug text-ink-900/85', i > 0 && 'mt-1.5', className)}>
          {line}
        </p>
      ))}
    </>
  );
}

function Guide({ dock = 0 }: { dock?: number }) {
  const t = useT();
  const game = useGame((s) => s.game);
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const buildPick = useGame((s) => s.buildPick);
  const tutorial = useGame((s) => s.tutorial);
  /* the guided game's table, which its progress is kept for */
  const table = useGame((s) => s.local);
  const endTutorial = useGame((s) => s.endTutorial);
  const matPlayer = useGame((s) => s.matPlayer);
  const sheetOpened = useGame((s) => s.sheetOpened);
  const openMat = useGame((s) => s.openMat);
  const closeMat = useGame((s) => s.closeMat);
  const setMarketFocus = useGame((s) => s.setMarketFocus);
  const [hidden, setHidden] = useState(false);
  /* the machine's move that was read and understood, by its entry in the
     log: the length of the log moves with every entry and would bring
     the plate back after each move of one's own */
  const [botHidden, setBotHidden] = useState<number>(-1);
  /* what the machine would play in the reader's seat, asked for one
     position: the index of the action to come names it */
  const [advice, setAdvice] = useState<{ at: number; action: GameAction | null; busy: boolean } | null>(null);
  const setBotHold = useGame((s) => s.setBotHold);
  const coachHold = useGame((s) => s.coachHold);
  const setGlimpse = useGame((s) => s.setGlimpse);
  /* G folds the guide to a rail down the right edge, and back */
  useEffect(() => {
    if (!dock) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key.toLowerCase() !== 'g' || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      setBoardOption('guideFolded', !getBoardOptions().guideFolded);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dock]);
  const [paged, setPaged] = useState({ key: '', page: 0 });
  /* the note can be dragged by its head, and folded to a strip; a new
     lesson unfolds it */
  const [pos, setPos] = useState<Pos>(readPos);
  const [miniAt, setMiniAt] = useState<string>(() => {
    try {
      return localStorage.getItem(MINI_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const grip = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; at: Pos; t0: number } | null>(null);
  /* the room the note has: under whatever the top bar occupies, above the
     hand — read from the pieces as they move, not sounded once a second */
  const [bar, map, dockBox] = useHudRects(['[data-topbar]', '[data-minimap]', '[data-dock]']);
  const band = useMemo(() => {
    const h = window.innerHeight;
    const top = (bar?.bottom || 80) + 12;
    /* the lane runs down to whatever the right edge already holds */
    const feet = [map?.top, dockBox && dockBox.right > window.innerWidth - laneWidth() - 40 ? dockBox.top : undefined, h - 40].filter((x): x is number => typeof x === 'number' && x > top);
    return { top, height: Math.max(220, Math.round(Math.min(...feet) - top - 12)) };
  }, [bar, map, dockBox]);
  /* the note is kept inside the window: once as it opens, and whenever the
     window or the room around it changes — the same place when it fits */
  useEffect(() => {
    const keep = () => setPos((p) => {
      const f = fit(p);
      return f.x === p.x && f.y === p.y ? p : f;
    });
    keep();
    window.addEventListener('resize', keep);
    return () => window.removeEventListener('resize', keep);
  }, [band]);
  /* the press that just ended was a move or a hold, not a click: the
     click that follows it must not fold the note */
  const held = useRef(false);
  /* the box moves under the pointer without a render: the state is
     written once, when it is let go */
  const box = useRef<HTMLDivElement>(null);

  /* my seat: online the one the table gave me; at home the first human at the table */
  const me = seat ?? Math.max(0, game?.players.findIndex((p) => !p.isBot) ?? 0);
  const myTurn = !!game && game.phase === 'action' && game.current === me && !game.players[me].isBot;
  const aid = !!game && me >= 0 && aidOn(game.assist, code !== null);
  /* the turns of the table, and the highest entry read of them */
  const happens = useMemo(() => (game && aid ? happenings(game, me, t) : []), [game, aid, me, t]);
  const [eventsSeen, setEventsSeen] = useState(-1);
  /* the machine's move whose reading the reader has set aside to see the lesson */
  const [unfoldAt, setUnfoldAt] = useState(-1);
  /* everything already said, oldest first, and what is still live */
  const [thread, setThread] = useState<Thread>(EMPTY_THREAD);
  const said = thread.said;
  const [question, setQuestion] = useState('');
  /* the notions offered under a question nothing matched, by the question */
  const [nearFor, setNearFor] = useState<Record<string, NearNotion[]>>({});
  /* the rules codex, flattened once into the passages a question searches */
  const lang = useLang();
  const passages = useMemo(() => passagesOf((dictOf(lang) as { rules?: unknown }).rules), [lang]);
  /* a lesson the reader went back to: held until they read forward again */
  const [review, setReview] = useState<Review | null>(null);
  /* the sheet of progress points at a lesson: the motif that came back most
     over the last games, and the step of the guide that teaches against it */
  const [adviceSeen, setAdviceSeen] = useState(false);
  /* outside the guided game the lesson has no page to open: it unfolds in the plate */
  const [adviceOpen, setAdviceOpen] = useState(false);
  const sheetAdvice = useMemo(() => {
    const back = recurring(listProgress(), 10)[0];
    if (!back) return null;
    const LESSON: Record<Motif, string> = { singleRail: 'link', buildOverLink: 'link', linkOverBuild: 'works', loanOverBuild: 'loan', sellLate: 'sell', buildOverDevelop: 'develop', developOverBuild: 'develop', wrongTown: 'works', wrongIndustry: 'works', passed: 'tips' };
    const id = LESSON[back.motif];
    return lessonOf(id) ? { motif: back.motif, times: back.times, id } : null;
  }, []);
  const news = happens.filter((x) => x.id > eventsSeen);

  /* the lessons: the progress kept for this table, settled against the
     table as it stands — a deed seen undone and now done is passed, and a
     lesson once passed stays passed (closing the mat again is no reason to
     teach the mat again) */
  const kept = useSyncExternalStore(onProgress, () => (tutorial && table ? progressAt(table) : NO_PROGRESS));
  const lctx = useMemo<LessonCtx | null>(() => (game ? { g: game, me, sel: selectedCardId, mat: matPlayer, sheet: sheetOpened } : null), [game, me, selectedCardId, matPlayer, sheetOpened]);
  const settled = useMemo(() => (tutorial && lctx ? settle(kept, lctx) : kept), [tutorial, lctx, kept]);
  const owed = useMemo(() => (tutorial && lctx ? dueNow(settled, lctx) : null), [tutorial, lctx, settled]);
  /* nothing due now but a lesson still to come — set aside, or waiting on
     its time: no lesson on show, a line that says so */
  const idle = owed?.mode === 'idle' && review === null;
  /* every lesson passed: the table is a plain one again */
  const over = owed?.mode === 'finished' && review === null;
  /* the lesson on show, for the tips that must not repeat it */
  const dueId = review ? review.id : idle || over ? null : (owed?.id ?? null);

  const ctx = useMemo<Ctx | null>(() => (game ? { g: game, me, step: dueId, card: selectedCardId ? (game.players[me]?.hand.find((c) => c.id === selectedCardId) ?? null) : null, verb, buildPick: buildPick ? { industry: buildPick.industry, level: buildPick.level, town: buildPick.town } : null } : null), [game, me, dueId, selectedCardId, verb, buildPick]);
  const tips = useMemo(() => (ctx && aid && myTurn ? TIPS.filter((tip) => tip.when(ctx)).map((tip) => ({ id: tip.id, text: t(`game.guide.tips.${tip.id}`, tip.vars?.(ctx)) })) : []), [ctx, aid, myTurn, t]);
  const warnings = useMemo(() => (ctx && aid ? alerts(ctx, t) : []), [ctx, aid, t]);
  const bot = useMemo(() => (game && aid ? botReason(game, me, t) : null), [game, aid, me, t]);

  const situation = `${selectedCardId ?? ''}|${verb ?? ''}|${game?.current ?? ''}`;
  const page = paged.key === situation ? paged.page : 0;
  const setPage = (p: number) => setPaged({ key: situation, page: p });

  /* the machine's next move waits while its last one is being read (guided game only) */
  /* a lesson still to be read holds the table: the reader sets the pace —
     a page, a deed done beforehand or a lesson read back, not a deed to do.
     So does the coach's word on the reader's last move, a moment */
  const unread = !!owed && (review !== null || owed.mode === 'read' || owed.mode === 'already');
  const holdWanted = !!(tutorial && game && game.phase === 'action' && game.players[game.current]?.isBot && ((bot && bot.fresh && botHidden !== bot.id) || unread || news.length > 0 || coachHold));
  useEffect(() => {
    setBotHold(holdWanted);
    return () => setBotHold(false);
  }, [holdWanted, setBotHold]);


  /* the lesson on show, worked out before the note decides whether to
     show at all: the thread files away whatever it replaces */
  const onTable = !!game && game.phase === 'action';
  /* the guided game's note is up: a lesson on show, or the line of the guide at rest */
  const guided = onTable && !!owed && !over;
  const showSteps = guided && !idle;
  const aside = guided && idle;
  /* the lesson due, and the deed it asks for when the table does not allow
     it now; when money is what is missing and the loan is still to be
     taught, the guide takes that lesson first and comes back to this one after */
  const dueStep = owed?.id ? lessonOf(owed.id)! : null;
  const block = game && owed?.mode === 'do' && review === null ? blockedBy(owed.id!, game, me, t) : null;
  const detour = !!(lctx && owed && block?.money && detourOf(settled, owed, lctx, true, canLoan(lctx.g, me).ok));
  /* what is on show: the lesson read back, the loan first, the lesson due
     — or, at rest, the one to come */
  const shownId = review ? review.id : detour ? 'loan' : (owed?.id ?? LAST_LESSON);
  const step = showSteps ? lessonOf(shownId)! : null;
  const shownIndex = lessonIndex(shownId);
  /* at rest, a lesson set aside says it comes back; one waiting on its time does not */
  const setAsideNow = aside && settled.later[shownId] !== undefined;
  /* a deed the reader may pass as the table stands — the loan, when the
     purse already pays for the next works: it says so, and what that
     works costs. Only the live deed, still undone: not in the detour,
     where money is what is missing, nor read back, nor done beforehand */
  const spare = useMemo(() => (lctx && showSteps && review === null && !detour && owed?.mode === 'do' && owed.id === shownId && optionalNow(shownId, lctx) ? { need: cheapestWorks(lctx.g, me) } : null), [lctx, showSteps, review, detour, owed, shownId, me]);
  /* what the lesson lights on the table: a deed that can wait is read
     past, so its button is not rung */
  const lensId = showSteps && !spare ? step?.id : null;
  const showBot = bot && botHidden !== bot.id && (guided || !hidden);
  /* the machine's fresh move is on show: the lesson folds to its strip
     so the plate reads first, until it is understood — every move of
     hers, in the guided game; an older plate is a line */
  const reading = !!(tutorial && showBot && bot?.fresh);
  /* a deed on show, still undone, is noted as seen: doing it passes it,
     wherever the reader has read to meanwhile. On show means in the
     note: not behind the folded rail, nor under her move's plate, nor
     on her turn, when the note only says whose turn it is (see) */
  const inView = showSteps && review === null && dock !== GUIDE_RAIL && !reading;
  const live = useMemo(() => (inView && lctx ? see(settled, shownId, lctx) : settled), [inView, lctx, settled, shownId]);
  /* the progress is written from an effect: a render may be thrown away,
     a line written to the disk may not */
  useEffect(() => {
    if (tutorial && live !== kept) saveProgress(live);
  }, [tutorial, live, kept]);
  /* the lane reads like a conversation: the newest turn is the one in view */
  useEffect(() => {
    const el = box.current;
    if (dock && el) el.scrollTop = el.scrollHeight;
  }, [dock, said.length, shownId, game?.ledgerSeq]);

  /* a lesson, a move of hers or an event that is no longer the live one
     is filed into the thread, worded as it was when it was read: one pure
     step, kept only when it changed anything (see guideThread.ts) */
  const filedNow = fileThread(thread, {
    lesson:
      game && dock && showSteps && step
        ? {
            at: shownIndex,
            word: () => {
              const vars = stepVarsOf(game, me, t, spare?.need);
              const key = stepKeyOf(step.id, game, me, !!spare);
              return { head: t(`game.guide.steps.${key}.title`, vars), body: t(`game.guide.steps.${key}.body`, vars) };
            },
          }
        : null,
    rest: !!(dock && aside),
    bot: dock && bot ? { id: bot.id, head: bot.what, body: bot.why, seat: bot.seat } : null,
    news: dock ? happens.filter((x) => x.id <= eventsSeen) : [],
  });
  if (filedNow !== thread) setThread(filedNow);

  if (!game || game.phase !== 'action') return null;
  const blocked = detour ? null : (block?.text ?? null);
  /* folded for the lesson on show only: the next one unfolds the note */
  const mini = miniAt === shownId;
  const lean = pos;
  /* the deed was done before its lesson came up: a page to read on from */
  const already = review === null && !detour && owed?.mode === 'already';
  const lines = [...warnings.map((w) => w.text), ...tips.map((x) => x.text)];
  const pages = Math.max(1, Math.ceil(lines.length / 2));
  const shown = lines.slice(page * 2, page * 2 + 2);
  /* the guided game waits: the machine's next move comes once this one is read */
  const holding = !!(tutorial && showBot && bot?.fresh && game.players[game.current]?.isBot);
  /* the reader asked for the lesson back while the plate is on show */
  const unfolded = unfoldAt === bot?.id;
  /* her turn is running: the note steps back to a line that says so */
  const theirTurn = !!(tutorial && game.phase === 'action' && game.players[game.current]?.isBot && !unread);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;
  const waiting = theirTurn ? t('game.guide.waitingTurn', { name: game.players[game.current]?.name ?? '', n: Math.min(maxActions - game.actionsLeft + 1, maxActions), max: maxActions }) : null;
  if (!guided && (hidden || lines.length === 0) && !showBot) return null;

  /* a lesson passed by the reader: read on from, or skipped. A page
     waiting on the game is not passed by reading on — it keeps its place */
  const passOn = (id: string) => {
    if (!lctx) return;
    const after = pass(live, id);
    saveProgress(after);
    /* the lesson on the hand wants the hand in view: the mat goes */
    if (dueNow(after, lctx).id === 'hand' && matPlayer !== null) closeMat();
  };
  /* Next: read back, it walks forward through what was passed and passes
     nothing; on the live lesson it passes it. The guide ends with the game,
     on the final ledger, not here */
  const next = () => {
    if (review) {
      setReview(readForward(settled, review));
      return;
    }
    passOn(shownId);
  };
  /* Back walks the lessons passed, newest first */
  const behind = guided ? readBack(settled, review) : null;
  /* the way on from the deed due, once the reader has played past it or
     the table does not allow it now: Later sets it aside, and it comes
     back next round in its place; in the last round, with none to come,
     Skip. In the loan's detour it is the lesson that led there, which
     money stops: it may wait for the payday. Not on a deed the reader may
     pass (Next says so), nor on one read back */
  const way = lctx && showSteps && review === null && owed?.mode === 'do' && owed.id && !spare ? wayOn(live, owed.id, lctx, !!block) : null;
  const later = way === 'later' ? (owed?.id ?? null) : null;
  const putAside = (id: string) => {
    if (lctx) saveProgress(setAside(live, id, lctx));
  };
  const fold = (to: boolean) => {
    setMiniAt(to ? shownId : '');
    try {
      localStorage.setItem(MINI_KEY, to ? shownId : '');
    } catch {
      /* non-fatal */
    }
  };
  const grab = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    grip.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, at: pos, t0: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const drag = (e: ReactPointerEvent<HTMLElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    g.at = fit({ x: g.ox + e.clientX - g.sx, y: g.oy + e.clientY - g.sy });
    if (box.current) box.current.style.transform = place(g.at);
  };
  const drop = (e: ReactPointerEvent<HTMLElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    /* a short press that did not travel is a click, and the note's own
       click folds it; a move or a hold is a grip, and lets go in place */
    const still = Math.abs(e.clientX - g.sx) < 4 && Math.abs(e.clientY - g.sy) < 4;
    held.current = !still || e.timeStamp - g.t0 > 300;
    if (still) return;
    setPos(g.at);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(g.at));
    } catch {
      /* non-fatal */
    }
  };
  /* a double click on the head puts the note back under the top bar */
  const home = () => {
    setPos({ x: 0, y: 0 });
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* non-fatal */
    }
  };
  /* a click anywhere on the paper folds the note, a click on the strip
     unfolds it; buttons, links and a text selection are left alone */
  const tap = (e: ReactMouseEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (held.current) {
      held.current = false;
      return;
    }
    if (el.closest('button, a') || window.getSelection()?.toString()) return;
    fold(!mini);
  };
  const grabProps = dock ? {} : { onPointerDown: grab, onPointerMove: drag, onPointerUp: drop, onPointerCancel: drop, onDoubleClick: home, title: t('game.guide.move') };
  const grabClass = dock ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing';
  const show = (what: Show) => {
    if (what === 'mat') openMat(me);
    /* the note leans out of the mat's way so both can be read at once */
    if (what === 'market') setMarketFocus(true);
    if (what === 'vp') setBoardOption('vpTrack', true);
  };
  /* the machine's name at the table, for the words of the advice */
  const machine = game.players.find((x) => x.isBot)?.name ?? '';
  const here = game.actions.length;
  const advised = advice && advice.at === here ? advice : null;
  const ask = () => {
    setAdvice({ at: here, action: null, busy: true });
    /* the search thinks on the thread that paints: let the note say so first */
    window.setTimeout(() => {
      const g = useGame.getState().game;
      if (!g || g.actions.length !== here) return;
      /* the search itself, at full strength: the machines' own entry point
         caps a human seat under assist and blurs its reading */
      const a = searchTurn(g, me, { budgetMs: 400, strength: 1 })?.action ?? null;
      setAdvice({ at: here, action: a, busy: false });
    }, 30);
  };
  /* the advised move, set up in the hand as if the reader had chosen it;
     the confirm bar is theirs */
  const prepare = (a: GameAction) => {
    const st = useGame.getState();
    st.cancel();
    const card = (id?: string) => id ?? st.game?.players[me].hand[0]?.id ?? null;
    switch (a.kind) {
      case 'build': {
        st.selectCard(a.card);
        useGame.getState().setVerb('build');
        const t = useGame.getState().currentTargets().find((x) => x.town === a.town && x.slot === a.slot && x.industry === a.industry);
        if (t) useGame.getState().pickBuild(t);
        break;
      }
      case 'network': {
        st.selectCard(a.card);
        useGame.getState().setVerb('network');
        const t = useGame.getState().currentLinks().find((x) => x.link.id === a.link);
        if (t) useGame.getState().pickLink(t);
        break;
      }
      case 'sell': {
        st.selectCard(a.card);
        useGame.getState().setVerb('sell');
        for (const sale of a.sales) {
          const t = useGame.getState().currentSells().find((x) => x.town === sale.town && x.slot === sale.slot);
          if (t) useGame.getState().pickSell(t);
        }
        break;
      }
      case 'develop':
        st.selectCard(a.card);
        useGame.getState().setVerb('develop');
        for (const ind of a.industries) useGame.getState().toggleDevelop(ind);
        break;
      case 'scout':
        st.selectCard(a.cards[0]);
        useGame.getState().setVerb('scout');
        for (const id of a.cards.slice(1)) useGame.getState().toggleScout(id);
        break;
      case 'loan':
        st.selectCard(card(a.card));
        useGame.getState().setVerb('loan');
        break;
      case 'pass':
        st.selectCard(card(a.card));
        useGame.getState().setVerb('pass');
        break;
      default:
        break;
    }
  };
  /* does the advised move do what the lesson asks? */
  const asked = (id: string, a: GameAction): boolean =>
    id === 'coal' ? a.kind === 'build' && a.industry === 'coal'
    : id === 'iron' ? a.kind === 'build' && a.industry === 'iron'
    : id === 'works' ? a.kind === 'build' && WORKS.includes(a.industry)
    : id === 'link' ? a.kind === 'network'
    : id === 'sell' ? a.kind === 'sell'
    : id === 'loan' ? a.kind === 'loan'
    : true;
  const whyKey = (a: GameAction): string => {
    if (a.kind === 'build') return a.industry === 'coal' || a.industry === 'iron' || a.industry === 'brewery' ? a.industry : 'works';
    /* a short game tells the loan in its own words: the purse and the income level count at its close */
    if (a.kind === 'loan' && game.eraLength === 'short') return 'loanShort';
    return a.kind;
  };
  /* the lesson's words, when the table asks for another telling of it:
     a payday owed rather than paid, a short game that ends here, a loan
     on show that can wait */
  const stepKey = (id: string): string => stepKeyOf(id, game, me, id === shownId && !!spare);
  /* the question about this table the words point at, and how long the
     phrase matched was — the same measure the written answers use, so the
     surest of the two wins rather than whichever was tried first */
  const intentOf = (q: string): { id: Ask; score: number } | null => {
    let best: { id: Ask; score: number; phrase: string } | null = null;
    /* as typed, and as mended — "jai combien dargent" is still the purse */
    const readings = [q, mend(q, lang)];
    for (const id of ASKS) {
      for (const phrase of t(`game.guide.ask.words.${id}`).split(',')) {
        const score = Math.max(...readings.map((r) => carries(r, phrase)));
        if (score && (!best || score > best.score)) best = { id, score, phrase };
      }
    }
    /* "c'est quoi la bière" is the rules' question, "j'ai de la bière" the
       table's: the table's phrase alone cannot tell them apart */
    return best && !asksTheRules(q, lang, best.phrase) ? { id: best.id, score: best.score } : null;
  };
  /* the answer, read off the table as it stands */
  const answerTo = (id: Ask): string => {
    const p = game.players[me];
    const level = incomeLevel(p.income);
    switch (id) {
      case 'sell': {
        const ok = sellTargets(game, me).find((x) => x.valid);
        if (ok) return t('game.guide.ask.answer.sellYes', { industry: t(`game.log.industry.${ok.tile.industry}`), town: TOWN_BY_ID[ok.town]?.name ?? ok.town, merchant: MERCHANT_BY_ID[ok.merchant]?.name ?? ok.merchant });
        return blockedBy('sell', game, me, t)?.text ?? t('game.guide.ask.answer.sellNo');
      }
      case 'build': {
        const n = p.hand.flatMap((c) => buildTargets(game, me, c)).filter((x) => x.valid).length;
        return n > 0 ? t('game.guide.ask.answer.buildYes', { n }) : (blockedBy('works', game, me, t)?.text ?? t('game.guide.ask.answer.buildNo'));
      }
      case 'coal':
        return t('game.guide.ask.answer.coal', { left: game.market.coal, mine: Object.values(game.tiles).filter((x) => x.industry === 'coal' && !x.flipped).length });
      case 'beer':
        return t('game.guide.ask.answer.beer', { mine: Object.values(game.tiles).filter((x) => x.owner === me && x.industry === 'brewery' && !x.flipped).length, merchant: Object.values(game.merchantBeer).reduce((a, b) => a + b, 0) });
      case 'money':
        return t(level >= 0 ? 'game.guide.ask.answer.money' : 'game.guide.ask.answer.moneyOwed', { money: p.money, level, pay: Math.abs(INCOME_PAYOUT[p.income]) });
      case 'rounds':
        return t('game.guide.ask.answer.rounds', { left: Math.max(0, eraRounds(game.players.length) - game.round + 1), round: game.round, total: eraRounds(game.players.length), actions: game.actionsLeft });
      case 'win':
        return t('game.guide.ask.answer.win', { mine: p.vp, best: Math.max(...game.players.map((x) => x.vp)) });
      case 'do':
      default:
        return t('game.guide.ask.answer.do', { name: machine });
    }
  };
  /* a question is answered in two tries: the table as it stands, then the
     guide's case — the notions of the game, the written answers, the rules
     codex — and, when nothing there is close, the notions it might mean */
  const putQuestion = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    const table = intentOf(q);
    const written = faqBest(q, faqFor(getLang()));
    /* the table answers when it is the surer match; the rules when they are */
    const id = table && (!written || table.score >= written.score) ? table.id : null;
    const found = id ? null : consult(q, getLang(), passages);
    if (found?.kind === 'near') setNearFor((prev) => ({ ...prev, [q]: found.near }));
    setThread((prev) => askThread(prev, q, id ? answerTo(id) : found!.answer));
    if (id === 'do' && myTurn && !advised) ask();
  };
  /* a notion taken up from the ones offered: asked by its name, answered
     plainly */
  const takeUp = (n: NearNotion) => setThread((prev) => askThread(prev, askedAs(n), tell(n.id, getLang())));
  const stepVars = (): Record<string, string | number> => stepVarsOf(game, me, t, spare?.need);

  /* folded: a rail down the right edge — the lesson's number, how far the
     guide has come (the lessons passed: one set aside is not), a dot when
     the machine or the table has something to say; the lesson's lens
     still lights the board */
  if (dock === GUIDE_RAIL) {
    const n = Math.min(shownIndex + 1, LESSONS.length);
    const come = settled.passed.length;
    const unread = !!bot || news.length > 0;
    /* the lesson's number while one is on show or set aside; at rest, the bar alone */
    const numbered = showSteps || setAsideNow;
    return (
      <>
        <LessonLens stepId={lensId} active={showSteps} />
        <aside data-guide aria-label={t('game.guide.rail.aria')} className="pointer-events-auto fixed inset-y-0 right-0 z-[80] flex flex-col items-center gap-3 border-l border-brass-hairline bg-coal-950/92 py-3 backdrop-blur-md" style={{ width: GUIDE_RAIL }}>
          <button type="button" onClick={() => setBoardOption('guideFolded', false)} aria-label={t('game.guide.rail.unfold')} title={t('game.guide.rail.unfold')} className="relative flex h-8 w-8 items-center justify-center rounded-md border border-brass-700/50 text-brass-400 transition-colors hover:border-brass-400">
            <ChevronLeft className="h-4 w-4" />
            {unread && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brass-400 shadow-[0_0_0_1px_rgba(0,0,0,.6)]" />}
          </button>
          <GraduationCap className="h-4 w-4 text-cream-100/60" aria-hidden />
          {guided && (
            <>
              {numbered && (
                <span className="font-mono text-[10px] text-cream-100/80 [writing-mode:vertical-rl]" title={t('game.guide.stepOf', { n, total: LESSONS.length })}>
                  {n}/{LESSONS.length}
                </span>
              )}
              <span className="relative w-1 flex-1 overflow-hidden rounded-full bg-coal-800" aria-hidden>
                <span className="absolute inset-x-0 top-0 rounded-full bg-brass-400/80" style={{ height: `${(come / LESSONS.length) * 100}%` }} />
              </span>
            </>
          )}
        </aside>
      </>
    );
  }

  return (
    <div
      ref={box}
      data-guide
      className={cn(
        'z-[80] flex min-h-0 flex-col items-stretch gap-2 overflow-y-auto overscroll-contain',
        dock ? 'pointer-events-auto fixed inset-y-0 right-0 border-l border-brass-hairline bg-coal-950/92 px-3 py-3 backdrop-blur-md' : 'pointer-events-none fixed right-3 will-change-transform',
      )}
      style={dock ? { width: dock } : { top: band.top, width: laneWidth(), maxHeight: band.height, transform: place(lean) }}
    >
      <LessonLens stepId={lensId} active={showSteps} />
      {dock > 0 && (
        <div className="flex shrink-0 items-center gap-2 pb-1">
          <GraduationCap className="h-4 w-4 text-brass-400" aria-hidden />
          <span className="font-fell text-[11px] uppercase tracking-[0.2em] text-cream-100/60">{t('game.guide.aria')}</span>
          {showSteps && <span className="font-mono text-[10.5px] text-cream-100/45">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => setBoardOption('guideFolded', true)} aria-label={t('game.guide.rail.fold')} title={t('game.guide.rail.fold')} className="rounded-md border border-brass-700/50 p-1 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {/* what has already been said, kept so a reader can look back at it */}
      {dock > 0 && said.length > 0 && (
        <div aria-label={t('game.guide.thread.aria')} className="flex shrink-0 flex-col gap-2">
          {said.map((m, i) => (
            <article key={m.key} className={cn('relative rounded-md border px-3 py-2', m.kind === 'ask' ? 'ml-6 border-bottle-600/50 bg-bottle-600/10' : 'border-brass-700/40 bg-coal-900/70')}>
              {m.head && <p className="font-mono text-[10.5px] leading-snug text-cream-100/55">{m.head}</p>}
              <p className={cn('font-serif text-[12px] leading-snug', m.kind === 'ask' ? 'text-bottle-400' : 'text-cream-100/70')}>{m.body}</p>
              {m.kind === 'answer' && i > 0 && nearFor[said[i - 1].body] && <NearList near={nearFor[said[i - 1].body]} onPick={takeUp} />}
              {m.kind === 'bot' && m.seat !== undefined && m.seat >= 0 && (
                <button type="button" onClick={() => setGlimpse({ seat: m.seat!, at: Date.now() })} className="mt-1 inline-flex items-center gap-1 font-sans text-[9.5px] font-bold uppercase tracking-[0.12em] text-brass-400/70 hover:text-brass-400">
                  <Eye className="h-3 w-3" /> {t('game.guide.ask.replay')}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {/* nothing due now: a line that says when the guide speaks again —
            the lesson set aside next round, or the next one in its time */}
        {aside && (
          <motion.aside key="aside" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.aria')} className="paper pointer-events-auto relative flex max-w-full flex-col gap-1 px-3 py-1.5 shadow-e3">
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div {...grabProps} className={cn(grabClass, 'relative flex min-w-0 items-center gap-2')}>
              {setAsideNow ? <Clock className="h-4 w-4 shrink-0 text-ink-900/70" /> : <GraduationCap className="h-4 w-4 shrink-0 text-ink-900/70" />}
              <span className="min-w-0 font-serif text-[12.5px] leading-snug text-ink-900/85">{setAsideNow ? t('game.guide.aside', { lesson: t(`game.guide.steps.${stepKey(shownId)}.title`, stepVars()) }) : t('game.guide.rest')}</span>
            </div>
            {/* the guide may be left from here too, as from any lesson */}
            <div className="relative flex items-center gap-x-3 pl-6">
              <button type="button" onClick={endTutorial} className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                {t('game.guide.leave')}
              </button>
              {behind && (
                <button type="button" onClick={() => setReview(behind)} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                  <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                </button>
              )}
            </div>
          </motion.aside>
        )}
        {showSteps && step && (mini || theirTurn || (reading && !unfolded)) && (
          <motion.aside key="strip" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.aria')} title={(reading || theirTurn) && !mini ? undefined : t('game.guide.expand')} onClick={(reading || theirTurn) && !mini ? undefined : tap} className={cn('paper pointer-events-auto relative flex max-w-full items-center gap-2 px-3 py-1.5 shadow-e3', !reading && 'cursor-pointer')}>
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div {...grabProps} className={cn(grabClass, 'relative flex min-w-0 items-center gap-2')}>
              <GraduationCap className="h-4 w-4 shrink-0 text-ink-900/70" />
              {!waiting && <span className="shrink-0 font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</span>}
              <span className="truncate font-display text-[13px] font-bold text-ink-900">{waiting ?? t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</span>
            </div>
            {(!reading || mini) && !theirTurn && (
              <button type="button" onClick={() => (reading ? setUnfoldAt(bot?.id ?? -1) : fold(false))} aria-label={t('game.guide.expand')} title={t('game.guide.expand')} className="relative shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}
        {(showSteps || lines.length > 0) && !(hidden && !showSteps) && !holding && !(showSteps && (mini || theirTurn || reading)) && (
          <motion.aside
            key="note"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label={t('game.guide.aria')}
            onClick={showSteps && !dock ? tap : undefined}
            style={{ maxHeight: dock ? undefined : band.height }}
            className={cn('paper pointer-events-auto relative flex w-full flex-col px-4 py-3 shadow-e3', dock ? 'shrink-0' : 'min-h-0', showSteps && !dock && 'cursor-pointer')}
          >
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div className="relative flex min-h-0 flex-col">
              {showSteps && step ? (
                <>
                  <div className={cn('flex items-start gap-2', !dock && 'min-h-0')}>
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/70" />
                    <div className={cn('flex min-w-0 flex-1 flex-col', !dock && 'min-h-0')}>
                      <div className="flex items-start justify-between gap-2">
                        <div {...grabProps} className={cn(grabClass, 'min-w-0 flex-1')}>
                          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</p>
                          <h3 className="mt-0.5 font-display text-[16px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</h3>
                        </div>
                        {!dock && (
                          <button type="button" onClick={() => fold(true)} aria-label={t('game.guide.minify')} title={t('game.guide.foldHint')} className="shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className={cn('mt-1', !dock && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
                        {sheetAdvice && !adviceSeen && review === null && (
                          <div className="mb-2 rounded-md border border-brass-500/50 bg-brass-500/10 px-2.5 py-1.5">
                            <p className="font-serif text-[12.5px] leading-snug text-ink-900/85">
                              {t('game.guide.advice.lede', { n: sheetAdvice.times })} <span className="font-semibold">{t(`game.debrief.motifs.${sheetAdvice.motif}`)}</span>
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <button type="button" onClick={() => { setReview(reread(settled, sheetAdvice.id)); setAdviceSeen(true); }} className="btn-strike !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
                                {t('game.guide.advice.open', { lesson: t(`game.guide.steps.${stepKey(sheetAdvice.id)}.title`, stepVars()) })}
                              </button>
                              <button type="button" onClick={() => setAdviceSeen(true)} className="font-sans text-[10.5px] text-ink-900/55 hover:text-ink-900">{t('game.guide.advice.later')}</button>
                            </div>
                          </div>
                        )}
                        {detour && block && dueStep && <p className="mb-1.5 font-serif text-[13px] leading-snug text-rust-500">{t('game.guide.detour', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) })} {lower(block.short)} {t(later ? 'game.guide.detourLater' : 'game.guide.detourOut')}</p>}
                        {already && <p className="mb-1.5 font-serif text-[13px] leading-snug text-bottle-600">{t('game.guide.already')}</p>}
                        {blocked && <p className="mb-1.5 font-serif text-[13px] leading-snug text-rust-500">{blocked}</p>}
                        <Paragraphs text={t(`game.guide.steps.${stepKey(step.id)}.body`, stepVars())} />
                      {/* what the chosen card allows, what the pick costs: the
                          assistance speaks under the lesson too */}
                      {tips.filter((x) => AT_HAND.has(x.id)).slice(0, 2).map((x) => (
                        <p key={x.id} className="mt-1.5 font-serif text-[12.5px] leading-snug text-ink-900/80">
                          {x.text}
                        </p>
                      ))}
                      {/* the purse's alert says the loan lesson over again: not under it */}
                      {warnings.filter((w) => (['negative', 'eraEnd', 'eraEndMine', 'deckOut'].includes(w.id) || ((w.id === 'broke' || w.id === 'brokeAgain') && !block && step.id !== 'loan'))).map((w) => (
                        <p key={w.id} className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-ink-900/70">
                          {w.text}
                        </p>
                      ))}
                      {unread && game.players[game.current]?.isBot && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.botHeld', { name: machine })}</p>}
                      {step.done && review === null && !blocked && !already && !spare && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{myTurn ? t('game.guide.yourTurn') : t('game.guide.wait')}</p>}
                      {blocked && !myTurn && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.wait')}</p>}
                      </div>
                    </div>
                  </div>
                  {shownIndex === 0 && !dock && <p className="mt-2 shrink-0 font-serif text-[11px] italic text-ink-900/50">{t('game.guide.foldHint')}</p>}
                  <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button type="button" onClick={endTutorial} className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                        {t('game.guide.leave')}
                      </button>
                      {behind && (
                        <button type="button" onClick={() => setReview(behind)} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                          <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                        </button>
                      )}
                      {myTurn && !advised && (
                        <button type="button" onClick={ask} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bottle-600 hover:text-ink-900">
                          <Sparkles className="h-3 w-3" /> {t('game.guide.suggest.ask', { name: machine })}
                        </button>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {step.show && !(step.show === 'mat' && matPlayer !== null) && (
                        <button type="button" onClick={() => show(step.show!)} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Eye className="h-3.5 w-3.5" /> {t(`game.guide.show.${step.show}`)}
                        </button>
                      )}
                      {later && (
                        <button type="button" onClick={() => putAside(later)} title={t('game.guide.laterHint')} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Clock className="h-3.5 w-3.5" /> {detour && dueStep ? t('game.guide.laterLesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) }) : t('game.guide.later')}
                        </button>
                      )}
                      {/* Skip: a deed the table does not allow now, for a
                          reader who gives it up — beside Later when it may
                          wait — or one played past in the last round; in
                          the loan's detour, the lesson that led there when
                          it cannot wait */}
                      {(blocked || (detour && !later) || way === 'skip') && myTurn && !already && (
                        <button type="button" onClick={() => owed?.id && passOn(owed.id)} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          {detour && dueStep ? t('game.guide.skipLesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) }) : t('game.guide.skip')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(!step.done || review !== null || already || !!spare) && (
                        <button type="button" onClick={next} className="btn-strike !min-h-[32px] !px-4 !py-1 !text-[10.5px]">
                          {t('game.guide.next')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className={cn('flex items-start gap-3', !dock && 'min-h-0')}>
                  {/* the floating note is taken by its lamp and dragged where it reads best */}
                  <span {...grabProps} className={cn(grabClass, 'mt-0.5 shrink-0')}>
                    <Lightbulb className="h-4 w-4 text-ink-900/60" />
                  </span>
                  <ul className={cn('min-w-0 flex-1 space-y-1.5', !dock && 'min-h-0 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
                    {shown.map((line, i) => (
                      <li key={i}>
                        <Paragraphs text={line} />
                      </li>
                    ))}
                  </ul>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button type="button" onClick={() => setHidden(true)} aria-label={t('game.guide.hide')} title={t('game.guide.hide')} className="rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {myTurn && !advised && (
                      <button type="button" onClick={ask} aria-label={t('game.guide.suggest.ask', { name: machine })} title={t('game.guide.suggest.ask', { name: machine })} className="rounded-full p-0.5 text-bottle-600 hover:text-ink-900">
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {pages > 1 && (
                      <button type="button" onClick={() => setPage((page + 1) % pages)} className="font-mono text-[10px] text-ink-900/50 hover:text-ink-900">
                        {page + 1}/{pages} ›
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        )}

        {/* the machine's reasons: why a player would have made that move */}
        {/* the sheet of progress points at a lesson: at a plain table the
            lesson unfolds here, since the guided pages are not on */}
        {!tutorial && sheetAdvice && !adviceSeen && (
          <div className="paper pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-3 shadow-e3">
            <div className="flex items-start gap-2">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/70" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[12.5px] leading-snug text-ink-900/85">
                  {t('game.guide.advice.lede', { n: sheetAdvice.times })} <span className="font-semibold">{t(`game.debrief.motifs.${sheetAdvice.motif}`)}</span>
                </p>
                {adviceOpen ? (
                  <div className="mt-1.5">
                    <p className="font-display text-[13px] font-bold text-ink-900">{t(`game.guide.steps.${stepKey(sheetAdvice.id)}.title`, stepVars())}</p>
                    <Paragraphs text={t(`game.guide.steps.${stepKey(sheetAdvice.id)}.body`, stepVars())} />
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => setAdviceOpen(true)} className="btn-strike !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
                      {t('game.guide.advice.open', { lesson: t(`game.guide.steps.${stepKey(sheetAdvice.id)}.title`, stepVars()) })}
                    </button>
                    <button type="button" onClick={() => setAdviceSeen(true)} className="font-sans text-[10.5px] text-ink-900/55 hover:text-ink-900">{t('game.guide.advice.later')}</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setAdviceSeen(true)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {showBot && bot && (
          <motion.aside key={`bot-${bot.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.botAria')} style={{ maxHeight: dock ? undefined : band.height }} className="plate pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-2.5">
            <div className={cn('flex items-start gap-2', !dock && 'min-h-0 flex-1')}>
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
              <div className={cn('flex min-w-0 flex-1 flex-col', !dock && 'min-h-0')}>
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-brass-400">{t('game.guide.botWhy', { name: bot.name })}</p>
                <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{bot.what}</p>
                {reading && <p className="mt-0.5 font-sans text-[9.5px] uppercase tracking-[0.12em] text-brass-400/60">{t('game.guide.seeMove', { key: keyLabel(getKeybindings().lastMove), name: bot.name })}</p>}
                {(reading || !tutorial) && (
                  <div className={cn('mt-1', !dock && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
                    <p className="font-serif text-[13px] leading-snug text-cream-100/90">{bot.why}</p>
                    <p className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{bot.turn}</p>
                  </div>
                )}
              </div>
              {!reading && (
                <button type="button" onClick={() => setBotHidden(bot.id)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-cream-100/40 hover:text-brass-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {holding && <p className="mt-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400/70">{t('game.guide.botHeld', { name: bot.name })}</p>}
            {reading && (
              <button
                type="button"
                onClick={() => {
                  setBotHidden(bot.id);
                  /* the words were read: the board now shows the move itself */
                  if (bot.seat >= 0) setGlimpse({ seat: bot.seat, at: Date.now() });
                }}
                className="btn-strike mt-2 !min-h-[30px] w-full !px-3 !py-1 !text-[10px]"
              >
                {t(holding ? 'game.guide.botNext' : 'game.guide.botOk', { name: bot.name })}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}

        {/* the turns of the table: what just happened, and why it matters */}
        {news.length > 0 && (
          <motion.aside key={`news-${news[news.length - 1].id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.happens.aria')} style={{ maxHeight: dock ? undefined : band.height }} className="plate pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-2.5">
            <div className={cn('flex items-start gap-2', !dock && 'min-h-0 flex-1')}>
              <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
              <div className={cn('flex min-w-0 flex-1 flex-col', !dock && 'min-h-0')}>
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-brass-400">{t('game.guide.happens.title')}</p>
                <div className={cn('mt-1', !dock && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
                  {news.map((x) => (
                    <p key={x.id} className="font-serif text-[13px] leading-snug text-cream-100/90 [&+&]:mt-1.5">
                      {x.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setEventsSeen(news[news.length - 1].id)} className="btn-strike mt-2 !min-h-[30px] w-full !px-3 !py-1 !text-[10px]">
              {t('game.guide.botOk')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.aside>
        )}

        {/* what the machine would play in the reader's seat, on request */}
        {advised && myTurn && (
          <motion.aside key={`advice-${here}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.suggest.aria')} style={{ maxHeight: dock ? undefined : band.height }} className="plate pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-bottle-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-bottle-400">{t('game.guide.suggest.title', { name: machine })}</p>
                {advised.busy ? (
                  <p className="mt-0.5 font-serif text-[13px] italic text-cream-100/70">{t('game.guide.suggest.thinking', { name: machine })}</p>
                ) : advised.action ? (
                  <>
                    <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{describeAction(advised.action)}</p>
                    <p className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">
                      {t(`game.guide.suggest.why.${whyKey(advised.action)}`, { name: machine })}
                      {(() => {
                        /* a link to a merchant place with no merchant at this table: worth its
                           two link icons and the coal market all the same — say so */
                        if (advised.action.kind !== 'network') return null;
                        const ends = [advised.action.link, advised.action.second].flatMap((id) => (id ? [LINKS.find((l) => l.id === id)] : [])).flatMap((l) => (l ? [l.a, l.b] : []));
                        const closed = ends.find((n) => MERCHANT_BY_ID[n] && !(game.merchantTiles[n]?.length));
                        return closed ? ` ${t('game.guide.suggest.closedMerchant', { merchant: MERCHANT_BY_ID[closed].name })}` : null;
                      })()}
                    </p>
                    {dueStep && owed?.mode === 'do' && !spare && !asked(dueStep.id, advised.action) && <p className="mt-1 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{t('game.guide.suggest.lesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) })}</p>}
                  </>
                ) : (
                  <p className="mt-0.5 font-serif text-[13px] text-cream-100/90">{t('game.guide.suggest.none', { name: machine })}</p>
                )}
              </div>
              <button type="button" onClick={() => setAdvice(null)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-cream-100/40 hover:text-brass-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {!advised.busy && advised.action && (
              <button type="button" onClick={() => prepare(advised.action!)} className="btn-strike mt-2 !min-h-[30px] w-full !px-3 !py-1 !text-[10px]">
                {t('game.guide.suggest.prepare')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* a question to the guide, answered from the table as it stands */}
      {dock > 0 && guided && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            putQuestion();
          }}
          className="sticky bottom-0 mt-auto flex shrink-0 items-center gap-2 pt-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('game.guide.ask.placeholder')}
            aria-label={t('game.guide.ask.placeholder')}
            className="min-w-0 flex-1 rounded-md border border-brass-700/60 bg-coal-900/90 px-3 py-1.5 font-sans text-[12px] text-cream-100 placeholder:text-cream-100/35 focus:border-brass-400 focus:outline-none"
          />
          <button type="submit" disabled={!question.trim()} aria-label={t('game.guide.ask.send')} title={t('game.guide.ask.send')} className="btn-strike !min-h-[32px] shrink-0 !px-3 !py-1 !text-[10px] disabled:opacity-40">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(Guide);
