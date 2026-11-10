import { Link } from "react-router";
import { motion } from "framer-motion";
import { BadgeCheck, ArrowUpRight } from "lucide-react";
import { useT } from "@/i18n";
import { BOARD_IDS, DEFAULT_BOARD } from "@/game/boards";
import Segmented from "./Segmented";
import Tip from "./Tip";
import type { EraLength, SetupOptions } from "./constants";
import { cn } from "@/lib/utils";
import { useSession } from "@/online/session";

const TIMER_VALUES = ["off", "2", "5"];

function RuleRow({
  label,
  hint,
  children,
  index,
  compact = false,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  index: number;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: compact ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: compact ? 0 : 0.15 + index * 0.06, duration: compact ? 0.2 : 0.35, ease: "easeOut" }}
      /* two tracks, not a wrapping row: the command keeps to the right edge
         even when the pair no longer fits on one line, and the label wraps */
      className={cn("grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-[var(--gz-ink-faint)] last:border-b-0", compact ? "min-h-[44px] py-2" : "min-h-[56px] py-3")}
    >
      <Tip label={hint} side="top">
        <span className={cn("cursor-help font-fraunces font-medium text-paper-100", compact ? "text-[14px]" : "text-[15px]")}>
          {label}
        </span>
      </Tip>
      {children}
    </motion.div>
  );
}

/**
 * House Rules panel (create.md §A4): era length, market temper, timer, the
 * beginner-assistance switch and the read-only fidelity chip linking to the
 * Rules Codex approximations. PROPS/API FIGÉES — aussi consommé par Lobby ;
 * restyle « Club Industriel » uniquement (enamel-850, filets hairline,
 * interrupteur laiton).
 *
 * At a guest's seat the panel is a notice, not a desk: pass `readOnly` and
 * every command is put out rather than left to answer the hand and the tab
 * and change nothing. The reason is printed under the heading, in the run of
 * the page, where a reader and a screen reader both meet it.
 */
export default function HouseRules({
  options,
  onChange,
  readOnly = false,
  compact = false,
  bare = false,
}: {
  options: SetupOptions;
  onChange: (patch: Partial<SetupOptions>) => void;
  /** the rules are the host's to set: show them, do not offer them */
  readOnly?: boolean;
  /** the one-screen sheet: tighter rows, no entrance one by one */
  compact?: boolean;
  /** under a leaf that already names it: no heading of its own */
  bare?: boolean;
}) {
  const t = useT();
  const admin = useSession()?.admin === true;
  return (
    <section
      aria-label={t("setup.houseRules.ariaLabel")}
      className="relative"
    >
      <header>
        {!bare && (
          <>
            <h2 className="h2-section">{t("setup.houseRules.heading")}</h2>
            <div aria-hidden className="gz-rule-double mt-2" />
          </>
        )}
        {readOnly && (
          <p className="mt-2 font-ui text-[12px] leading-snug text-paper-300">{t("online.room.hostSets")}</p>
        )}
      </header>

      <div className="mt-1">
        {/* a second country is the direction's to try, not yet everyone's */}
        {BOARD_IDS.length > 1 && admin && (
          <RuleRow
            compact={compact}
            index={0}
            label={t("setup.houseRules.map.label")}
            hint={t(`setup.houseRules.map.${options.map ?? DEFAULT_BOARD}Hint`)}
          >
            <Segmented<string>
              readOnly={readOnly}
              ariaLabel={t("setup.houseRules.map.ariaLabel")}
              value={options.map ?? DEFAULT_BOARD}
              onChange={(map) => onChange({ map })}
              options={BOARD_IDS.map((id) => ({ value: id, label: t(`setup.houseRules.map.${id}`) }))}
            />
          </RuleRow>
        )}
        <RuleRow
          compact={compact}
          index={0}
          label={t("setup.houseRules.eraLength.label")}
          hint={t("setup.houseRules.eraLength.hint")}
        >
          <Segmented<EraLength>
            readOnly={readOnly}
            ariaLabel={t("setup.houseRules.eraLength.ariaLabel")}
            value={options.eraLength}
            onChange={(eraLength) => onChange({ eraLength })}
            options={[
              { value: "standard", label: t("setup.houseRules.eraLength.full") },
              { value: "short", label: t("setup.houseRules.eraLength.canalOnly") },
            ]}
          />
        </RuleRow>

        {/* the market's temper stays standard: the calm and the volatile
            markets were an experiment, kept for the challenges alone */}
        <RuleRow
          compact={compact}
          index={2}
          label={t("setup.houseRules.timer.label")}
          hint={t("setup.houseRules.timer.hint")}
        >
          <Segmented
            readOnly={readOnly}
            ariaLabel={t("setup.houseRules.timer.ariaLabel")}
            value={options.timerMinutes === null ? "off" : String(options.timerMinutes)}
            onChange={(v) => onChange({ timerMinutes: v === "off" ? null : Number(v) })}
            options={TIMER_VALUES.map((v) => ({
              value: v,
              label: v === "off" ? t("setup.houseRules.timer.off") : t("setup.houseRules.timer.min", { n: v }),
            }))}
          />
        </RuleRow>

        {/* the beginner's assistance is each player's own, in the board's
            settings — never a rule laid on the whole table */}
        {/* Rules fidelity — read-only info row, not a control */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + 4 * 0.06, duration: 0.35, ease: "easeOut" }}
          /* the notice is the one that gives way: the label keeps its line
             and the note and its link fold to the right edge beside it */
          className="grid min-h-[56px] grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 py-3"
        >
          <span className="font-fraunces text-[15px] font-medium text-paper-100">
            {t("setup.houseRules.fidelity.label")}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
            <motion.span
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 5, repeat: 1, ease: "easeInOut" }}
              className="inline-flex items-center gap-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-paper-100"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-bottle-ink" />
              {t("setup.houseRules.fidelity.faithful")}
            </motion.span>
            <Link
              to="/rules#approximations"
              className="inline-flex items-center gap-1 font-ui text-[12px] font-semibold text-brass-300 underline decoration-brass-hairline-strong underline-offset-4 transition-colors hover:text-brass-400"
            >
              {t("setup.houseRules.fidelity.seeApproximations")}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
