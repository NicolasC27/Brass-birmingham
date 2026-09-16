import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BLEED_X, BLEED_Y, WORLD_H, WORLD_W } from "@/components/game/boardView";
import { routeFor } from "@/components/game/routePaths";
import { LINKS, PLAYER_COLORS, TOWN_BY_ID } from "@/game/data";
import type { IndustryType } from "@/game/types";

/* ------------------------------------------------------------------ */
/* The survey behind the title: the canal painting, and a game playing */
/* itself over it — links drawn one after another, works laid in the   */
/* towns, a few sold and flipped — the way the board looks in play.    */
/* World coordinates throughout: the SVG's view box is a window on the */
/* same 3200×1800 plane the board uses, so the routes are the board's. */
/* ------------------------------------------------------------------ */

const FILE: Record<IndustryType, string> = { coal: "coal", iron: "iron", cotton: "cotton", manufacturer: "manufacture", pottery: "pottery", brewery: "brewery" };
const TILE = 68;

type Move = { kind: "build"; who: string; town: string; slot: number; industry: IndustryType } | { kind: "link"; who: string; a: string; b: string } | { kind: "sell"; town: string; slot: number };

/* a plausible opening around the Black Country, three seats at the table */
const MOVES: Move[] = [
  { kind: "build", who: "brass", town: "coalbrookdale", slot: 2, industry: "coal" },
  { kind: "build", who: "oxblood", town: "coventry", slot: 0, industry: "pottery" },
  { kind: "link", who: "brass", a: "coalbrookdale", b: "kidderminster" },
  { kind: "build", who: "verdigris", town: "kidderminster", slot: 1, industry: "cotton" },
  { kind: "link", who: "oxblood", a: "coventry", b: "birmingham" },
  { kind: "build", who: "brass", town: "coalbrookdale", slot: 1, industry: "iron" },
  { kind: "link", who: "verdigris", a: "kidderminster", b: "worcester" },
  { kind: "build", who: "oxblood", town: "nuneaton", slot: 0, industry: "manufacturer" },
  { kind: "link", who: "brass", a: "wolverhampton", b: "coalbrookdale" },
  { kind: "build", who: "verdigris", town: "worcester", slot: 0, industry: "cotton" },
  { kind: "link", who: "oxblood", a: "tamworth", b: "nuneaton" },
  { kind: "build", who: "brass", town: "wolverhampton", slot: 0, industry: "manufacturer" },
  { kind: "sell", town: "kidderminster", slot: 1 },
  { kind: "link", who: "oxblood", a: "birmingham", b: "m-oxford" },
  { kind: "build", who: "verdigris", town: "tamworth", slot: 0, industry: "coal" },
  { kind: "link", who: "brass", a: "birmingham", b: "dudley" },
  { kind: "sell", town: "coventry", slot: 0 },
  { kind: "build", who: "oxblood", town: "coventry", slot: 2, industry: "iron" },
  { kind: "sell", town: "worcester", slot: 0 },
];

/* the window on the world: the Black Country, with the title's column
   over Birmingham and the towns played at either side of it */
const VIEW = { x: 690, y: 665, w: 1900, h: 1069 };
const viewBox = (dx: number, dy: number) => `${VIEW.x + dx} ${VIEW.y + dy} ${VIEW.w} ${VIEW.h}`;

const linkOf = (a: string, b: string) => LINKS.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
const slotOf = (town: string, slot: number) => TOWN_BY_ID[town]?.slots[slot];
const tileKey = (town: string, slot: number) => `${town}:${slot}`;

export default function HeroSurvey({ alt }: { alt: string }) {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const svg = root.current;
      if (!svg) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const links = Array.from(svg.querySelectorAll<SVGPathElement>("[data-link]"));
      const tiles = Array.from(svg.querySelectorAll<SVGGElement>("[data-tile]"));
      const seals = Array.from(svg.querySelectorAll<SVGGElement>("[data-seal]"));
      if (reduced) {
        /* the board as the opening leaves it, still */
        gsap.set(links, { strokeDashoffset: 0 });
        gsap.set(tiles, { opacity: 1, scale: 1, transformOrigin: "50% 50%" });
        gsap.set(seals, { opacity: 1, scale: 1, transformOrigin: "50% 50%" });
        return;
      }
      /* the camera: a slow drift over the country, back and forth */
      gsap.to(svg, { attr: { viewBox: viewBox(-140, -70) }, duration: 38, ease: "sine.inOut", yoyo: true, repeat: -1 });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, delay: 1.2 });
      tl.set(links, { strokeDashoffset: 1 });
      tl.set(tiles, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" });
      tl.set(seals, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
      let at = 0;
      MOVES.forEach((m, i) => {
        if (m.kind === "link") tl.to(svg.querySelectorAll(`[data-link="${i}"]`), { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, at);
        else if (m.kind === "build") tl.to(svg.querySelector(`[data-tile="${tileKey(m.town, m.slot)}"]`), { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.7)" }, at);
        else {
          tl.to(svg.querySelector(`[data-tile="${tileKey(m.town, m.slot)}"] image`), { opacity: 0.5, duration: 0.35 }, at);
          tl.to(svg.querySelector(`[data-seal="${tileKey(m.town, m.slot)}"]`), { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, at + 0.1);
        }
        at += m.kind === "link" ? 1.05 : 0.85;
      });
      /* the table cleared, the opening played again */
      tl.to([tiles, seals], { opacity: 0, duration: 0.8, ease: "power2.in" }, at + 2.4);
      tl.to(links, { strokeDashoffset: 1, duration: 0.8, ease: "power2.in" }, at + 2.4);
      tl.set(svg.querySelectorAll("[data-tile] image"), { opacity: 1 }, at + 3.3);
    },
    { scope: root },
  );

  const built = MOVES.filter((m): m is Extract<Move, { kind: "build" }> => m.kind === "build");
  const sold = MOVES.filter((m): m is Extract<Move, { kind: "sell" }> => m.kind === "sell");

  return (
    <svg ref={root} viewBox={viewBox(0, 0)} preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={alt}>
      <image href="/map-era-canal.webp" x={-BLEED_X} y={-BLEED_Y} width={WORLD_W + 2 * BLEED_X} height={WORLD_H + 2 * BLEED_Y} preserveAspectRatio="none" />
      {/* the links, drawn along the board's own routes */}
      {MOVES.map((m, i) => {
        if (m.kind !== "link") return null;
        const def = linkOf(m.a, m.b);
        if (!def) return null;
        const d = routeFor(def, "canal").d;
        const color = PLAYER_COLORS[m.who]?.hex ?? "#C9A45C";
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={color} strokeWidth={22} strokeLinecap="round" opacity={0.22} pathLength={1} strokeDasharray={1} strokeDashoffset={1} data-link={i} />
            <path d={d} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" opacity={0.95} pathLength={1} strokeDasharray={1} strokeDashoffset={1} data-link={i} />
          </g>
        );
      })}
      {/* the works, on the owner's card */}
      {built.map((m) => {
        const s = slotOf(m.town, m.slot);
        if (!s) return null;
        return (
          <g key={tileKey(m.town, m.slot)} data-tile={tileKey(m.town, m.slot)} opacity={0}>
            <rect x={s.x - TILE / 2 - 2} y={s.y - TILE / 2 - 2} width={TILE + 4} height={TILE + 4} rx={7} fill="#0c0a08" opacity={0.55} />
            <image href={`/tile-${FILE[m.industry]}-${m.who}.png`} x={s.x - TILE / 2} y={s.y - TILE / 2} width={TILE} height={TILE} />
          </g>
        );
      })}
      {/* a sale: the tile turns, a brass seal on its corner */}
      {sold.map((m) => {
        const s = slotOf(m.town, m.slot);
        if (!s) return null;
        return (
          <g key={`seal-${tileKey(m.town, m.slot)}`} data-seal={tileKey(m.town, m.slot)} opacity={0}>
            <circle cx={s.x + TILE / 2 - 6} cy={s.y - TILE / 2 + 6} r={13} fill="#C9A45C" stroke="#0c0a08" strokeWidth={2} />
            <text x={s.x + TILE / 2 - 6} y={s.y - TILE / 2 + 11} textAnchor="middle" fontSize={15} fontWeight={700} fontFamily="Georgia, serif" fill="#0c0a08">
              £
            </text>
          </g>
        );
      })}
    </svg>
  );
}
