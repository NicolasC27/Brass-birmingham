import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

/**
 * Section 4 — Era Teaser Strip (home.md §4).
 * Pinned for ~120vh; scroll progress scrubs a glyph crossing the canal→rail
 * seam while the gradient seam slides across the band.
 */
export default function EraStrip() {
  const root = useRef<HTMLElement>(null);
  const t = useT();

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 0.6,
        },
      });
      // Glyph travels left → right across the seam
      tl.fromTo(".era-glyph", { left: "12%" }, { left: "82%", ease: "none", duration: 1 }, 0);
      // Narrowboat crossfades into locomotive at the seam
      tl.to(".era-boat", { opacity: 0, ease: "none", duration: 0.18 }, 0.41)
        .fromTo(".era-train", { opacity: 0 }, { opacity: 1, ease: "none", duration: 0.18 }, 0.41);
      // Gradient seam slides across the band
      tl.fromTo(
        ".era-seam",
        { backgroundPosition: "0% 0%" },
        { backgroundPosition: "100% 0%", ease: "none", duration: 1 },
        0,
      );
      // Caption opacity tracks glyph position
      tl.fromTo(".era-caption", { opacity: 0.35 }, { opacity: 1, ease: "none", duration: 0.5 }, 0);
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative h-[220px] overflow-hidden"
      aria-label={t("home.eraStrip.aria")}
    >
      {/* Sliding gradient seam (canal green → rail copper, diagonal) */}
      <div
        className="era-seam absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, #1E3A2A 0%, #1E3A2A 42%, #7C3E1F 58%, #7C3E1F 100%)",
          backgroundSize: "220% 100%",
        }}
      />
      {/* Friezes at 18% */}
      <img
        src="/era-canal-banner.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-[62%] object-cover opacity-[0.18]"
      />
      <img
        src="/era-rail-banner.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-[62%] object-cover opacity-[0.18]"
      />

      {/* Travelling glyph: narrowboat → locomotive */}
      <div className="era-glyph absolute top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2">
        <img src="/icon-canal.svg" alt="" className="era-boat absolute inset-0 h-full w-full text-cream-100 invert" />
        <img src="/icon-rail.svg" alt="" className="era-train absolute inset-0 h-full w-full text-cream-100 opacity-0 invert" />
      </div>

      {/* Caption */}
      <p className="era-caption absolute inset-0 z-10 flex items-center justify-center font-fell text-[28px] uppercase tracking-[0.2em] text-cream-100 drop-shadow-[0_2px_4px_rgba(0,0,0,.6)]">
        {t("home.eraStrip.caption")}
      </p>
    </section>
  );
}
