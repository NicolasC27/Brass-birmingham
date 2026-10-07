import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* MemberAvatar — avatar gravé + cadre de carte de membre (comptoir).  */
/* Les cadres sont des anneaux SVG en code (filet, rivets, engrenage,  */
/* lauriers) posés autour de l'avatar — aucune image.                  */
/* ------------------------------------------------------------------ */

/* The plate itself is the register's, so a frame struck by day is not the one
   struck by night: `fill` and `stroke` are CSS properties even when written as
   SVG attributes, and take a var() like any other. The highlight and the shade
   stay fixed — they are not a colour but the modelling of the metal, the light
   caught on the rim and the shadow under it, and they must sit either side of
   the plate in both registers. */
const BRASS = 'rgb(var(--brass-plate, 201 162 75))';
const BRASS_HI = '#E7C97E';
const BRASS_LO = '#8F6B23';

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

/* ------------------------------ Anneaux ------------------------------ */

function FilletRing() {
  return (
    <>
      <circle cx="50" cy="50" r="45.5" fill="none" stroke={BRASS} strokeWidth="2.4" />
      <path d="M 18 30 A 38 38 0 0 1 46 11.5" fill="none" stroke={BRASS_HI} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </>
  );
}

function RivetsRing() {
  return (
    <>
      <circle cx="50" cy="50" r="45.5" fill="none" stroke={BRASS_LO} strokeWidth="1.6" />
      {Array.from({ length: 12 }).map((_, i) => {
        const [x, y] = polar(45.5, i * 30);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="2.7" fill={BRASS} stroke={BRASS_LO} strokeWidth="0.8" />
            <circle cx={x - 0.7} cy={y - 0.7} r="0.8" fill={BRASS_HI} opacity="0.9" />
          </g>
        );
      })}
    </>
  );
}

function GearRing() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x="46.9" y="0.5" width="6.2" height="8" rx="1.2" fill={BRASS} stroke={BRASS_LO} strokeWidth="0.7" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="43.5" fill="none" stroke={BRASS} strokeWidth="2.6" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={BRASS_LO} strokeWidth="1" opacity="0.8" />
    </>
  );
}

function LaurelRing() {
  /* deux branches de laurier qui montent du bas, feuilles le long de l'anneau */
  const leaves: { x: number; y: number; rot: number }[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const deg = 90 + s * (22 + i * 16);
      const [x, y] = polar(44.5, deg);
      leaves.push({ x, y, rot: deg + 90 + s * 24 });
    }
  }
  return (
    <>
      {([-1, 1] as const).map((s) => {
        const [x1, y1] = polar(44.5, 90 + s * 14);
        const [x2, y2] = polar(44.5, 90 + s * 124);
        return <path key={s} d={`M ${x1} ${y1} A 44.5 44.5 0 ${s === -1 ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={BRASS_LO} strokeWidth="1.3" />;
      })}
      {leaves.map((l, i) => (
        <ellipse key={i} cx={l.x} cy={l.y} rx="4.8" ry="2.1" fill={BRASS} stroke={BRASS_LO} strokeWidth="0.6" transform={`rotate(${l.rot} ${l.x} ${l.y})`} />
      ))}
      <circle cx="50" cy="95.2" r="2" fill={BRASS_HI} stroke={BRASS_LO} strokeWidth="0.6" />
      <circle cx="45.8" cy="93.6" r="1.5" fill={BRASS} stroke={BRASS_LO} strokeWidth="0.6" />
      <circle cx="54.2" cy="93.6" r="1.5" fill={BRASS} stroke={BRASS_LO} strokeWidth="0.6" />
    </>
  );
}

export function FrameRing({ frame }: { frame: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[122%] w-[122%] -translate-x-1/2 -translate-y-1/2">
      {frame === 'frame-fillet' && <FilletRing />}
      {frame === 'frame-rivets' && <RivetsRing />}
      {frame === 'frame-gear' && <GearRing />}
      {frame === 'frame-laurel' && <LaurelRing />}
    </svg>
  );
}

/* ------------------------------ Composant ------------------------------ */

export interface MemberAvatarProps {
  /** id d'objet avatar (ex. 'avatar-brass') — avatar-iron par défaut */
  avatar?: string;
  /** id d'objet cadre (ex. 'frame-gear') — frame-none = sans cadre */
  frame?: string;
  size?: number;
  className?: string;
}

export default function MemberAvatar({ avatar = 'avatar-iron', frame = 'frame-none', size = 64, className }: MemberAvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <img src={`/${avatar}.svg`} alt="" width={size} height={size} className="h-full w-full rounded-full" />
      {frame !== 'frame-none' && <FrameRing frame={frame} />}
    </span>
  );
}
