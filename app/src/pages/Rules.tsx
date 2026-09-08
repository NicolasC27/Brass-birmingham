import { useCallback, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useLocation } from "react-router";

import { useT } from "@/i18n";
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

gsap.registerPlugin(ScrollTrigger);

const isReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const STATUS_STYLES: Record<Fidelity, string> = {
  faithful: "border-bottle-600 bg-bottle-600 text-cream-100",
  approximate: "border-brass-700 bg-brass-500 text-ink-900",
  planned: "border-rust-500 bg-transparent text-rust-500",
};

/** Ornamental divider — brass rule with a centered gear diamond (paper-safe). */
function Ornament({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="rules-orn relative mx-auto h-px w-56 origin-center bg-gradient-to-r from-transparent via-brass-700/80 to-transparent">
        <span className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brass-700 shadow-[0_0_0_4px_#F2EAD6]" />
      </div>
    </div>
  );
}

/** Static market-tray mock for Chapter VII — div-based, mono prices. */
function MarketTrayMock() {
  const t = useT();
  return (
    <div className="rounded-lg border border-brass-700/50 bg-coal-900 p-4 shadow-e2">
      <p className="font-fell text-[12px] uppercase tracking-[0.18em] text-cream-100/70">
        {t("rules.marketTray.title")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={
              i === 2
                ? "flex h-11 w-11 flex-col items-center justify-center rounded border-2 border-brass-400 bg-coal-700 shadow-[0_0_12px_rgba(201,164,92,0.35)]"
                : "flex h-11 w-11 flex-col items-center justify-center rounded border border-brass-700/50 bg-coal-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            }
          >
            <span className="font-mono text-[9.5px] text-brass-500">£{i + 1}</span>
            {i < 2 ? (
              <span className="mt-0.5 h-3 w-3 rounded-full bg-ink-900 ring-1 ring-cream-100/40" />
            ) : (
              <span className="mt-0.5 h-3 w-3 rounded-full border border-dashed border-cream-100/20" />
            )}
          </div>
        ))}
        <span className="ml-2 rounded bg-brass-500 px-2 py-1 font-mono text-[11px] font-semibold text-ink-900">
          {t("rules.marketTray.buy")}
        </span>
      </div>
      <p className="mt-2 font-sans text-[11px] text-cream-100/55">
        {t("rules.marketTray.caption")}
      </p>
    </div>
  );
}

/** Worked scoring sketch for Chapter X. */
function ScoringSketch() {
  const t = useT();
  return (
    <svg
      viewBox="0 0 360 130"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={t("rules.scoringSketch.aria")}
    >
      <circle cx={60} cy={56} r={26} fill="#211C17" stroke="#8A6B33" strokeWidth={1.5} />
      <text x={60} y={60} textAnchor="middle" fontSize={11} fill="#F2EAD6" fontFamily="'IM Fell English SC', Georgia, serif">
        Dudley
      </text>
      <circle cx={250} cy={56} r={26} fill="#211C17" stroke="#8A6B33" strokeWidth={1.5} />
      <text x={250} y={60} textAnchor="middle" fontSize={11} fill="#F2EAD6" fontFamily="'IM Fell English SC', Georgia, serif">
        B’ham
      </text>
      {/* flipped ember tiles */}
      <g>
        <rect x={96} y={22} width={34} height={24} rx={3} fill="#211C17" stroke="#A6562B" strokeWidth={1.5} />
        <text x={113} y={38} textAnchor="middle" fontSize={11} fill="#A6562B" fontFamily="'IBM Plex Mono', monospace">2</text>
        <rect x={176} y={66} width={34} height={24} rx={3} fill="#211C17" stroke="#A6562B" strokeWidth={1.5} />
        <text x={193} y={82} textAnchor="middle" fontSize={11} fill="#A6562B" fontFamily="'IBM Plex Mono', monospace">5</text>
      </g>
      {/* the link */}
      <path d="M 86 56 C 140 40, 180 72, 224 58" fill="none" stroke="#C9A45C" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={140} y={10} width={52} height={18} rx={4} fill="#171310" stroke="#C9A45C" />
      <text x={166} y={23} textAnchor="middle" fontSize={10} fill="#C9A45C" fontFamily="'IBM Plex Mono', monospace">{t("rules.scoringSketch.link")}</text>
      <text x={320} y={60} textAnchor="middle" fontSize={13} fill="#241D14" fontFamily="'IBM Plex Mono', monospace">
        = 10
      </text>
      <text x={320} y={78} textAnchor="middle" fontSize={8.5} fill="#241D14" opacity={0.65} fontFamily="'IM Fell English SC', Georgia, serif">
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
    <p className="mt-2 font-sans text-[12px] leading-relaxed text-cream-100/65">
      {before}
      <span className="font-mono text-brass-400">{expr}</span>
      {after}
    </p>
  );
}

/**
 * /rules — The Midlands Compendium (rules.md). An inverted paper sheet on
 * parchment with ink typography, sticky engraved index rail with scroll-spy,
 * accordion action reference, tabbed industry tables, and the interactive
 * supply-logic diagram. Lenis + GSAP on this page only, with full
 * reduced-motion fallbacks.
 */
export default function Rules() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [activeId, setActiveId] = useState(() => getChapters()[0].id);
  const { hash } = useLocation();

  const chapters = getChapters();
  const quickSteps = getQuickSteps();
  const glossary = getGlossary();
  const approximations = getApproximations();
  const statusLabels: Record<Fidelity, string> = {
    faithful: t("rules.status.faithful"),
    approximate: t("rules.status.approximate"),
    planned: t("rules.status.planned"),
  };

  /* Lenis smooth scroll (page-scoped), skipped entirely under reduced motion */
  useEffect(() => {
    if (isReduced()) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  /* Deep links from Home/Setup/Game (/rules#market etc.) */
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(hash);
      if (!el) return;
      if (lenisRef.current) lenisRef.current.scrollTo(el as HTMLElement, { offset: -80, duration: 0.6 });
      else (el as HTMLElement).scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [hash]);

  /* Scroll-spy — the active chapter lights the index rail */
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

  const onNavigate = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { offset: -80, duration: 0.45 });
    } else {
      el.scrollIntoView({ block: "start", behavior: isReduced() ? "auto" : "smooth" });
    }
  }, []);

  /* GSAP choreography: hero load-in, chapter reveals, era banner clips,
     era glyph crossing. All initial states are set by GSAP only, so
     reduced-motion readers see the page fully rendered. */
  useGSAP(
    () => {
      if (isReduced()) return;

      // Title page entrance
      const intro = gsap.timeline({ defaults: { ease: "power2.out" } });
      intro
        .from(".rules-sheet", { y: 30, opacity: 0, duration: 0.7 })
        .from(".rules-title-w", { y: 22, opacity: 0, duration: 0.5, stagger: 0.07 }, "-=0.35")
        .from(".rules-orn", { scaleX: 0, duration: 0.6, ease: "power3.out" }, "-=0.2")
        .from(".rules-hero-foot", { y: 14, opacity: 0, duration: 0.4 }, "-=0.3")
        .from(".rules-rail", { x: 24, opacity: 0, duration: 0.5 }, "-=0.35");

      // Chapter reveals: H2 word rise + underline draw, body fade-rise stagger
      gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((sec) => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: sec, start: "top 75%", once: true },
          defaults: { ease: "power2.out" },
        });
        tl.from(sec.querySelectorAll(".rules-h2w"), { y: 18, opacity: 0, duration: 0.4, stagger: 0.04 })
          .from(sec.querySelector(".rules-h2line"), { scaleX: 0, duration: 0.55, ease: "power3.out" }, "-=0.2")
          .from(sec.querySelectorAll(".rules-body > *"), { y: 16, opacity: 0, duration: 0.45, stagger: 0.06 }, "-=0.35");
        const medallions = sec.querySelectorAll(".rules-medallion");
        if (medallions.length) {
          tl.from(medallions, { scale: 0.4, opacity: 0, duration: 0.45, ease: "back.out(2.2)", stagger: 0.08 }, "-=0.5");
        }
      });

      // Era banners clip-reveal from center
      gsap.utils.toArray<HTMLElement>(".rules-era-banner").forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(0% 50% 0% 50%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1,
            ease: "power3.inOut",
            scrollTrigger: { trigger: el, start: "top 70%", once: true },
          },
        );
      });

      // Narrowboat → locomotive crossing flourish (scrubbed, not pinned)
      const crossing = root.current?.querySelector(".rules-era-crossing");
      if (crossing) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: crossing, start: "top 85%", end: "top 30%", scrub: 0.6 },
        });
        tl.fromTo(".rules-cross-glyph", { left: "4%" }, { left: "88%", ease: "none", duration: 1 }, 0)
          .to(".rules-cross-boat", { opacity: 0, duration: 0.15, ease: "none" }, 0.45)
          .fromTo(".rules-cross-train", { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" }, 0.45);
      }
    },
    { scope: root },
  );

  const titleWords = t("rules.hero.title").split(" ");

  return (
    <div ref={root} className="relative min-h-[100dvh] bg-coal-950">
      <RulesStyle />
      {/* soot texture on the surround at 5% */}
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.05]" />

      <div className="relative mx-auto max-w-[1120px] px-4 pb-24 pt-6 md:px-6 lg:flex lg:items-start lg:gap-8">
        <IndexRail chapters={chapters} activeId={activeId} onNavigate={onNavigate} />

        {/* ------------------------------ Paper sheet ------------------------------ */}
        <div className="rules-sheet paper relative mt-4 w-full max-w-[760px] px-6 py-10 shadow-e1 md:p-12 lg:mt-0 lg:flex-1">
          {/* paper grain at 12% — never above text */}
          <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-md opacity-[0.12]" />
          <span aria-hidden className="rules-corner rules-corner-tl" />
          <span aria-hidden className="rules-corner rules-corner-tr" />
          <span aria-hidden className="rules-corner rules-corner-bl" />
          <span aria-hidden className="rules-corner rules-corner-br" />

          <div className="relative">
            {/* --------------------------- Title page --------------------------- */}
            <header id="overview" className="scroll-mt-24 pb-4 pt-2 text-center">
              <img
                src="/logo-mark.svg"
                alt=""
                className="mx-auto h-14 w-14"
                style={{ filter: "brightness(0.22) contrast(1.15)" }}
              />
              <p className="mt-5 font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brass-700">
                {t("rules.hero.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-[40px] font-black leading-[1.02] tracking-[-0.01em] text-ink-900 md:text-[52px]">
                {titleWords.map((w, i) => (
                  <span key={i} className="rules-title-w inline-block">
                    {w}
                    {i < titleWords.length - 1 ? " " : ""}
                  </span>
                ))}
              </h1>
              <p className="mx-auto mt-4 max-w-[520px] font-fell text-[19px] leading-snug text-ink-900/75 md:text-[20px]">
                {t("rules.hero.lede")}
              </p>
              <Ornament className="mt-7" />
              <div className="rules-hero-foot mt-7 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => onNavigate("quickstart")} className="btn-strike">
                  {t("rules.chapters.quickstart")}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("eras")}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-brass-700/80 px-5 py-3 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-brass-700 transition-colors hover:bg-brass-500/15"
                >
                  {t("rules.hero.wholeOfIt")}
                </button>
              </div>
            </header>

            {/* --------------------------- I. Quickstart --------------------------- */}
            <ChapterSection id="quickstart" numeral="I." title={t("rules.chapters.quickstart")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickSteps.map((s, i) => (
                  <div
                    key={s.title}
                    className="flex gap-3 rounded-md border border-brass-700/45 bg-cream-100 p-4 shadow-[0_2px_5px_rgba(36,29,20,0.12)]"
                  >
                    <span className="rules-medallion relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-700 bg-gradient-to-br from-brass-400 via-brass-500 to-brass-700 text-ink-900 shadow-e2">
                      <RulesIcon icon={s.icon} className="h-[18px] w-[18px]" />
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink-900 font-mono text-[9px] font-semibold text-cream-100">
                        {i + 1}
                      </span>
                    </span>
                    <span>
                      <span className="block font-fell text-[15px] uppercase tracking-[0.07em] text-ink-900">
                        {s.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-900/75">
                        {s.body}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-3 text-[13px] italic text-ink-900/60">
                <img src="/card-back.webp" alt="" className="h-14 w-10 rounded-sm border border-brass-700/40 shadow-e2" />
                {t("rules.quickstart.note")}
              </p>
            </ChapterSection>

            {/* --------------------------- II. Eras --------------------------- */}
            <ChapterSection id="eras" numeral="II." title={t("rules.chapters.eras")}>
              <div>
                <div className="rules-era-banner overflow-hidden rounded-md border border-brass-700/40 shadow-e2">
                  <img src="/era-canal-banner.webp" alt={t("rules.eras.canalAlt")} className="block h-16 w-full object-cover md:h-20" />
                </div>
                <h3 className="mt-3 font-fell text-[17px] uppercase tracking-[0.08em] text-bottle-800">
                  {t("rules.eras.canalTitle")}
                </h3>
                <p className="mt-1">
                  {t("rules.eras.canalBody")}
                </p>
              </div>

              {/* narrowboat → locomotive flourish */}
              <div className="rules-era-crossing relative h-10 overflow-hidden" aria-hidden>
                <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-bottle-600/50 via-brass-700/50 to-copper-500/50" />
                <span className="rules-cross-glyph absolute top-1/2 -translate-y-1/2">
                  <img src="/icon-canal.svg" alt="" className="rules-cross-boat h-6 w-6 text-ink-900" />
                  <img src="/icon-rail.svg" alt="" className="rules-cross-train absolute inset-0 h-6 w-6 text-ink-900" />
                </span>
              </div>

              <div>
                <div className="rules-era-banner overflow-hidden rounded-md border border-brass-700/40 shadow-e2">
                  <img src="/era-rail-banner.webp" alt={t("rules.eras.railAlt")} className="block h-16 w-full object-cover md:h-20" />
                </div>
                <h3 className="mt-3 font-fell text-[17px] uppercase tracking-[0.08em] text-copper-700">
                  {t("rules.eras.railTitle")}
                </h3>
                <p className="mt-1">
                  {t("rules.eras.railBody")}
                </p>
              </div>

              <div className="rounded-md border border-rust-500/70 bg-rust-500/[0.07] p-4">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-rust-500">
                  {t("rules.eras.betweenTitle")}
                </p>
                <p className="mt-1 text-[14px]">
                  {t("rules.eras.betweenBody")}
                </p>
              </div>
            </ChapterSection>

            {/* --------------------------- III. Actions --------------------------- */}
            <ChapterSection id="actions" numeral="III." title={t("rules.chapters.actions")}>
              <p>
                {t("rules.actionsIntro")}
              </p>
              <ActionsAccordion />
            </ChapterSection>

            {/* --------------------------- IV. Industries --------------------------- */}
            <ChapterSection id="industries" numeral="IV." title={t("rules.chapters.industries")}>
              <p>
                {t("rules.industriesIntro")}
              </p>
              <IndustryTabs />
            </ChapterSection>

            {/* --------------------------- V. Network --------------------------- */}
            <ChapterSection id="network" numeral="V." title={t("rules.chapters.network")}>
              <p>
                {t("rules.network.intro")}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-bottle-600/60 bg-bottle-600/10 px-3 py-2 font-mono text-[12px] text-ink-900">
                  <img src="/icon-canal.svg" alt="" className="h-4 w-4" /> {t("rules.network.canalChip")}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-copper-500/60 bg-copper-500/10 px-3 py-2 font-mono text-[12px] text-ink-900">
                  <img src="/icon-rail.svg" alt="" className="h-4 w-4" /> {t("rules.network.railChip")}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-copper-500/60 bg-copper-500/10 px-3 py-2 font-mono text-[12px] text-ink-900">
                  {t("rules.network.doubleRailChip")}
                </span>
              </div>
              <p>
                {t("rules.network.outro")}
              </p>
            </ChapterSection>

            {/* --------------------------- VI. Supply --------------------------- */}
            <ChapterSection id="supply" numeral="VI." title={t("rules.chapters.supply")}>
              <p>
                {t("rules.supply.intro")}
              </p>
              <SupplyDiagram />
              <p className="text-[13px] italic text-ink-900/65">
                {t("rules.supply.note")}
              </p>
            </ChapterSection>

            {/* --------------------------- VII. Market --------------------------- */}
            <ChapterSection id="market" numeral="VII." title={t("rules.chapters.market")}>
              <p>
                {t("rules.market.p1")}
              </p>
              <MarketTrayMock />
              <p>
                {t("rules.market.p2")}
              </p>
            </ChapterSection>

            {/* --------------------------- VIII. Selling --------------------------- */}
            <ChapterSection id="selling" numeral="VIII." title={t("rules.chapters.selling")}>
              <div className="grid items-start gap-6 md:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <p>
                    {t("rules.selling.intro")}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-[14px]">
                    <li>{t("rules.selling.li1")}</li>
                    <li>{t("rules.selling.li2")}</li>
                    <li>{t("rules.selling.li3")}</li>
                  </ul>
                  <p>
                    {t("rules.selling.choice")}
                  </p>
                </div>
                <TileFlipMock />
              </div>
            </ChapterSection>

            {/* --------------------------- IX. Money --------------------------- */}
            <ChapterSection id="money" numeral="IX." title={t("rules.chapters.money")}>
              <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
                <MoneyLadder />
                <div className="space-y-4">
                  <p>
                    {t("rules.money.intro")}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-[14px]">
                    <li>{t("rules.money.li1")}</li>
                    <li>{t("rules.money.li2")}</li>
                    <li>{t("rules.money.li3")}</li>
                  </ul>
                  <p>
                    {t("rules.money.develop")}
                  </p>
                </div>
              </div>
            </ChapterSection>

            {/* --------------------------- X. Scoring --------------------------- */}
            <ChapterSection id="scoring" numeral="X." title={t("rules.chapters.scoring")}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-brass-700/60">
                    <th scope="col" className="px-2 pb-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-700">{t("rules.scoring.thSource")}</th>
                    <th scope="col" className="px-2 pb-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-700">{t("rules.scoring.thCounts")}</th>
                    <th scope="col" className="px-2 pb-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-700">{t("rules.scoring.thWhen")}</th>
                  </tr>
                </thead>
                <tbody className="font-sans text-[13.5px]">
                  <tr className="border-b border-brass-700/25">
                    <td className="px-2 py-2 font-fell text-[14px]">{t("rules.scoring.r1s")}</td>
                    <td className="px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r1c")}</td>
                    <td className="px-2 py-2">{t("rules.scoring.r1w")}</td>
                  </tr>
                  <tr className="border-b border-brass-700/25">
                    <td className="px-2 py-2 font-fell text-[14px]">{t("rules.scoring.r2s")}</td>
                    <td className="px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r2c")}</td>
                    <td className="px-2 py-2">{t("rules.scoring.r2w")}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-fell text-[14px]">{t("rules.scoring.r3s")}</td>
                    <td className="px-2 py-2 font-mono text-[12.5px]">{t("rules.scoring.r3c")}</td>
                    <td className="px-2 py-2">{t("rules.scoring.r3w")}</td>
                  </tr>
                </tbody>
              </table>
              <div className="rounded-md border border-brass-700/45 bg-coal-900 p-4 shadow-e2">
                <p className="mb-2 font-fell text-[12px] uppercase tracking-[0.18em] text-cream-100/70">
                  {t("rules.scoring.exampleTitle")}
                </p>
                <ScoringSketch />
                <WorkedExampleCaption />
              </div>
            </ChapterSection>

            {/* --------------------------- XI. Glossary --------------------------- */}
            <ChapterSection id="glossary" numeral="XI." title={t("rules.chapters.glossary")}>
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                {glossary.map((g) => (
                  <div key={g.term} className="border-b border-brass-700/25 pb-3">
                    <dt className="font-fell text-[15px] uppercase tracking-[0.07em] text-ink-900">{g.term}</dt>
                    <dd className="mt-1 text-[13px] leading-relaxed text-ink-900/75">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </ChapterSection>

            {/* --------------------------- XII. Approximations --------------------------- */}
            <ChapterSection id="approximations" numeral="XII." title={t("rules.chapters.approximations")}>
              <p>
                {t("rules.approx.intro")}
              </p>
              <div className="overflow-hidden rounded-md border-2 border-rust-500/70 bg-rust-500/[0.05]">
                <ul className="divide-y divide-rust-500/25">
                  {approximations.map((a) => (
                    <li key={a.area} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                      <span
                        className={`inline-flex w-fit shrink-0 items-center rounded-sm border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[a.status]}`}
                      >
                        {statusLabels[a.status]}
                      </span>
                      <span>
                        <span className="font-fell text-[14px] uppercase tracking-[0.06em] text-ink-900">{a.area}</span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-900/75">{a.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* The Clockwork Club — bot note with beta ribbon, deep-link target */}
              <div id="bots" className="relative scroll-mt-24 overflow-hidden rounded-md border border-brass-700/45 bg-cream-100 p-4 shadow-[0_2px_5px_rgba(36,29,20,0.12)]">
                <span className="beta-ribbon">{t("rules.approx.botsRibbon")}</span>
                <h3 className="font-fell text-[16px] uppercase tracking-[0.08em] text-ink-900">
                  {t("rules.approx.botsTitle")}
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-900/80">
                  {t("rules.approx.botsBody1")}
                  <strong>Apprentice</strong>
                  {t("rules.approx.botsBody2")}
                  <strong>Foreman</strong>
                  {t("rules.approx.botsBody3")}
                  <strong>Baron</strong>
                  {t("rules.approx.botsBody4")}
                </p>
              </div>
            </ChapterSection>

            <Ornament className="mt-14" />
            <p className="mt-6 text-center font-fell text-[12px] uppercase tracking-[0.22em] text-ink-900/50">
              {t("rules.finis")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
