import { useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Coins, Hammer, Layers } from "lucide-react";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* How it plays — a turn in three steps, for whoever has never opened  */
/* the box: a card, a work or a link, a sale. Then the rules.          */
/* ------------------------------------------------------------------ */

const STEPS = [
  { key: "card", Icon: Layers, faces: ["/tile-cotton-cut.png"] },
  { key: "build", Icon: Hammer, faces: ["/tile-coal-brass.png", "/tile-iron-oxblood.png"] },
  { key: "sell", Icon: Coins, faces: ["/tile-manufacture-verdigris.png"] },
] as const;

export default function HowItPlays() {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(".how-step", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: root.current, start: "top 78%" } });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative border-t border-brass-700/30 bg-coal-950" aria-label={t("home.how.aria")}>
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.04]" />
      <div className="relative mx-auto max-w-[1200px] px-6 py-16">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <p className="eyebrow">{t("home.how.eyebrow")}</p>
            <h2 className="mt-1.5 font-display text-[26px] font-bold text-cream-100">{t("home.how.title")}</h2>
          </div>
          <Link to="/rules" className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-brass-400 hover:text-brass-300">
            {t("home.how.rules")}
          </Link>
        </header>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ key, Icon, faces }, i) => (
            <li key={key} className="how-step plate relative overflow-hidden p-5 opacity-0">
              <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.05]" />
              <div className="relative flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brass-500/60 bg-brass-500/10 text-brass-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-fell text-[11px] uppercase tracking-[0.2em] text-brass-400/80">{t("home.how.step", { n: i + 1 })}</p>
                  <h3 className="mt-0.5 font-display text-[19px] font-bold text-cream-100">{t(`home.how.${key}.title`)}</h3>
                  <p className="mt-2 font-serif text-[14.5px] leading-relaxed text-cream-100/70">{t(`home.how.${key}.body`)}</p>
                </div>
              </div>
              <div aria-hidden className="pointer-events-none absolute -bottom-5 -right-4 flex gap-1 opacity-70">
                {faces.map((f, k) => (
                  <img key={f} src={f} alt="" width={64} height={64} className="h-16 w-16 rounded-md shadow-e3" style={{ transform: `rotate(${k % 2 ? 8 : -6}deg)` }} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
