import { motion } from "framer-motion";
import Tip from "@/components/setup/Tip";
import type { PlayerColor } from "@/components/setup/constants";
import { INK, seatInk } from "./ink";
import type { FinalResult } from "./types";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Game timeline frieze (endgame.md §4): one milestone per entry from the
 * action history, player-colored pastilles joined by a hairline that traces
 * itself on load. The swing into the Rail Era is marked with the rail-banner
 * miniature and a shift to bottle green.
 */
export default function TimelineFrieze({
  result,
  reveal,
}: {
  result: FinalResult;
  reveal: boolean;
}) {
  const { timeline, players } = result;
  const t = useT();

  if (timeline.length === 0) return null;

  const playerFor = (entry: string) =>
    players.find((p) => p.name && entry.includes(p.name)) ?? null;

  const isRailTurn = (entry: string) =>
    /rail/i.test(entry) && /ère|era|commence|begins/i.test(entry);

  const railTurnIdx = timeline.findIndex(isRailTurn);

  /* the store keeps each entry as « [Canal R5] sentence »: the bracket is the
     ledger's shorthand, printed here as the era and the round in words */
  const split = (entry: string) => {
    const m = /^\[(Canal|Rail) R(\d+)\]\s*(.*)$/.exec(entry);
    if (!m) return { when: null, text: entry };
    const era = t(m[1] === 'Canal' ? 'platform.tableau.canal' : 'platform.tableau.rail');
    return { when: t('platform.tableau.progress', { era, turn: t('platform.state.turn', { round: Number(m[2]) }) }), text: m[3] };
  };

  return (
    <section aria-label={t("results.frieze.title")} className="relative">
      <h2 className="h2-section">{t("results.frieze.title")}</h2>
      <div aria-hidden className="gz-rule-double mt-2" />

      <div className="relative mt-6 overflow-x-auto pb-4">
        {/* hairline tracing itself */}
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={reveal ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, ease: "easeInOut", delay: 0.1 }}
          style={{ transformOrigin: "left" }}
          className="absolute left-4 right-4 top-[13px] h-px bg-[var(--gz-ink-soft)]"
        />

        <ol className="relative flex min-w-max items-start gap-7 px-4">
          {timeline.map((entry, i) => {
            const player = playerFor(entry);
            const color: PlayerColor = player?.color ?? "brass";
            const railTurn = i === railTurnIdx;
            const inRailEra = railTurnIdx >= 0 && i > railTurnIdx;
            const { when, text } = split(entry);
            return (
              <li key={i} className="relative flex w-40 flex-col items-center">
                <Tip label={text} side="bottom" className="flex">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={reveal ? { scale: 1 } : {}}
                    transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 400, damping: 20 }}
                    whileHover={{ scale: 1.25 }}
                    className={cn(
                      "flex h-7 w-7 cursor-help items-center justify-center rounded-full border-2 bg-enamel-850",
                      inRailEra ? "border-rust-400/70" : "border-bottle-ink/60",
                    )}
                    style={{ boxShadow: `0 0 0 3px ${INK.ground}` }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: seatInk(color) }}
                    />
                  </motion.span>
                </Tip>

                {railTurn && (
                  <img
                    src="/era-rail-banner.webp"
                    alt={t("results.frieze.railBannerAlt")}
                    className="mt-2 h-[54px] w-24 border border-[var(--gz-ink-soft)] object-cover"
                  />
                )}
                {when && <p className="micro-label mt-2 text-center text-iron-400">{when}</p>}
                <p
                  className={cn(
                    "max-h-16 overflow-hidden text-center font-ui text-[11px] leading-snug text-paper-300",
                    when ? "mt-0.5" : "mt-2",
                  )}
                >
                  {text}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
