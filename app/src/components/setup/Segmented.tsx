import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Segmented brass toggle (setup.md): pill indicator slides between options
 * via a Framer Motion layout animation.
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-brass-700/60 bg-coal-900 p-1 shadow-inner",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors duration-150",
              active ? "text-ink-900" : "text-cream-100/60 hover:text-brass-400",
              o.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full border border-brass-700"
                style={{
                  background:
                    "linear-gradient(160deg, var(--brass-400), var(--brass-500) 45%, var(--brass-700))",
                  boxShadow:
                    "inset 0 1px 0 rgba(242,234,214,0.5), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)",
                }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
