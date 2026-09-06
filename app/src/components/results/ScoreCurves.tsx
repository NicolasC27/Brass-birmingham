import { useId } from "react";
import { motion } from "framer-motion";
import { PLAYER_COLORS } from "@/game/data";
import type { FinalResult } from "./types";
import { useT } from "@/i18n";

/**
 * Round-by-round curves (the account book): one line per player, victory
 * points on the left, income level on the right, with the era divider.
 * Pure SVG, viewBox-scaled, lines draw themselves on reveal.
 */

const W = 560;
const H = 220;
const PAD = { l: 38, r: 14, t: 16, b: 30 };

function Chart({ result, series, title, reveal }: { result: FinalResult; series: (r: FinalResult["history"][number]) => number[]; title: string; reveal: boolean }) {
  const t = useT();
  const id = useId();
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
    <figure className="min-w-0">
      <figcaption className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-100/70">{title}</figcaption>
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
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#F4ECD8" strokeOpacity={0.1} strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontFamily="'IBM Plex Mono',monospace" fontSize={10} fill="#F4ECD8" fillOpacity={0.55}>
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {/* zero line, when negative values exist */}
        {lo < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#C9A45C" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 4" />}
        {/* round labels */}
        {rounds.map((r, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - PAD.b + 16} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} fill="#F4ECD8" fillOpacity={0.5}>
              {t("results.page.curvesRound", { n: r.round })}
            </text>
          ) : null,
        )}
        {/* era divider */}
        {eraSplit !== null && (
          <g>
            <line x1={eraSplit} x2={eraSplit} y1={PAD.t - 6} y2={H - PAD.b} stroke="#C9A45C" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 4" />
            <text x={eraSplit - 6} y={PAD.t - 8} textAnchor="end" fontFamily="'IM Fell English SC',serif" fontSize={11} fill="#2F3D29" stroke="#9FD4B4" strokeWidth={0} className="fill-bottle-600">
              {t("results.page.curvesCanal")}
            </text>
            <text x={eraSplit + 6} y={PAD.t - 8} textAnchor="start" fontFamily="'IM Fell English SC',serif" fontSize={11} fill="#B0703C">
              {t("results.page.curvesRail")}
            </text>
          </g>
        )}
        {/* one line per player */}
        <g clipPath={`url(#${id}-clip)`}>
          {result.players.map((p, pi) => {
            const col = PLAYER_COLORS[p.color]?.hex ?? "#C9A45C";
            const d = rounds.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(values[i][pi] ?? 0).toFixed(1)}`).join(" ");
            const last = values[n - 1]?.[pi] ?? 0;
            return (
              <g key={pi}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={col}
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
                  fill={col}
                  stroke="#191715"
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
    <div className="grid gap-8 md:grid-cols-2">
      <Chart result={result} series={(r) => r.vp} title={t("results.page.curvesVp")} reveal={reveal} />
      <Chart result={result} series={(r) => r.income} title={t("results.page.curvesIncome")} reveal={reveal} />
      {/* legend */}
      <ul className="col-span-full flex flex-wrap gap-x-5 gap-y-1.5 font-sans text-[12px] text-cream-100/80">
        {result.players.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAYER_COLORS[p.color]?.hex ?? "#C9A45C" }} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
