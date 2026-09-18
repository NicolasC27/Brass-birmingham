import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Plus, Search } from "lucide-react";

import { useT } from "@/i18n";
import Button from "@/components/platform/Button";
import Toast from "@/components/platform/Toast";
import type { ToastData } from "@/components/platform/Toast";
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
  approximate: "border-brass-500/60 bg-brass-500/10 text-brass-300",
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
            <span className="tnums font-mono text-[9.5px] text-brass-500">£{i + 1}</span>
            {i >= 2 ? (
              <span className="mt-0.5 h-3 w-3 rounded-full bg-ink-900 ring-1 ring-paper-100/40" />
            ) : (
              <span className="mt-0.5 h-3 w-3 rounded-full border border-dashed border-paper-100/20" />
            )}
          </div>
        ))}
        <span className="ml-2 rounded bg-brass-500 px-2 py-1 font-mono text-[11px] font-semibold text-ink-900">
          {t("rules.marketTray.buy")}
        </span>
      </div>
      <p className="mt-2 font-ui text-[11px] text-iron-400">{t("rules.marketTray.caption")}</p>
    </div>
  );
}

/** Worked scoring sketch for chapter 10. */
function ScoringSketch() {
  const t = useT();
  return (
    <svg
      viewBox="0 0 360 130"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={t("rules.scoringSketch.aria")}
    >
      <circle cx={60} cy={56} r={26} fill="rgb(var(--enamel-800))" stroke="#8F6B23" strokeWidth={1.5} />
      <text x={60} y={60} textAnchor="middle" fontSize={11} fill="rgb(var(--paper-100))" fontFamily="Inter, sans-serif">
        Dudley
      </text>
      <circle cx={250} cy={56} r={26} fill="rgb(var(--enamel-800))" stroke="#8F6B23" strokeWidth={1.5} />
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
      <path d="M 86 56 C 140 40, 180 72, 224 58" fill="none" stroke="#C9A45C" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={140} y={10} width={52} height={18} rx={4} fill="rgb(var(--enamel-850))" stroke="#C9A45C" />
      <text x={166} y={23} textAnchor="middle" fontSize={10} fill="var(--rd-brass, #C9A45C)" fontFamily="'IBM Plex Mono', monospace">{t("rules.scoringSketch.link")}</text>
      <text x={320} y={60} textAnchor="middle" fontSize={13} fill="rgb(var(--paper-100))" fontFamily="'IBM Plex Mono', monospace">
        = 10
      </text>
      <text x={320} y={78} textAnchor="middle" fontSize={8.5} fill="rgb(var(--iron-400))" fontFamily="Inter, sans-serif">
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
    <p className="mt-2 font-ui text-[12px] leading-relaxed text-paper-300">
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

  const headerReveal = (i: number) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: "easeOut" as const, delay: reduced ? 0 : i * 0.06 },
  });

  return (
    <div className="relative">
      <RulesStyle />

      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
        {/* --------------------- En-tête du registre --------------------- */}
        <header className="flex flex-col gap-6 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between">
          <div>
            <motion.p {...headerReveal(0)} className="micro-label text-brass-400">
              {t("platform.rules.eyebrow")}
            </motion.p>
            <motion.h1 {...headerReveal(1)} className="display-page mt-2">
              {t("platform.rules.title")}
            </motion.h1>
            <motion.p {...headerReveal(2)} className="mt-2 max-w-[52ch] font-ui text-[15px] leading-relaxed text-paper-300">
              {t("platform.rules.lede")}
            </motion.p>
          </div>
          <motion.div {...headerReveal(3)} className="rules-print-hide flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center">
            <label className="relative block min-[640px]:w-[260px]">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-iron-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t("platform.rules.searchPlaceholder")}
                aria-label={t("platform.rules.searchAria")}
                className="h-10 w-full rounded-lg border border-brass-hairline bg-enamel-850 pl-9 pr-3 font-ui text-[14px] text-paper-100 placeholder:text-iron-600 focus-visible:outline-2 focus-visible:outline-signal-400"
              />
            </label>
            <Button variant="ghost" to="/online" icon={<Play size={16} aria-hidden />}>
              {t("platform.nav.play")}
            </Button>
          </motion.div>
        </header>

        <div className="mt-10 min-[900px]:grid min-[900px]:grid-cols-12 min-[900px]:gap-6">
          {/* ------------------------- Sommaire ------------------------- */}
          <div className="min-[900px]:col-span-3">
            <IndexRail chapters={chapters} activeId={activeId} matches={matches} onNavigate={onNavigate} />
          </div>

          {/* ------------------------- Le registre ------------------------- */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rules-ledger relative mt-8 overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850 px-6 py-8 min-[900px]:col-span-9 min-[900px]:mt-0 md:px-14 md:py-12"
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
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-600 bg-gradient-to-br from-brass-300 via-brass-500 to-brass-600 text-ink-900">
                        <RulesIcon icon={s.icon} className="h-[18px] w-[18px]" />
                        <span className="tnums absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-lacquer-950 font-mono text-[9px] font-semibold text-paper-100 ring-1 ring-brass-hairline">
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
                <p className="flex items-center gap-3 font-ui text-[13px] text-iron-400">
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
                  <h3 className="mt-3 font-ui text-[15px] font-semibold text-bottle-400">
                    {t("rules.eras.canalTitle")}
                  </h3>
                  <p className="mt-1">{t("rules.eras.canalBody")}</p>
                </div>

                <Ornament />

                <div>
                  <div className="overflow-hidden rounded-lg border border-brass-hairline">
                    <img src="/era-rail-banner.webp" alt={t("rules.eras.railAlt")} className="block h-16 w-full object-cover md:h-20" />
                  </div>
                  <h3 className="mt-3 font-ui text-[15px] font-semibold text-rust-400">
                    {t("rules.eras.railTitle")}
                  </h3>
                  <p className="mt-1">{t("rules.eras.railBody")}</p>
                </div>

                <div className="rounded-lg border-l-[3px] border-rust-600/70 bg-lacquer-950 p-4">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-rust-400">
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
                  <span className="inline-flex items-center gap-2 rounded-md border border-bottle-500/40 bg-bottle-500/10 px-3 py-2 font-mono text-[12px] text-paper-100">
                    <img src="/icon-canal.svg" alt="" className="h-4 w-4 [filter:brightness(0)_invert(0.85)]" />
                    {t("rules.network.canalChip")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md border border-rust-600/40 bg-rust-600/10 px-3 py-2 font-mono text-[12px] text-paper-100">
                    <img src="/icon-rail.svg" alt="" className="h-4 w-4 [filter:brightness(0)_invert(0.85)]" />
                    {t("rules.network.railChip")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md border border-rust-600/40 bg-rust-600/10 px-3 py-2 font-mono text-[12px] text-paper-100">
                    {t("rules.network.doubleRailChip")}
                  </span>
                </div>
                <p>{t("rules.network.outro")}</p>
              </ChapterSection>

              {/* ---------------------- 06. Supply ---------------------- */}
              <ChapterSection id="supply" numeral="06" title={t("rules.chapters.supply")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.supply.intro")}</p>
                <SupplyDiagram />
                <p className="font-ui text-[13px] text-iron-400">{t("rules.supply.note")}</p>
              </ChapterSection>

              {/* ---------------------- 07. Market ---------------------- */}
              <ChapterSection id="market" numeral="07" title={t("rules.chapters.market")} onCopyAnchor={onCopyAnchor}>
                <p>{t("rules.market.p1")}</p>
                <MarketTrayMock />
                <p>{t("rules.market.p2")}</p>
              </ChapterSection>

              {/* ---------------------- 08. Selling ---------------------- */}
              <ChapterSection id="selling" numeral="08" title={t("rules.chapters.selling")} onCopyAnchor={onCopyAnchor}>
                <div className="grid items-start gap-6 md:grid-cols-[1fr_auto]">
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
                  <tbody className="font-ui text-[13.5px] text-paper-300">
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
                <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
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
                <div className="overflow-hidden rounded-lg border border-[rgb(var(--rust-600)/.35)] bg-[rgb(var(--rust-600)/.05)]">
                  <ul className="divide-y divide-[rgb(var(--rust-600)/.18)]">
                    {approximations.map((a) => (
                      <li key={a.area} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                        <span
                          className={`inline-flex w-fit shrink-0 items-center rounded-sm border px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[a.status]}`}
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
                  <h3 className="font-ui text-[15px] font-semibold text-paper-100">
                    {t("rules.approx.botsTitle")}
                  </h3>
                  <p className="mt-1 font-ui text-[13.5px] leading-relaxed text-paper-300">
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
          className="rules-print-hide mt-12 flex min-h-[88px] flex-col gap-4 rounded-xl border border-[rgb(var(--paper-100)/.14)] px-6 py-5 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
        >
          <p className="font-fraunces text-[20px] font-semibold text-paper-100">
            {t("platform.rules.ready")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" to="/online" icon={<Play size={16} aria-hidden />}>
              {t("platform.action.playNow")}
            </Button>
            <Button variant="ghost" to="/setup" icon={<Plus size={16} aria-hidden />}>
              {t("platform.action.createTable")}
            </Button>
          </div>
        </motion.div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
