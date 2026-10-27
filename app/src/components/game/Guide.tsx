import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, GraduationCap, Lightbulb, LogOut, Minus, Newspaper, Sparkles, TimerOff, X } from 'lucide-react';
import { aidOn, getBoardOptions, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import { GUIDE_RAIL, MINI_KEY, POS_KEY } from '@/components/game/guideKeys';
import LessonLens from './LessonLens';
import { useLayer } from './useLayer';
import { getKeybindings, isKey, keyLabel, typing, useKeybindings } from '@/components/game/keybindings';
import { INCOME_PAYOUT, INDUSTRIES, LOAN_AMOUNT, LOAN_INCOME_HIT, MERCHANT_BY_ID, START_INCOME_SPACE, START_MONEY, TOWN_BY_ID, incomeLevel, LINKS } from '@/game/data';
import { buildTargets, canLoan, eraRounds, linkTargets, marketSaleOnBuild, sellTargets } from '@/game/engine';
import { ledgerText } from '@/game/ledgerText';
import { passagesOf } from '@/game/faq';
import { askedAs, tell } from '@/game/faq/consult';
import type { NearNotion } from '@/game/faq/consult';
import { cardLabel, describeAction, useGame } from '@/game/store';
import { searchTurn } from '@/game/search';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { dictOf, getLang, localeOf, useLang, useT } from '@/i18n';
import { roman } from '@/gl/roman';
import { useCoarse } from '@/hooks/use-narrow';
import { cn } from '@/lib/utils';
import { useHudRects } from './useHudRects';
import { askThread, fileThread, noteThread } from './guideThread';
import { NOTHING_READ, READ_KEY, readAt, shelve, threadOf } from './guideRead';
import type { Read } from './guideRead';
import { NearList } from './AskGuide';
import type { Thread } from './guideThread';
import { listProgress, recurring } from '@/game/progress';
import type { Motif } from '@/game/progress';
import { LAST_LESSON, LESSONS, back as readBack, cheapestWorks, detourOf, due as dueNow, forward as readForward, freshProgress, lastRound, lessonIndex, lessonOf, letPlayOn, onProgress, optionalNow, pass, progressAt, reread, saveProgress, see, setAside, settle, wayOn } from './lessons';
import type { LessonCtx, Review, Show } from './lessons';
import { barrelBonuses, buyersOf, closingWords, dryRound, firstPayday, forgeWays, forgesFromMines, loanWords, plainKeyOf, stepKeyOf, worksOnMat } from './lessonWords';
import { answerQuestion, blockedBy } from './tableAnswers';
import { holdFor, mayPlayOn, unreadOf } from './guideHold';
import type { Reading } from './guideHold';
import { hasPlace, keepsFor, placeLens, spareFor } from './expertAdvice';

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

/** a look at a seat's last move, from this moment */
const glimpseNow = (seat: number) => ({ seat, at: Date.now() });

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

/* the questions about the table, and their answers, are kept in
   tableAnswers.ts: the question tool asks there too */

/* ----------------------------- the block ----------------------------- */

/* why a deed cannot be done now (blockedBy) is kept in tableAnswers.ts */

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
  /* in the last round no payday comes: a short game still counts the
     level at its close, a full one no longer does */
  const final = lastRound(g);
  /* a short game counts the purse and the income level at its close: a loan
     is weighed there, not written off as late */
  if (p.money < 8 && p.loans === 0) out.push({ id: 'broke', text: t(g.eraLength === 'short' ? 'game.guide.alerts.brokeShort' : 'game.guide.alerts.broke', { money: p.money, amount: LOAN_AMOUNT, hit: LOAN_INCOME_HIT, level, after: Math.max(-10, level - LOAN_INCOME_HIT) }) });
  else if (p.money < 8) out.push({ id: 'brokeAgain', text: t(final ? 'game.guide.alerts.brokeAgainLast' : 'game.guide.alerts.brokeAgain', { money: p.money, level }) });
  if (last?.key === 'payday') out.push({ id: 'payday', text: t(level >= 0 ? 'game.guide.alerts.payday' : 'game.guide.alerts.paydayOwed', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  if (g.deck.length === 0 && p.hand.length > 0) out.push({ id: 'deckOut', text: t('game.guide.alerts.deckOut', { cards: p.hand.length }) });
  if (level < 0 && !(final && g.eraLength !== 'short')) out.push({ id: 'negative', text: t(final ? 'game.guide.alerts.negativeLast' : 'game.guide.alerts.negative', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
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

/* under a finger (the coarse: variant, a tablet) each control of the
   note wants some 44 px: the small icons reach past what they show, a
   margin taking back what they grow, and the words and buttons stand
   taller */

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
  const { vpTrack } = useBoardOptions();
  const sheetOpened = useGame((s) => s.sheetOpened);
  const openMat = useGame((s) => s.openMat);
  const closeMat = useGame((s) => s.closeMat);
  const setMarketFocus = useGame((s) => s.setMarketFocus);
  const ledgerOpen = useGame((s) => s.ledgerOpen);
  /* a finger for a pointer: no key to name */
  const finger = useCoarse();
  /* the keys as the reader has bound them: a key rebound in the settings
     is named at once, here and in the lesson's words */
  const keys = useKeybindings();
  const setLedgerOpen = useGame((s) => s.setLedgerOpen);
  /* what was read at this table, kept over a reload (guideRead.ts): the
     page reloaded brings back neither her plates nor the news already
     read, and keeps the thread. Read once, as the guide opens: the page
     opens a new guide for another table */
  const readHere = table ?? code;
  const [before] = useState<Read>(() => {
    try {
      return readHere ? readAt(localStorage.getItem(READ_KEY), readHere) : NOTHING_READ;
    } catch {
      return NOTHING_READ;
    }
  });
  /* × on the tips note puts away the lines it holds, for the round: an
     alert or a tip not yet said still comes, the next round they may all
     come back, and the machine's plates keep their own × */
  const [muted, setMuted] = useState<{ ids: string[]; round: string }>({ ids: [], round: '' });
  /* the machine's move that was read and understood, by its entry in the
     log: the length of the log moves with every entry and would bring
     the plate back after each move of one's own */
  const [botHidden, setBotHidden] = useState<number>(before.plate);
  /* what an expert would play in the reader's seat — the search at full
     strength, not the machine at the table — asked for one position: the
     index of the action to come names it. Given by degrees: the reason,
     then, asked again, the place; the move set up in the hand last */
  const [advice, setAdvice] = useState<{ at: number; action: GameAction | null; busy: boolean; place: boolean } | null>(null);
  const setGuideHold = useGame((s) => s.setGuideHold);
  const coachHold = useGame((s) => s.coachHold);
  const setGlimpse = useGame((s) => s.setGlimpse);
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
  const [bar, map, dockBox, rail, matHead, ledgerBox, marketBox] = useHudRects(['[data-topbar]', '[data-minimap]', '[data-dock]', '[data-player-rail]', '[data-mat-head]', '[data-ledger]', '[data-market]']);
  const band = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    /* the note's column down the right edge, and what stands over it: the
       banner; on a narrow table the players' strip under it, whose tools
       hold the ledger's button; and the head of a mat opened across it,
       with its tabs and its close */
    const over = (r: typeof rail) => !!r && r.right > w - laneWidth(w) - 12 && r.left < w - 12;
    const top = Math.max(bar?.bottom || 80, over(rail) ? rail!.bottom : 0, over(matHead) ? matHead!.bottom : 0) + 12;
    /* the lane runs down to whatever the right edge already holds */
    const feet = [map?.top, dockBox && dockBox.right > w - laneWidth(w) - 40 ? dockBox.top : undefined, h - 40].filter((x): x is number => typeof x === 'number' && x > top);
    return { top, height: Math.max(220, Math.round(Math.min(...feet) - top - 12)), mat: over(matHead) };
  }, [bar, map, dockBox, rail, matHead]);
  /* a sheet opened down the right edge — the ledger, the exchange's tray —
     is read beside the floating note, not under it: the note steps left
     of it for as long as it is open, and back after. The ledger is read by
     its width, as it slides in from the edge */
  const sheetAside = useMemo(() => {
    const w = window.innerWidth;
    const edges = [ledgerBox ? w - ledgerBox.width : null, marketBox?.left ?? null].filter((x): x is number => x !== null);
    return edges.length ? Math.min(...edges) - 12 - (w - 12) : 0;
  }, [ledgerBox, marketBox]);
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
  /* and it is watched while it stands (see below): its coming and going
     is state too, so the watch starts with the box, whenever it shows */
  const [boxOn, setBoxOn] = useState(false);
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    setBoxOn(el !== null);
  }, []);

  /* my seat: online the one the table gave me; at home the first human at the table */
  const me = seat ?? Math.max(0, game?.players.findIndex((p) => !p.isBot) ?? 0);
  const myTurn = !!game && game.phase === 'action' && game.current === me && !game.players[me].isBot;
  const aid = !!game && me >= 0 && aidOn(game.assist, code !== null);
  /* the turns of the table, and the highest entry read of them */
  const happens = useMemo(() => (game && aid ? happenings(game, me, t) : []), [game, aid, me, t]);
  const [eventsSeen, setEventsSeen] = useState(before.news);
  /* the machine's move whose reading the reader has set aside to see the lesson */
  const [unfoldAt, setUnfoldAt] = useState(-1);
  /* the lesson the reader opened again over a mat spread under the
     floating note: kept open until the mat is closed */
  const [overMat, setOverMat] = useState(false);
  if (matPlayer === null && overMat) setOverMat(false);
  /* everything already said, oldest first, and what is still live */
  const [thread, setThread] = useState<Thread>(() => threadOf(before));
  const said = thread.said;
  /* and kept as it goes: written from an effect, never from a render */
  useEffect(() => {
    if (!readHere) return;
    try {
      localStorage.setItem(READ_KEY, shelve(localStorage.getItem(READ_KEY), readHere, { plate: botHidden, news: eventsSeen, said: thread.said, filed: thread.filed }));
    } catch {
      /* non-fatal: a reload reads the table afresh */
    }
  }, [readHere, botHidden, eventsSeen, thread.said, thread.filed]);
  const [question, setQuestion] = useState('');
  /* the notions offered under a question nothing matched, by the question */
  const [nearFor, setNearFor] = useState<Record<string, NearNotion[]>>({});
  /* the rules codex, flattened once into the passages a question searches */
  const lang = useLang();
  const passages = useMemo(() => passagesOf((dictOf(lang) as { rules?: unknown }).rules), [lang]);
  /* a lesson the reader went back to: held until they read forward again */
  const [review, setReview] = useState<Review | null>(null);
  /* folded to the rail, a lesson read back is put down, however the rail
     came — the G key, the chevron, a window widened with the guide left
     folded: the rail answers what is unread, and the reader reads on from
     the lesson due when the note comes back. The rail has no Back, so
     nothing sets it again there */
  if (dock === GUIDE_RAIL && review !== null) setReview(null);
  /* G — or the key the reader gave it — folds the guide to a rail down
     the right edge, and back */
  useEffect(() => {
    if (!dock) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isKey(e, 'guide') || typing(e)) return;
      e.preventDefault();
      setBoardOption('guideFolded', !getBoardOptions().guideFolded);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dock]);
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
  /* the move in the making is read too: a build that buys at the market,
     a sale chosen, call for the page that tells of it */
  const lctx = useMemo<LessonCtx | null>(() => (game ? { g: game, me, sel: selectedCardId, mat: matPlayer, sheet: sheetOpened, verb, pick: buildPick } : null), [game, me, selectedCardId, matPlayer, sheetOpened, verb, buildPick]);
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

  /* a lesson still to be read: a page, a deed done beforehand or a
     lesson read back, not a deed to do */
  const unread = !!owed && (review !== null || owed.mode === 'read' || owed.mode === 'already');
  /* what the reader may not have read yet: her fresh move's plate, the
     table's news, the lesson's page, the coach's word on their last move */
  const toRead: Reading = { plate: !!(bot && bot.fresh && botHidden !== bot.id), news: news.length > 0, page: owed?.mode ?? null, review: review !== null, coach: coachHold };
  /* at the guided table the machine's next move waits while it is read:
     the reader sets the pace — and, the first rounds played, may let it
     play on, held by a new page alone (guideHold.ts). Beside the lane
     only, whose thread keeps what goes by unheld: the floating note has
     no thread, and a plate played past there would be lost unread */
  const playOn = dock > 0 && !!settled.playOn;
  const machineUp = !!(tutorial && game && game.phase === 'action' && game.players[game.current]?.isBot);
  const hold = machineUp ? holdFor(toRead, playOn) : null;
  /* the lesson's own part in it, which its note says */
  const pageHold = machineUp && holdFor({ ...toRead, plate: false, news: false, coach: false }, playOn) !== null;
  const holdWanted = hold !== null;
  /* the guide's own hold: the reader's pause of the machines is theirs */
  useEffect(() => {
    setGuideHold(holdWanted);
    return () => setGuideHold(false);
  }, [holdWanted, setGuideHold]);


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
     works costs; the barrel, when none is left. Only the live deed, still
     undone: not in the detour, where money is what is missing, nor read
     back, nor done beforehand */
  const spare = useMemo(() => (lctx && showSteps && review === null && !detour && owed?.mode === 'do' && owed.id === shownId && optionalNow(shownId, lctx) ? { need: shownId === 'loan' ? cheapestWorks(lctx.g, me) : null } : null), [lctx, showSteps, review, detour, owed, shownId, me]);
  /* what the lesson lights on the table: a deed that can wait is read
     past, so its button is not rung */
  const lensId = showSteps && !spare ? step?.id : null;
  /* the expert's move, set up without the card a lesson asks the reader
     to keep — the lesson due's, and through the opening the coal and
     forge cards, whatever page is on show — and its place, once asked
     for, lit in the lesson's stead while the plate is up */
  const deed = tutorial && owed?.mode === 'do' ? owed.id : null;
  const counsel = useMemo(() => (game && advice?.action && advice.at === game.actions.length ? spareFor(game, me, advice.action, tutorial ? keepsFor(settled, game, me, deed, detour) : []) : null), [game, advice, tutorial, settled, me, deed, detour]);
  const placeLit = useMemo(() => (aid && myTurn && advice?.place && counsel ? placeLens(counsel.action ?? advice.action!) : null), [aid, myTurn, advice, counsel]);
  /* the machine's reasons are its turns of the conversation: put away
     one by one, never with the tips */
  const showBot = bot && botHidden !== bot.id;
  /* the machine's fresh move is on show: the lesson folds to its strip
     so the plate reads first, until it is understood — every move of
     hers, in the guided game; an older plate is a line */
  const reading = !!(tutorial && showBot && bot?.fresh);
  /* the reader asked for the lesson back while her plate is on show */
  const unfolded = reading && unfoldAt === bot?.id;
  /* a deed on show, still undone, is noted as seen: doing it passes it,
     wherever the reader has read to meanwhile. On show means in the
     note: not behind the folded rail, nor under her move's plate unless
     asked back, nor on her turn, when the note only says whose turn it
     is (see) */
  const inView = showSteps && review === null && dock !== GUIDE_RAIL && (!reading || unfolded);
  const live = useMemo(() => (inView && lctx ? see(settled, shownId, lctx) : settled), [inView, lctx, settled, shownId]);
  /* the progress is written from an effect: a render may be thrown away,
     a line written to the disk may not */
  useEffect(() => {
    if (tutorial && live !== kept) saveProgress(live);
  }, [tutorial, live, kept]);
  /* the guide has the reader's eyes — a lesson open, her plate, the
     news: at the guided table the table's notices (the paper, the call
     to play) wait until it is done. Not while it is folded to the rail
     or its strip, nor on her turn, when the note only says whose turn */
  const setGuideSpeaks = useGame((s) => s.setGuideSpeaks);
  const quiet = miniAt === shownId || (machineUp && !unread);
  const speaks = !!tutorial && dock !== GUIDE_RAIL && ((showSteps && !quiet) || reading || news.length > 0);
  useEffect(() => {
    setGuideSpeaks(speaks);
    return () => setGuideSpeaks(false);
  }, [speaks, setGuideSpeaks]);
  /* her plate, or the news, holds the machine: its Understood takes the
     focus, so Enter or Space reads it on — when nothing else holds the
     focus: a field typed in, a card or a control the reader is at, keep
     it. On the reader's own turn the plate waits for nothing, and Enter
     is left to the move being made */
  const plateOk = useRef<HTMLButtonElement>(null);
  const newsOk = useRef<HTMLButtonElement>(null);
  const answerAt = hold === 'plate' && bot ? `p${bot.id}` : hold === 'news' && news.length ? `n${news[news.length - 1].id}` : '';
  useEffect(() => {
    if (!answerAt) return;
    const at = document.activeElement;
    if (at && at !== document.body && !box.current?.contains(at)) return;
    (answerAt.startsWith('p') ? plateOk : newsOk).current?.focus({ preventScroll: true });
  }, [answerAt]);
  /* leaving the guide is final for this table: the table forgets it was
     the guided one. So it is asked first, from a control of its own well
     away from Back, and the keyboard lands on Stay; Escape stays too.
     Folded to the rail, the question is dropped, not kept to spring up
     again when the lane comes back */
  const [leaving, setLeaving] = useState(false);
  if (leaving && dock === GUIDE_RAIL) setLeaving(false);
  const confirming = leaving && guided;
  const leaveBox = useLayer<HTMLElement>(confirming, () => setLeaving(false), { focus: false });
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) stay.current?.focus();
  }, [confirming]);
  /* the lane reads like a conversation: the newest turn is the one in
     view. Whatever comes in lengthens it — a lesson filed and the next,
     her plate, the news, a Skip the table now calls for, the expert's
     next degree, the lesson grown with the card chosen — and brings its
     foot into view, where the newest stands. Read off the page itself,
     not off a list of what may come in: a list forgets one. The floating
     note, held to the room under the top bar, scrolls the same way */
  useEffect(() => {
    const el = box.current;
    if (!boxOn || !el) return;
    let tall = el.scrollHeight;
    let frame = 0;
    const look = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const now = el.scrollHeight;
        if (now > tall) el.scrollTop = now;
        tall = now;
      });
    };
    const grown = new MutationObserver(look);
    grown.observe(el, { childList: true, subtree: true, characterData: true });
    const sized = new ResizeObserver(look);
    sized.observe(el);
    el.scrollTop = el.scrollHeight;
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      grown.disconnect();
      sized.disconnect();
    };
  }, [boxOn]);

  /* a lesson, a move of hers or an event that is no longer the live one
     is filed into the thread, worded as it was when it was read: one pure
     step, kept only when it changed anything (see guideThread.ts). The
     news are passed as they stand whether the lane is there or not: the
     floating note shows them too, and news unread while the lane was away
     — a tablet turned — are still unread when it comes back, not gone */
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
    rest: !!dock && !showSteps,
    bot: dock && bot ? { id: bot.id, head: bot.what, body: bot.why, seat: bot.seat } : null,
    news: happens.filter((x) => x.id <= eventsSeen),
    unread: news,
  });
  if (filedNow !== thread) setThread(filedNow);

  if (!game || game.phase !== 'action') return null;
  const blocked = detour ? null : (block?.text ?? null);
  /* folded for the lesson on show only: the next one unfolds the note */
  const mini = miniAt === shownId;
  /* the key that folds the lane to its rail, as the reader has bound it */
  const foldKey = keyLabel(keys.guide);
  /* where the note stands: where it was put, or stepped left of a sheet
     opened at the edge — never off the window's left */
  const lean = !dock && sheetAside < 0 ? { x: Math.max(-(window.innerWidth - laneWidth() - 20), Math.min(pos.x, sheetAside)), y: pos.y } : pos;
  /* the deed was done before its lesson came up: a page to read on from */
  const already = review === null && !detour && owed?.mode === 'already';
  const round = `${game.era}:${game.round}`;
  const put = muted.round === round ? muted.ids : [];
  const told = [...warnings, ...tips].filter((x) => !put.includes(x.id));
  const lines = told.map((x) => x.text);
  const pages = Math.max(1, Math.ceil(lines.length / 2));
  const shown = lines.slice(page * 2, page * 2 + 2);
  /* the guided game waits: the machine's next move comes once this one is read */
  const holding = hold === 'plate';
  /* her turn is running: the note steps back to a line that says so */
  const theirTurn = !!(tutorial && game.phase === 'action' && game.players[game.current]?.isBot && !unread);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;
  const waiting = theirTurn ? t('game.guide.waitingTurn', { name: game.players[game.current]?.name ?? '', n: Math.min(maxActions - game.actionsLeft + 1, maxActions), max: maxActions }) : null;
  /* the lane stands for as long as the table keeps it — the guide left,
     the machine to play, the tips put away: its thread and its question
     field are still there. The floating note has nothing to show */
  if (!guided && !dock && lines.length === 0 && !showBot) return null;

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
  /* the machine's name at the table, for the note's word that it waits */
  const machine = game.players.find((x) => x.isBot)?.name ?? '';
  /* the machine let play on, offered once the first rounds are played —
     and kept offered to a reader who took it, to take it back. Beside
     the lane alone, as the choice holds there alone (see playOn) */
  const offerPlayOn = tutorial && dock > 0 && (playOn || mayPlayOn(game));
  const letPlay = (on: boolean) => {
    if (!tutorial) return;
    saveProgress(letPlayOn(live, on));
    /* what it changes, said in the thread: the switches are icons, and
       their titles are never seen under a finger */
    if (on) setThread((prev) => noteThread(prev, t('game.guide.playOn.hint', { name: machine })));
  };
  const fold = (to: boolean) => {
    setMiniAt(to ? shownId : '');
    try {
      localStorage.setItem(MINI_KEY, to ? shownId : '');
    } catch {
      /* non-fatal */
    }
  };
  /* a mat spread across the floating note's column is the reader's to
     work on — its rows run under the note: the live lesson steps down
     to its strip, and back when the mat closes. Not a lesson read with
     the mat open — the mat's own, and the tile to read, whose NEXT tile
     leads its row at the left, clear of the note — nor one read back,
     nor one the reader opens again over it */
  const matAside = !dock && band.mat && review === null && step?.show !== 'mat' && !overMat;
  /* the lesson down to its strip: folded by the reader, under her plate
     while it is read, or beside the mat; and on her turn stepped back to
     a line that says so — unless asked back over her plate */
  const stripped = mini || (reading && !unfolded) || matAside;
  const stepBack = theirTurn && !unfolded;
  /* the strip opens only where opening shows something: on her turn,
     with no plate of hers to read the lesson over, it stays the line
     that says whose turn it is */
  const opens = stripped && (!stepBack || reading);
  /* and back in full — over her plate too, which stays under it */
  const unfold = () => {
    fold(false);
    if (reading && bot) setUnfoldAt(bot.id);
    if (matAside) setOverMat(true);
  };
  const grab = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    grip.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: lean.x, oy: lean.y, at: lean, t0: e.timeStamp };
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
    if (stripped) unfold();
    else fold(true);
  };
  const grabProps = dock ? {} : { onPointerDown: grab, onPointerMove: drag, onPointerUp: drop, onPointerCancel: drop, onDoubleClick: home, title: t('game.guide.move') };
  const grabClass = dock ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing';
  const show = (what: Show) => {
    if (what === 'mat') openMat(me);
    /* the note leans out of the mat's way so both can be read at once */
    if (what === 'market') setMarketFocus(true);
    if (what === 'vp') setBoardOption('vpTrack', true);
    if (what === 'ledger') setLedgerOpen(true);
  };
  /* the switch that lets it play on, in the lane's head and on the rail */
  const playOnSwitch = (box: string) =>
    offerPlayOn && (
      <button type="button" onClick={() => letPlay(!playOn)} aria-pressed={playOn} aria-label={t('game.guide.playOn.let', { name: machine })} title={t(playOn ? 'game.guide.playOn.hold' : 'game.guide.playOn.let', { name: machine })} className={cn(box, 'rounded-md border border-brass-700/50 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400', playOn && '!border-brass-400 bg-brass-500/20 !text-brass-300')}>
        <TimerOff className="h-3.5 w-3.5" />
      </button>
    );
  /* the way out of the guide: in the lane's head, or at the floating
     note's top by its fold — never in the row of Back and Next */
  const leaveButton = (box: string) => (
    <button type="button" onClick={() => setLeaving(true)} aria-label={t('game.guide.leave')} title={t('game.guide.leave')} aria-haspopup="dialog" aria-expanded={confirming} className={box}>
      <LogOut className="h-3.5 w-3.5" />
    </button>
  );
  const leave = () => {
    setLeaving(false);
    endTutorial();
  };
  const here = game.actions.length;
  const advised = advice && advice.at === here ? advice : null;
  /* the move as it would be set up: the lesson's card kept, when another
     card plays it — else the expert's own, which is then not set up */
  const move = advised?.action ? (counsel?.action ?? advised.action) : null;
  /* cards named as the hand names them: "la carte Worcester et la carte Forge" */
  const cardsNamed = (ids: string[]): string => listed(ids.map((id) => {
    const c = game.players[me].hand.find((x) => x.id === id);
    return t('game.guide.suggest.card', { card: c ? cardLabel(c) : id });
  }), 'conjunction');
  const ask = () => {
    setAdvice({ at: here, action: null, busy: true, place: false });
    /* the search thinks on the thread that paints: let the note say so first */
    window.setTimeout(() => {
      const g = useGame.getState().game;
      if (!g || g.actions.length !== here) return;
      /* the search itself, at full strength: the machines' own entry point
         caps a human seat under assist and blurs its reading */
      const a = searchTurn(g, me, { budgetMs: 400, strength: 1 })?.action ?? null;
      setAdvice({ at: here, action: a, busy: false, place: false });
    }, 30);
  };
  /* the second degree: where the move is played, lit on the board and
     the camera brought there */
  const showPlace = () => {
    setAdvice((prev) => (prev ? { ...prev, place: true } : prev));
    const at = move ? placeLens(move)?.at : undefined;
    if (at) useGame.getState().flyToRegion(at);
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
  /* the sheet's advice at a plain table: the lesson read for its rule, not its moment */
  const plainKey = (id: string): string => plainKeyOf(id, game, me);
  /* a question is answered from the table as it stands when that is the
     surer match, else from the guide's case — and, when nothing there is
     close, with the notions it might mean */
  const putQuestion = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    /* the table answers where the assistance is on, as the tools' plate does */
    const got = answerQuestion(q, aid ? { g: game, me } : null, t, getLang(), passages);
    if (got.near.length) setNearFor((prev) => ({ ...prev, [q]: got.near }));
    setThread((prev) => askThread(prev, q, got.answer));
    if (got.intent === 'do' && aid && myTurn && !advised) ask();
  };
  /* a notion taken up from the ones offered: asked by its name, answered
     plainly */
  const takeUp = (n: NearNotion) => setThread((prev) => askThread(prev, askedAs(n), tell(n.id, getLang())));
  const stepVars = (): Record<string, string | number> => stepVarsOf(game, me, t, spare?.need);
  /* what a screen reader hears as it comes up: her move first, then the
     news, then the lesson once it is open — said once, not the note over */
  const spoken =
    reading && bot ? `${t('game.guide.botWhy', { name: bot.name })}. ${bot.what}`
    : news.length ? news[news.length - 1].text
    : showSteps && step && !stripped && !stepBack ? `${t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}. ${t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}`
    : '';
  const heard = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {spoken}
    </p>
  );

  /* her move read: the plate goes, and the board shows the move itself */
  const readPlate = (b: NonNullable<typeof bot>) => {
    setBotHidden(b.id);
    if (b.seat >= 0) setGlimpse(glimpseNow(b.seat));
  };
  const readNews = () => setEventsSeen(news[news.length - 1].id);

  /* folded: a rail down the right edge — the lesson's number, how far the
     guide has come (the lessons passed: one set aside is not), a dot while
     something waits to be read (her fresh move, the news, a page); the
     lesson's lens still lights the board */
  if (dock === GUIDE_RAIL) {
    const n = Math.min(shownIndex + 1, LESSONS.length);
    const come = settled.passed.length;
    const due = unreadOf(toRead);
    /* the lesson's number while one is on show or set aside; at rest, the bar alone */
    const numbered = showSteps || setAsideNow;
    /* what is unread has its answer on the rail, as in the note: Understood
       for her move or the news, Next for a page — the machine need not
       wait on a note folded out of sight */
    const answer =
      due === 'plate' && bot ? { go: () => readPlate(bot), word: t('game.guide.botOk'), say: t(holding ? 'game.guide.botNext' : 'game.guide.botOk', { name: bot.name }) }
      : due === 'news' && news.length ? { go: readNews, word: t('game.guide.botOk'), say: t('game.guide.botOk') }
      : due === 'page' ? { go: next, word: t('game.guide.next'), say: t('game.guide.rail.next', { lesson: t(`game.guide.steps.${stepKey(shownId)}.title`, stepVars()) }) }
      : null;
    return (
      <>
        <LessonLens stepId={lensId} active={showSteps} />
        {heard}
        <aside data-guide aria-label={t('game.guide.rail.aria')} className="pointer-events-auto fixed inset-y-0 right-0 z-[80] flex flex-col items-center gap-3 border-l border-brass-hairline bg-coal-950/92 py-3 backdrop-blur-md" style={{ width: GUIDE_RAIL }}>
          <button type="button" onClick={() => setBoardOption('guideFolded', false)} aria-label={t('game.guide.rail.unfold', { key: foldKey })} title={t('game.guide.rail.unfold', { key: foldKey })} className="relative flex h-8 w-8 items-center justify-center rounded-md border border-brass-700/50 text-brass-400 transition-colors hover:border-brass-400 coarse:h-10 coarse:w-10">
            <ChevronLeft className="h-4 w-4" />
            {due && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brass-400 shadow-[0_0_0_1px_rgba(0,0,0,.6)]" />}
          </button>
          {answer && (
            <button type="button" onClick={answer.go} aria-label={answer.say} title={answer.say} className="flex w-8 shrink-0 flex-col items-center gap-1.5 rounded-md border border-brass-400 bg-brass-500/20 py-2 coarse:w-10 text-brass-300 transition-colors hover:bg-brass-500/35">
              {due === 'page' ? <ChevronRight className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              <span className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] [writing-mode:vertical-rl]">{answer.word}</span>
            </button>
          )}
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
              {playOnSwitch('flex h-8 w-8 shrink-0 items-center justify-center coarse:h-10 coarse:w-10')}
            </>
          )}
        </aside>
      </>
    );
  }

  return (
    <div
      ref={boxRef}
      data-guide
      className={cn(
        'z-[80] flex min-h-0 flex-col items-stretch gap-2 overflow-y-auto overscroll-contain',
        dock ? 'pointer-events-auto fixed inset-y-0 right-0 border-l border-brass-hairline bg-coal-950/92 px-3 py-3 backdrop-blur-md' : 'pointer-events-none fixed right-3 will-change-transform',
      )}
      style={dock ? { width: dock } : { top: band.top, width: laneWidth(), maxHeight: band.height, transform: place(lean) }}
    >
      <LessonLens stepId={lensId} active={showSteps} over={placeLit} />
      {heard}
      {/* the lane's head stays at the top as the thread scrolls under it:
          the fold is always in reach, under a finger as under the G key */}
      {dock > 0 && (
        <div className="sticky -top-3 z-10 -mx-3 -mt-3 flex shrink-0 items-center gap-2 bg-coal-950 px-3 pb-1 pt-3">
          <GraduationCap className="h-4 w-4 text-brass-400" aria-hidden />
          <span className="min-w-0 truncate font-fell text-[11px] uppercase tracking-[0.2em] text-cream-100/60 coarse:hidden">{t('game.guide.aria')}</span>
          {showSteps && <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] text-cream-100/45">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</span>}
          <span className="flex-1" />
          {guided && leaveButton('rounded-md p-1 text-cream-100/45 transition-colors hover:text-cream-100 coarse:p-3.5')}
          {playOnSwitch('p-1 coarse:p-3.5')}
          <button type="button" onClick={() => setBoardOption('guideFolded', true)} aria-label={t('game.guide.rail.fold', { key: foldKey })} title={t('game.guide.rail.fold', { key: foldKey })} className="rounded-md border border-brass-700/50 p-1 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400 coarse:p-3.5">
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
                <button type="button" onClick={() => setGlimpse({ seat: m.seat!, at: Date.now() })} className="mt-1 inline-flex items-center gap-1 font-sans text-[9.5px] font-bold uppercase tracking-[0.12em] text-brass-400/70 hover:text-brass-400 coarse:min-h-[44px]">
                  <Eye className="h-3 w-3" /> {t('game.guide.ask.replay')}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {/* leave the guide? Said to be final before it is: the lessons end
            at this table for good, the assistance stays */}
        {confirming && (
          <motion.aside
            key="leave"
            ref={leaveBox}
            tabIndex={-1}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-labelledby="guide-leave-title"
            aria-describedby="guide-leave-body"
            className="paper pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-3 shadow-e3 outline-none"
          >
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div className="relative flex items-start gap-2">
              <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/70" />
              <div className="min-w-0 flex-1">
                <h3 id="guide-leave-title" className="font-display text-[16px] font-bold leading-tight text-ink-900">
                  {t('game.guide.leaveAsk.title')}
                </h3>
                <div id="guide-leave-body" className="mt-1">
                  <Paragraphs text={t('game.guide.leaveAsk.body', { name: machine })} />
                </div>
              </div>
            </div>
            <div className="relative mt-2 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={leave} className="btn-ledger !min-h-[32px] coarse:!min-h-[44px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                {t('game.guide.leaveAsk.go')}
              </button>
              <button ref={stay} type="button" onClick={() => setLeaving(false)} className="btn-strike !min-h-[32px] coarse:!min-h-[44px] !px-4 !py-1 !text-[10.5px]">
                {t('game.guide.leaveAsk.stay')}
              </button>
            </div>
          </motion.aside>
        )}
        {/* nothing due now: a line that says when the guide speaks again —
            the lesson set aside next round, or the next one in its time */}
        {aside && (
          <motion.aside key="aside" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.aria')} className="paper pointer-events-auto relative flex max-w-full flex-col gap-1 px-3 py-1.5 shadow-e3">
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            {/* floating, the guide may be left from here too, by the line's
                end: in the lane its head holds the way out */}
            <div className="relative flex items-start gap-2">
              <div {...grabProps} className={cn(grabClass, 'flex min-w-0 flex-1 items-center gap-2')}>
                {setAsideNow ? <Clock className="h-4 w-4 shrink-0 text-ink-900/70" /> : <GraduationCap className="h-4 w-4 shrink-0 text-ink-900/70" />}
                <span className="min-w-0 font-serif text-[12.5px] leading-snug text-ink-900/85">{setAsideNow ? t('game.guide.aside', { lesson: t(`game.guide.steps.${stepKey(shownId)}.title`, stepVars()) }) : t('game.guide.rest')}</span>
              </div>
              {!dock && leaveButton('shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:-m-3 coarse:p-3.5')}
            </div>
            {behind && (
              <div className="relative flex items-center gap-x-3 pl-6">
                <button type="button" onClick={() => setReview(behind)} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900 coarse:min-h-[44px]">
                  <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                </button>
              </div>
            )}
          </motion.aside>
        )}
        {/* floating, the strip keeps to its own width at the right edge:
            what lies beside it on the table stays in reach */}
        {showSteps && step && (stripped || stepBack) && (
          <motion.aside key="strip" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.aria')} title={opens ? t('game.guide.expand') : undefined} onClick={opens ? tap : undefined} className={cn('paper pointer-events-auto relative flex max-w-full items-center gap-2 px-3 py-1.5 shadow-e3', opens && 'cursor-pointer', !dock && 'self-end')}>
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div {...grabProps} className={cn(grabClass, 'relative flex min-w-0 items-center gap-2')}>
              <GraduationCap className="h-4 w-4 shrink-0 text-ink-900/70" />
              {!waiting && <span className="shrink-0 font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</span>}
              <span className="truncate font-display text-[13px] font-bold text-ink-900">{waiting ?? t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</span>
            </div>
            {opens && (
              <button type="button" onClick={unfold} aria-label={t('game.guide.expand')} title={t('game.guide.expand')} className="relative shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:-m-3 coarse:p-3.5">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}
        {(showSteps ? !(stripped || stepBack) : lines.length > 0 && !holding) && (
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
                  {/* floating, the note is held to the room left under the
                      top bar: the text column takes the row's height, not
                      its own, and scrolls in it — else it runs on under
                      the buttons below */}
                  <div className={cn('flex gap-2', dock ? 'items-start' : 'min-h-0 items-stretch')}>
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/70" />
                    <div className={cn('flex min-w-0 flex-1 flex-col', !dock && 'min-h-0')}>
                      <div className="flex items-start justify-between gap-2">
                        <div {...grabProps} className={cn(grabClass, 'min-w-0 flex-1')}>
                          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, LESSONS.length), total: LESSONS.length })}</p>
                          <h3 className="mt-0.5 font-display text-[16px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</h3>
                        </div>
                        {/* floating, the way out stands by the fold, far from
                            Back: under a finger the two keep a thumb apart */}
                        {!dock && (
                          <div className="flex shrink-0 items-center gap-1.5 coarse:gap-7">
                            {leaveButton('rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:-m-3 coarse:p-3.5')}
                            <button type="button" onClick={() => fold(true)} aria-label={t('game.guide.minify')} title={t('game.guide.foldHint')} className="shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:-m-3 coarse:p-3.5">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={cn('mt-1', !dock && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
                        {sheetAdvice && !adviceSeen && review === null && (
                          <div className="mb-2 rounded-md border border-brass-500/50 bg-brass-500/10 px-2.5 py-1.5">
                            <p className="font-serif text-[12.5px] leading-snug text-ink-900/85">
                              {t('game.guide.advice.lede', { n: sheetAdvice.times })} <span className="font-semibold">{t(`game.debrief.motifs.${sheetAdvice.motif}`)}</span>
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <button type="button" onClick={() => { setReview(reread(settled, sheetAdvice.id)); setAdviceSeen(true); }} className="btn-strike !min-h-[24px] coarse:!min-h-[44px] !px-2.5 !py-0.5 !text-[10px]">
                                {t('game.guide.advice.open', { lesson: t(`game.guide.steps.${stepKey(sheetAdvice.id)}.title`, stepVars()) })}
                              </button>
                              <button type="button" onClick={() => setAdviceSeen(true)} className="font-sans text-[10.5px] text-ink-900/55 hover:text-ink-900 coarse:min-h-[44px] coarse:px-2">{t('game.guide.advice.later')}</button>
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
                      {pageHold && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.botHeld', { name: machine })}</p>}
                      {step.done && review === null && !blocked && !already && !spare && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{myTurn ? t('game.guide.yourTurn') : t('game.guide.wait')}</p>}
                      {blocked && !myTurn && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.wait')}</p>}
                      </div>
                    </div>
                  </div>
                  {shownIndex === 0 && !dock && <p className="mt-2 shrink-0 font-serif text-[11px] italic text-ink-900/50">{t('game.guide.foldHint')}</p>}
                  <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {behind && (
                        <button type="button" onClick={() => setReview(behind)} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900 coarse:min-h-[44px]">
                          <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                        </button>
                      )}
                      {aid && myTurn && !advised && (
                        <button type="button" onClick={ask} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bottle-600 hover:text-ink-900 coarse:min-h-[44px]">
                          <Sparkles className="h-3 w-3" /> {t('game.guide.suggest.ask')}
                        </button>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {/* Show, while what it shows is not on show: the points'
                          ruler hidden, the lesson's halo rings this toggle */}
                      {step.show && !(step.show === 'mat' && matPlayer !== null) && !(step.show === 'vp' && vpTrack) && !(step.show === 'ledger' && ledgerOpen) && (
                        <button type="button" onClick={() => show(step.show!)} data-lens={step.show === 'vp' ? 'vp' : undefined} className="btn-ledger !min-h-[32px] coarse:!min-h-[44px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Eye className="h-3.5 w-3.5" /> {t(`game.guide.show.${step.show}`)}
                        </button>
                      )}
                      {later && (
                        <button type="button" onClick={() => putAside(later)} title={t('game.guide.laterHint')} className="btn-ledger !min-h-[32px] coarse:!min-h-[44px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Clock className="h-3.5 w-3.5" /> {detour && dueStep ? t('game.guide.laterLesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) }) : t('game.guide.later')}
                        </button>
                      )}
                      {/* Skip: a deed the table does not allow now, for a
                          reader who gives it up — beside Later when it may
                          wait — or one played past in the last round; in
                          the loan's detour, the lesson that led there when
                          it cannot wait */}
                      {(blocked || (detour && !later) || way === 'skip') && myTurn && !already && (
                        <button type="button" onClick={() => owed?.id && passOn(owed.id)} className="btn-ledger !min-h-[32px] coarse:!min-h-[44px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          {detour && dueStep ? t('game.guide.skipLesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) }) : t('game.guide.skip')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(!step.done || review !== null || already || !!spare) && (
                        <button type="button" onClick={next} className="btn-strike !min-h-[32px] coarse:!min-h-[44px] !px-4 !py-1 !text-[10.5px]">
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
                    <button type="button" onClick={() => setMuted({ ids: [...put, ...told.map((x) => x.id)], round })} aria-label={t('game.guide.hide')} title={t('game.guide.hide')} className="rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:p-3">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {aid && myTurn && !advised && (
                      <button type="button" onClick={ask} aria-label={t('game.guide.suggest.ask')} title={t('game.guide.suggest.ask')} className="rounded-full p-0.5 text-bottle-600 hover:text-ink-900 coarse:p-3">
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {pages > 1 && (
                      <button type="button" onClick={() => setPage((page + 1) % pages)} className="font-mono text-[10px] text-ink-900/50 hover:text-ink-900 coarse:min-h-[44px] coarse:px-2">
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
                    <p className="font-display text-[13px] font-bold text-ink-900">{t(`game.guide.steps.${plainKey(sheetAdvice.id)}.title`, stepVars())}</p>
                    <Paragraphs text={t(`game.guide.steps.${plainKey(sheetAdvice.id)}.body`, stepVars())} />
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => setAdviceOpen(true)} className="btn-strike !min-h-[24px] coarse:!min-h-[44px] !px-2.5 !py-0.5 !text-[10px]">
                      {t('game.guide.advice.open', { lesson: t(`game.guide.steps.${plainKey(sheetAdvice.id)}.title`, stepVars()) })}
                    </button>
                    <button type="button" onClick={() => setAdviceSeen(true)} className="font-sans text-[10.5px] text-ink-900/55 hover:text-ink-900 coarse:min-h-[44px] coarse:px-2">{t('game.guide.advice.later')}</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setAdviceSeen(true)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900 coarse:-m-3 coarse:p-3.5">
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
                {/* her move on the board: a button under a finger as under
                    the mouse, its key named only where there are keys */}
                {reading && (
                  <button type="button" onClick={() => setGlimpse(glimpseNow(bot.seat))} className="mt-0.5 inline-flex items-center gap-1 self-start text-left font-sans text-[9.5px] uppercase tracking-[0.12em] text-brass-400/60 hover:text-brass-400 coarse:min-h-[44px]">
                    <Eye className="h-3 w-3 shrink-0" />
                    <span>
                      {t('game.guide.seeMove', { name: bot.name })}
                      {!finger && <kbd className="ml-1 font-mono tracking-normal text-brass-400/50">({keyLabel(keys.lastMove)})</kbd>}
                    </span>
                  </button>
                )}
                {(reading || !tutorial) && (
                  <div className={cn('mt-1', !dock && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
                    <p className="font-serif text-[13px] leading-snug text-cream-100/90">{bot.why}</p>
                    <p className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{bot.turn}</p>
                  </div>
                )}
              </div>
              {!reading && (
                <button type="button" onClick={() => setBotHidden(bot.id)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-cream-100/40 hover:text-brass-400 coarse:-m-3 coarse:p-3.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {holding && <p className="mt-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400/70">{t('game.guide.botHeld', { name: bot.name })}</p>}
            {reading && (
              <button ref={plateOk} type="button" onClick={() => readPlate(bot)} className="btn-strike mt-2 !min-h-[30px] coarse:!min-h-[44px] w-full !px-3 !py-1 !text-[10px]">
                {t(holding ? 'game.guide.botNext' : 'game.guide.botOk', { name: bot.name })}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            {/* after the first rounds its moves may go by unheld: said here,
                where the waiting is felt, and taken back the same way */}
            {reading && offerPlayOn && (
              <button type="button" onClick={() => letPlay(!playOn)} title={t('game.guide.playOn.hint', { name: bot.name })} className="mt-1.5 self-center font-sans text-[9.5px] font-bold uppercase tracking-[0.12em] text-brass-400/70 hover:text-brass-400 coarse:min-h-[44px]">
                {t(playOn ? 'game.guide.playOn.hold' : 'game.guide.playOn.let', { name: bot.name })}
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
            <button ref={newsOk} type="button" onClick={readNews} className="btn-strike mt-2 !min-h-[30px] coarse:!min-h-[44px] w-full !px-3 !py-1 !text-[10px]">
              {t('game.guide.botOk')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.aside>
        )}

        {/* what an expert would play in the reader's seat, on request */}
        {advised && myTurn && (
          <motion.aside key={`advice-${here}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.suggest.aria')} style={{ maxHeight: dock ? undefined : band.height }} className="plate pointer-events-auto relative flex w-full shrink-0 flex-col px-4 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-bottle-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-bottle-400">{t('game.guide.suggest.title')}</p>
                {advised.busy ? (
                  <p className="mt-0.5 font-serif text-[13px] italic text-cream-100/70">{t('game.guide.suggest.thinking')}</p>
                ) : move ? (
                  <>
                    {/* the reason first; the move itself, and where, once asked for */}
                    {advised.place && <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{describeAction(move)}</p>}
                    <p className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">
                      {t(`game.guide.suggest.why.${whyKey(move)}`)}
                      {advised.place && (() => {
                        /* a link to a merchant place with no merchant at this table: worth its
                           two link icons and the coal market all the same — say so */
                        if (move.kind !== 'network') return null;
                        const ends = [move.link, move.second].flatMap((id) => (id ? [LINKS.find((l) => l.id === id)] : [])).flatMap((l) => (l ? [l.a, l.b] : []));
                        const closed = ends.find((n) => MERCHANT_BY_ID[n] && !(game.merchantTiles[n]?.length));
                        return closed ? ` ${t('game.guide.suggest.closedMerchant', { merchant: MERCHANT_BY_ID[closed].name })}` : null;
                      })()}
                    </p>
                    {/* the card the lesson keeps: another plays the move, or none does */}
                    {advised.place && counsel?.lesson && (
                      <p className="mt-1 font-serif text-[12.5px] leading-snug text-cream-100/80">
                        {counsel.action
                          ? t('game.guide.suggest.spared', { card: cardsNamed(counsel.played), kept: cardsNamed(counsel.kept), lesson: t(`game.guide.steps.${stepKey(counsel.lesson)}.title`, stepVars()) })
                          : t('game.guide.suggest.kept', { kept: cardsNamed(counsel.kept), lesson: t(`game.guide.steps.${stepKey(counsel.lesson)}.title`, stepVars()) })}
                      </p>
                    )}
                    {dueStep && owed?.mode === 'do' && !spare && !asked(dueStep.id, move) && <p className="mt-1 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{t('game.guide.suggest.lesson', { lesson: t(`game.guide.steps.${stepKey(dueStep.id)}.title`, stepVars()) })}</p>}
                  </>
                ) : (
                  <p className="mt-0.5 font-serif text-[13px] text-cream-100/90">{t('game.guide.suggest.none')}</p>
                )}
              </div>
              <button type="button" onClick={() => setAdvice(null)} aria-label={t('game.guide.hide')} className="shrink-0 rounded-full p-0.5 text-cream-100/40 hover:text-brass-400 coarse:-m-3 coarse:p-3.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* one degree more at each click: the place, then the move set
                up — never with the card the lesson keeps */}
            {!advised.busy && move && !advised.place && (
              <button type="button" onClick={showPlace} className="btn-strike mt-2 !min-h-[30px] coarse:!min-h-[44px] w-full !px-3 !py-1 !text-[10px]">
                {t(hasPlace(move) ? 'game.guide.suggest.where' : 'game.guide.suggest.show')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            {!advised.busy && advised.place && counsel?.action && (
              <button type="button" onClick={() => prepare(counsel.action!)} className="btn-strike mt-2 !min-h-[30px] coarse:!min-h-[44px] w-full !px-3 !py-1 !text-[10px]">
                {t('game.guide.suggest.prepare')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* a question to the guide, answered from the table as it stands —
          in the lane for as long as it stands, the guide left or not */}
      {dock > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            putQuestion();
          }}
          className="sticky -bottom-3 z-10 -mx-3 -mb-3 mt-auto flex shrink-0 items-center gap-2 bg-coal-950 px-3 pb-3 pt-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('game.guide.ask.placeholder')}
            aria-label={t('game.guide.ask.placeholder')}
            className="min-w-0 flex-1 rounded-md border border-brass-700/60 bg-coal-900/90 px-3 py-1.5 font-sans text-[12px] coarse:min-h-[44px] text-cream-100 placeholder:text-cream-100/35 focus:border-brass-400 focus:outline-none"
          />
          <button type="submit" disabled={!question.trim()} aria-label={t('game.guide.ask.send')} title={t('game.guide.ask.send')} className="btn-strike !min-h-[32px] coarse:!min-h-[44px] shrink-0 !px-3 !py-1 !text-[10px] disabled:opacity-40 coarse:!px-4">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(Guide);
