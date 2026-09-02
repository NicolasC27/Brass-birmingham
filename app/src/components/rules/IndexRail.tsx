import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { Chapter } from "./rulesData";

interface IndexRailProps {
  chapters: Chapter[];
  activeId: string;
  onNavigate: (id: string) => void;
}

/**
 * Sticky engraved chapter index (desktop) + compact "Chapters" dropdown
 * (mobile). The desktop rail slides in from the right on load via the
 * page's GSAP timeline; the active chapter is driven by scroll-spy.
 */
export default function IndexRail({ chapters, activeId, onNavigate }: IndexRailProps) {
  const t = useT();
  return (
    <>
      {/* Mobile: sticky chapters dropdown */}
      <div className="sticky top-14 z-30 -mx-4 bg-coal-950/95 px-4 py-2 backdrop-blur-sm lg:hidden">
        <label className="flex items-center gap-3">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-500">
            {t("rules.rail.chapters")}
          </span>
          <select
            value={activeId}
            onChange={(e) => onNavigate(e.target.value)}
            aria-label={t("rules.rail.jumpAria")}
            className="min-h-[44px] flex-1 rounded-md border border-brass-700/60 bg-coal-800 px-3 font-fell text-base text-cream-100 focus-visible:outline-2 focus-visible:outline-brass-400"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numeral} {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Desktop: sticky engraved rail */}
      <nav
        aria-label={t("rules.rail.navAria")}
        className="rules-rail plate sticky top-[88px] order-last hidden max-h-[calc(100dvh-120px)] w-[280px] shrink-0 overflow-y-auto p-5 lg:block"
      >
        <p className="eyebrow !text-[10px]">{t("rules.rail.index")}</p>
        <ol className="mt-3 space-y-0.5">
          {chapters.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(c.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group relative flex w-full items-baseline gap-2 rounded-sm px-3 py-1.5 text-left font-fell text-[15px] transition-colors duration-150",
                    active ? "text-brass-400" : "text-cream-100/65 hover:text-cream-100",
                  )}
                >
                  {/* brass tick for the active chapter */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-[60%] w-0.5 -translate-y-1/2 rounded-full bg-brass-500 transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span
                    className={cn(
                      "shrink-0 text-[12px] tracking-wider",
                      active ? "text-brass-500" : "text-brass-700",
                    )}
                  >
                    {c.numeral}
                  </span>
                  <span className="leading-snug">{c.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="divider-brass mt-4 !mx-0 w-full" />
        <p className="mt-3 font-sans text-[10.5px] leading-relaxed text-cream-100/45">
          {t("rules.rail.footnote")}
        </p>
      </nav>
    </>
  );
}
