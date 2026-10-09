import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

interface ChapterSectionProps {
  id: string;
  /** two-digit mono number, e.g. "01" */
  numeral: string;
  title: string;
  children: ReactNode;
  className?: string;
  /** when provided, an anchor-copy button appears on heading hover/focus */
  onCopyAnchor?: (id: string, title: string) => void;
}

/**
 * One chapter of the club ledger (design/rules.md §3). Fraunces 24px heading
 * preceded by its mono brass number, rivet-bulleted body via `.rules-body`
 * (see RulesStyle), sober once-only reveal at 20% viewport. Section ids are
 * stable anchors referenced across the app (`/rules#market`…) — never rename.
 */
export default function ChapterSection({
  id,
  numeral,
  title,
  children,
  className,
  onCopyAnchor,
}: ChapterSectionProps) {
  const t = useT();
  const reduced = useReducedMotion();
  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-heading`}
      data-chapter={id}
      className={cn("scroll-mt-24 pt-12 first:pt-0", className)}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.2, once: true }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* the chapter keeps one measure, head and body together, set in the
          middle of the register: a 641px column set flush left in a 762px
          frame left 176px of dead gutter on the right, and the anchor
          floated off beyond the last line */}
      <div className="mx-auto max-w-[640px]">
        <header className="group flex items-baseline gap-3">
          <span aria-hidden className="font-mono text-[13px] text-brass-500">
            {numeral}.
          </span>
          <h2 id={`${id}-heading`} className="h2-section">
            {title}
          </h2>
          {onCopyAnchor && (
            <button
              type="button"
              onClick={() => onCopyAnchor(id, title)}
              aria-label={t("platform.rules.copyLinkAria", { section: title })}
              className="rules-print-hide ml-auto self-center p-1 text-iron-400 opacity-0 transition-[opacity,color] duration-150 hover:text-brass-300 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Link2 size={14} aria-hidden />
            </button>
          )}
        </header>
        <div className="rules-body mt-5 space-y-5 font-ui text-[15px] leading-[1.7] text-paper-300">
          {children}
        </div>
      </div>
    </motion.section>
  );
}
