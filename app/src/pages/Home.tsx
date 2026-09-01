import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroSection from "@/components/home/HeroSection";
import ModeSelect from "@/components/home/ModeSelect";
import FeatureTriptych from "@/components/home/FeatureTriptych";
import EraStrip from "@/components/home/EraStrip";
import ClosingCTA from "@/components/home/ClosingCTA";

gsap.registerPlugin(ScrollTrigger);

/**
 * Home / Title screen (home.md) — Lenis smooth scroll + GSAP ScrollTrigger.
 * All motion on this page is GSAP-driven (library isolation per react-dev.md).
 */
export default function Home() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <HeroSection />
      <ModeSelect />
      <FeatureTriptych />
      <EraStrip />
      <ClosingCTA />
    </>
  );
}
