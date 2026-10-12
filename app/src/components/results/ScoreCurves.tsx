import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { INK, seatInk } from "./ink";
import type { FinalResult } from "./types";
import { useT } from "@/i18n";

/**
 * Round-by-round curves (the account book): one line per player, victory
 * points on the left, income level on the right, with the era divider.
 * Pure SVG, lines draw themselves on reveal. The drawing is laid out at
 * the width it is shown at, not scaled down from a wider plate: three to
 * a row, a scaled plate set its figures at six pixels.
 */

const H = 220;
const PAD = { l: 38, r: 14, t: 16, b: 30 };

function Chart({ result, series, title, reveal }: { result: FinalResult; series: (r: FinalResult["history"][number]) => number[]; title: string; reveal: boolean }) {
  const t = useT();
  const id = useId();
  const frame = useRef<HTMLElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rounds = result.history;
  const n = rounds.length;
  const values = rounds.map(series);
  let lo = Math.min(0, ...values.flat());
  let hi = Math.max(1, ...values.flat());
  const span = Math.max(1, hi - lo);
  lo -= span * 0.05;
  hi += span * 0.08;
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = 4;
  const canalRounds = rounds.filter((r) => r.era === "canal").length;
  const eraSplit = canalRounds > 0 && canalRounds < n ? (x(canalRounds - 1) + x(canalRounds)) / 2 : null;
  const step = Math.max(1, Math.ceil(n / 9));

  return (
    <figure ref={frame} className="min-w-0">
      <figcaption className="micro-label mb-2 text-paper-300">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={PAD.l} y={0} width={W - PAD.l - PAD.r} height={H} />
          </clipPath>
        </defs>
        {/* gridlines + axis labels */}
        {Array.from({ length: ticks + 1 }, (_, k) => {
          const v = lo + ((hi - lo) * k) / ticks;
          return (
            <g key={k}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: INK.text }} strokeOpacity={0.14} strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontFamily="'IBM Plex Mono',monospace" fontSize={10.5} style={{ fill: INK.text }} fillOpacity={0.72}>
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {/* zero line, when negative values exist */}
        {lo < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} style={{ stroke: INK.brass }} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" />}
        {/* round labels */}
        {rounds.map((r, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - PAD.b + 16} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={10.5} style={{ fill: INK.text }} fillOpacity={0.72}>
              {t("results.page.curvesRound", { n: r.round })}
            </text>
          ) : null,
        )}
        {/* era divider */}
        {eraSplit !== null && (
          <g>
            <line x1={eraSplit} x2={eraSplit} y1={PAD.t - 6} y2={H - PAD.b} style={{ stroke: INK.brass }} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4 4" />
            <text x={eraSplit - 6} y={PAD.t - 8} textAnchor="end" fontFamily="Inter,system-ui,sans-serif" fontSize={9.5} fontWeight={500} letterSpacing="0.16em" style={{ fill: INK.canal, textTransform: "uppercase" }}>
              {t("results.page.curvesCanal")}
            </text>
            <text x={eraSplit + 6} y={PAD.t - 8} textAnchor="start" fontFamily="Inter,system-ui,sans-serif" fontSize={9.5} fontWeight={500} letterSpacing="0.16em" style={{ fill: INK.rail, textTransform: "uppercase" }}>
              {t("results.page.curvesRail")}
            </text>
          </g>
        )}
        {/* one line per player */}
        <g clipPath={`url(#${id}-clip)`}>
          {result.players.map((p, pi) => {
            const col = seatInk(p.color);
            const d = rounds.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(values[i][pi] ?? 0).toFixed(1)}`).join(" ");
            const last = values[n - 1]?.[pi] ?? 0;
            return (
              <g key={pi}>
                <motion.path
                  d={d}
                  fill="none"
                  style={{ stroke: col }}
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={reveal ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={{ duration: 1.4, delay: 0.2 + pi * 0.15, ease: "easeOut" }}
                />
                <motion.circle
                  cx={x(n - 1)}
                  cy={y(last)}
                  r={3.5}
                  style={{ fill: col, stroke: INK.ground }}
                  strokeWidth={1.2}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: reveal ? 1 : 0 }}
                  transition={{ delay: 1.6 + pi * 0.15 }}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

export default function ScoreCurves({ result, reveal }: { result: FinalResult; reveal: boolean }) {
  const t = useT();
  return (
    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
      <Chart result={result} series={(r) => r.vp} title={t("results.page.curvesVp")} reveal={reveal} />
      <Chart result={result} series={(r) => r.income} title={t("results.page.curvesIncome")} reveal={reveal} />
      <Chart result={result} series={(r) => r.money} title={t("results.page.curvesMoney")} reveal={reveal} />
      {/* legend */}
      <ul className="col-span-full flex flex-wrap gap-x-5 gap-y-1.5 font-ui text-[12.5px] text-paper-300">
        {result.players.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seatInk(p.color) }} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
