import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, ChevronLeft, ChevronRight, Eye, GraduationCap, Lightbulb, Minus, Newspaper, Sparkles, X } from 'lucide-react';
import { aidOn, setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY, POS_KEY } from '@/components/game/guideKeys';
import { getKeybindings, keyLabel } from '@/components/game/keybindings';
import { INCOME_PAYOUT, INDUSTRIES, LOAN_AMOUNT, LOAN_INCOME_HIT, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { buildTargets, canLoan, eraRounds, linkTargets, marketSaleOnBuild, sellTargets } from '@/game/engine';
import { ledgerText } from '@/game/ledgerText';
import { describeAction, useGame } from '@/game/store';
import { chooseBotAction } from '@/game/search';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

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

/** what a lesson may point at on the screen */
type Show = 'mat' | 'market' | 'vp';

interface Step {
  id: string;
  /** done by the state (a 'do' step), or by reading on (a 'read' step);
   *  `ack` says the machine's latest move has been read and understood */
  done?: (g: GameState, me: number, sel: string | null, mat: number | null, ack: boolean) => boolean;
  show?: Show;
  /** a read step that only makes sense once this holds */
  when?: (g: GameState, me: number) => boolean;
}

const WORKS = ['cotton', 'manufacturer', 'pottery'];

const STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'board' },
  { id: 'goal', show: 'vp' },
  { id: 'money' },
  { id: 'mat', show: 'mat', done: (_g, _me, _sel, mat) => mat !== null },
  { id: 'matRead', show: 'mat' },
  { id: 'hand', done: (_g, _me, sel) => sel !== null },
  { id: 'coal', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && t.industry === 'coal') },
  /* done once the machine has played and its reasons were read: the
     lesson is the plate under it, not the words above */
  { id: 'botTurn', done: (g, me, _sel, _mat, ack) => ack && g.ledger.some((e) => e.player !== undefined && e.player !== me && e.verb !== 'system') },
  { id: 'payday', when: (g) => g.round >= 2 },
  { id: 'link', done: (g, me) => Object.values(g.links).some((l) => l.owner === me) },
  { id: 'works', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && WORKS.includes(t.industry)) },
  { id: 'market', show: 'market' },
  { id: 'beer' },
  { id: 'sell', done: (g, me) => g.players[me].stats.sold > 0 },
  { id: 'flipped', when: (g, me) => g.players[me].stats.sold > 0 },
  { id: 'loan', done: (g, me) => g.players[me].loans > 0 },
  { id: 'develop' },
  { id: 'eraEnd' },
  { id: 'onward' },
];

const STEP_KEY = 'brassworks.tutorial.step';
const REACH_KEY = 'brassworks.tutorial.reached';

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
  const reach = Math.max(0, w / 2 - 80);
  const down = Math.max(0, h - 220);
  return { x: clamp(p.x, -reach, reach), y: clamp(p.y, Math.min(0, -90), down) };
};
/** a sentence that follows a colon starts low */
const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const place = (p: Pos) => `translate(calc(-50% + ${p.x}px), ${p.y}px)`;

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
    case 'loan':
      why = t('game.guide.bot.loan', facts);
      break;
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
        if (e.player === me) out.push({ id: e.id, text: t('game.guide.happens.short', vars) });
        break;
      default:
        break;
    }
  }
  return out;
}

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
  if (id === 'coal' || id === 'works') {
    const inds = id === 'coal' ? ['coal'] : WORKS;
    const targets = p.hand.flatMap((c) => buildTargets(g, me, c)).filter((x) => inds.includes(x.industry));
    if (targets.some((x) => x.valid)) return null;
    const short = targets.filter((x) => money(x.reason));
    if (short.length) {
      const why = t(`game.guide.blocked.${id}Money`, { ...vars, need: Math.min(...short.map((x) => x.total)) });
      return { short: why, text: `${why} ${t('game.guide.blocked.loanAdvice', vars)}`, money: true };
    }
    const why = t(`game.guide.blocked.${id}Card`, vars);
    return { short: why, text: why, money: false };
  }
  if (id === 'link') {
    const targets = linkTargets(g, me);
    if (targets.some((x) => x.valid)) return null;
    const short = targets.some((x) => money(x.reason));
    const why = t(short ? 'game.guide.blocked.linkMoney' : 'game.guide.blocked.link', vars);
    return { short: why, text: short ? `${why} ${t('game.guide.blocked.loanAdvice', vars)}` : why, money: short };
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
const LOAN_AT = STEPS.findIndex((x) => x.id === 'loan');

/* ----------------------------- the alerts ---------------------------- */

/** what the assistance says on its own: money, payday, a tile flipped, the era */
function alerts(c: Ctx, t: T): { id: string; text: string }[] {
  const { g, me } = c;
  const p = g.players[me];
  const out: { id: string; text: string }[] = [];
  const last = g.ledger[g.ledger.length - 1];
  const level = incomeLevel(p.income);
  if (p.money < 8 && p.loans === 0) out.push({ id: 'broke', text: t('game.guide.alerts.broke', { money: p.money, amount: LOAN_AMOUNT, hit: LOAN_INCOME_HIT, level, after: Math.max(-10, level - LOAN_INCOME_HIT) }) });
  else if (p.money < 8) out.push({ id: 'brokeAgain', text: t('game.guide.alerts.brokeAgain', { money: p.money, level }) });
  if (last?.key === 'payday') out.push({ id: 'payday', text: t(level >= 0 ? 'game.guide.alerts.payday' : 'game.guide.alerts.paydayOwed', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  if (g.deck.length === 0 && p.hand.length > 0) out.push({ id: 'deckOut', text: t('game.guide.alerts.deckOut', { cards: p.hand.length }) });
  if (level < 0) out.push({ id: 'negative', text: t('game.guide.alerts.negative', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  if (g.era === 'canal' && g.round >= eraRounds(g.players.length) - 1) {
    out.push({ id: 'eraEnd', text: t('game.guide.alerts.eraEnd') });
    /* the tiles of theirs the sweep is about to take, named */
    const doomed = Object.entries(g.tiles).filter(([, x]) => x.owner === me && x.level === 1);
    if (doomed.length) out.push({ id: 'eraEndMine', text: t('game.guide.alerts.eraEndMine', { list: doomed.map(([key, x]) => `${t(`game.log.industry.${x.industry}`)} (${TOWN_BY_ID[key.split(':')[0]]?.name ?? key})`).join(', '), n: doomed.length, unsold: doomed.filter(([, x]) => !x.flipped).length }) });
  }
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

export default function Guide() {
  const t = useT();
  const game = useGame((s) => s.game);
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const buildPick = useGame((s) => s.buildPick);
  const tutorial = useGame((s) => s.tutorial);
  const endTutorial = useGame((s) => s.endTutorial);
  const matPlayer = useGame((s) => s.matPlayer);
  const marketFocus = useGame((s) => s.marketFocus);
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
  const setGlimpse = useGame((s) => s.setGlimpse);
  const [paged, setPaged] = useState({ key: '', page: 0 });
  /* the note can be dragged by its head, and folded to a strip; a new
     lesson unfolds it */
  const [pos, setPos] = useState<Pos>(readPos);
  const [miniAt, setMiniAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(MINI_KEY) ?? -1);
    } catch {
      return -1;
    }
  });
  const grip = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; at: Pos; t0: number } | null>(null);
  /* the room the note has: under whatever the top bar occupies, above the hand */
  const [band, setBand] = useState<{ top: number; height: number }>({ top: 100, height: 520 });
  useEffect(() => {
    const measure = () => {
      /* a hidden tab measures every box at zero: nothing is learned from it */
      if (window.innerHeight < 320) return;
      const bar = document.querySelector('[data-topbar]')?.getBoundingClientRect();
      const rail = document.querySelector('[data-player-rail]')?.getBoundingClientRect();
      const dock = document.querySelector('[data-dock]')?.getBoundingClientRect();
      const top = Math.round(Math.max(bar?.bottom || 80, window.innerWidth < 1024 ? rail?.bottom || 0 : 0)) + 12;
      const foot = dock && dock.top > top ? dock.top : window.innerHeight - 40;
      setBand({ top, height: Math.max(220, Math.round(foot - top - 12)) });
      setPos((p) => fit(p));
    };
    measure();
    const t = window.setInterval(measure, 1000);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, []);
  /* the press that just ended was a move or a hold, not a click: the
     click that follows it must not fold the note */
  const held = useRef(false);
  /* the box moves under the pointer without a render: the state is
     written once, when it is let go */
  const box = useRef<HTMLDivElement>(null);
  const [readPast, setReadPast] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STEP_KEY) ?? 0);
    } catch {
      return 0;
    }
  });

  /* my seat: online the one the table gave me; at home the first human at the table */
  const me = seat ?? Math.max(0, game?.players.findIndex((p) => !p.isBot) ?? 0);
  const myTurn = !!game && game.phase === 'action' && game.current === me && !game.players[me].isBot;
  const aid = !!game && me >= 0 && aidOn(game.assist, code !== null);
  const botNow = useMemo(() => (game ? botReason(game, me, t) : null), [game, me, t]);
  const ack = !!botNow && botHidden === botNow.id;
  /* the turns of the table, and the highest entry read of them */
  const happens = useMemo(() => (game && aid ? happenings(game, me, t) : []), [game, aid, me, t]);
  const [eventsSeen, setEventsSeen] = useState(-1);
  /* the machine's move whose reading the reader has set aside to see the lesson */
  const [unfoldAt, setUnfoldAt] = useState(-1);
  /* a lesson the reader went back to: held until they read forward again */
  const [review, setReview] = useState<number | null>(null);
  /* the lesson whose deed was already done when it came up: it stays a page
     to read on from, even if the reader undoes the deed meanwhile */
  const [arrived, setArrived] = useState<{ at: number; done: boolean }>({ at: -1, done: false });
  const news = happens.filter((x) => x.id > eventsSeen);

  /* the lesson: the first step not done — a read step is done once read past,
     and a step once passed stays passed (closing the mat again is no reason
     to teach the mat again) */
  const [reached, setReached] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(REACH_KEY) ?? 0);
    } catch {
      return 0;
    }
  });
  /* the first lesson not done, and the first one waiting on the game
     before it: that one is not passed, it comes up when its time comes */
  const lesson = (): { rawIndex: number; pending: number } => {
    if (!game || !tutorial) return { rawIndex: -1, pending: -1 };
    let pending = -1;
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (i < reached) continue;
      /* a deed already done when the lesson comes up is no reason to skip
         the lesson: it becomes a page to read on from */
      if (s.done ? s.done(game, me, selectedCardId, matPlayer, ack) && i < readPast : i < readPast) continue;
      /* a read step waiting on the game: skipped until it makes sense */
      if (!s.done && s.when && !s.when(game, me)) {
        if (pending < 0) pending = i;
        continue;
      }
      return { rawIndex: i, pending };
    }
    return { rawIndex: STEPS.length, pending };
  };
  const { rawIndex, pending } = review !== null ? { rawIndex: review, pending: -1 } : lesson();
  /* the lesson on show, for the tips that must not repeat it */
  const dueId = tutorial && rawIndex >= 0 && rawIndex < STEPS.length ? STEPS[rawIndex].id : null;
  const stepIndex = rawIndex < 0 ? -1 : review !== null ? review : Math.max(rawIndex, reached);
  const reachable = pending >= 0 ? Math.min(rawIndex, pending) : rawIndex;
  if (tutorial && review === null && reachable > reached) {
    setReached(reachable);
    try {
      localStorage.setItem(REACH_KEY, String(reachable));
    } catch {
      /* non-fatal */
    }
  }

  const ctx = useMemo<Ctx | null>(() => (game ? { g: game, me, step: dueId, card: selectedCardId ? (game.players[me]?.hand.find((c) => c.id === selectedCardId) ?? null) : null, verb, buildPick: buildPick ? { industry: buildPick.industry, level: buildPick.level, town: buildPick.town } : null } : null), [game, me, dueId, selectedCardId, verb, buildPick]);
  const tips = useMemo(() => (ctx && aid && myTurn ? TIPS.filter((tip) => tip.when(ctx)).map((tip) => ({ id: tip.id, text: t(`game.guide.tips.${tip.id}`, tip.vars?.(ctx)) })) : []), [ctx, aid, myTurn, t]);
  const warnings = useMemo(() => (ctx && aid ? alerts(ctx, t) : []), [ctx, aid, t]);
  const bot = useMemo(() => (game && aid ? botReason(game, me, t) : null), [game, aid, me, t]);

  const situation = `${selectedCardId ?? ''}|${verb ?? ''}|${game?.current ?? ''}`;
  const page = paged.key === situation ? paged.page : 0;
  const setPage = (p: number) => setPaged({ key: situation, page: p });

  /* the machine's next move waits while its last one is being read (guided game only) */
  const lessonNow = tutorial && stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const unread = !!lessonNow && !lessonNow.done;
  const holdWanted = !!(tutorial && game && game.phase === 'action' && game.players[game.current]?.isBot && ((bot && bot.fresh && botHidden !== bot.id) || unread || news.length > 0));
  useEffect(() => {
    setBotHold(holdWanted);
    return () => setBotHold(false);
  }, [holdWanted, setBotHold]);


  if (!game || game.phase !== 'action') return null;
  const showSteps = tutorial && stepIndex >= 0;
  const due = showSteps ? STEPS[Math.min(stepIndex, STEPS.length - 1)] : null;
  const finished = showSteps && stepIndex >= STEPS.length;
  /* the deed the lesson asks for, when the table does not allow it now;
     when money is what is missing and the loan is still to be taught, the
     guide takes that lesson first and comes back to this one after */
  const block = due?.done && !finished && review === null ? blockedBy(due.id, game, me, t) : null;
  const detour = !!block?.money && due!.id !== 'loan' && stepIndex < LOAN_AT && !STEPS[LOAN_AT].done!(game, me, selectedCardId, matPlayer, ack) && canLoan(game, me).ok;
  const step = detour ? STEPS[LOAN_AT] : due;
  const shownIndex = detour ? LOAN_AT : stepIndex;
  const blocked = detour ? null : (block?.text ?? null);
  /* folded for the lesson on show only: the next one unfolds the note */
  const mini = miniAt === shownIndex;
  /* a side panel opened by a lesson is what the lesson talks about: the
     note leans off it, unless the reader has placed it themselves */
  const room = Math.min(180, Math.max(0, window.innerWidth / 2 - 320));
  const lean = pos.x !== 0 || pos.y !== 0 ? pos : matPlayer !== null ? { x: room, y: 0 } : marketFocus ? { x: -room, y: 0 } : pos;
  const doneNow = !!step?.done && step.done(game, me, selectedCardId, matPlayer, ack);
  if (shownIndex >= 0 && arrived.at !== shownIndex) setArrived({ at: shownIndex, done: doneNow });
  const already = doneNow || (arrived.at === shownIndex && arrived.done);
  const lines = [...warnings.map((w) => w.text), ...tips.map((x) => x.text)];
  const pages = Math.max(1, Math.ceil(lines.length / 2));
  const shown = lines.slice(page * 2, page * 2 + 2);
  const showBot = bot && botHidden !== bot.id && (showSteps || !hidden);
  /* the guided game waits: the machine's next move comes once this one is read */
  const holding = !!(tutorial && showBot && bot?.fresh && game.players[game.current]?.isBot);
  /* the machine's fresh move is on show: the lesson folds to its strip
     so the plate reads first, until it is understood — every move of
     hers, in the guided game; an older plate is a line */
  const reading = !!(tutorial && showBot && bot?.fresh);
  /* the reader asked for the lesson back while the plate is on show */
  const unfolded = unfoldAt === bot?.id;
  if (!showSteps && (hidden || lines.length === 0) && !showBot) return null;

  const advance = (to: number) => {
    setReview(null);
    /* reading on does not pass a lesson still waiting on the game */
    const reach = pending >= 0 && pending < to ? pending : to;
    /* the lesson on the hand wants the hand in view: the mat goes */
    if (STEPS[to]?.id === 'hand' && matPlayer !== null) closeMat();
    setReadPast(to);
    setReached(reach);
    try {
      localStorage.setItem(STEP_KEY, String(to));
      localStorage.setItem(REACH_KEY, String(reach));
    } catch {
      /* non-fatal */
    }
  };
  const fold = (to: boolean) => {
    setMiniAt(to ? shownIndex : -1);
    try {
      localStorage.setItem(MINI_KEY, String(to ? shownIndex : -1));
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
  const grabProps = { onPointerDown: grab, onPointerMove: drag, onPointerUp: drop, onPointerCancel: drop, onDoubleClick: home, title: t('game.guide.move') };
  const grabClass = 'cursor-grab touch-none select-none active:cursor-grabbing';
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
      const a = chooseBotAction(g, me, { budgetMs: 400, strength: 1 });
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
    : id === 'works' ? a.kind === 'build' && WORKS.includes(a.industry)
    : id === 'link' ? a.kind === 'network'
    : id === 'sell' ? a.kind === 'sell'
    : id === 'loan' ? a.kind === 'loan'
    : true;
  const whyKey = (a: GameAction): string => {
    if (a.kind === 'build') return a.industry === 'coal' || a.industry === 'iron' || a.industry === 'brewery' ? a.industry : 'works';
    return a.kind;
  };
  /* the lesson's words, when the table asks for another telling of it:
     a payday owed rather than paid, a short game that ends here */
  const stepKey = (id: string): string =>
    id === 'payday' && incomeLevel(game.players[me].income) < 0 ? 'paydayOwed' : id === 'eraEnd' && game.eraLength === 'short' ? 'eraEndShort' : id;
  const stepVars = (): Record<string, string | number> => {
    const p = game.players[me];
    const k = getKeybindings();
    return { name: p.name, money: p.money, level: incomeLevel(p.income), pay: Math.abs(INCOME_PAYOUT[p.income]), rounds: eraRounds(game.players.length), bot: game.players.find((x) => x.isBot)?.name ?? '', nth: t(game.actionsLeft === 1 ? 'game.guide.nth.second' : 'game.guide.nth.first'), keyMat: keyLabel(k.mat), keyLedger: keyLabel(k.ledger), keyMarket: keyLabel(k.market), keyVp: keyLabel(k.vpTrack) };
  };

  return (
    <div ref={box} data-guide className="pointer-events-none fixed left-1/2 z-[80] flex w-[min(600px,92vw)] min-h-0 flex-col items-center gap-2 overflow-y-auto overscroll-contain will-change-transform" style={{ top: band.top, maxHeight: band.height, transform: place(lean) }}>
      <AnimatePresence initial={false} mode="popLayout">
        {showSteps && step && (mini || (reading && !unfolded)) && (
          <motion.aside key="strip" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.aria')} title={reading && !mini ? undefined : t('game.guide.expand')} onClick={reading && !mini ? undefined : tap} className={cn('paper pointer-events-auto relative flex max-w-full items-center gap-2 px-3 py-1.5 shadow-e3', !reading && 'cursor-pointer')}>
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div {...grabProps} className={cn(grabClass, 'relative flex min-w-0 items-center gap-2')}>
              <GraduationCap className="h-4 w-4 shrink-0 text-ink-900/70" />
              <span className="shrink-0 font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, STEPS.length), total: STEPS.length })}</span>
              <span className="truncate font-display text-[13px] font-bold text-ink-900">{t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</span>
            </div>
            {(!reading || mini) && (
              <button type="button" onClick={() => (reading ? setUnfoldAt(bot?.id ?? -1) : fold(false))} aria-label={t('game.guide.expand')} title={t('game.guide.expand')} className="relative shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.aside>
        )}
        {(showSteps || lines.length > 0) && !(hidden && !showSteps) && !holding && !(showSteps && (mini || reading)) && (
          <motion.aside
            key="note"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label={t('game.guide.aria')}
            onClick={showSteps ? tap : undefined}
            style={{ maxHeight: band.height }}
            className={cn('paper pointer-events-auto relative flex w-full min-h-0 flex-col px-4 py-3 shadow-e3', showSteps && 'cursor-pointer')}
          >
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div className="relative flex min-h-0 flex-col">
              {showSteps && step ? (
                <>
                  <div className="flex min-h-0 items-start gap-3">
                    <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-ink-900/70" />
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div {...grabProps} className={cn(grabClass, 'min-w-0 flex-1')}>
                          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(shownIndex + 1, STEPS.length), total: STEPS.length })}</p>
                          <h3 className="mt-0.5 font-display text-[17px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${stepKey(step.id)}.title`, stepVars())}</h3>
                        </div>
                        <button type="button" onClick={() => fold(true)} aria-label={t('game.guide.minify')} title={t('game.guide.foldHint')} className="shrink-0 rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
                        {detour && block && <p className="mb-1.5 font-serif text-[13px] leading-snug text-rust-500">{t('game.guide.detour', { lesson: t(`game.guide.steps.${stepKey(due!.id)}.title`, stepVars()) })} {lower(block.short)}</p>}
                        {blocked && <p className="mb-1.5 font-serif text-[13px] leading-snug text-rust-500">{blocked}</p>}
                        <Paragraphs text={t(`game.guide.steps.${stepKey(step.id)}.body`, stepVars())} />
                      {/* what the chosen card allows, what the pick costs: the
                          assistance speaks under the lesson too */}
                      {tips.filter((x) => AT_HAND.has(x.id)).slice(0, 2).map((x) => (
                        <p key={x.id} className="mt-1.5 font-serif text-[12.5px] leading-snug text-ink-900/80">
                          {x.text}
                        </p>
                      ))}
                      {warnings.filter((w) => (['negative', 'eraEnd', 'eraEndMine', 'deckOut'].includes(w.id) || ((w.id === 'broke' || w.id === 'brokeAgain') && !block))).map((w) => (
                        <p key={w.id} className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-ink-900/70">
                          {w.text}
                        </p>
                      ))}
                      {!step.done && !finished && game.players[game.current]?.isBot && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.botHeld', { name: machine })}</p>}
                      {step.done && !finished && !blocked && !already && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{step.id === 'botTurn' ? t('game.guide.readPlate', stepVars()) : myTurn ? t('game.guide.yourTurn') : t('game.guide.wait')}</p>}
                      {blocked && !myTurn && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{t('game.guide.wait')}</p>}
                      </div>
                    </div>
                  </div>
                  {shownIndex === 0 && <p className="mt-2 shrink-0 font-serif text-[11px] italic text-ink-900/50">{t('game.guide.foldHint')}</p>}
                  <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={endTutorial} className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                        {t('game.guide.leave')}
                      </button>
                      {stepIndex > 0 && (
                        <button type="button" onClick={() => setReview(Math.max(0, shownIndex - 1))} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                          <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                        </button>
                      )}
                      {myTurn && !advised && (
                        <button type="button" onClick={ask} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bottle-600 hover:text-ink-900">
                          <Sparkles className="h-3 w-3" /> {t('game.guide.suggest.ask', { name: machine })}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {step.show && !(step.show === 'mat' && matPlayer !== null) && (
                        <button type="button" onClick={() => show(step.show!)} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Eye className="h-3.5 w-3.5" /> {t(`game.guide.show.${step.show}`)}
                        </button>
                      )}
                      {blocked && myTurn && !already && (
                        <button type="button" onClick={() => advance(stepIndex + 1)} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          {t('game.guide.skip')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(!step.done || finished || review !== null || already) && (
                        <button type="button" onClick={finished || stepIndex === STEPS.length - 1 ? endTutorial : () => advance(Math.max(stepIndex + 1, reached))} className="btn-strike !min-h-[32px] !px-4 !py-1 !text-[10.5px]">
                          {finished || stepIndex === STEPS.length - 1 ? t('game.guide.done') : t('game.guide.next')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-0 items-start gap-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/60" />
                  <ul className="min-h-0 min-w-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
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
        {showBot && bot && (
          <motion.aside key={`bot-${bot.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.botAria')} className="plate pointer-events-auto relative w-full px-4 py-2.5">
            <div className="flex items-start gap-3">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-brass-400">{t('game.guide.botWhy', { name: bot.name })}</p>
                <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{bot.what}</p>
                {reading && <p className="mt-0.5 font-sans text-[9.5px] uppercase tracking-[0.12em] text-brass-400/60">{t('game.guide.seeMove', { key: keyLabel(getKeybindings().lastMove), name: bot.name })}</p>}
                {(reading || !tutorial) && (
                  <>
                    <p className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">{bot.why}</p>
                    <p className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{bot.turn}</p>
                  </>
                )}
              </div>
              {reading ? (
                <button
                  type="button"
                  onClick={() => {
                    setBotHidden(bot.id);
                    /* the words were read: the board now shows the move itself */
                    if (bot.seat >= 0) setGlimpse({ seat: bot.seat, at: Date.now() });
                  }}
                  className="btn-strike !min-h-[30px] !px-3 !py-1 !text-[10px]"
                >
                  {t(holding ? 'game.guide.botNext' : 'game.guide.botOk', { name: bot.name })}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={() => setBotHidden(bot.id)} aria-label={t('game.guide.hide')} className="rounded-full p-0.5 text-cream-100/40 hover:text-brass-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {holding && <p className="mt-1.5 pl-7 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400/70">{t('game.guide.botHeld', { name: bot.name })}</p>}
          </motion.aside>
        )}

        {/* the turns of the table: what just happened, and why it matters */}
        {news.length > 0 && (
          <motion.aside key={`news-${news[news.length - 1].id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.happens.aria')} className="plate pointer-events-auto relative w-full px-4 py-2.5">
            <div className="flex items-start gap-3">
              <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-brass-400">{t('game.guide.happens.title')}</p>
                {news.map((x) => (
                  <p key={x.id} className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">
                    {x.text}
                  </p>
                ))}
              </div>
              <button type="button" onClick={() => setEventsSeen(news[news.length - 1].id)} className="btn-strike !min-h-[30px] shrink-0 !px-3 !py-1 !text-[10px]">
                {t('game.guide.botOk')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}

        {/* what the machine would play in the reader's seat, on request */}
        {advised && myTurn && (
          <motion.aside key={`advice-${here}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.suggest.aria')} className="plate pointer-events-auto relative w-full px-4 py-2.5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-bottle-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-bottle-400">{t('game.guide.suggest.title', { name: machine })}</p>
                {advised.busy ? (
                  <p className="mt-0.5 font-serif text-[13px] italic text-cream-100/70">{t('game.guide.suggest.thinking', { name: machine })}</p>
                ) : advised.action ? (
                  <>
                    <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{describeAction(advised.action)}</p>
                    <p className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">{t(`game.guide.suggest.why.${whyKey(advised.action)}`, { name: machine })}</p>
                    {due?.done && !finished && !asked(due.id, advised.action) && <p className="mt-1 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{t('game.guide.suggest.lesson', { lesson: t(`game.guide.steps.${stepKey(due.id)}.title`, stepVars()) })}</p>}
                  </>
                ) : (
                  <p className="mt-0.5 font-serif text-[13px] text-cream-100/90">{t('game.guide.suggest.none', { name: machine })}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!advised.busy && advised.action && (
                  <button type="button" onClick={() => prepare(advised.action!)} className="btn-strike !min-h-[30px] !px-3 !py-1 !text-[10px]">
                    {t('game.guide.suggest.prepare')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => setAdvice(null)} aria-label={t('game.guide.hide')} className="rounded-full p-0.5 text-cream-100/40 hover:text-brass-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
