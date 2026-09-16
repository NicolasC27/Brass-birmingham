import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronLeft, ChevronRight, Eye, GraduationCap, Lightbulb, X } from 'lucide-react';
import { aidOn } from '@/components/game/boardOptions';
import { INCOME_PAYOUT, INDUSTRIES, LOAN_AMOUNT, LOAN_INCOME_HIT, incomeLevel } from '@/game/data';
import { buildTargets, eraRounds, linkTargets, marketSaleOnBuild, sellTargets } from '@/game/engine';
import { ledgerText } from '@/game/ledgerText';
import { useGame } from '@/game/store';
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
  card: GameState['players'][number]['hand'][number] | null;
  verb: string | null;
  buildPick: { industry: string; level: number; town: string } | null;
}

/* ------------------------------- lessons ----------------------------- */

/** what a lesson may point at on the screen */
type Show = 'mat' | 'market' | 'income' | 'vp' | 'hand';

interface Step {
  id: string;
  /** done by the state (a 'do' step), or by reading on (a 'read' step) */
  done?: (g: GameState, me: number, sel: string | null, mat: number | null) => boolean;
  show?: Show;
  /** a read step that only makes sense once this holds */
  when?: (g: GameState, me: number) => boolean;
}

const WORKS = ['cotton', 'manufacturer', 'pottery'];

const STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'board' },
  { id: 'goal', show: 'vp' },
  { id: 'money', show: 'income' },
  { id: 'mat', show: 'mat', done: (_g, _me, _sel, mat) => mat !== null },
  { id: 'matRead', show: 'mat' },
  { id: 'hand', show: 'hand', done: (_g, _me, sel) => sel !== null },
  { id: 'coal', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && t.industry === 'coal') },
  { id: 'botTurn', when: (g, me) => g.ledger.some((e) => e.player !== undefined && e.player !== me && e.verb !== 'system') },
  { id: 'payday', when: (g) => g.round >= 2 },
  { id: 'link', done: (g, me) => Object.values(g.links).some((l) => l.owner === me) },
  { id: 'works', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && WORKS.includes(t.industry)) },
  { id: 'market', show: 'market' },
  { id: 'beer' },
  { id: 'sell', done: (g, me) => g.players[me].stats.sold > 0 },
  { id: 'flipped' },
  { id: 'loan', done: (g, me) => g.players[me].loans > 0 },
  { id: 'develop' },
  { id: 'eraEnd' },
  { id: 'onward' },
];

const STEP_KEY = 'brassworks.tutorial.step';
const REACH_KEY = 'brassworks.tutorial.reached';

/* ---------------------------- the machine ---------------------------- */

/** the last move a machine made, said as a player would reason it */
function botReason(g: GameState, me: number, t: T): { name: string; what: string; why: string; turn: string; fresh: boolean } | null {
  const e = [...g.ledger].reverse().find((x) => x.player !== undefined && x.player !== me && g.players[x.player]?.isBot && x.key && x.key !== 'flip');
  if (!e || e.player === undefined) return null;
  const p = g.players[e.player];
  const v = e.vars ?? {};
  const facts = { name: p.name, money: p.money, level: incomeLevel(p.income), industry: typeof v.industry === 'string' ? t(`game.log.industry.${v.industry}`) : '', town: v.town ?? '', merchant: v.merchant ?? '', a: v.a ?? '', b: v.b ?? '', sale: v.saleN ?? 0, gain: v.saleGain ?? 0, to: v.to ?? 0 };
  let why = '';
  switch (e.key) {
    case 'build': {
      const ind = String(v.industry);
      const base = ind === 'coal' ? 'coal' : ind === 'iron' ? 'iron' : ind === 'brewery' ? 'brewery' : 'works';
      why = t(`game.guide.bot.build.${base}`, facts);
      if (Number(v.saleN) > 0) why += ' ' + t('game.guide.bot.build.sold', facts);
      if (v.overName) why += ' ' + t('game.guide.bot.build.over', facts);
      break;
    }
    case 'network':
      why = t('game.guide.bot.network', facts);
      break;
    case 'sell':
      why = t('game.guide.bot.sell', facts);
      break;
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
  const played = g.ledger.filter((x) => x.era === e.era && x.round === e.round && x.player === e.player && x.verb !== 'system' && x.verb !== 'score').length;
  const you = g.players[me]?.name ?? '';
  const meIdx = g.order.indexOf(me);
  const botIdx = g.order.indexOf(e.player);
  const spentBot = g.lastSpent?.[e.player];
  const spentMe = g.lastSpent?.[me];
  let turn: string;
  if (e.round === 1 && e.era === 'canal') turn = t('game.guide.turn.first', { name: p.name });
  else if (played <= 1) turn = spentBot !== undefined && spentMe !== undefined ? t(botIdx < meIdx ? 'game.guide.turn.orderBefore' : 'game.guide.turn.orderAfter', { name: p.name, you, spentBot, spentMe, round: e.round }) : t('game.guide.turn.order', { name: p.name, round: e.round });
  else turn = t(g.current === me ? 'game.guide.turn.secondThenYou' : 'game.guide.turn.second', { name: p.name, you });
  /* fresh: the machine's move is the latest action of the log — the one being played through */
  return { name: p.name, what: ledgerText(e, t), why, turn, fresh: e.at === g.actions.length - 1 };
}

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
  const flipped = [...g.ledger].reverse().find((x) => x.key === 'flip' && x.player === me);
  if (flipped && g.ledger.indexOf(flipped) >= g.ledger.length - 3) out.push({ id: 'flipped', text: t('game.guide.alerts.flipped', { industry: t(`game.log.industry.${flipped.vars?.industry}`), income: flipped.vars?.income ?? 0, level }) });
  if (level < 0) out.push({ id: 'negative', text: t('game.guide.alerts.negative', { level, pay: Math.abs(INCOME_PAYOUT[p.income]) }) });
  if (g.era === 'canal' && g.round >= eraRounds(g.players.length) - 1) out.push({ id: 'eraEnd', text: t('game.guide.alerts.eraEnd') });
  return out;
}

/* ------------------------------ the tips ----------------------------- */

const TIPS: { id: string; when: (c: Ctx) => boolean; vars?: (c: Ctx) => Record<string, string | number> }[] = [
  { id: 'firstRound', when: ({ g }) => g.era === 'canal' && g.round === 1 },
  { id: 'select', when: ({ card, g, me }) => !card && g.current === me },
  { id: 'location', when: ({ card }) => card?.kind === 'location', vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }) },
  { id: 'industry', when: ({ card }) => card?.kind === 'industry', vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }) },
  { id: 'wild', when: ({ card }) => !!card && card.kind.startsWith('wild') },
  {
    id: 'coalMarket',
    when: ({ g, buildPick }) => !!buildPick && (buildPick.industry === 'coal' || buildPick.industry === 'iron') && marketSaleOnBuild(g, buildPick.town, buildPick.industry as 'coal' | 'iron', buildPick.level).sold > 0,
    vars: ({ g, buildPick }) => marketSaleOnBuild(g, buildPick!.town, buildPick!.industry as 'coal' | 'iron', buildPick!.level),
  },
  { id: 'buildCost', when: ({ buildPick }) => !!buildPick, vars: ({ buildPick }) => ({ cost: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].cost, income: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].incomeDelta, vp: INDUSTRIES[buildPick!.industry as keyof typeof INDUSTRIES][buildPick!.level - 1].vp }) },
  { id: 'network', when: ({ g, me, verb }) => verb === 'network' && linkTargets(g, me).some((l) => l.valid) },
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
  const openMat = useGame((s) => s.openMat);
  const setMarketFocus = useGame((s) => s.setMarketFocus);
  const [hidden, setHidden] = useState(false);
  const [botHidden, setBotHidden] = useState<number>(-1);
  const setBotHold = useGame((s) => s.setBotHold);
  const [paged, setPaged] = useState({ key: '', page: 0 });
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
  const rawIndex = useMemo(() => {
    if (!game || !tutorial) return -1;
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (i < reached) continue;
      if (s.done ? s.done(game, me, selectedCardId, matPlayer) : i < readPast) continue;
      /* a read step waiting on the game: skipped until it makes sense */
      if (!s.done && s.when && !s.when(game, me)) continue;
      return i;
    }
    return STEPS.length;
  }, [game, tutorial, me, selectedCardId, matPlayer, readPast, reached]);
  const stepIndex = rawIndex < 0 ? -1 : Math.max(rawIndex, reached);
  if (tutorial && rawIndex > reached) {
    setReached(rawIndex);
    try {
      localStorage.setItem(REACH_KEY, String(rawIndex));
    } catch {
      /* non-fatal */
    }
  }

  const ctx = useMemo<Ctx | null>(() => (game ? { g: game, me, card: selectedCardId ? (game.players[me]?.hand.find((c) => c.id === selectedCardId) ?? null) : null, verb, buildPick: buildPick ? { industry: buildPick.industry, level: buildPick.level, town: buildPick.town } : null } : null), [game, me, selectedCardId, verb, buildPick]);
  const tips = useMemo(() => (ctx && aid && myTurn ? TIPS.filter((tip) => tip.when(ctx)).map((tip) => ({ id: tip.id, text: t(`game.guide.tips.${tip.id}`, tip.vars?.(ctx)) })) : []), [ctx, aid, myTurn, t]);
  const warnings = useMemo(() => (ctx && aid ? alerts(ctx, t) : []), [ctx, aid, t]);
  const bot = useMemo(() => (game && aid ? botReason(game, me, t) : null), [game, aid, me, t]);

  const situation = `${selectedCardId ?? ''}|${verb ?? ''}|${game?.current ?? ''}`;
  const page = paged.key === situation ? paged.page : 0;
  const setPage = (p: number) => setPaged({ key: situation, page: p });

  /* the machine's next move waits while its last one is being read (guided game only) */
  const holdWanted = !!(tutorial && game && game.phase === 'action' && bot && bot.fresh && botHidden !== game.ledger.length && game.players[game.current]?.isBot);
  useEffect(() => {
    setBotHold(holdWanted);
    return () => setBotHold(false);
  }, [holdWanted, setBotHold]);

  if (!game || game.phase !== 'action') return null;
  const showSteps = tutorial && stepIndex >= 0;
  const step = showSteps ? STEPS[Math.min(stepIndex, STEPS.length - 1)] : null;
  const finished = showSteps && stepIndex >= STEPS.length;
  const lines = [...warnings.map((w) => w.text), ...tips.map((x) => x.text)];
  const pages = Math.max(1, Math.ceil(lines.length / 2));
  const shown = lines.slice(page * 2, page * 2 + 2);
  const botSeq = game.ledger.length;
  const showBot = bot && botHidden !== botSeq && (showSteps || !hidden);
  /* the guided game waits: the machine's next move comes once this one is read */
  const holding = !!(tutorial && showBot && bot?.fresh && game.players[game.current]?.isBot);
  if (!showSteps && (hidden || lines.length === 0) && !showBot) return null;

  const advance = (to: number) => {
    setReadPast(to);
    setReached(to);
    try {
      localStorage.setItem(STEP_KEY, String(to));
      localStorage.setItem(REACH_KEY, String(to));
    } catch {
      /* non-fatal */
    }
  };
  const show = (what: Show) => {
    if (what === 'mat') openMat(me);
    if (what === 'market') setMarketFocus(true);
  };
  const stepVars = (): Record<string, string | number> => {
    const p = game.players[me];
    return { name: p.name, money: p.money, level: incomeLevel(p.income), pay: INCOME_PAYOUT[p.income], rounds: eraRounds(game.players.length), bot: game.players.find((x) => x.isBot)?.name ?? '' };
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-[100px] z-[80] flex w-[min(600px,92vw)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {(showSteps || lines.length > 0) && !(hidden && !showSteps) && !holding && (
          <motion.aside
            key="note"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label={t('game.guide.aria')}
            className="paper pointer-events-auto relative px-4 py-3 shadow-e3"
          >
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div className="relative">
              {showSteps && step ? (
                <>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-ink-900/70" />
                    <div className="min-w-0 flex-1">
                      <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: Math.min(stepIndex + 1, STEPS.length), total: STEPS.length })}</p>
                      <h3 className="mt-0.5 font-display text-[17px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${step.id}.title`, stepVars())}</h3>
                      <div className="mt-1 max-h-[38vh] overflow-y-auto pr-1">
                        <Paragraphs text={t(`game.guide.steps.${step.id}.body`, stepVars())} />
                      </div>
                      {step.done && !finished && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{myTurn ? t('game.guide.yourTurn') : t('game.guide.wait')}</p>}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={endTutorial} className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                        {t('game.guide.leave')}
                      </button>
                      {stepIndex > 0 && (
                        <button type="button" onClick={() => advance(Math.max(0, stepIndex - 1))} className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                          <ChevronLeft className="h-3 w-3" /> {t('game.guide.back')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {step.show && (
                        <button type="button" onClick={() => show(step.show!)} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                          <Eye className="h-3.5 w-3.5" /> {t(`game.guide.show.${step.show}`)}
                        </button>
                      )}
                      {(!step.done || finished) && (
                        <button type="button" onClick={finished || stepIndex === STEPS.length - 1 ? endTutorial : () => advance(stepIndex + 1)} className="btn-strike !min-h-[32px] !px-4 !py-1 !text-[10.5px]">
                          {finished || stepIndex === STEPS.length - 1 ? t('game.guide.done') : t('game.guide.next')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/60" />
                  <ul className="min-w-0 flex-1 space-y-1.5">
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
          <motion.aside key={`bot-${botSeq}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('game.guide.botAria')} className="plate pointer-events-auto relative px-4 py-2.5">
            <div className="flex items-start gap-3">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.18em] text-brass-400">{t('game.guide.botWhy', { name: bot.name })}</p>
                <p className="mt-0.5 font-mono text-[11px] text-cream-100/60">{bot.what}</p>
                <p className="mt-1 font-serif text-[13px] leading-snug text-cream-100/90">{bot.why}</p>
                <p className="mt-1.5 font-serif text-[12.5px] italic leading-snug text-cream-100/65">{bot.turn}</p>
              </div>
              {holding ? (
                <button type="button" onClick={() => setBotHidden(botSeq)} className="btn-strike !min-h-[30px] !px-3 !py-1 !text-[10px]">
                  {t('game.guide.botNext', { name: bot.name })}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={() => setBotHidden(botSeq)} aria-label={t('game.guide.hide')} className="rounded-full p-0.5 text-cream-100/40 hover:text-brass-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {holding && <p className="mt-1.5 pl-7 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400/70">{t('game.guide.botHeld', { name: bot.name })}</p>}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
