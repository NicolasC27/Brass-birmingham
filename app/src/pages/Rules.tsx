import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Plus, Search, X } from "lucide-react";

import { useT } from "@/i18n";
import Toast from "@/components/platform/Toast";
import type { ToastData } from "@/components/platform/Toast";
import PageShell from "@/components/site/PageShell";
import RulesStyle from "@/components/rules/RulesStyle";
import RulesIcon from "@/components/rules/RulesIcon";
import ChapterSection from "@/components/rules/ChapterSection";
import IndexRail from "@/components/rules/IndexRail";
import ActionsAccordion from "@/components/rules/ActionsAccordion";
import IndustryTabs from "@/components/rules/IndustryTabs";
import SupplyDiagram from "@/components/rules/SupplyDiagram";
import TileFlipMock from "@/components/rules/TileFlipMock";
import MoneyLadder from "@/components/rules/MoneyLadder";
import {
  getApproximations,
  getChapters,
  getGlossary,
  getQuickSteps,
  type Fidelity,
} from "@/components/rules/rulesData";

const STATUS_STYLES: Record<Fidelity, string> = {
  faithful: "border-bottle-500/60 bg-bottle-700 text-paper-100",
  /* the ticket keeps its brass rule, but the ink is the page's: brass on this
     wash measured 3.79 by day, where paper-100 holds 11.31 and 12.30 */
  approximate: "border-brass-500/60 bg-brass-500/10 text-paper-100",
  planned: "border-rust-600/60 bg-transparent text-rust-400",
};

/** accent-insensitive lowercase, for the rules search */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");


/** Ornamental divider — brass hairline with a centered rivet diamond. */
function Ornament({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="relative mx-auto h-px w-56 bg-gradient-to-r from-transparent via-brass-500/60 to-transparent">
        <span className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brass-500 shadow-[0_0_0_4px_rgb(var(--enamel-850))]" />
      </div>
    </div>
  );
}

/** Static market-tray mock for chapter 07 — div-based, mono prices. */
function MarketTrayMock() {
  const t = useT();
  return (
    <div className="rounded-lg border border-brass-hairline bg-lacquer-950 p-4">
      <p className="micro-label text-iron-400">{t("rules.marketTray.title")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={
              i === 2
                ? "flex h-11 w-11 flex-col items-center justify-center rounded border-2 border-brass-500 bg-enamel-700 shadow-[0_0_12px_rgba(201,164,92,0.25)]"
                : "flex h-11 w-11 flex-col items-center justify-center rounded border border-brass-hairline bg-enamel-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            }
          >
            <span className="tnums font-mono text-[10.5px] text-brass-500">£{i + 1}</span>
            {i >= 2 ? (
              /* the cube is cut from the register's own ink — dark on the day's
                 paper, pale at night — where a flat ink-900 sank to 1.02 on
                 the night's enamel */
              <span className="mt-0.5 h-3 w-3 rounded-full bg-paper-100 ring-1 ring-[var(--gz-ink-soft)]" />
            ) : (
              <span className="mt-0.5 h-3 w-3 rounded-full border border-dashed border-paper-100/20" />
            )}
          </div>
        ))}
        {/* the plate and the ink that was cut for it: 4.90 by day, 7.63 by
            night, where brass-500 under ink-900 measured 2.59 */}
        <span className="ml-2 rounded bg-[rgb(var(--brass-plate))] px-2 py-1 font-mono text-[10.5px] font-semibold text-[rgb(var(--ink-on-brass))]">
          {t("rules.marketTray.buy")}
        </span>
      </div>
      <p className="mt-2 font-ui text-[10.5px] text-iron-400">{t("rules.marketTray.caption")}</p>
    </div>
  );
}

/** Worked scoring sketch for chapter 10. */
function ScoringSketch() {
  const t = useT();
  /* the label's frame is cut to its words: 6 units a glyph at 10 in Plex
     Mono, 6 of margin either side — « Verbindung 3 » ran 20 units past a
     frame sized on the English */
  const link = t("rules.scoringSketch.link");
  const linkW = link.length * 6 + 12;
  return (
    <svg
      viewBox="0 0 360 130"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={t("rules.scoringSketch.aria")}
    >
      <circle cx={60} cy={56} r={26} fill="rgb(var(--enamel-800))" stroke="var(--rd-brass, #8F6B23)" strokeWidth={1.5} />
      <text x={60} y={60} textAnchor="middle" fontSize={11} fill="rgb(var(--paper-100))" fontFamily="Inter, sans-serif">
        Dudley
      </text>
      <circle cx={250} cy={56} r={26} fill="rgb(var(--enamel-800))" stroke="var(--rd-brass, #8F6B23)" strokeWidth={1.5} />
      <text x={250} y={60} textAnchor="middle" fontSize={11} fill="rgb(var(--paper-100))" fontFamily="Inter, sans-serif">
        B’ham
      </text>
      {/* flipped ember tiles */}
      <g>
        <rect x={96} y={22} width={34} height={24} rx={3} fill="rgb(var(--enamel-800))" stroke="rgb(var(--rust-600))" strokeWidth={1.5} />
        <text x={113} y={38} textAnchor="middle" fontSize={11} fill="rgb(var(--rust-400))" fontFamily="'IBM Plex Mono', monospace">2</text>
        <rect x={176} y={66} width={34} height={24} rx={3} fill="rgb(var(--enamel-800))" stroke="rgb(var(--rust-600))" strokeWidth={1.5} />
        <text x={193} y={82} textAnchor="middle" fontSize={11} fill="rgb(var(--rust-400))" fontFamily="'IBM Plex Mono', monospace">5</text>
      </g>
      {/* the link */}
      <path d="M 86 56 C 140 40, 180 72, 224 58" fill="none" stroke="var(--rd-brass, #C9A45C)" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={176 - linkW / 2} y={10} width={linkW} height={18} fill="rgb(var(--enamel-850))" stroke="var(--rd-brass, #C9A45C)" />
      <text x={176} y={23} textAnchor="middle" fontSize={10} fill="var(--rd-brass, #C9A45C)" fontFamily="'IBM Plex Mono', monospace">{link}</text>
      <text x={320} y={60} textAnchor="middle" fontSize={13} fill="rgb(var(--paper-100))" fontFamily="'IBM Plex Mono', monospace">
        = 10
      </text>
      <text x={320} y={80} textAnchor="middle" fontSize={10} fill="rgb(var(--iron-400))" fontFamily="'IBM Plex Mono', monospace">
        {t("rules.scoringSketch.vpTotal")}
      </text>
    </svg>
  );
}

/** Worked-example caption — the mono formula keeps its brass styling. */
function WorkedExampleCaption() {
  const t = useT();
  const expr = t("rules.scoring.expr");
  const [before, after = ""] = t("rules.scoring.exampleBody", { expr }).split(expr);
  return (
    <p className="mt-2 font-ui text-[12.5px] leading-relaxed text-paper-300">
      {before}
      <span className="tnums font-mono text-brass-300">{expr}</span>
      {after}
    </p>
  );
}

/**
 * /rules — Le registre du club (design/rules.md). Contenu des règles intact ;
 * habillage « registre » : panneau texture-ledger, rail sommaire sticky avec
 * scroll-spy et progression, recherche live avec surbrillance, drawer mobile,
 * styles d'impression. Motion : Framer Motion sobre uniquement (design.md §5)
 * — Lenis/GSAP n'ont plus cours ici.
 */
export default function Rules() {
  const t = useT();
  const reduced = useReducedMotion();
  const { hash } = useLocation();
  const [activeId, setActiveId] = useState(() => getChapters()[0].id);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<string[] | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const chapters = getChapters().map((c, i) => ({
    id: c.id,
    num: String(i + 1).padStart(2, "0"),
    title: c.title,
  }));
  const quickSteps = getQuickSteps();
  const glossary = getGlossary();
  const approximations = getApproximations();
  const statusLabels: Record<Fidelity, string> = {
    faithful: t("rules.status.faithful"),
    approximate: t("rules.status.approximate"),
    planned: t("rules.status.planned"),
  };

  /* Deep links from Home/Setup/Game (/rules#market etc.) — immediate scroll */
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector(hash);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [hash]);

  /* Scroll-spy — the active chapter lights the summary rail */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId((e.target as HTMLElement).dataset.chapter!);
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  /* Live search — narrows the summary to chapters whose content matches.
   * Computed in the change handler (the ledger DOM is the search index). */
  const onSearch = useCallback((value: string) => {
    setQuery(value);
    const q = norm(value.trim());
    if (!q) {
      setMatches(null);
      return;
    }
    setMatches(
      getChapters()
        .map((c) => c.id)
        .filter((id) => {
          const el = document.getElementById(id);
          return el ? norm(el.textContent ?? "").includes(q) : false;
        }),
    );
  }, []);

  const onNavigate = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      // search: highlight the first matching paragraph for 1.6s
      const q = norm(query.trim());
      if (!q) return;
      let hit: HTMLElement = el;
      for (const c of Array.from(el.querySelectorAll<HTMLElement>("p, li, td, dd, caption"))) {
        if (norm(c.textContent ?? "").includes(q)) {
          hit = c;
          break;
        }
      }
      hit.classList.remove("rules-hit");
      void hit.offsetWidth; // restart the fade animation
      hit.classList.add("rules-hit");
      window.setTimeout(() => hit.classList.remove("rules-hit"), 1700);
    },
    [query, reduced],
  );

  /* Heading anchor — copies a shareable /rules#id link */
  const onCopyAnchor = useCallback(
    (id: string) => {
      const url = `${window.location.origin}/rules#${id}`;
      if (navigator.clipboard) void navigator.clipboard.writeText(url).catch(() => {});
      window.history.replaceState(null, "", `#${id}`);
      setToast({ id: Date.now(), message: t("platform.rules.linkCopied"), kind: "success" });
    },
    [t],
  );

  return (
    <div className="relative">
      <RulesStyle />

      {/* the register opens like the other two reading rooms, through the
          shared page head; the search and the tickets sit in its aside */}
      <PageShell
        eyebrow={t("platform.rules.eyebrow")}
        title={t("platform.rules.title")}
        lede={t("platform.rules.lede")}
        aside={
          <div className="rules-print-hide flex flex-col gap-2">
            <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center">
              <label className="relative block min-[640px]:w-[260px]">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-iron-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => onSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && query) onSearch("");
                  }}
                  placeholder={t("platform.rules.searchPlaceholder")}
                  aria-label={t("platform.rules.searchAria")}
                  aria-describedby="rules-search-count"
                  className="h-10 w-full border border-brass-hairline-strong bg-enamel-850 pl-9 pr-10 font-ui text-[14px] text-paper-100 placeholder:text-iron-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => onSearch("")}
                    aria-label={t("platform.rules.clear")}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-iron-400 transition-colors duration-150 hover:text-paper-100"
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </label>
              <Link to="/online" className="gz-ticket">
                <Play aria-hidden />
                {t("platform.nav.play")}
              </Link>
            </div>
            {/* a fixed line: an empty count has no baseline, and aligning on
                one nudged the whole aside 5px each time the count appeared */}
            <div className="flex h-4 items-center justify-between gap-4">
              {/* what the search found, said aloud as it narrows */}
              <p id="rules-search-count" aria-live="polite" className="data-text leading-4 text-iron-400">
                {matches ? t("platform.rules.matches", { n: matches.length, total: chapters.length }) : ""}
              </p>
              <Link
                to="/cours"
                className="font-ui text-[10.5px] font-semibold uppercase leading-4 tracking-label text-brass-500 transition-colors duration-150 hover:text-paper-100"
              >
                {t("platform.rules.programme")} →
              </Link>
            </div>
          </div>
        }
      >
        <div className="min-[900px]:grid min-[900px]:grid-cols-12 min-[900px]:gap-6">
          {/* ------------------------- Sommaire ------------------------- */}
          <div className="min-[900px]:col-span-3">
            <IndexRail chapters={chapters} activeId={activeId} matches={matches} onNavigate={onNavigate} onClear={() => onSearch("")} />
          </div>

          {/* ------------------------- Le registre ------------------------- */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rules-ledger relative mt-8 overflow-hidden console px-6 py-8 min-[900px]:col-span-9 min-[900px]:mt-0 md:px-14 md:py-12"
          >
            {/* ledger paper texture at 45% — never above text */}
            <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-45" />

            <div className="relative">
              {/* --------------------- 01. Quickstart --------------------- */}
              <ChapterSection id="quickstart" numeral="01" title={t("rules.chapters.quickstart")} onCopyAnchor={onCopyAnchor}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickSteps.map((s, i) => (
                    <div
                      key={s.title}
                      className="flex gap-3 rounded-lg border border-brass-hairline bg-enamel-800 p-4"
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-600 bg-[rgb(var(--brass-plate))] text-[rgb(var(--ink-on-brass))]">
                        <RulesIcon icon={s.icon} className="h-[18px] w-[18px]" />
                        <span className="tnums absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-lacquer-950 font-mono text-[10.5px] font-semibold text-paper-100 ring-1 ring-brass-hairline">
                          {i + 1}
                        </span>
                      </span>
                      <span>
                        <span className="block font-ui text-[14px] font-semibold text-paper-100">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block font-ui text-[13px] leading-relaxed text-paper-300">
                          {s.body}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="flex items-center gap-3 font-ui text-[13px] text-paper-300">
                  <img src="/card-back.webp" alt="" className="h-14 w-10 rounded-sm border border-brass-hairline" />
                  {t("rules.quickstart.note")}
                </p>
              </ChapterSection>

              {/* ----------------------- 02. Eras ----------------------- */}
              <ChapterSection id="eras" numeral="02" title={t("rules.chapters.eras")} onCopyAnchor={onCopyAnchor}>
                <div>
                  <div className="overflow-hidden rounded-lg border border-brass-hairline">
                    <img src="/era-canal-banner.webp" alt={t("rules.eras.canalAlt")} className="block h-16 w-full object-cover md:h-20" />
                  </div>
                  <h3 className="mt-3 font-fraunces text-[15px] font-medium leading-[1.3] text-bottle-ink">
                    {t("rules.eras.canalTitle")}
                  </h3>
                  <p className="mt-1">{t("rules.eras.canalBody")}</p>
                </div>

                <Ornament />

                <div>
                  <div className="overflow-hidden rounded-lg border border-brass-hairline">
                    <img src="/era-rail-banner.webp" alt={t("rules.eras.railAlt")} className="block h-16 w-full object-cover md:h-20" />
                  </div>
                  <h3 className="mt-3 font-fraunces text-[15px] font-medium leading-[1.3] text-rust-400">
                    {t("rules.eras.railTitle")}
                  </h3>
                  <p className="mt-1">{t("rules.eras.railBody")}</p>
                </div>

                <div className="rounded-lg border-l-[3px] border-rust-600/70 bg-lacquer-950 p-4">
                  <p className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.18em] text-rust-400">
                    {t("rules.eras.betweenTitle")}
                  </p>
                  <p className="mt-1 font-ui text-[14px] text-paper-300">
                    {t("rules.eras.betweenBody")}
                  </p>
                </div>
              </ChapterSection>

              {/* ---------------------- 03. Actions ---------------------- */}
              <ChapterSection id="actions" numeral="03" title={t("rules.chapters.actions")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.actionsIntro")}</p>
                <ActionsAccordion />
              </ChapterSection>

              {/* -------------------- 04. Industries -------------------- */}
              <ChapterSection id="industries" numeral="04" title={t("rules.chapters.industries")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.industriesIntro")}</p>
                <IndustryTabs />
              </ChapterSection>

              {/* ---------------------- 05. Network ---------------------- */}
              <ChapterSection id="network" numeral="05" title={t("rules.chapters.network")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.network.intro")}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md border border-bottle-500/40 bg-bottle-500/10 px-3 py-2 font-mono text-[12.5px] text-paper-100">
                    <img src="/icon-canal.svg" alt="" className="h-4 w-4 [html[data-theme=dark]_&]:[filter:brightness(0)_invert(0.85)]" />
                    {t("rules.network.canalChip")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md border border-rust-600/40 bg-rust-600/10 px-3 py-2 font-mono text-[12.5px] text-paper-100">
                    <img src="/icon-rail.svg" alt="" className="h-4 w-4 [html[data-theme=dark]_&]:[filter:brightness(0)_invert(0.85)]" />
                    {t("rules.network.railChip")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md border border-rust-600/40 bg-rust-600/10 px-3 py-2 font-mono text-[12.5px] text-paper-100">
                    {t("rules.network.doubleRailChip")}
                  </span>
                </div>
                <p>{t("rules.network.outro")}</p>
              </ChapterSection>

              {/* ---------------------- 06. Supply ---------------------- */}
              <ChapterSection id="supply" numeral="06" title={t("rules.chapters.supply")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.supply.intro")}</p>
                <SupplyDiagram />
                <p className="font-ui text-[13px] text-paper-300">{t("rules.supply.note")}</p>
              </ChapterSection>

              {/* ---------------------- 07. Market ---------------------- */}
              <ChapterSection id="market" numeral="07" title={t("rules.chapters.market")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.market.p1")}</p>
                <MarketTrayMock />
                <p>{t("rules.market.p2")}</p>
              </ChapterSection>

              {/* ---------------------- 08. Selling ---------------------- */}
              <ChapterSection id="selling" numeral="08" title={t("rules.chapters.selling")} onCopyAnchor={onCopyAnchor}>
                <div className="grid items-start gap-6 min-[1100px]:grid-cols-[1fr_180px]">
                  <div className="space-y-4">
                    <p>{t("rules.selling.intro")}</p>
                    <ul className="space-y-1 font-ui text-[14px]">
                      <li>{t("rules.selling.li1")}</li>
                      <li>{t("rules.selling.li2")}</li>
                      <li>{t("rules.selling.li3")}</li>
                    </ul>
                    <p>{t("rules.selling.choice")}</p>
                  </div>
                  <TileFlipMock />
                </div>
              </ChapterSection>

              {/* ----------------------- 09. Money ----------------------- */}
              <ChapterSection id="money" numeral="09" title={t("rules.chapters.money")} onCopyAnchor={onCopyAnchor}>
                <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
                  <MoneyLadder />
                  <div className="space-y-4">
                    <p>{t("rules.money.intro")}</p>
                    <ul className="space-y-1 font-ui text-[14px]">
                      <li>{t("rules.money.li1")}</li>
                      <li>{t("rules.money.li2")}</li>
                      <li>{t("rules.money.li3")}</li>
                    </ul>
                    <p>{t("rules.money.develop")}</p>
                  </div>
                </div>
              </ChapterSection>

              {/* ---------------------- 10. Scoring ---------------------- */}
              <ChapterSection id="scoring" numeral="10" title={t("rules.chapters.scoring")} onCopyAnchor={onCopyAnchor}>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-brass-hairline-strong">
                      <th scope="col" className="micro-label px-2 pb-2 text-brass-500">{t("rules.scoring.thSource")}</th>
                      <th scope="col" className="micro-label px-2 pb-2 text-brass-500">{t("rules.scoring.thCounts")}</th>
                      <th scope="col" className="micro-label px-2 pb-2 text-brass-500">{t("rules.scoring.thWhen")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-ui text-[13px] text-paper-300">
                    <tr className="border-b border-[rgb(var(--paper-100)/.08)]">
                      <td className="px-2 py-2 font-ui text-[14px] font-semibold text-paper-100">{t("rules.scoring.r1s")}</td>
                      <td className="tnums px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r1c")}</td>
                      <td className="px-2 py-2">{t("rules.scoring.r1w")}</td>
                    </tr>
                    <tr className="border-b border-[rgb(var(--paper-100)/.08)]">
                      <td className="px-2 py-2 font-ui text-[14px] font-semibold text-paper-100">{t("rules.scoring.r2s")}</td>
                      <td className="tnums px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r2c")}</td>
                      <td className="px-2 py-2">{t("rules.scoring.r2w")}</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-2 font-ui text-[14px] font-semibold text-paper-100">{t("rules.scoring.r3s")}</td>
                      <td className="tnums px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r3c")}</td>
                      <td className="px-2 py-2">{t("rules.scoring.r3w")}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="rounded-lg border border-brass-hairline bg-lacquer-950 p-4">
                  <p className="micro-label mb-3 text-iron-400">{t("rules.scoring.exampleTitle")}</p>
                  <ScoringSketch />
                  <WorkedExampleCaption />
                </div>
              </ChapterSection>

              {/* ---------------------- 11. Glossary ---------------------- */}
              <ChapterSection id="glossary" numeral="11" title={t("rules.chapters.glossary")} onCopyAnchor={onCopyAnchor}>
                <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                  {glossary.map((g) => (
                    <div key={g.term} className="border-b border-[rgb(var(--paper-100)/.08)] pb-3">
                      <dt className="font-ui text-[14px] font-semibold text-paper-100">{g.term}</dt>
                      <dd className="mt-1 font-ui text-[13px] leading-relaxed text-paper-300">{g.def}</dd>
                    </div>
                  ))}
                </dl>
              </ChapterSection>

              {/* ------------------ 12. Approximations ------------------ */}
              <ChapterSection id="approximations" numeral="12" title={t("rules.chapters.approximations")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.approx.intro")}</p>
                {/* the ledger of fidelity keeps the page's own rules — rust is
                    the rail and the ember, not a state — and its stamps share
                    one column, whatever the width of the word in each tongue */}
                <div className="border border-[var(--gz-ink-soft)]">
                  <ul className="divide-y divide-[var(--gz-ink-faint)] sm:grid sm:grid-cols-[max-content_1fr]">
                    {approximations.map((a) => (
                      <li key={a.area} className="flex flex-col gap-2 px-4 py-3 sm:col-span-2 sm:grid sm:grid-cols-subgrid sm:items-baseline sm:gap-x-4">
                        <span
                          className={`inline-flex w-fit shrink-0 items-center rounded-sm border px-2 py-0.5 font-ui text-[10.5px] font-semibold uppercase tracking-label ${STATUS_STYLES[a.status]}`}
                        >
                          {statusLabels[a.status]}
                        </span>
                        <span>
                          <span className="font-ui text-[14px] font-semibold text-paper-100">{a.area}</span>
                          <span className="mt-0.5 block font-ui text-[13px] leading-relaxed text-paper-300">{a.note}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* The Clockwork Club — bot note with beta ribbon, deep-link target */}
                <div id="bots" className="relative scroll-mt-24 overflow-hidden rounded-lg border border-brass-hairline bg-enamel-800 p-4">
                  <span className="beta-ribbon">{t("rules.approx.botsRibbon")}</span>
                  <h3 className="title-card">
                    {t("rules.approx.botsTitle")}
                  </h3>
                  <p className="mt-1 font-ui text-[13px] leading-relaxed text-paper-300">
                    {t("rules.approx.botsBody1")}
                    <strong className="text-paper-100">{t("setup.persona.boulton.label")}</strong>
                    {t("rules.approx.botsBody2")}
                    <strong className="text-paper-100">{t("setup.persona.wedgwood.label")}</strong>
                    {t("rules.approx.botsBody3")}
                    <strong className="text-paper-100">{t("setup.persona.watt.label")}</strong>
                    {t("rules.approx.botsBody4")}
                    <strong className="text-paper-100">{t("setup.persona.arkwright.label")}</strong>
                    {t("rules.approx.botsBody5")}
                  </p>
                </div>
              </ChapterSection>

              <Ornament className="mt-14" />
              <p className="micro-label mt-6 text-center text-iron-400">{t("rules.finis")}</p>
            </div>
          </motion.div>
        </div>

        {/* --------------------- Pied du registre --------------------- */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.25, once: true }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="rules-print-hide mt-12 flex min-h-[88px] flex-col gap-4 border border-[var(--gz-ink-faint)] px-6 py-5 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
        >
          <p className="h2-section">{t("platform.rules.ready")}</p>
          {/* the house's tickets, as on the evening course — not the form
              buttons, which drew the same departure a second way */}
          <div className="flex flex-wrap gap-3">
            <Link to="/online" className="gz-ticket gz-ticket-brass">
              <Play aria-hidden />
              {t("platform.action.playNow")}
            </Link>
            <Link to="/setup" className="gz-ticket">
              <Plus aria-hidden />
              {t("platform.action.createTable")}
            </Link>
          </div>
        </motion.div>
      </PageShell>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
