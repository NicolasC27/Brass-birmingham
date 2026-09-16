import type { ReactNode } from 'react';
import { PLAYER_COLORS } from '@/game/data';
import type { Tier } from '@/online/table';
import { cn } from '@/lib/utils';
import { TIER_TONE, portraitFor } from './bits';

/* ------------------------------------------------------------------ */
/* Small pieces every hall screen shares: a seat's portrait, a row of  */
/* seats, a code on split flaps, a trend line, the colour of a rank.   */
/* ------------------------------------------------------------------ */

export function Seats({ seats, size = 26 }: { seats: { color: string; kind: 'human' | 'bot' }[]; size?: number }) {
  return (
    <span className="hall-seats" aria-hidden>
      {seats.map((s, i) =>
        s.kind === 'human' ? (
          <img key={i} src={portraitFor(i)} alt="" style={{ width: size, height: size }} />
        ) : (
          <i key={i} style={{ width: size, height: size, ['--c' as string]: PLAYER_COLORS[s.color]?.hex ?? '#C9A45C' }} />
        ),
      )}
    </span>
  );
}

/** a table code, letter by letter on flaps */
export function Flap({ code, offset = 0 }: { code: string; offset?: number }) {
  return (
    <span className="hall-flap" aria-label={code}>
      {code.split('').map((ch, i) => (
        <span key={i} style={{ ['--i' as string]: offset + i }} aria-hidden>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** the last cotes as a line, the end marked; flat and grey with one point only */
export function Trend({ values, gain, loss, flat }: { values: number[]; gain: string; loss: string; flat: string }) {
  const pts = values.length ? values : [1200];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const x = (i: number) => (pts.length === 1 ? 96 : (i / (pts.length - 1)) * 96);
  const y = (v: number) => 19 - ((v - min) / span) * 16;
  const tone = pts.length < 2 ? flat : pts[pts.length - 1] > pts[0] ? gain : pts[pts.length - 1] < pts[0] ? loss : flat;
  return (
    <span className="hall-trend" aria-hidden>
      <svg viewBox="0 0 96 22">
        <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={tone} strokeWidth={1.5} />
        <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={2} fill={tone} />
      </svg>
    </span>
  );
}

export function TierMark({ tier, children, className }: { tier: Tier; children: ReactNode; className?: string }) {
  return (
    <span className={cn('hall-tier', className)} style={{ ['--t' as string]: TIER_TONE[tier] }}>
      <i aria-hidden />
      {children}
    </span>
  );
}
