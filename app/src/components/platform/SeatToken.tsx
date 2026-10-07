import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Crown, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorDef, type PlayerColor, type PlayerShape } from '@/components/setup/constants';
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
    /** the member's likeness, if the office serves one; the initial otherwise */
    portrait?: string | null;
  } | null;
  /** 36px par défaut, 44 dans le lobby */
  size?: number;
  index?: number;
}

const spring = { type: 'spring', stiffness: 260, damping: 24 } as const;

/* The colour's shape, notched into the rim of the disc. The register has
   carried a shape for every player since the first plan (design.md §8) and
   drew it in one place only; here the seat says it too, so the four seats
   are told apart by a mark and not by a hue alone. */
function ShapeNotch({ shape, ring, size }: { shape: PlayerShape; ring: string; size: number }) {
  const box = Math.max(11, Math.round(size * 0.34));
  const glyph = Math.round(box * 0.7);
  return (
    <span
      aria-hidden
      className="absolute -bottom-0.5 -left-0.5 flex items-center justify-center rounded-full bg-lacquer-900"
      style={{ width: box, height: box }}
    >
      <svg viewBox="0 0 12 12" style={{ width: glyph, height: glyph }} fill={ring}>
        {shape === 'circle' && <circle cx="6" cy="6" r="4.6" />}
        {shape === 'square' && <rect x="1.7" y="1.7" width="8.6" height="8.6" />}
        {shape === 'diamond' && <polygon points="6,0.8 11.2,6 6,11.2 0.8,6" />}
        {shape === 'triangle' && <polygon points="6,1.2 11.3,10.4 0.7,10.4" />}
      </svg>
    </span>
  );
}

export default function SeatToken({ seat, size = 36, index = 0 }: SeatTokenProps) {
  const t = useT();
  /* a likeness that does not come back leaves the initial in its place */
  const [broken, setBroken] = useState<string | null>(null);

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
        <span className="micro-label text-[9px] text-iron-400">{t('platform.seat.free')}</span>
      </motion.div>
    );
  }

  const { ring, shape } = colorDef(seat.color);
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
          'flex items-center justify-center overflow-hidden rounded-full bg-enamel-700 font-ui font-semibold text-paper-100',
          seat.ready && 'ring-2 ring-bottle-500',
          seat.you && 'shadow-[0_0_0_2px_rgb(var(--lacquer-900)),0_0_0_4px_rgb(var(--paper-100))]',
        )}
        style={{ width: size, height: size, border: `2px solid ${ring}`, fontSize: size * 0.38 }}
      >
        {seat.kind === 'bot' ? (
          <Bot className="text-iron-400" style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
        ) : seat.portrait && broken !== seat.portrait ? (
          <img src={seat.portrait} alt="" draggable={false} onError={() => setBroken(seat.portrait ?? null)} className="h-full w-full object-cover" />
        ) : (
          seat.name.charAt(0).toUpperCase()
        )}
      </div>
      <ShapeNotch shape={shape} ring={ring} size={size} />
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
