import { useEffect, useRef, useState } from 'react';
import type { Reading, Verdict } from '@/game/analysis';

/* the game as a line, the way a chess site draws an evaluation: the
   reader's chance after every move, lit above the half-way mark and dark
   below it, the eras named, the wider misses as dots; a press picks, a
   drag scrubs, a hover reads the figure. The judge's own doubt is drawn
   too: a ribbon between the lowest and the highest of its passes, and a
   dashed line as long as a stretch has been read by one pass only */
export default function AnalysisCurve({ chances, reads, settled, rivals, at, marks, split, label, eras, vary, height = 112, onPick }: { height?: number; chances: number[]; reads: (Reading | undefined)[]; settled: boolean[]; rivals: { seat: number; color: string; chances: (number | null)[] }[]; at: number; marks: Record<number, Verdict>; split: number; label: string; eras: [string, string]; vary: { from: number; chances: number[]; seats: { seat: number; color: string; chances: number[] }[] } | null; onPick: (k: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setW(Math.round(width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const TOP = 16;
  const BOTTOM = 6;
  const last = Math.max(1, chances.length - 1);
  const x = (k: number) => (k / last) * w;
  const y = (c: number) => TOP + (1 - c) * (H - TOP - BOTTOM);
  const mid = y(0.5);
  /* a soft line through the points: Catmull-Rom turned into cubic curves */
  const smooth = (pts: (readonly [number, number])[]): string => {
    if (!pts.length) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const pts = chances.map((c, k) => [x(k), y(c)] as const);
  const line = smooth(pts);
  const areaDown = `${line} L${w},${H} L0,${H} Z`;
  const areaUp = `${line} L${w},0 L0,0 Z`;
  /* the judge's doubt: the passes' highest edge out, their lowest back */
  const doubt = reads.some((r) => r && r.high > r.low)
    ? `${smooth(chances.map((c, k) => [x(k), y(reads[k]?.high ?? c)] as const))} ${smooth(chances.map((c, k) => [x(k), y(reads[k]?.low ?? c)] as const).reverse()).replace(/^M/, 'L')} Z`
    : '';
  /* how far the reading has settled: every position up to here has been
     read by every pass, so the line is drawn full rather than dashed */
  let front = -1;
  while (front + 1 < chances.length && settled[front + 1]) front += 1;
  const misses = Object.values(marks).filter((m) => m.grade !== 'top' && m.grade !== 'good');
  const kAt = (el: Element, clientX: number) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(last, Math.round(((clientX - r.left) / r.width) * last)));
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser does not track: the press still picks */
    }
    onPick(kAt(e.currentTarget, e.clientX));
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const k = kAt(e.currentTarget, e.clientX);
    if (e.buttons & 1) onPick(k);
    else setHover(k);
  };
  /* a marker: the hairline, the bead on the line, the figure beside it */
  const mark = (k: number, strong: boolean) => {
    const cx = x(k);
    const cy = y(chances[k] ?? 0.5);
    /* the spread between the passes, when they disagreed by a point or more */
    const r = reads[k];
    const band = r ? Math.round(((r.high - r.low) / 2) * 100) : 0;
    const text = `${k} · ${Math.round((chances[k] ?? 0.5) * 100)} %${band > 0 ? ` ± ${band}` : ''}`;
    const right = cx > w - 56;
    return (
      <g key={strong ? 'at' : 'hover'} pointerEvents="none">
        <line x1={cx} x2={cx} y1={TOP - 4} y2={H} stroke={strong ? '#F5EBD7' : 'rgba(245,235,215,0.45)'} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3} fill={strong ? '#F5EBD7' : '#C9A45C'} stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
        <text x={right ? cx - 5 : cx + 5} y={TOP - 5} textAnchor={right ? 'end' : 'start'} fill={strong ? '#F5EBD7' : 'rgba(245,235,215,0.7)'} fontSize={9.5} fontFamily="ui-monospace, monospace">
          {text}
        </text>
      </g>
    );
  };
  return (
    <div ref={box} className="w-full">
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerLeave={() => setHover(null)} style={{ height: H }} className="block w-full cursor-crosshair touch-none select-none rounded-sm border border-brass-700/40 bg-coal-900/80">
        <defs>
          <clipPath id="curve-above">
            <rect x={0} y={0} width={w} height={mid} />
          </clipPath>
          <clipPath id="curve-below">
            <rect x={0} y={mid} width={w} height={H - mid} />
          </clipPath>
        </defs>
        {/* the ground: lit where the reader stood above even, dark below */}
        <path d={areaDown} fill="rgba(201,164,92,0.28)" clipPath="url(#curve-above)" />
        <path d={areaUp} fill="rgba(20,14,10,0.55)" clipPath="url(#curve-below)" />
        {[0.25, 0.75].map((c) => (
          <line key={c} x1={0} x2={w} y1={y(c)} y2={y(c)} stroke="rgba(245,235,215,0.08)" strokeWidth={1} />
        ))}
        <line x1={0} x2={w} y1={mid} y2={mid} stroke="rgba(245,235,215,0.35)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={4} y={mid - 3} fill="rgba(245,235,215,0.4)" fontSize={9} fontFamily="ui-monospace, monospace">50 %</text>
        {/* the eras */}
        {split > 0 && <line x1={x(split)} x2={x(split)} y1={0} y2={H} stroke="rgba(245,235,215,0.22)" strokeWidth={1} />}
        <text x={4} y={H - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[0].toUpperCase()}</text>
        {split > 0 && <text x={x(split) + 4} y={H - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[1].toUpperCase()}</text>}
        {doubt && <path d={doubt} fill="rgba(231,201,120,0.22)" stroke="none" />}
        {/* the other seats, faint: the same reading from their chair */}
        {rivals.map((r) => {
          const pts = r.chances.map((c, k) => (c === null ? null : ([x(k), y(c)] as const))).filter((p): p is readonly [number, number] => !!p);
          return pts.length > 1 ? <path key={r.seat} d={smooth(pts)} fill="none" stroke={r.color} strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" /> : null;
        })}
        {/* the line: dashed while a stretch is read by one pass only */}
        <path d={line} fill="none" stroke="#E7C978" strokeOpacity={0.45} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        {front > 0 && <path d={smooth(pts.slice(0, front + 1))} fill="none" stroke="#E7C978" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
        {misses.map((m) => (
          <circle key={m.at} cx={x(m.at + 1)} cy={y(chances[m.at + 1] ?? 0.5)} r={3} fill={m.grade === 'blunder' ? '#B4472E' : m.grade === 'mistake' ? '#C97A3B' : '#E7D6AE'} stroke="rgba(0,0,0,0.6)" strokeWidth={1}>
            <title>{`${m.at + 1} · −${Math.round(m.loss * 100)} %`}</title>
          </circle>
        ))}
        {/* the variation, dashed, leaving the game where it does */}
        {vary && vary.chances.length > 1 && (
          <g pointerEvents="none">
            {vary.seats.map((r) => (
              <path key={r.seat} d={r.chances.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(vary.from + i).toFixed(1)},${y(c).toFixed(1)}`).join(' ')} fill="none" stroke={r.color} strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="3 3" strokeLinejoin="round" />
            ))}
            <path d={vary.chances.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(vary.from + i).toFixed(1)},${y(c).toFixed(1)}`).join(' ')} fill="none" stroke="#F5EBD7" strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />
            <circle cx={x(vary.from + vary.chances.length - 1)} cy={y(vary.chances[vary.chances.length - 1])} r={3} fill="#F5EBD7" stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
          </g>
        )}
        {hover !== null && hover !== at && mark(hover, false)}
        {mark(at, true)}
      </svg>
    </div>
  );
}

