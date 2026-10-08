import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { leaveOnlineTable, useGame } from '@/game/store';
import { shareFragment } from '@/game/share';
import { useT } from '@/i18n';
import { useLayer } from './useLayer';

/**
 * Game-over write-out (game.md §10): podium + ledger table on a paper panel,
 * slow brass-gear particle fall (≤30, stops after 6s), rematch actions.
 */
const holdOn = () => undefined;

export default function GameOverModal({ onRematch }: { onRematch: () => void }) {
  const t = useT();
  const seat = useGame((s) => s.seat);
  const mine = useGame((s) => seat ?? (s.game ? s.game.players.findIndex((p) => !p.isBot) : -1));
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const closeGameOver = useGame((s) => s.closeGameOver);
  const game = useGame((s) => s.game);
  const open = useGame((s) => s.gameOverOpen);
  const online = useGame((s) => s.code !== null);
  const local = useGame((s) => s.local);
  const code = useGame((s) => s.code);
  const navigate = useNavigate();
  /* the write-out holds the table until one of its ways out is taken:
     Escape stops at it (the board's own Escape stays out of reach) */
  const sheet = useLayer(open && !!game && game.phase === 'game-over', holdOn, { modal: true });
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

  const rows = useMemo(() => {
    if (!game) return [];
    return game.players
      .map((p, i) => ({
        i,
        name: p.name,
        color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C',
        canal: game.canalScores?.[i] ?? 0,
        rail: game.finalScores?.[i] ?? 0,
        vp: p.vp,
        built: p.stats.built,
        links: p.stats.links,
        loans: p.stats.loans,
        sold: p.stats.sold,
      }))
      .sort((a, b) => b.vp - a.vp);
  }, [game]);

  if (!open || !game || game.phase !== 'game-over') return null;
  const winner = rows[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-coal-950/80 p-4 backdrop-blur-md"
      ref={sheet}
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
      aria-label={t('game.scoring.aria')}
    >
      {/* brass gear confetti — bounded, transform-only */}
      {Array.from({ length: 24 }, (_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-[-30px] block h-3 w-3 rounded-full border-2 border-brass-500/70"
          style={{ left: `${(i * 41) % 100}%` }}
          initial={{ y: 0, rotate: 0, opacity: 0.9 }}
          animate={{ y: '110vh', rotate: 540, opacity: [0.9, 0.9, 0] }}
          transition={{ duration: 6, delay: (i % 8) * 0.5, ease: 'linear' }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.92, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="paper relative w-full max-w-[640px] p-8 shadow-e4"
      >
        <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[10px] opacity-[0.1]" />
        <p className="relative text-center font-sans text-xs font-semibold uppercase tracking-[0.3em] text-ink-900/60">
          {t('game.scoring.eyebrow')}
        </p>
        <h2 className="relative mt-2 text-center font-display text-4xl font-black text-ink-900">
          {t(game.abandoned ? 'game.scoring.abandonedTitle' : 'game.scoring.title')}
        </h2>
        <p className="relative mt-1 text-center font-fell text-xl text-ink-900/85">
          {t('game.scoring.winnerLine', { name: winner.name, vp: winner.vp })}
        </p>

        <table className="relative mt-6 w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900/30 text-left font-fell text-xs uppercase tracking-wider text-ink-900/70">
              <th className="py-1.5 pr-2">{t('game.scoring.thPlayer')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thCanal')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thRail')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thBuilt')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thLinks')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thSold')}</th>
              <th className="py-1.5 pr-2 text-right">{t('game.scoring.thLoans')}</th>
              <th className="py-1.5 text-right">{t('game.scoring.thVp')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rank) => (
              <motion.tr
                key={r.i}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rank * 0.2 }}
                className="border-b border-ink-900/15 text-ink-900"
              >
                <td className="py-1.5 pr-2">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: r.color }} />
                  <span className="font-semibold">{r.name}</span>
                  {rank === 0 && <span className="ml-2 font-fell text-xs text-brass-700">{t('game.scoring.victor')}</span>}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.canal}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.rail}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.built}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.links}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.sold}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{r.loans}</td>
                <td className="py-1.5 text-right font-mono font-semibold">{r.vp}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
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
          {mine !== null && mine >= 0 && (
            <button
              type="button"
              onClick={() => {
                setDebriefOpen(true);
                closeGameOver();
              }}
              className="btn-ledger !text-ink-900 !border-ink-900/40 hover:!bg-ink-900/10"
            >
              {t('game.debrief.open')}
            </button>
          )}
          <button type="button" onClick={share} className="btn-ledger !text-ink-900 !border-ink-900/40 hover:!bg-ink-900/10" aria-live="polite">
            {shared ? t('game.scoring.shared') : t('game.scoring.share')}
          </button>
          <button type="button" onClick={() => navigate('/setup')} className="btn-ledger !text-ink-900 !border-ink-900/40 hover:!bg-ink-900/10">
            {t('game.scoring.changeTable')}
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn-ledger !text-ink-900 !border-ink-900/40 hover:!bg-ink-900/10">
            {t('game.scoring.returnTitle')}
          </button>
          <button type="button" onClick={() => navigate('/results')} className="btn-ledger !text-brass-700 !border-brass-700 hover:!bg-brass-500/20">
            {t('game.scoring.bilan')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
