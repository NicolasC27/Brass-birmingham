import { motion } from "framer-motion";
import Tip from "@/components/setup/Tip";
import { colorDef, type PlayerColor } from "@/components/setup/constants";
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

  return (
    <section aria-label={t("results.frieze.title")} className="relative">
      <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
        {t("results.frieze.title")}
      </h2>
      <div className="divider-brass mt-3 !mx-0" />

      <div className="relative mt-6 overflow-x-auto pb-4">
        {/* hairline tracing itself */}
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={reveal ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, ease: "easeInOut", delay: 0.1 }}
          style={{ transformOrigin: "left" }}
          className="absolute left-4 right-4 top-[13px] h-px bg-brass-700/70"
        />

        <ol className="relative flex min-w-max items-start gap-7 px-4">
          {timeline.map((entry, i) => {
            const player = playerFor(entry);
            const color: PlayerColor = player?.color ?? "brass";
            const railTurn = i === railTurnIdx;
            const inRailEra = railTurnIdx >= 0 && i > railTurnIdx;
            return (
              <li key={i} className="relative flex w-40 flex-col items-center">
                <Tip label={entry} side="bottom" className="flex">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={reveal ? { scale: 1 } : {}}
                    transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 400, damping: 20 }}
                    whileHover={{ scale: 1.25 }}
                    className={cn(
                      "flex h-7 w-7 cursor-help items-center justify-center rounded-full border-2 bg-coal-800",
                      inRailEra ? "border-bottle-600" : "border-brass-700/60",
                    )}
                    style={{ boxShadow: `0 0 0 3px rgba(23,19,16,1)` }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorDef(color).hex }}
                    />
                  </motion.span>
                </Tip>

                {railTurn && (
                  <img
                    src="/era-rail-banner.png"
                    alt={t("results.frieze.railBannerAlt")}
                    className="mt-2 h-[54px] w-24 rounded-sm border border-copper-700/60 object-cover shadow-e2"
                  />
                )}
                <p
                  className={cn(
                    "mt-2 max-h-16 overflow-hidden text-center font-sans text-[11px] leading-snug text-cream-100/60",
                    inRailEra && "text-cream-100/50",
                  )}
                >
                  {entry}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
