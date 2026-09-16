import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { INCOME_PAYOUT, PLAYER_COLORS, fmtPay, incomeLevel } from '@/game/data';
import { useGame } from '@/game/store';
import type { GameState } from '@/game/types';
import { titlesFor } from '@/components/results/titles';
import { useTable } from '@/online/lobby';
import { recordAgainst } from '@/online/rivals';
import { useDesk, useSession } from '@/online/session';
import { useT } from '@/i18n';
import { PortraitMedallion } from './PlayerRail';

/* The player's card — what the table knows of a seat: the purse and the
   income, the tally of the game so far and the title it earns, and, when
   the desk remembers, the games played against them. Opens from the
   portrait on the rail. */

export default function PlayerCard({ game, seat, onClose }: { game: GameState; seat: number; onClose: () => void }) {
  const t = useT();
  const p = game.players[seat];
  const mySeat = useGame((s) => s.seat);
  const mutedSeats = useGame((s) => s.mutedSeats);
  const muteSeat = useGame((s) => s.muteSeat);
  const desk = useDesk();
  const me = useSession();
  const code = useGame((s) => s.code);
  const table = useTable(code);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!p) return null;
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const ranked = game.players.map((_, i) => i).sort((a, b) => game.players[b].vp - game.players[a].vp || game.players[b].income - game.players[a].income);
  const title = titlesFor(game.players.map((x) => x.stats), ranked)[seat];
  const tiles = Object.values(game.tiles).filter((x) => x.owner === seat);
  const links = Object.values(game.links).filter((l) => l.owner === seat).length;
  const flipped = tiles.filter((x) => x.flipped).length;
  const myIndex = mySeat ?? game.players.findIndex((x) => !x.isBot);
  /* the record against this player, from the desk's past games (online) */
  const record = me && seat !== myIndex && !p.isBot ? recordAgainst(desk, table, seat) : null;
  const mine = seat === myIndex;
  const muted = mutedSeats.includes(seat);
  const rows: [string, string][] = [
    [t('game.card.purse'), `£${p.money}`],
    [t('game.card.income'), `${incomeLevel(p.income)} · ${fmtPay(INCOME_PAYOUT[p.income])}`],
    [t('game.card.vp'), String(p.vp)],
    [t('game.card.onBoard'), t('game.card.onBoardValue', { tiles: tiles.length, flipped, links })],
    [t('game.card.tally'), t('game.card.tallyValue', { built: p.stats.built, sold: p.stats.sold, developed: p.stats.developed, loans: p.stats.loans })],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.16 }}
      role="dialog"
      aria-label={t('game.card.aria', { name: p.name })}
      className="plate relative w-[268px] p-3 shadow-e4"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onClose} aria-label={t('board.inspector.close')} className="absolute right-1.5 top-1.5 rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-3">
        <PortraitMedallion p={p} index={seat} active={false} size={44} />
        <div className="min-w-0">
          <p className="truncate font-fell text-[16px] tracking-wide" style={{ color: color.hex }}>{p.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-cream-100/50">
            {p.isBot ? t(`setup.difficulty.${p.difficulty}.label`) : mine ? t('game.card.you') : t('game.card.player')}
            {title && <span className="ml-1.5 rounded-sm border border-brass-700/60 px-1 font-fell normal-case tracking-wide text-brass-400">{t(`results.titles.${title}`)}</span>}
          </p>
        </div>
      </div>
      <div className="my-2 h-px bg-brass-700/50" />
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 font-sans text-[11.5px]">
            <dt className="text-cream-100/55">{k}</dt>
            <dd className="text-right font-mono text-[11px] text-cream-100/90">{v}</dd>
          </div>
        ))}
        {record && (
          <div className="flex items-baseline justify-between gap-3 font-sans text-[11.5px]">
            <dt className="text-cream-100/55">{t('game.card.record')}</dt>
            <dd className="text-right font-mono text-[11px] text-brass-400">{t('game.card.recordValue', { won: record.won, lost: record.lost, played: record.played })}</dd>
          </div>
        )}
      </dl>
      {!mine && (
        <div className="mt-2.5 flex justify-end border-t border-brass-700/40 pt-2">
          <button type="button" onClick={() => muteSeat(seat, !muted)} className="btn-ledger !min-h-[28px] !px-2.5 !py-1 text-[11px]">
            {muted ? t('game.card.unmute') : t('game.card.mute')}
          </button>
        </div>
      )}
    </motion.div>
  );
}
