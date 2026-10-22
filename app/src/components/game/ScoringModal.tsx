import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { PLAYER_COLORS, incomeLevel } from '@/game/data';
import { keepFinal, keepTableOf } from '@/game/final';
import { buildFinalPayload, leaveOnlineTable, useGame } from '@/game/store';
import { shareFragment } from '@/game/share';
import type { GameState, PlayerState } from '@/game/types';
import { money, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { setBoardOption } from './boardOptions';
import { LAST_LESSON, LESSONS, pass, progressAt, saveProgress } from './lessons';
import { PortraitMedallion } from './PlayerRail';
import { useReducedMotion } from './useReducedMotion';
import { useLayer } from './useLayer';

/* ------------------------------------------------------------------ */
/* The final ledger: a lacquered plate laid on the table, not a sheet   */
/* of the journal. The master of the Midlands first, in their          */
/* medallion; then the ledger, whose point columns add up to the total */
/* (canal, rail, the merchants' bonuses); then the ways out, one of    */
/* them first. On a game that has just closed, the last era is counted */
/* in and the order settles once before the winner is named.           */
/* ------------------------------------------------------------------ */

const ROMAN = ['I', 'II', 'III', 'IV'];

/** the order the engine crowns by: points, then income level, then money */
function outranks(a: PlayerState, b: PlayerState): number {
  return b.vp - a.vp || incomeLevel(b.income) - incomeLevel(a.income) || b.money - a.money;
}

interface Row {
  i: number;
  p: PlayerState;
  name: string;
  color: string;
  canal: number | null;
  rail: number | null;
  /** what no era column holds: the merchants' beer, the short game's closing books */
  bonus: number;
  vp: number;
  /** the standing before the last count (the rail era, or the closing books) */
  before: number;
}

function rowsOf(game: GameState): Row[] {
  const short = game.eraLength === 'short';
  const rows = game.players.map((p, i) => {
    const canal = game.canalScores?.[i] ?? null;
    const rail = short ? null : (game.finalScores?.[i] ?? null);
    const bonus = p.vp - (canal ?? 0) - (rail ?? 0);
    return { i, p, name: p.name, color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C', canal, rail, bonus, vp: p.vp, before: p.vp - (short ? bonus : (rail ?? 0)) };
  });
  const ranked = [...rows].sort((a, b) => outranks(a.p, b.p) || a.i - b.i);
  /* the engine's crowning is the word: it stands first whatever the sort says */
  const crowned = game.abandoned ? -1 : (game.winner ?? -1);
  const at = ranked.findIndex((r) => r.i === crowned);
  if (at > 0) ranked.unshift(...ranked.splice(at, 1));
  return ranked;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** the ledger's own figures: Spectral, lining and tabular, never the terminal's mono */
const FIG = 'font-serif tabular-nums [font-variant-numeric:lining-nums_tabular-nums]';

export default function GameOverModal({
  onRematch,
  fresh = false,
  ready = true,
}: {
  onRematch: () => void;
  /** the game closed during this visit: its last era is counted in */
  fresh?: boolean;
  /** the table is in view: the count waits for the title card to lift */
  ready?: boolean;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const seat = useGame((s) => s.seat);
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const closeGameOver = useGame((s) => s.closeGameOver);
  const game = useGame((s) => s.game);
  const open = useGame((s) => s.gameOverOpen);
  const online = useGame((s) => s.code !== null);
  const local = useGame((s) => s.local);
  const code = useGame((s) => s.code);
  /* the guided table: the guide's closing word is told here */
  const guided = useGame((s) => s.tutorial);
  const navigate = useNavigate();
  const shown = open && !!game && game.phase === 'game-over';
  /* the last lesson is this closing word, on the ledger of a game played
     to its end: shown, it is passed — the lessons the game never came to
     stay unread */
  useEffect(() => {
    if (!shown || !guided || !local) return;
    const p = progressAt(local);
    const q = pass(p, LAST_LESSON);
    if (q !== p) saveProgress(q);
  }, [shown, guided, local]);
  /* Escape lowers the plate to a strip and the finished board shows: the
     strip brings it back */
  const sheet = useLayer(shown, closeGameOver, { modal: true });

  /* the settings or any drawer left open under the plate goes away with the game */
  useEffect(() => {
    if (shown) setBoardOption('settingsOpen', false);
  }, [shown]);

  /* the game handed on in a link: the deal and the moves, replayed on arrival */
  const [shared, setShared] = useState(false);
  const share = () => {
    if (!game) return;
    const url = `${window.location.origin}/game/local/${local ?? code ?? 'GAME'}${shareFragment(game)}`;
    const done = () => {
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt(t('game.scoring.shareCopy'), url));
    else window.prompt(t('game.scoring.shareCopy'), url);
  };

  const rows = useMemo(() => (game && game.phase === 'game-over' ? rowsOf(game) : []), [game]);

  /* the last count, once per game closed on this visit: the standing before
     it, the era's figures coming in, then the order settles and the master
     is named. Reduced motion, a game reopened or given up: the ledger as it
     stands, at once */
  const abandoned = !!game?.abandoned;
  const seed = game?.seed ?? null;
  const seats = game?.players.length ?? 0;
  const [counted, setCounted] = useState<number | null>(null);
  const counting = shown && fresh && !abandoned && !reduced && counted !== seed;
  const [stage, setStage] = useState(0);
  const [stagedFor, setStagedFor] = useState<number | null>(null);
  if (counting && stagedFor !== seed) {
    setStagedFor(seed);
    setStage(0);
  }
  useEffect(() => {
    if (!counting || !ready) return;
    const settle = 500 + seats * 260 + 700;
    const timers = [window.setTimeout(() => setStage(1), 500), window.setTimeout(() => setStage(2), settle), window.setTimeout(() => setCounted(seed), settle + 900)];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [counting, ready, seats, seed]);
  const phase = counting ? stage : 2;

  if (!shown || !game) return null;
  const short = game.eraLength === 'short';
  const winner = rows[0];
  const order = phase < 2 ? [...rows].sort((a, b) => b.before - a.before || a.i - b.i) : rows;

  /* where the reader stands: one human at this device, or my seat online */
  const humans = game.players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0);
  const me = seat ?? (humans.length === 1 ? humans[0] : -1);
  /* the analysis reads a seat: mine, else the first human at this device */
  const reader = seat ?? humans[0] ?? -1;
  const myRank = rows.findIndex((r) => r.i === me);
  const ordinal = (rank: number) => t(`game.scoring.ranks.${Math.min(rank, 3)}`);
  let standing: string | null = null;
  if (!abandoned && myRank >= 0 && rows.length > 1) {
    if (myRank === 0) {
      const gap = rows[0].vp - rows[1].vp;
      standing = gap > 0 ? t('game.scoring.youWin', { gap }) : t('game.scoring.youWinTie');
    } else {
      const gap = winner.vp - rows[myRank].vp;
      standing = gap > 0 ? t('game.scoring.youPlace', { rank: ordinal(myRank), gap }) : t('game.scoring.youPlaceTie', { rank: ordinal(myRank) });
    }
  }
  /* a tie at the top is settled as the rules settle it, and the plate says how */
  let tiebreak: string | null = null;
  if (!abandoned && rows.length > 1 && rows[0].vp === rows[1].vp) {
    const [a, b] = [rows[0].p, rows[1].p];
    if (incomeLevel(a.income) !== incomeLevel(b.income)) tiebreak = t('game.scoring.tieIncome', { vp: a.vp, hi: incomeLevel(a.income), lo: incomeLevel(b.income) });
    else if (a.money !== b.money) tiebreak = t('game.scoring.tieMoney', { vp: a.vp, hi: money(a.money), lo: money(b.money) });
  }
  const eraName = t(game.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail');

  const toBilan = () => {
    keepFinal(buildFinalPayload(game));
    navigate(online || !local ? '/results' : `/results?table=${local}`);
  };
  /* the salon opens set for the table just played */
  const changeTable = () => {
    if (!online) keepTableOf(game);
    navigate('/setup');
  };

  const th = 'px-2 pb-1.5 pt-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em]';
  /* the works are counts, not points: a paler band, centred under short heads */
  const work = 'px-1.5 pb-1.5 pt-1 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-cream-100/45';
  const workCell = cn(FIG, 'px-1.5 py-2.5 text-center text-[14px] text-cream-100/50');
  const link = 'rounded px-1 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-300/80 transition-colors hover:text-cream-100 focus-visible:text-cream-100';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'radial-gradient(ellipse 70% 75% at 50% 50%, rgba(16,13,11,.5), rgba(16,13,11,.84))' }}
      ref={sheet}
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
      aria-label={t('game.scoring.aria')}
    >
      {/* brass rings falling, once, for a game just won: bounded, transform-only */}
      {fresh &&
        !abandoned &&
        !reduced &&
        Array.from({ length: 18 }, (_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute top-[-30px] block h-3 w-3 rounded-full border-2 border-brass-500/60"
            style={{ left: `${(i * 41 + 7) % 100}%` }}
            initial={{ y: 0, rotate: 0, opacity: 0.85 }}
            animate={{ y: '110vh', rotate: 540, opacity: [0.85, 0.85, 0] }}
            transition={{ duration: 6, delay: 1.6 + (i % 6) * 0.45, ease: 'linear' }}
          />
        ))}

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.2 : 0.45, ease: [0.16, 1, 0.3, 1] }}
        data-count={phase}
        className="plate plaque-rivets relative my-auto w-[min(840px,100%)] px-7 pb-6 pt-6"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.5), inset 0 0 0 4px rgba(12,9,7,.9), inset 0 0 0 5px rgba(201,164,92,.28), 0 18px 48px rgba(0,0,0,.6)' }}
      >
        {/* the plate's other two rivets */}
        <span aria-hidden className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full shadow-[0_1px_1px_rgba(0,0,0,.5)]" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--brass-400)), var(--brass-700))' }} />
        <span aria-hidden className="absolute bottom-[7px] left-[7px] h-[5px] w-[5px] rounded-full shadow-[0_1px_1px_rgba(0,0,0,.5)]" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--brass-400)), var(--brass-700))' }} />

        <div className="flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-brass-500/60" />
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brass-400">{t(abandoned ? 'game.scoring.abandonedTitle' : 'game.scoring.title')}</h2>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-brass-500/60" />
        </div>

        {abandoned ? (
          <p className="mt-4 text-center font-fell text-[26px] leading-tight text-cream-100">{t('game.scoring.abandonedLine', { era: eraName, round: game.round })}</p>
        ) : (
          <div className="relative mt-5">
            {/* the master's place, held while the last era is counted in */}
            {counting && (
              <motion.p
                initial={false}
                animate={{ opacity: phase >= 2 ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                role="status"
                className="pointer-events-none absolute inset-0 flex items-center justify-center font-fell text-[22px] italic text-cream-100/70"
              >
                {t(short ? 'game.scoring.countingShort' : 'game.scoring.counting')}
              </motion.p>
            )}
            <motion.div
              initial={false}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 || reduced ? 0 : 6 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              aria-hidden={phase < 2}
              className="flex items-center justify-center gap-5"
            >
              <span className="rounded-full p-[3px]" style={{ background: 'linear-gradient(160deg, rgb(var(--brass-300)), var(--brass-700))', boxShadow: '0 4px 14px rgba(0,0,0,.5)' }}>
                <PortraitMedallion p={winner.p} index={winner.i} active={false} size={84} />
              </span>
              <div className="min-w-0 text-left">
                <p className="truncate font-display text-[46px] font-black leading-[1.02] text-cream-100 [text-shadow:0_1px_0_rgba(0,0,0,.6)]">{winner.name}</p>
                <p className="mt-1 flex items-baseline gap-2 text-brass-300">
                  <span className={cn(FIG, 'text-[30px] font-semibold leading-none')}>{winner.vp}</span>
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-400/85">{t('game.scoring.thVp')}</span>
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {(standing || tiebreak) && (
          <motion.div initial={false} animate={{ opacity: phase >= 2 ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="mt-3 text-center">
            {standing && <p className="font-serif text-[16px] italic text-cream-100/85">{standing}</p>}
            {tiebreak && <p className="mt-0.5 font-sans text-[12px] text-brass-300/80">{tiebreak}</p>}
          </motion.div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-cream-100">
            <caption className="sr-only">{t(abandoned ? 'game.scoring.abandonedCaption' : 'game.scoring.eyebrow')}</caption>
            <thead>
              <tr className="text-brass-400/90">
                <th scope="colgroup" colSpan={2} className="pb-1 text-left font-fell text-[13px] font-normal text-cream-100/70">
                  {t(abandoned ? 'game.scoring.abandonedCaption' : 'game.scoring.eyebrow')}
                </th>
                <th scope="colgroup" colSpan={short ? 3 : 4} className="border-b border-brass-500/40 pb-1 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.24em]">
                  {t('game.scoring.groupPoints')}
                </th>
                <th aria-hidden className="w-3" />
                <th scope="colgroup" colSpan={4} className="border-b border-brass-500/20 pb-1 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-cream-100/45">
                  {t('game.scoring.groupWorks')}
                </th>
              </tr>
              <tr className="border-b border-brass-500/50 text-brass-400/90">
                <th scope="col" className="w-11 min-w-[2.75rem] pb-1.5 pt-1" aria-label={t('game.scoring.thRank')} />
                <th scope="col" className="pb-1.5 pt-1 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('game.scoring.thPlayer')}</th>
                <th scope="col" className={th}>{t('game.scoring.thCanal')}</th>
                {!short && <th scope="col" className={th}>{t('game.scoring.thRail')}</th>}
                <th scope="col" className={th} title={t(short ? 'game.scoring.thBooksTip' : 'game.scoring.thBonusTip')}>
                  {t(short ? 'game.scoring.thBooks' : 'game.scoring.thBonus')}
                </th>
                <th scope="col" className={cn(th, 'border-l-[3px] border-double border-brass-500/60 pl-3 text-brass-300')}>{t('game.scoring.thVp')}</th>
                <th aria-hidden />
                <th scope="col" className={work}>{t('game.scoring.thBuilt')}</th>
                <th scope="col" className={work}>{t('game.scoring.thLinks')}</th>
                <th scope="col" className={work}>{t('game.scoring.thSold')}</th>
                <th scope="col" className={work}>{t('game.scoring.thLoans')}</th>
              </tr>
            </thead>
            <tbody>
              {order.map((r, k) => {
                const first = !abandoned && phase >= 2 && k === 0;
                /* the column being counted in: blank, then its figure, row after row */
                const landed = phase >= 1;
                const rowDelay = counting ? order.findIndex((o) => o.i === r.i) * 0.26 : 0;
                return (
                  <motion.tr
                    key={r.i}
                    layout={reduced ? false : 'position'}
                    transition={{ layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
                    className={cn('border-b border-brass-500/15', first && 'bg-brass-500/[0.09] shadow-[inset_0_1px_0_rgba(201,164,92,.55),inset_0_-1px_0_rgba(201,164,92,.55)]')}
                  >
                    <td className={cn(FIG, 'py-2.5 pl-2 pr-1 text-[15px]', first ? 'text-brass-300' : 'text-cream-100/45')}>{abandoned ? '' : phase >= 2 ? ROMAN[k] : ''}</td>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2.5 whitespace-nowrap">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/50" style={{ background: r.color }} />
                        <span className={cn('font-fell text-[17px]', first ? 'text-cream-100' : 'text-cream-100/85')}>{r.name}</span>
                        {/* the star's room is kept while the count runs, so the
                            columns do not shift when it lands */}
                        {!abandoned && r.i === winner.i && (
                          <span className={cn('text-[13px] text-brass-300', !first && 'invisible')}>
                            <span aria-hidden>★</span>
                            {first && <span className="sr-only">{t('game.scoring.victor')}</span>}
                          </span>
                        )}
                        {r.i === me && <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-100/40">{t('game.scoring.you')}</span>}
                      </span>
                    </td>
                    <td className={cn(FIG, 'px-2 py-2.5 text-right text-[16px] text-cream-100/80')}>{r.canal ?? '—'}</td>
                    {!short && (
                      <td className={cn(FIG, 'px-2 py-2.5 text-right text-[16px] text-cream-100/80')}>
                        <motion.span initial={false} animate={{ opacity: landed ? 1 : 0 }} transition={{ duration: 0.35, delay: counting ? rowDelay : 0 }} className="inline-block">
                          {r.rail ?? '—'}
                        </motion.span>
                      </td>
                    )}
                    <td className={cn(FIG, 'px-2 py-2.5 text-right text-[16px] text-cream-100/80')}>
                      {short ? (
                        <motion.span initial={false} animate={{ opacity: landed ? 1 : 0 }} transition={{ duration: 0.35, delay: counting ? rowDelay : 0 }} className="inline-block">
                          {signed(r.bonus)}
                        </motion.span>
                      ) : (
                        signed(r.bonus)
                      )}
                    </td>
                    <td className={cn(FIG, 'border-l-[3px] border-double border-brass-500/60 py-2.5 pl-3 pr-2 text-right text-[19px] font-semibold', first ? 'text-brass-300' : 'text-cream-100')}>
                      {counting ? (
                        /* the standing before the count gives way to the total as the row's figure lands */
                        <span className="inline-grid justify-items-end">
                          <motion.span initial={false} animate={{ opacity: landed ? 0 : 1 }} transition={{ duration: 0.3, delay: landed ? rowDelay + 0.15 : 0 }} className="[grid-area:1/1]" aria-hidden>
                            {r.before}
                          </motion.span>
                          <motion.span initial={false} animate={{ opacity: landed ? 1 : 0 }} transition={{ duration: 0.3, delay: landed ? rowDelay + 0.15 : 0 }} className="[grid-area:1/1]">
                            {r.vp}
                          </motion.span>
                        </span>
                      ) : (
                        r.vp
                      )}
                    </td>
                    <td aria-hidden />
                    <td className={workCell}>{r.p.stats.built}</td>
                    <td className={workCell}>{r.p.stats.links}</td>
                    <td className={workCell}>{r.p.stats.sold}</td>
                    <td className={workCell}>{r.p.stats.loans}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* the guided game ends here: the guide's last lesson, on its own
            paper, with the roads it names */}
        {guided && !abandoned && (
          <motion.div initial={false} animate={{ opacity: phase >= 2 ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="paper relative mt-5 px-4 py-3 text-left shadow-e3">
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
            <div className="relative flex items-start gap-2">
              <GraduationCap aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-900/70" />
              <div className="min-w-0 flex-1">
                <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.guide.stepOf', { n: LESSONS.length, total: LESSONS.length })}</p>
                <h3 className="mt-0.5 font-display text-[16px] font-bold leading-tight text-ink-900">{t(`game.guide.steps.${LAST_LESSON}.title`)}</h3>
                {t(`game.guide.steps.${LAST_LESSON}.body`).split('\n').map((line, i) => (
                  <p key={i} className={cn('font-serif text-[13.5px] leading-snug text-ink-900/85', i > 0 ? 'mt-1.5' : 'mt-1')}>
                    {line}
                  </p>
                ))}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate('/cours')} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                    {t('platform.home.shortcuts.guided')}
                  </button>
                  <button type="button" onClick={() => navigate('/desk')} className="btn-ledger !min-h-[32px] !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
                    {t('platform.home.shortcuts.desk')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* a rematch reshuffles this browser's own game: at an online
              table it is the room's business, so the button steps aside */}
          {online ? (
            <button
              type="button"
              onClick={() => {
                leaveOnlineTable();
                navigate('/online');
              }}
              className="btn-strike"
            >
              {t('game.scoring.backToRoom')}
            </button>
          ) : (
            <button type="button" onClick={onRematch} className="btn-strike">
              {t('game.scoring.rematch')}
            </button>
          )}
          {reader >= 0 && (
            <button
              type="button"
              onClick={() => {
                setDebriefOpen(true);
                closeGameOver();
              }}
              className="btn-ledger"
            >
              {t('game.debrief.open')}
            </button>
          )}
          <button type="button" onClick={closeGameOver} className="btn-ledger" aria-keyshortcuts="Escape">
            {t('game.scoring.lookBoard')}
          </button>
        </div>
        <nav aria-label={t('game.scoring.moreAria')} className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-brass-500/50">
          <button type="button" onClick={toBilan} className={link}>
            {t('game.scoring.bilan')}
          </button>
          <span aria-hidden>·</span>
          <button type="button" onClick={share} className={link} aria-live="polite">
            {shared ? t('game.scoring.shared') : t('game.scoring.share')}
          </button>
          <span aria-hidden>·</span>
          <button type="button" onClick={changeTable} className={link}>
            {t('game.scoring.changeTable')}
          </button>
          <span aria-hidden>·</span>
          <button type="button" onClick={() => navigate('/')} className={link}>
            {t('game.scoring.returnTitle')}
          </button>
        </nav>
      </motion.div>
    </motion.div>
  );
}
