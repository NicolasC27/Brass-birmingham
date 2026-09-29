import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reading, Verdict } from '@/game/analysis';

/* the game as a line, the way a chess site draws an evaluation: the
   reader's chance after every move, lit above the half-way mark and dark
   below it, the eras named, the wider misses as dots; a press picks, a
   drag scrubs, a hover reads the figure. The judge's own doubt is drawn
   too: a ribbon between the lowest and the highest of its passes, and a
   dashed line as long as a stretch has been read by one pass only.
   The line may be looked at closer: the wheel zooms about the pointer, a
   shift-drag (or a right-button drag) marks a stretch to zoom to, a
   double-click shows the whole game again, and a bar at the foot shows the
   window and pans it when dragged. The window follows the move on show. */
/** a hex colour with an alpha, for the fills */
const tint = (hex: string, alpha: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

export default function AnalysisCurve({ chances, reads, settled, rivals, at, marks, split, label, eras, vary, height = 112, color = '#E7C978', rounds, titleOf, hint, onPick }: { height?: number; /** the seat's colour: the line and its ground wear it */ color?: string; /** the round each position stands in, for the ticks */ rounds?: number[]; /** a move's words, for the reading under the pointer */ titleOf?: (k: number) => string; /** how to zoom, said in a corner until the reader has */ hint?: string; chances: number[]; reads: (Reading | undefined)[]; settled: boolean[]; rivals: { seat: number; color: string; chances: (number | null)[] }[]; at: number; marks: Record<number, Verdict>; split: number; label: string; eras: [string, string]; vary: { from: number; chances: number[]; seats: { seat: number; color: string; chances: number[] }[] } | null; onPick: (k: number) => void }) {
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
  const BOTTOM = 12;
  const last = Math.max(1, chances.length - 1);
  /* the stretch of the game on view, in moves: the whole of it until zoomed */
  /* `anchor` is the move on show when the window was set by hand: the view
     follows the cursor only once it has moved since */
  const [win, setWinState] = useState<{ lo: number; hi: number; anchor: number } | null>(null);
  const setWin = useCallback((next: { lo: number; hi: number } | null) => setWinState(next ? { ...next, anchor: at } : null), [at]);
  const MIN_SPAN = 6;
  const clampWin = useCallback((a: number, b: number): { lo: number; hi: number } | null => {
    const s = Math.max(MIN_SPAN, Math.min(last, b - a));
    const l = Math.max(0, Math.min(last - s, a));
    if (s >= last) return null;
    return { lo: l, hi: l + s };
  }, [last]);
  /* the move on show stays in the window: the view slides to keep it, and
     the next zoom or pan starts from where the view stands */
  const view = win && at !== win.anchor && (at < win.lo || at > win.hi) ? clampWin(at - (win.hi - win.lo) / 2, at + (win.hi - win.lo) / 2) : win;
  const lo = view ? view.lo : 0;
  const hi = view ? view.hi : last;
  const span = Math.max(1, hi - lo);
  const x = (k: number) => ((k - lo) / span) * w;
  /* zoomed in, the height fits the stretch on view: a line that sits near
     the floor is read at its own scale, with the doubt's ribbon inside */
  let yLo = 0;
  let yHi = 1;
  if (view) {
    let a = 1;
    let b = 0;
    for (let k = Math.max(0, Math.floor(lo)); k <= Math.min(last, Math.ceil(hi)); k++) {
      const r = reads[k];
      a = Math.min(a, r ? r.low : chances[k]);
      b = Math.max(b, r ? r.high : chances[k]);
    }
    const pad = Math.max(0.04, (b - a) * 0.2);
    yLo = Math.max(0, a - pad);
    yHi = Math.min(1, b + pad);
    if (yHi - yLo < 0.12) {
      const c = (yLo + yHi) / 2;
      yLo = Math.max(0, c - 0.06);
      yHi = Math.min(1, c + 0.06);
    }
  }
  const y = (c: number) => TOP + (1 - (c - yLo) / (yHi - yLo)) * (H - TOP - BOTTOM);
  const mid = y(0.5);
  const midOn = 0.5 >= yLo && 0.5 <= yHi;
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
  const fracAt = (el: Element, clientX: number) => {
    const r = el.getBoundingClientRect();
    return lo + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * span;
  };
  const kAt = (el: Element, clientX: number) => Math.max(0, Math.min(last, Math.round(fracAt(el, clientX))));
  /* what a press is doing: scrubbing the move, marking a stretch, or
     dragging the window's bar */
  const drag = useRef<{ mode: 'scrub' | 'brush' | 'pan'; from: number; x0: number; lo0: number } | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const BAR_Y = H - 5;
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser does not track: the press still picks */
    }
    const r = e.currentTarget.getBoundingClientRect();
    const onBar = view && e.clientY - r.top >= BAR_Y - 4;
    if (onBar) {
      drag.current = { mode: 'pan', from: 0, x0: e.clientX, lo0: lo };
      return;
    }
    if (e.shiftKey || e.button === 2) {
      const f = fracAt(e.currentTarget, e.clientX);
      drag.current = { mode: 'brush', from: f, x0: e.clientX, lo0: lo };
      setBrush({ a: f, b: f });
      return;
    }
    drag.current = { mode: 'scrub', from: 0, x0: e.clientX, lo0: lo };
    onPick(kAt(e.currentTarget, e.clientX));
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (d && e.buttons) {
      if (d.mode === 'scrub') onPick(kAt(e.currentTarget, e.clientX));
      else if (d.mode === 'brush') setBrush({ a: d.from, b: fracAt(e.currentTarget, e.clientX) });
      else if (d.mode === 'pan') {
        const r = e.currentTarget.getBoundingClientRect();
        const shift = ((e.clientX - d.x0) / r.width) * last;
        setWin(clampWin(d.lo0 + shift, d.lo0 + shift + span));
      }
      return;
    }
    setHover(kAt(e.currentTarget, e.clientX));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'brush' && brush) {
      const a = Math.min(brush.a, brush.b);
      const b = Math.max(brush.a, brush.b);
      if (b - a >= 2) setWin(clampWin(a, b));
    }
    setBrush(null);
  };
  /* the wheel zooms about the pointer; a passive listener could not stop the page scrolling */
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = lo + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * span;
      const factor = e.deltaY > 0 ? 1.25 : 0.8;
      const s = span * factor;
      const ratio = (f - lo) / span;
      setWin(clampWin(f - ratio * s, f - ratio * s + s));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [lo, span, clampWin]);
  /* the rounds' ticks, once a round has room for its name */
  const roundTicks: { k: number; round: number }[] = [];
  if (rounds) {
    for (let k = Math.max(1, Math.floor(lo)); k <= Math.min(last, Math.ceil(hi)); k++) if (rounds[k] !== rounds[k - 1]) roundTicks.push({ k, round: rounds[k] });
  }
  const roomPerRound = roundTicks.length > 1 ? w / roundTicks.length : w;
  /* a marker: the hairline, the bead on the line, the figure beside it */
  const mark = (k: number, strong: boolean) => {
    const cx = x(k);
    const cy = y(chances[k] ?? 0.5);
    /* the spread between the passes, when they disagreed by a point or more */
    const r = reads[k];
    const band = r ? Math.round(((r.high - r.low) / 2) * 100) : 0;
    const text = `${k} · ${Math.round((chances[k] ?? 0.5) * 100)} %${band > 0 ? ` ± ${band}` : ''}`;
    const words = titleOf && k > 0 ? titleOf(k) : '';
    const right = cx > w - 160;
    return (
      <g key={strong ? 'at' : 'hover'} pointerEvents="none">
        <line x1={cx} x2={cx} y1={TOP - 4} y2={BAR_Y - 2} stroke={strong ? '#F5EBD7' : 'rgba(245,235,215,0.45)'} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3} fill={strong ? '#F5EBD7' : '#C9A45C'} stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
        <text x={right ? cx - 5 : cx + 5} y={TOP - 5} textAnchor={right ? 'end' : 'start'} fill={strong ? '#F5EBD7' : 'rgba(245,235,215,0.7)'} fontSize={9.5} fontFamily="ui-monospace, monospace">
          {text}{words ? `  ${words}` : ''}
        </text>
      </g>
    );
  };
  return (
    <div ref={box} className="w-full">
      <svg ref={svgRef} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)} onDoubleClick={() => setWin(null)} onContextMenu={(e) => e.preventDefault()} style={{ height: H }} className="block w-full cursor-crosshair touch-none select-none rounded-sm border border-brass-700/40 bg-coal-900/80">
        <defs>
          <clipPath id="curve-above">
            <rect x={0} y={0} width={w} height={Math.max(0, Math.min(H, mid))} />
          </clipPath>
          <clipPath id="curve-below">
            <rect x={0} y={Math.max(0, Math.min(H, mid))} width={w} height={Math.max(0, H - Math.max(0, Math.min(H, mid)))} />
          </clipPath>
        </defs>
        {/* the ground: lit where the reader stood above even, dark below */}
        <path d={areaDown} fill={tint(color, 0.28)} clipPath="url(#curve-above)" />
        <path d={areaUp} fill="rgba(20,14,10,0.55)" clipPath="url(#curve-below)" />
        {[0.25, 0.75].map((c) => (
          <line key={c} x1={0} x2={w} y1={y(c)} y2={y(c)} stroke="rgba(245,235,215,0.08)" strokeWidth={1} />
        ))}
        {midOn && <line x1={0} x2={w} y1={mid} y2={mid} stroke="rgba(245,235,215,0.35)" strokeWidth={1} strokeDasharray="3 3" />}
        {midOn && <text x={4} y={mid - 3} fill="rgba(245,235,215,0.4)" fontSize={9} fontFamily="ui-monospace, monospace">50 %</text>}
        {/* zoomed: the scale's ends named, so a flat stretch is read for what it is */}
        {view && (
          <>
            <text x={4} y={TOP + 8} fill="rgba(245,235,215,0.4)" fontSize={8.5} fontFamily="ui-monospace, monospace">{`${Math.round(yHi * 100)} %`}</text>
            <text x={w - 4} y={H - BOTTOM - 2} textAnchor="end" fill="rgba(245,235,215,0.4)" fontSize={8.5} fontFamily="ui-monospace, monospace">{`${Math.round(yLo * 100)} %`}</text>
          </>
        )}
        {/* the eras */}
        {split > 0 && <line x1={x(split)} x2={x(split)} y1={0} y2={H} stroke="rgba(245,235,215,0.22)" strokeWidth={1} />}
        {x(0) > -w && <text x={Math.max(4, x(0) + 4)} y={BAR_Y - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[0].toUpperCase()}</text>}
        {split > 0 && <text x={Math.max(4, x(split) + 4)} y={BAR_Y - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[1].toUpperCase()}</text>}
        {/* the rounds, ticked and named once there is room */}
        {roundTicks.map((tk) => (
          <g key={tk.k} pointerEvents="none">
            <line x1={x(tk.k)} x2={x(tk.k)} y1={BAR_Y - 14} y2={BAR_Y - 8} stroke="rgba(245,235,215,0.3)" strokeWidth={1} />
            {roomPerRound >= 26 && <text x={x(tk.k) + 2} y={BAR_Y - 9} fill="rgba(245,235,215,0.45)" fontSize={8} fontFamily="ui-monospace, monospace">{tk.round}</text>}
          </g>
        ))}
        {doubt && <path d={doubt} fill={tint(color, 0.22)} stroke="none" />}
        {/* the other seats, faint: the same reading from their chair */}
        {rivals.map((r) => {
          const pts = r.chances.map((c, k) => (c === null ? null : ([x(k), y(c)] as const))).filter((p): p is readonly [number, number] => !!p);
          return pts.length > 1 ? <path key={r.seat} d={smooth(pts)} fill="none" stroke={r.color} strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" /> : null;
        })}
        {/* the line: dashed while a stretch is read by one pass only */}
        <path d={line} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        {front > 0 && <path d={smooth(pts.slice(0, front + 1))} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
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
        {/* how to look closer, in the corner while the whole game is on view */}
        {!view && hint && <text x={w - 4} y={BAR_Y - 4} textAnchor="end" fill="rgba(245,235,215,0.38)" fontSize={8.5} fontFamily="ui-monospace, monospace" pointerEvents="none">{hint}</text>}
        {/* the stretch being marked to zoom to */}
        {brush && <rect x={x(Math.min(brush.a, brush.b))} y={TOP - 4} width={Math.max(1, x(Math.max(brush.a, brush.b)) - x(Math.min(brush.a, brush.b)))} height={BAR_Y - TOP + 2} fill="rgba(245,235,215,0.12)" stroke="rgba(245,235,215,0.6)" strokeWidth={1} strokeDasharray="3 2" pointerEvents="none" />}
        {/* the window's bar at the foot: where the view sits in the whole game; drag it to pan */}
        {view && (
          <g>
            <rect x={0} y={BAR_Y} width={w} height={4} rx={2} fill="rgba(245,235,215,0.12)" />
            <rect x={(lo / last) * w} y={BAR_Y} width={Math.max(6, (span / last) * w)} height={4} rx={2} fill={color} fillOpacity={0.8} style={{ cursor: 'grab' }} />
            <text x={w - 4} y={TOP - 5} textAnchor="end" fill="rgba(245,235,215,0.45)" fontSize={8.5} fontFamily="ui-monospace, monospace" pointerEvents="none">{`${Math.round(lo)}–${Math.round(hi)} · ×${(last / span).toFixed(1)}`}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

