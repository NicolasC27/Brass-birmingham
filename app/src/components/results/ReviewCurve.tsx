import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { INK, seatInk } from './ink';
import type { Beat } from '@/game/review';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The curve of a finished game: every move along the bottom, every    */
/* seat's standing up the side. The standing is what is banked plus    */
/* what the board would pay were the era scored at that instant, so    */
/* the line moves with the play rather than jumping twice at the       */
/* decomptes. Drawn the way the account book's curves are drawn.       */
/* ------------------------------------------------------------------ */

const W = 720;
const H = 260;
const PAD = { l: 38, r: 14, t: 22, b: 28 };

/** a move worth marking on the line, and how it was read */
export interface Mark {
  at: number;
  grade: 'inaccuracy' | 'mistake' | 'blunder';
}

/* the grades in the register's inks, the same as the chips below the curve */
const GRADE_HEX: Record<Mark['grade'], string> = { inaccuracy: 'rgb(var(--brass-300))', mistake: 'rgb(var(--signal-ink))', blunder: 'rgb(var(--rust-400))' };

export default function ReviewCurve({
  curve,
  seats,
  seat,
  marks = [],
  onPick,
}: {
  curve: Beat[];
  seats: { name: string; color: string }[];
  /** the seat the marks belong to */
  seat: number;
  marks?: Mark[];
  onPick?: (at: number) => void;
}) {
  const t = useT();
  const id = useId();
  const [over, setOver] = useState<number | null>(null);
  const n = curve.length;
  if (n < 2) return null;

  const flat = curve.flatMap((b) => b.proj);
  let lo = Math.min(0, ...flat);
  let hi = Math.max(1, ...flat);
  const span = Math.max(1, hi - lo);
  lo -= span * 0.05;
  hi += span * 0.08;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = 4;

  /* the era changes between two moves: the line goes between them */
  const railFrom = curve.findIndex((b) => b.era === 'rail');
  const eraSplit = railFrom > 0 ? (x(railFrom - 1) + x(railFrom)) / 2 : null;
  /* a label under the first move of each round, thinned to fit */
  const opens: number[] = [];
  curve.forEach((b, i) => {
    const prev = curve[i - 1];
    if (!prev || prev.round !== b.round || prev.era !== b.era) opens.push(i);
  });
  const step = Math.max(1, Math.ceil(opens.length / 10));

  const at = over === null ? null : curve[over];
  const byIndex = new Map(marks.map((m) => [m.at, m.grade]));

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={t('results.review.curveAria')}
        onPointerLeave={() => setOver(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
          setOver(i >= 0 && i < n ? i : null);
        }}
        onPointerDown={() => {
          if (over !== null && onPick) onPick(curve[over].at);
        }}
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={PAD.l} y={0} width={W - PAD.l - PAD.r} height={H} />
          </clipPath>
        </defs>

        {Array.from({ length: ticks + 1 }, (_, k) => {
          const v = lo + ((hi - lo) * k) / ticks;
          return (
            <g key={k}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: INK.text }} strokeOpacity={0.14} strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontFamily="'IBM Plex Mono',monospace" fontSize={10} style={{ fill: INK.text }} fillOpacity={0.72}>
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {opens.map((i, k) =>
          k % step === 0 || k === opens.length - 1 ? (
            <text key={i} x={x(i)} y={H - PAD.b + 16} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} style={{ fill: INK.text }} fillOpacity={0.72}>
              {t('results.page.curvesRound', { n: curve[i].round })}
            </text>
          ) : null,
        )}

        {eraSplit !== null && (
          <g>
            <line x1={eraSplit} x2={eraSplit} y1={PAD.t - 8} y2={H - PAD.b} style={{ stroke: INK.brass }} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4 4" />
            <text x={eraSplit - 6} y={PAD.t - 10} textAnchor="end" fontFamily="Inter,system-ui,sans-serif" fontSize={9.5} fontWeight={500} letterSpacing="0.16em" style={{ fill: INK.canal, textTransform: 'uppercase' }}>
              {t('results.page.curvesCanal')}
            </text>
            <text x={eraSplit + 6} y={PAD.t - 10} textAnchor="start" fontFamily="Inter,system-ui,sans-serif" fontSize={9.5} fontWeight={500} letterSpacing="0.16em" style={{ fill: INK.rail, textTransform: 'uppercase' }}>
              {t('results.page.curvesRail')}
            </text>
          </g>
        )}

        {/* the move under the pointer */}
        {over !== null && (
          <line x1={x(over)} x2={x(over)} y1={PAD.t - 8} y2={H - PAD.b} style={{ stroke: INK.text }} strokeOpacity={0.45} strokeWidth={1} />
        )}

        <g clipPath={`url(#${id}-clip)`}>
          {seats.map((p, pi) => {
            const col = seatInk(p.color);
            const d = curve.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.proj[pi] ?? 0).toFixed(1)}`).join(' ');
            return (
              <motion.path
                key={pi}
                d={d}
                fill="none"
                style={{ stroke: col }}
                strokeWidth={pi === seat ? 2.6 : 1.6}
                strokeOpacity={pi === seat ? 1 : 0.55}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.1 + pi * 0.1, ease: 'easeOut' }}
              />
            );
          })}

          {/* what the machine made of the reader's moves */}
          {marks.map((m) => {
            const i = curve.findIndex((b) => b.at === m.at);
            if (i < 0) return null;
            return (
              <circle
                key={m.at}
                cx={x(i)}
                cy={y(curve[i].proj[seat] ?? 0)}
                r={m.grade === 'blunder' ? 4.5 : 3.4}
                style={{ fill: GRADE_HEX[m.grade], stroke: INK.ground }}
                strokeWidth={1.2}
                className={onPick ? 'cursor-pointer' : undefined}
              />
            );
          })}
        </g>

        {/* the readout, above the chart so it never covers the lines */}
        {at && (
          <text x={PAD.l} y={12} fontFamily="'IBM Plex Mono',monospace" fontSize={10} style={{ fill: INK.text }} fillOpacity={0.9}>
            {t(at.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: at.round })}
            {'  '}
            {seats.map((p, pi) => `${p.name.split(' ')[0]} ${at.proj[pi] ?? 0}`).join('   ')}
            {byIndex.has(at.at) ? `   · ${t(`results.review.grade.${byIndex.get(at.at)}`)}` : ''}
          </text>
        )}
      </svg>
    </figure>
  );
}
