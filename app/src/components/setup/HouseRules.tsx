import { Link } from "react-router";
import { motion } from "framer-motion";
import { BadgeCheck, ArrowUpRight } from "lucide-react";
import { useT } from "@/i18n";
import Segmented from "./Segmented";
import Tip from "./Tip";
import type { EraLength, MarketTemper, SetupOptions } from "./constants";
import { cn } from "@/lib/utils";

const TIMER_VALUES = ["off", "2", "5"];

function RuleRow({
  label,
  hint,
  children,
  index,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.06, duration: 0.35, ease: "easeOut" }}
      className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-coal-700/70 py-3 last:border-b-0"
    >
      <Tip label={hint} side="top">
        <span className="cursor-help font-sans text-sm font-medium text-cream-100/85">
          {label}
        </span>
      </Tip>
      {children}
    </motion.div>
  );
}

/**
 * House Rules panel (setup.md §Panel 2): era length, market temper, timer and
 * the read-only fidelity chip linking to the Rules Codex approximations.
 */
export default function HouseRules({
  options,
  onChange,
}: {
  options: SetupOptions;
  onChange: (patch: Partial<SetupOptions>) => void;
}) {
  const t = useT();
  return (
    <section aria-label={t("setup.houseRules.ariaLabel")} className="plate relative p-6">
      <div
        aria-hidden
        className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]"
      />
      <header className="relative">
        <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
          {t("setup.houseRules.heading")}
        </h2>
        <div className="divider-brass mt-3 !mx-0" />
      </header>

      <div className="relative mt-2">
        <RuleRow
          index={0}
          label={t("setup.houseRules.eraLength.label")}
          hint={t("setup.houseRules.eraLength.hint")}
        >
          <Segmented<EraLength>
            ariaLabel={t("setup.houseRules.eraLength.ariaLabel")}
            value={options.eraLength}
            onChange={(eraLength) => onChange({ eraLength })}
            options={[
              { value: "standard", label: t("setup.houseRules.eraLength.full") },
              { value: "short", label: t("setup.houseRules.eraLength.canalOnly") },
            ]}
          />
        </RuleRow>

        <RuleRow
          index={1}
          label={t("setup.houseRules.marketTemper.label")}
          hint={t("setup.houseRules.marketTemper.hint")}
        >
          <div className="relative">
            <Segmented<MarketTemper>
              ariaLabel={t("setup.houseRules.marketTemper.ariaLabel")}
              value={options.marketTemper}
              onChange={(marketTemper) => onChange({ marketTemper })}
              options={[
                { value: "calm", label: t("setup.houseRules.marketTemper.calm") },
                { value: "standard", label: t("setup.houseRules.marketTemper.standard") },
                { value: "volatile", label: t("setup.houseRules.marketTemper.volatile") },
              ]}
            />
            {options.marketTemper === "volatile" && (
              <span className="absolute -top-2 right-0 rounded-sm bg-rust-500 px-1.5 py-px font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-cream-100">
                {t("setup.houseRules.marketTemper.beta")}
              </span>
            )}
          </div>
        </RuleRow>

        <RuleRow
          index={2}
          label={t("setup.houseRules.timer.label")}
          hint={t("setup.houseRules.timer.hint")}
        >
          <Segmented
            ariaLabel={t("setup.houseRules.timer.ariaLabel")}
            value={options.timerMinutes === null ? "off" : String(options.timerMinutes)}
            onChange={(v) => onChange({ timerMinutes: v === "off" ? null : Number(v) })}
            options={TIMER_VALUES.map((v) => ({
              value: v,
              label: v === "off" ? t("setup.houseRules.timer.off") : t("setup.houseRules.timer.min", { n: v }),
            }))}
          />
        </RuleRow>

        <RuleRow
          index={3}
          label={t("setup.houseRules.assist.label")}
          hint={t("setup.houseRules.assist.hint")}
        >
          <button
            type="button"
            role="switch"
            aria-checked={!!options.assist}
            onClick={() => onChange({ assist: !options.assist })}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
              options.assist ? "border-brass-400 bg-brass-500/20 text-brass-400" : "border-brass-700/60 text-cream-100/60 hover:text-cream-100/90",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", options.assist ? "bg-brass-400" : "bg-cream-100/30")} />
            {options.assist ? t("setup.houseRules.assist.on") : t("setup.houseRules.assist.off")}
          </button>
        </RuleRow>

        {/* Rules fidelity — read-only info row, not a control */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + 4 * 0.06, duration: 0.35, ease: "easeOut" }}
          className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
        >
          <span className="font-sans text-sm font-medium text-cream-100/85">
            {t("setup.houseRules.fidelity.label")}
          </span>
          <div className="flex items-center gap-3">
            <motion.span
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 5, repeat: 1, ease: "easeInOut" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-bottle-600/80 bg-bottle-800/60 px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/90"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-brass-400" />
              {t("setup.houseRules.fidelity.faithful")}
            </motion.span>
            <Link
              to="/rules#approximations"
              className="inline-flex items-center gap-1 font-sans text-[12px] font-semibold text-brass-500 underline decoration-brass-700/60 underline-offset-4 transition-colors hover:text-brass-400"
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
