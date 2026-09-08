import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, GraduationCap, Lightbulb, X } from 'lucide-react';
import { aidOn } from '@/components/game/boardOptions';
import { buildTargets, eraRounds, linkTargets, marketSaleOnBuild, sellTargets } from '@/game/engine';
import { useGame } from '@/game/store';
import type { GameState } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The guide — a parchment note under the top bar.                     */
/*                                                                     */
/* With the beginner assistance on, it says what the player can do     */
/* right now (what a card allows, what a mine will sell, when a loan   */
/* is worth it) and slips in a tip about the game as the eras go by.   */
/* In the guided game it walks a newcomer through their first turns:   */
/* one step at a time, each done by playing it, the machine playing    */
/* its own turns in between.                                           */
/* ------------------------------------------------------------------ */

type Ctx = { g: GameState; me: number; card: ReturnType<typeof pickCard>; verb: string | null; buildPick: { industry: string; level: number; town: string } | null };

function pickCard(g: GameState, me: number, id: string | null) {
  return id ? (g.players[me]?.hand.find((c) => c.id === id) ?? null) : null;
}

/** the tips, in the order they are worth saying; the first two that apply are shown */
const TIPS: { id: string; when: (c: Ctx) => boolean; vars?: (c: Ctx) => Record<string, string | number> }[] = [
  { id: 'firstRound', when: ({ g }) => g.era === 'canal' && g.round === 1 },
  { id: 'select', when: ({ card, g, me }) => !card && g.current === me },
  {
    id: 'location',
    when: ({ card }) => card?.kind === 'location',
    vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }),
  },
  {
    id: 'industry',
    when: ({ card }) => card?.kind === 'industry',
    vars: ({ g, me, card }) => ({ n: buildTargets(g, me, card!).filter((x) => x.valid).length }),
  },
  { id: 'wild', when: ({ card }) => !!card && card.kind.startsWith('wild') },
  {
    id: 'coalMarket',
    when: ({ g, buildPick }) => !!buildPick && (buildPick.industry === 'coal' || buildPick.industry === 'iron') && marketSaleOnBuild(g, buildPick.town, buildPick.industry as 'coal' | 'iron', buildPick.level).sold > 0,
    vars: ({ g, buildPick }) => marketSaleOnBuild(g, buildPick!.town, buildPick!.industry as 'coal' | 'iron', buildPick!.level),
  },
  { id: 'network', when: ({ g, me, verb }) => verb === 'network' && linkTargets(g, me).some((l) => l.valid) },
  { id: 'sell', when: ({ verb }) => verb === 'sell' },
  { id: 'noLinks', when: ({ g, me }) => g.round >= 2 && !Object.values(g.links).some((l) => l.owner === me) },
  { id: 'loan', when: ({ g, me }) => g.players[me].money < 10 && g.players[me].loans === 0 },
  { id: 'unsold', when: ({ g, me }) => Object.values(g.tiles).some((t) => t.owner === me && !t.flipped && ['cotton', 'manufacturer', 'pottery'].includes(t.industry)) && sellTargets(g, me).some((x) => x.valid) },
  { id: 'endCanal', when: ({ g }) => g.era === 'canal' && g.round >= eraRounds(g.players.length) - 1 },
  { id: 'develop', when: ({ g, me }) => g.players[me].stacks.pottery?.[0] === 1 },
  { id: 'links', when: ({ g }) => g.round >= 3 },
];

/** the guided game, step by step; a step is done by the state, or by hand */
const STEPS: { id: string; done?: (g: GameState, me: number, sel: string | null) => boolean; manual?: boolean }[] = [
  { id: 'welcome', manual: true },
  { id: 'hand', done: (_g, _me, sel) => sel !== null },
  { id: 'coal', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && t.industry === 'coal') },
  { id: 'link', done: (g, me) => Object.values(g.links).some((l) => l.owner === me) },
  { id: 'works', done: (g, me) => Object.values(g.tiles).some((t) => t.owner === me && ['cotton', 'manufacturer', 'pottery'].includes(t.industry)) },
  { id: 'sell', done: (g, me) => g.players[me].stats.sold > 0 },
  { id: 'loan', done: (g, me) => g.players[me].loans > 0 || g.players[me].stats.developed > 0 },
  { id: 'onward', manual: true },
];

const STEP_KEY = 'brassworks.tutorial.step';

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
  const [hidden, setHidden] = useState(false);
  /* the page of tips, tied to the situation it was turned in: a new situation starts over */
  const [paged, setPaged] = useState({ key: '', page: 0 });
  const [manualDone, setManualDone] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STEP_KEY) ?? 0);
    } catch {
      return 0;
    }
  });

  /* my seat: online the one the table gave me; at home the first human at the table */
  const me = seat ?? Math.max(0, game?.players.findIndex((p) => !p.isBot) ?? 0);
  const myTurn = !!game && game.phase === 'action' && game.current === me && !game.players[me].isBot;
  const aid = !!game && aidOn(game.assist, code !== null);

  /* the step: the first not done — a manual step is done once clicked past */
  const stepIndex = useMemo(() => {
    if (!game || !tutorial) return -1;
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (s.manual ? i < manualDone : s.done!(game, me, selectedCardId)) continue;
      return i;
    }
    return STEPS.length;
  }, [game, tutorial, me, selectedCardId, manualDone]);

  const tips = useMemo(() => {
    if (!game || !aid || !myTurn) return [];
    const ctx: Ctx = { g: game, me, card: pickCard(game, me, selectedCardId), verb, buildPick: buildPick ? { industry: buildPick.industry, level: buildPick.level, town: buildPick.town } : null };
    return TIPS.filter((tip) => tip.when(ctx)).map((tip) => ({ id: tip.id, text: t(`game.guide.tips.${tip.id}`, tip.vars?.(ctx)) }));
  }, [game, aid, myTurn, me, selectedCardId, verb, buildPick, t]);

  const situation = `${selectedCardId ?? ''}|${verb ?? ''}|${game?.current ?? ''}`;
  const page = paged.key === situation ? paged.page : 0;
  const setPage = (p: number) => setPaged({ key: situation, page: p });

  if (!game || game.phase !== 'action') return null;
  const showSteps = tutorial && stepIndex >= 0;
  const step = showSteps ? STEPS[Math.min(stepIndex, STEPS.length - 1)] : null;
  const finished = showSteps && stepIndex >= STEPS.length;
  if (!showSteps && (hidden || tips.length === 0)) return null;
  const shown = tips.slice(page * 2, page * 2 + 2);
  const pages = Math.ceil(tips.length / 2);

  const advance = () => {
    const next = stepIndex + 1;
    setManualDone(next);
    try {
      localStorage.setItem(STEP_KEY, String(next));
    } catch {
      /* non-fatal */
    }
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={showSteps ? `step-${stepIndex}` : 'tips'}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        aria-label={t('game.guide.aria')}
        className="paper fixed left-1/2 top-[100px] z-[63] w-[min(560px,92vw)] -translate-x-1/2 px-4 py-3 shadow-e3"
      >
        <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
        <div className="relative">
          {showSteps && step ? (
            <>
              <div className="flex items-start gap-3">
                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-ink-900/70" />
                <div className="min-w-0 flex-1">
                  <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">
                    {t('game.guide.stepOf', { n: Math.min(stepIndex + 1, STEPS.length), total: STEPS.length })}
                  </p>
                  <h3 className="mt-0.5 font-display text-[17px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${step.id}.title`)}</h3>
                  <p className="mt-1 font-serif text-[13.5px] leading-snug text-ink-900/85">{t(`game.guide.steps.${step.id}.body`)}</p>
                  {!step.manual && !finished && <p className="mt-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bottle-600">{myTurn ? t('game.guide.yourTurn') : t('game.guide.wait')}</p>}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <button type="button" onClick={endTutorial} className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-900/50 hover:text-ink-900">
                  {t('game.guide.leave')}
                </button>
                {(step.manual || finished) && (
                  <button type="button" onClick={finished || stepIndex === STEPS.length - 1 ? endTutorial : advance} className="btn-strike !min-h-[32px] !px-4 !py-1 !text-[10.5px]">
                    {finished || stepIndex === STEPS.length - 1 ? t('game.guide.done') : t('game.guide.next')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/60" />
              <ul className="min-w-0 flex-1 space-y-1.5">
                {shown.map((tip) => (
                  <li key={tip.id} className="font-serif text-[13.5px] leading-snug text-ink-900/85">
                    {tip.text}
                  </li>
                ))}
              </ul>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button type="button" onClick={() => setHidden(true)} aria-label={t('game.guide.hide')} title={t('game.guide.hide')} className="rounded-full p-0.5 text-ink-900/40 hover:text-ink-900">
                  <X className="h-3.5 w-3.5" />
                </button>
                {pages > 1 && (
                  <button type="button" onClick={() => setPage((page + 1) % pages)} className={cn('font-mono text-[10px] text-ink-900/50 hover:text-ink-900')}>
                    {page + 1}/{pages} ›
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
