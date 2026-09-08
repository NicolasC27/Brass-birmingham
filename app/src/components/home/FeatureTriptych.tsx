import { useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

/* ---------------- Row 1 visual: miniature coal/iron market tray ---------------- */
function MarketTrayMini() {
  const t = useT();
  const prices = ["£1", "£2", "£3", "£4", "£5", "£6", "£7", "£8"];
  const coalCubes = [2, 3, 4, 5];
  const ironCubes = [3, 4, 5];
  return (
    <div className="space-y-4">
      {(
        [
          { name: t("home.triptych.market.coal"), cubes: coalCubes, tone: "bg-coal-950 border-coal-700" },
          { name: t("home.triptych.market.iron"), cubes: ironCubes, tone: "bg-copper-700 border-copper-500" },
        ] as const
      ).map((tray, ti) => (
        <div key={tray.name} className="flex items-center gap-3">
          <span className="w-12 font-fell text-sm uppercase tracking-[0.08em] text-cream-100/70">
            {tray.name}
          </span>
          <div className="flex flex-1 items-center gap-1.5">
            {prices.map((p, i) => {
              const filled = tray.cubes.includes(i);
              const current = i === (ti === 0 ? 1 : 2);
              return (
                <div
                  key={p}
                  className={cn(
                    "relative flex h-11 flex-1 flex-col items-center justify-center rounded-sm bg-coal-950/80",
                    "shadow-[inset_0_2px_5px_rgba(0,0,0,.7)]",
                    current && "ring-2 ring-brass-500 group-hover:animate-pulse-glow",
                  )}
                >
                  {filled && (
                    <span
                      className={cn(
                        "animate-bob-soft block h-4 w-4 rounded-full border",
                        tray.tone,
                        "shadow-[inset_0_1px_2px_rgba(242,234,214,.25),0_2px_3px_rgba(0,0,0,.5)]",
                      )}
                      style={{ animationDelay: `${(i + ti) * 0.35}s` }}
                    />
                  )}
                  <span className="absolute -bottom-4 font-mono text-[10px] text-brass-500/80">
                    {p}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="pt-4 text-right font-mono text-xs text-brass-400">{t("home.triptych.market.buy")}</p>
    </div>
  );
}

/* ---------------- Row 2 visual: era friezes with hover crossfade ---------------- */
function EraFriezes() {
  const t = useT();
  return (
    <div className="group/frieze relative">
      <div className="relative overflow-hidden rounded-sm border border-brass-700/50">
        <img
          src="/era-canal-banner.webp"
          alt={t("home.triptych.eras.canalAlt")}
          className="h-36 w-full object-cover transition-all group-hover/frieze:opacity-0"
          style={{ transitionDuration: "600ms" }}
        />
        <img
          src="/era-rail-banner.webp"
          alt={t("home.triptych.eras.railAlt")}
          className="absolute inset-0 h-36 w-full translate-x-2 object-cover opacity-0 transition-all group-hover/frieze:translate-x-0 group-hover/frieze:opacity-100"
          style={{ transitionDuration: "600ms" }}
        />
      </div>
      {/* torn-paper divider */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-fell text-xs uppercase tracking-[0.2em] text-bottle-600">
          {t("home.triptych.eras.canal")}
        </span>
        <svg viewBox="0 0 120 8" className="h-2 flex-1 text-cream-300/40" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 4 L8 2 L16 6 L26 3 L36 6 L48 2 L60 5 L72 3 L84 6 L96 2 L108 5 L120 4"
            stroke="currentColor"
            fill="none"
            strokeWidth="1.4"
          />
        </svg>
        <span className="font-fell text-xs uppercase tracking-[0.2em] text-copper-500">
          {t("home.triptych.eras.rail")}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Row 3 visual: mini map with self-tracing link ---------------- */
function MiniMapTrace() {
  const t = useT();
  return (
    <svg
      viewBox="0 0 360 200"
      className="h-44 w-full rounded-sm border border-brass-700/50 bg-cream-100"
      role="img"
      aria-label={t("home.triptych.map.aria")}
    >
      <rect width="360" height="200" fill="#F2EAD6" />
      <g opacity="0.5" stroke="#8A6B33" strokeWidth="1" fill="none">
        <path d="M 30 40 q 20 -12 40 0 M 290 150 q 18 -10 36 0 M 250 30 q 16 -9 32 0" />
      </g>
      {/* dashed supply line to the market */}
      <path
        d="M 90 150 Q 70 90 90 60"
        stroke="#7C3E1F"
        strokeWidth="1.6"
        strokeDasharray="4 5"
        fill="none"
        opacity="0.8"
      />
      {/* the canal link, tracing itself in a loop (CSS keyframe) */}
      <path
        d="M 90 60 Q 180 30 270 70"
        stroke="#2E5540"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="120"
        className="animate-trace-link"
        style={{ ["--trace-len" as string]: "120" }}
      />
      {/* towns */}
      {(
        [
          { x: 90, y: 60, name: "Walsall" },
          { x: 270, y: 70, name: "Birmingham" },
          { x: 90, y: 150, name: "Dudley" },
        ] as const
      ).map((t) => (
        <g key={t.name}>
          <circle cx={t.x} cy={t.y} r="10" fill="#E3D4B4" stroke="#8A6B33" strokeWidth="1.6" />
          <circle cx={t.x} cy={t.y} r="3" fill="#241D14" />
          <text
            x={t.x}
            y={t.y - 16}
            textAnchor="middle"
            fontFamily="'IM Fell English SC', Georgia, serif"
            fontSize="13"
            fill="#241D14"
          >
            {t.name}
          </text>
        </g>
      ))}
      {/* market square */}
      <g>
        <rect x="66" y="168" width="48" height="18" rx="2" fill="#2C251D" stroke="#8A6B33" />
        <text x="90" y="181" textAnchor="middle" fontFamily="Archivo, sans-serif" fontSize="9" fill="#C9A45C" letterSpacing="1">
          {t("home.triptych.map.market")}
        </text>
      </g>
    </svg>
  );
}

/** Section 3 — Feature Triptych ("Inside the Box", home.md §3). */
export default function FeatureTriptych() {
  const root = useRef<HTMLElement>(null);
  const t = useT();

  /* ---------------- Rows ---------------- */
  const ROWS = [
    {
      eyebrow: t("home.triptych.rows.market.eyebrow"),
      title: t("home.triptych.rows.market.title"),
      body: t("home.triptych.rows.market.body"),
      link: { to: "/rules#market", label: t("home.triptych.learnMore") },
      visual: <MarketTrayMini />,
    },
    {
      eyebrow: t("home.triptych.rows.eras.eyebrow"),
      title: t("home.triptych.rows.eras.title"),
      body: t("home.triptych.rows.eras.body"),
      link: { to: "/rules#eras", label: t("home.triptych.learnMore") },
      visual: <EraFriezes />,
    },
    {
      eyebrow: t("home.triptych.rows.supply.eyebrow"),
      title: t("home.triptych.rows.supply.title"),
      body: t("home.triptych.rows.supply.body"),
      link: { to: "/rules#supply", label: t("home.triptych.learnMore") },
      visual: <MiniMapTrace />,
    },
  ];

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>(".triptych-row").forEach((row) => {
        const fromLeft = row.dataset.side === "left";
        const tl = gsap.timeline({
          scrollTrigger: { trigger: row, start: "top 70%" },
        });
        tl.fromTo(
          row.querySelector(".triptych-visual"),
          { opacity: 0, x: fromLeft ? -60 : 60, clipPath: fromLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" },
          { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0%)", duration: 0.8, ease: "power3.out" },
        ).fromTo(
          row.querySelectorAll(".triptych-text > *"),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.55, stagger: 0.09, ease: "power3.out" },
          "-=0.45",
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative bg-coal-950" aria-label={t("home.triptych.aria")}>
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.04]" />
      <div className="relative mx-auto max-w-[1200px] space-y-20 px-6 py-24">
        <header className="text-center">
          <p className="eyebrow">{t("home.triptych.eyebrow")}</p>
          <h2 className="mt-3 font-display text-[34px] font-bold text-cream-100">
            {t("home.triptych.title")}
          </h2>
          <div className="divider-brass mt-6 w-64" />
        </header>

        {ROWS.map((row, i) => {
          const imageLeft = i % 2 === 0;
          return (
            <div
              key={row.eyebrow}
              data-side={imageLeft ? "left" : "right"}
              className="triptych-row grid items-center gap-10 md:grid-cols-2"
            >
              <div className={cn("triptych-visual group", !imageLeft && "md:order-2")}>
                <div className="rounded-md border border-brass-700/60 bg-coal-800 p-5 shadow-e2">
                  {row.visual}
                </div>
              </div>
              <div className={cn("triptych-text", !imageLeft && "md:order-1")}>
                <p className="eyebrow">{row.eyebrow}</p>
                <h3 className="mt-3 font-display text-[26px] font-bold text-cream-100">
                  {row.title}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-[1.6] text-cream-100/85">
                  {row.body}
                </p>
                <Link
                  to={row.link.to}
                  className="mt-4 inline-block font-sans text-sm font-semibold text-brass-400 transition-colors hover:text-brass-500"
                >
                  {row.link.label}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
