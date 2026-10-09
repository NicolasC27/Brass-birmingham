import { cn } from '@/lib/utils';
import type { RankTier } from './RankBadge';

/* ------------------------------------------------------------------ */
/* The rank's emblem, cut for the size it is read at (14 to 48px).     */
/*                                                                     */
/* The office's first emblems were drawn on a 128 grid and printed at  */
/* 24: a 3-unit rule came out at half a pixel, the inner frame at a    */
/* fifth, and gold, brass, steel and iron all settled into the same    */
/* pale cream — the night's ink, on the day's paper as well. This one  */
/* is drawn for its size — one frame, one figure, strokes of 9 to 12   */
/* units — and each metal is inked from the register it sits in, gold  */
/* kept apart from brass and steel from iron by at least 1.9:1 by day  */
/* and 2.1:1 by night. Gold and brass differ by their figure as well:  */
/* a full disc against a ring. The master wears gold with a star.      */
/* ------------------------------------------------------------------ */

type Metal = Exclude<RankTier, 'maitre'>;

/* each metal is a token of the register (index.css, --rank-*): the day's
   ink on paper, the night's lit one, and the day's again on the printed page */
const INK: Record<Metal, string> = {
  or: 'text-[rgb(var(--rank-or))]',
  laiton: 'text-[rgb(var(--rank-laiton))]',
  acier: 'text-[rgb(var(--rank-acier))]',
  fer: 'text-[rgb(var(--rank-fer))]',
  bronze: 'text-[rgb(var(--rank-bronze))]',
};

const HEX = '64,10 110.8,37 110.8,91 64,118 17.2,91 17.2,37';

/** one, two or three chevrons for the three lower metals, stacked about the centre */
function Chevrons({ n }: { n: number }) {
  const step = 22;
  const top = 64 - ((n - 1) * step) / 2;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const y = top + i * step + 8;
        return <path key={i} d={`M42 ${y} L64 ${y - 16} L86 ${y}`} fill="none" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </>
  );
}

/** a five-pointed star about the centre, for the master */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 11 : 27;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return `${(64 + r * Math.cos(a)).toFixed(1)},${(66 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

export default function RankEmblem({ tier, size = 24, className }: { tier: RankTier | 'placement'; size?: number; className?: string }) {
  /* not placed yet: the frame waits, dashed, with a question in it */
  if (tier === 'placement') {
    return (
      <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden className={cn('shrink-0 stroke-current text-iron-400', className)}>
        <polygon points={HEX} fill="none" strokeWidth={9} strokeLinejoin="round" strokeDasharray="16 12" />
        <path d="M50 52 a14 14 0 1 1 20 12.7 c-4 2 -6 5 -6 9.3 v3" fill="none" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={64} cy={93} r={6.5} fill="currentColor" strokeWidth={0} />
      </svg>
    );
  }
  const metal: Metal = tier === 'maitre' ? 'or' : tier;
  return (
    <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden className={cn('shrink-0 stroke-current', INK[metal], className)}>
      <polygon points={HEX} fill="currentColor" fillOpacity={0.35} strokeWidth={9} strokeLinejoin="round" />
      {metal === 'bronze' && <Chevrons n={1} />}
      {metal === 'fer' && <Chevrons n={2} />}
      {metal === 'acier' && <Chevrons n={3} />}
      {metal === 'laiton' && <circle cx={64} cy={64} r={20} fill="none" strokeWidth={11} />}
      {tier === 'or' && <circle cx={64} cy={64} r={22} fill="currentColor" strokeWidth={0} />}
      {tier === 'maitre' && <polygon points={STAR} fill="currentColor" strokeWidth={4} strokeLinejoin="round" />}
    </svg>
  );
}
