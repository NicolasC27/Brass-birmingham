import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

const RUNGS = ["−£10", "£0", "£5", "£10", "£15", "£20", "£25", "£30"]; // level 30 is the ceiling
const MID = 3; // pawn rests on the £10 rung

/**
 * §IX ornament — the income ladder. A brass pawn drifts ±3 rungs with the
 * reader's scroll progress through the chapter, echoing how loans (down
 * three) and flipped works (up) move the marker. Static under reduced
 * motion.
 */
export default function MoneyLadder() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const pawn = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !pawn.current) return;
      const step = 24;
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 80%",
        end: "bottom 20%",
        onUpdate(self) {
          // ±3 rungs around the resting rung
          const rung = MID + Math.round((self.progress - 0.5) * 6);
          gsap.to(pawn.current, { y: (MID - rung) * step, duration: 0.25, ease: "power1.out" });
        },
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex items-center justify-center">
      <svg
        viewBox="0 0 120 210"
        className="h-52 w-auto"
        role="img"
        aria-label={t("rules.money.ladderAria")}
      >
        {/* rails */}
        <line x1={34} y1={12} x2={34} y2={196} stroke="#8A6B33" strokeWidth={2} />
        <line x1={86} y1={12} x2={86} y2={196} stroke="#8A6B33" strokeWidth={2} />
        {RUNGS.map((label, i) => {
          const y = 24 + (RUNGS.length - 1 - i) * 24; // highest income on top
          return (
            <g key={label}>
              <rect
                x={40}
                y={y - 8}
                width={40}
                height={15}
                rx={3}
                fill={i === MID ? "#C9A45C" : "#F2EAD6"}
                stroke={i === 1 ? "#8E3B2F" : "#8A6B33"}
                strokeWidth={i === 1 ? 1.6 : 1}
              />
              <text
                x={60}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={9}
                fill={i === MID ? "#241D14" : "#241D14"}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
        <g ref={pawn} style={{ transform: "translateY(0px)" }}>
          <circle cx={22} cy={24 + (RUNGS.length - 1 - MID) * 24 - 1} r={8} fill="#C9A45C" stroke="#8A6B33" strokeWidth={1.5} />
          <circle cx={20} cy={24 + (RUNGS.length - 1 - MID) * 24 - 3} r={2} fill="#DDBE7E" />
        </g>
        <text x={60} y={208} textAnchor="middle" fontSize={8.5} fill="#241D14" opacity={0.6} fontFamily="'IM Fell English SC', Georgia, serif">
          {t("rules.money.ladderCaption")}
        </text>
      </svg>
    </div>
  );
}
