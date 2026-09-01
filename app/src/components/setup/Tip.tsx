import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Discreet contextual tooltip (design.md §6.4): dark plate, 1px brass rule,
 * appears on hover/focus after a short delay. Pure CSS so it works anywhere.
 */
export default function Tip({
  label,
  children,
  className,
  side = "top",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-40 w-56 max-w-[260px] -translate-x-1/2 rounded-lg border border-brass-700/60 bg-coal-900/95 px-3 py-2 text-left font-sans text-[12.5px] font-normal normal-case leading-snug tracking-normal text-cream-100/90 opacity-0 shadow-e3 transition-all duration-150",
          side === "top" ? "bottom-full mb-2 translate-y-1" : "top-full mt-2 -translate-y-1",
          "group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-hover/tip:delay-200 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-focus-within/tip:delay-200",
        )}
      >
        {label}
      </span>
    </span>
  );
}
