import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ListOrdered, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export interface RailChapter {
  id: string;
  /** two-digit mono number, e.g. "01" */
  num: string;
  title: string;
}

interface IndexRailProps {
  chapters: RailChapter[];
  activeId: string;
  /** ids matching the current search — null when the search field is empty */
  matches: string[] | null;
  onNavigate: (id: string) => void;
}

/** Numbered chapter list shared by the desktop rail and the mobile drawer. */
function ChapterList({
  chapters,
  activeId,
  matches,
  onNavigate,
  stagger,
}: IndexRailProps & { stagger: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const visible = matches ? chapters.filter((c) => matches.includes(c.id)) : chapters;

  if (matches && visible.length === 0) {
    return <p className="mt-3 font-ui text-[13px] text-iron-400">{t("platform.rules.noResult")}</p>;
  }
  return (
    <ol className="mt-3 space-y-0.5">
      {visible.map((c, i) => {
        const active = c.id === activeId;
        return (
          <motion.li
            key={c.id}
            initial={stagger && !reduced ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: stagger && !reduced ? i * 0.03 : 0 }}
          >
            <button
              type="button"
              onClick={() => onNavigate(c.id)}
              aria-current={active ? "true" : undefined}
              className="group relative flex w-full items-baseline gap-2.5 rounded py-1.5 pl-3 pr-2 text-left transition-colors duration-150"
            >
              {active && (
                <motion.span
                  layoutId="rules-rail-active"
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-brass-400"
                  transition={{ duration: 0.15, ease: "easeOut" }}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "shrink-0 font-mono text-[10.5px] transition-colors duration-150",
                  active ? "text-brass-500" : "text-iron-400",
                )}
              >
                {c.num}
              </span>
              <span
                className={cn(
                  "font-ui text-[14px] font-medium leading-snug transition-colors duration-150",
                  active ? "text-brass-300" : "text-paper-300 group-hover:text-paper-100",
                )}
              >
                {c.title}
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Reading-progress filament + « back to top » (appears after 600px). */
function RailFoot() {
  const t = useT();
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      setShowTop(el.scrollTop > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mt-6 flex items-end gap-3">
      <div aria-hidden className="h-20 w-0.5 overflow-hidden rounded-full bg-enamel-700">
        <div
          className="h-full w-full origin-top bg-brass-500"
          style={{ transform: `scaleY(${progress})` }}
        />
      </div>
      <AnimatePresence>
        {showTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
            className="flex items-center gap-1.5 rounded font-ui text-[13px] font-semibold text-iron-400 transition-colors duration-150 hover:text-paper-100 focus-visible:outline-2 focus-visible:outline-signal-400"
          >
            <ArrowUp size={14} aria-hidden />
            {t("platform.rules.backToTop")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Registry summary rail (design/rules.md §2). Sticky numbered index on
 * desktop (active chapter lit by the page's scroll-spy, brass filament
 * animated via layoutId) ; on mobile a floating « Sommaire » button opens a
 * left drawer. Search narrows the list live (matches prop).
 */
export default function IndexRail(props: IndexRailProps) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigateAndClose = (id: string) => {
    setDrawerOpen(false);
    props.onNavigate(id);
  };

  return (
    <div className="rules-print-hide">
      {/* Desktop: sticky rail */}
      <nav
        aria-label={t("rules.rail.navAria")}
        className="sticky top-[88px] hidden max-h-[calc(100dvh-120px)] overflow-y-auto pb-2 min-[900px]:block"
      >
        <p className="micro-label text-iron-400">{t("platform.rules.summary")}</p>
        <ChapterList {...props} stagger />
        <RailFoot />
      </nav>

      {/* Mobile: floating summary button + left drawer */}
      <div className="min-[900px]:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-[76px] left-4 z-40 flex h-10 items-center gap-2 rounded-lg border border-brass-hairline-strong bg-enamel-800 px-4 font-ui text-[13px] font-semibold text-paper-100 shadow-[0_8px_24px_var(--shadow-modal)] transition-colors duration-150 hover:border-brass-500 focus-visible:outline-2 focus-visible:outline-signal-400"
        >
          <ListOrdered size={16} aria-hidden className="text-brass-300" />
          {t("platform.rules.summaryOpen")}
        </button>
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                key="rules-drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-[70] bg-black/60"
              />
              <motion.div
                key="rules-drawer-panel"
                role="dialog"
                aria-label={t("platform.rules.summary")}
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="fixed inset-y-0 left-0 z-[71] w-[300px] overflow-y-auto border-r border-brass-hairline bg-enamel-850 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="micro-label text-iron-400">{t("platform.rules.summary")}</p>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label={t("platform.action.close")}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--paper-100)/.14)] text-paper-300 transition-colors duration-150 hover:bg-enamel-800 hover:text-paper-100"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <ChapterList {...props} onNavigate={navigateAndClose} stagger={false} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
