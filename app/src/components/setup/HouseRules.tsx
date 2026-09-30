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
      className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[rgb(var(--paper-100)/.07)] py-3 last:border-b-0"
    >
      <Tip label={hint} side="top">
        <span className="cursor-help font-ui text-sm font-medium text-paper-300">
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
    <section
      aria-label={t("setup.houseRules.ariaLabel")}
      className="relative console p-6"
    >
      <header>
        <h2 className="title-card">{t("setup.houseRules.heading")}</h2>
        <div aria-hidden className="mt-3 border-t border-[rgb(var(--paper-100)/.07)]" />
      </header>

      <div className="mt-2">
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
              <span className="absolute -top-2 right-0 rounded-sm bg-rust-700 px-1.5 py-px font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-paper-100">
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
          {/* Interrupteur laiton (create.md §A4) : piste enamel, curseur dégradé */}
          <button
            type="button"
            role="switch"
            aria-checked={!!options.assist}
            onClick={() => onChange({ assist: !options.assist })}
            className="inline-flex items-center gap-2.5"
          >
            <span
              aria-hidden
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-[180ms]",
                options.assist ? "bg-bottle-500" : "bg-enamel-700",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full transition-transform duration-[180ms]",
                  options.assist ? "translate-x-[22px]" : "translate-x-0.5",
                )}
                style={{
                  background: "linear-gradient(180deg, #E7C97E 0%, #C9A24B 48%, #8F6B23 100%)",
                  boxShadow: "0 1px 3px rgba(0,0,0,.5)",
                }}
              />
            </span>
            <span
              className={cn(
                "font-ui text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                options.assist ? "text-brass-300" : "text-iron-400",
              )}
            >
              {options.assist ? t("setup.houseRules.assist.on") : t("setup.houseRules.assist.off")}
            </span>
          </button>
        </RuleRow>

        {/* Rules fidelity — read-only info row, not a control */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + 4 * 0.06, duration: 0.35, ease: "easeOut" }}
          className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
        >
          <span className="font-ui text-sm font-medium text-paper-300">
            {t("setup.houseRules.fidelity.label")}
          </span>
          <div className="flex items-center gap-3">
            <motion.span
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 5, repeat: 1, ease: "easeInOut" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-bottle-500/60 bg-bottle-700/40 px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-paper-100"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-bottle-400" />
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
