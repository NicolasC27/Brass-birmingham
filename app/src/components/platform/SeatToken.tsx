import { motion } from 'framer-motion';
import { Bot, Check, Crown, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorDef, type PlayerColor } from '@/components/setup/constants';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* SeatToken — le jeton de siège, composant signature (design.md §7.1).*/
/* Disque fond enamel-700, anneau 2px couleur joueur ; états vide /    */
/* occupé / prêt / hôte / moi. Motion §5 : spring 260/24, entrée       */
/* scale .6→1 180ms.                                                   */
/* ------------------------------------------------------------------ */

export interface SeatTokenProps {
  /** null → siège ouvert (pointillé, LIBRE) */
  seat?: {
    name: string;
    color: PlayerColor;
    kind: 'human' | 'bot';
    ready?: boolean;
    host?: boolean;
    you?: boolean;
  } | null;
  /** 36px par défaut, 44 dans le lobby */
  size?: number;
  index?: number;
}

const spring = { type: 'spring', stiffness: 260, damping: 24 } as const;

export default function SeatToken({ seat, size = 36, index = 0 }: SeatTokenProps) {
  const t = useT();

  if (!seat) {
    return (
      <motion.div
        layout
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring, duration: 0.18 }}
        className="relative flex flex-col items-center gap-1"
        role="img"
        aria-label={t('platform.seat.seatAria', { n: index + 1, label: t('platform.seat.free') })}
      >
        <div
          className="flex items-center justify-center rounded-full border-2 border-dashed border-iron-600 bg-enamel-700/40"
          style={{ width: size, height: size }}
        >
          <UserPlus className="text-iron-600" style={{ width: size * 0.42, height: size * 0.42 }} aria-hidden />
        </div>
        <span className="micro-label text-[9px] text-iron-600">{t('platform.seat.free')}</span>
      </motion.div>
    );
  }

  const hex = colorDef(seat.color).hex;
  const stateLabel = seat.you
    ? t('platform.seat.you')
    : seat.kind === 'bot'
      ? t('platform.seat.bot')
      : seat.ready
        ? t('platform.seat.ready')
        : seat.name;

  return (
    <motion.div
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring}
      className="relative"
      role="img"
      aria-label={t('platform.seat.seatAria', { n: index + 1, label: `${seat.name} — ${stateLabel}` })}
      title={`${seat.name} — ${stateLabel}`}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-enamel-700 font-ui font-semibold text-paper-100',
          seat.ready && 'ring-2 ring-bottle-500',
          seat.you && 'shadow-[0_0_0_2px_rgb(var(--lacquer-900)),0_0_0_4px_rgb(var(--paper-100))]',
        )}
        style={{ width: size, height: size, border: `2px solid ${hex}`, fontSize: size * 0.38 }}
      >
        {seat.kind === 'bot' ? (
          <Bot className="text-iron-400" style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
        ) : (
          seat.name.charAt(0).toUpperCase()
        )}
      </div>
      {seat.ready && !seat.you && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-bottle-400"
          style={{ width: size * 0.36, height: size * 0.36 }}
        >
          <Check className="text-lacquer-950" style={{ width: size * 0.24, height: size * 0.24 }} strokeWidth={3.5} aria-hidden />
        </span>
      )}
      {seat.host && (
        <Crown
          className="absolute -top-1.5 -right-1 text-brass-300"
          style={{ width: 12, height: 12 }}
          aria-label={t('platform.seat.host')}
        />
      )}
    </motion.div>
  );
}
