import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { ledgerParts } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import { tileFaceUrl } from '@/gl/paint';
import { useT } from '@/i18n';
import { useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';

/* ------------------------------------------------------------------ */
/* A tile turning over is the moment of the game — income rises, the   */
/* points are banked — and it happened in the corner of the eye. Each  */
/* flip now lands as a plaque under the banner, the card in the owner's */
/* colour on it, for a few seconds, one under the other when several.  */
/* ------------------------------------------------------------------ */

interface Flip {
  id: number;
  owner: number;
  industry: string;
  title: string;
  detail: string;
}
const SHOWN_MS = 4200;

export default function FlipToast() {
  const t = useT();
  const game = useGame((s) => s.game);
  const { tileArt } = useBoardOptions();
  const insets = useHudInsets();
  const [flips, setFlips] = useState<Flip[]>([]);
  const [seen, setSeen] = useState<number | null>(null);
  const ledger = game?.ledger;
  const players = game?.players;

  useEffect(() => {
    if (!ledger || !players) return;
    /* the first look sets the mark: nothing that was already written toasts */
    if (seen === null) {
      const mark = window.setTimeout(() => setSeen(ledger.length ? ledger[ledger.length - 1].id + 1 : 0), 0);
      return () => window.clearTimeout(mark);
    }
    const fresh = ledger.filter((e) => e.id >= seen && e.key === 'flip' && e.player !== undefined);
    const last = ledger.length ? ledger[ledger.length - 1].id + 1 : seen;
    if (last === seen) return;
    const add = window.setTimeout(() => {
      setSeen(last);
      if (!fresh.length) return;
      const items = fresh.map((e) => {
        const { head, detail } = ledgerParts(e, t);
        return { id: e.id, owner: e.player!, industry: String(e.vars?.industry ?? ''), title: t('game.flip.title', { name: players[e.player!].name, what: head }), detail };
      });
      setFlips((f) => [...f, ...items]);
      for (const it of items) window.setTimeout(() => setFlips((f) => f.filter((x) => x.id !== it.id)), SHOWN_MS);
    }, 0);
    return () => window.clearTimeout(add);
  }, [ledger, players, seen, t]);

  if (!game) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 z-[78] flex -translate-x-1/2 flex-col items-center gap-2" style={{ top: insets.top + 120 }} aria-live="polite">
      <AnimatePresence>
        {flips.map((f) => {
          const color = PLAYER_COLORS[game.players[f.owner]?.color]?.hex ?? '#C9A45C';
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="plaque relative flex items-center gap-3 rounded-lg py-2 pl-2 pr-4"
              style={{ boxShadow: `0 0 0 1px ${color}66, 0 0 26px ${color}55, 0 10px 28px rgba(0,0,0,.45)` }}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] rounded-l-lg" style={{ background: color }} />
              {f.industry && (
                <span className="ml-1 h-12 w-12 shrink-0 overflow-hidden rounded-md" style={{ boxShadow: `0 0 0 1.5px ${color}` }}>
                  <img src={tileFaceUrl(f.industry as never, tileArt, game.players[f.owner]?.color ?? 'brass')} alt="" className="h-full w-full object-cover" />
                </span>
              )}
              <span className="flex flex-col leading-tight">
                <span className="font-fell text-[15px] tracking-wide text-cream-100">{f.title}</span>
                <span className="font-mono text-[11px] text-bottle-600 brightness-150">{f.detail}</span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
