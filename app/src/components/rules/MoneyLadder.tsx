import { useT } from "@/i18n";

const RUNGS = ["−£10", "£0", "£5", "£10", "£15", "£20", "£25", "£30"]; // level 30 is the ceiling
const MID = 3; // pawn rests on the £10 rung

/**
 * §IX ornament — the income ladder. A brass pawn rests on the £10 rung,
 * echoing where loans (down three) and flipped works (up) move the marker.
 * Static: the platform runs on sober Framer Motion only (design.md §5).
 */
export default function MoneyLadder() {
  const t = useT();

  return (
    <div className="flex items-center justify-center">
      <svg
        viewBox="0 0 120 210"
        className="h-52 w-auto"
        role="img"
        aria-label={t("rules.money.ladderAria")}
      >
        {/* rails */}
        <line x1={34} y1={12} x2={34} y2={196} stroke="var(--rd-brass, #8A6B33)" strokeWidth={2} />
        <line x1={86} y1={12} x2={86} y2={196} stroke="var(--rd-brass, #8A6B33)" strokeWidth={2} />
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
                fill={i === MID ? "var(--rd-brass, #C9A45C)" : "var(--rd-cream, #F2EAD6)"}
                stroke={i === 1 ? "var(--rd-rust, #D0704E)" : "var(--rd-brass, #8A6B33)"}
                strokeWidth={i === 1 ? 1.6 : 1}
              />
              <text
                x={60}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={9}
                fill="#241D14"
                fontFamily="'IBM Plex Mono', monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
        <g>
          <circle cx={22} cy={24 + (RUNGS.length - 1 - MID) * 24 - 1} r={8} fill="var(--rd-brass, #C9A45C)" stroke="var(--rd-brass, #8A6B33)" strokeWidth={1.5} />
          <circle cx={20} cy={24 + (RUNGS.length - 1 - MID) * 24 - 3} r={2} fill="var(--rd-cream, #DDBE7E)" />
        </g>
        <text x={60} y={208} textAnchor="middle" fontSize={8.5} fill="var(--rd-ink, #C8BFAC)" opacity={0.75} fontFamily="'IBM Plex Mono', monospace">
          {t("rules.money.ladderCaption")}
        </text>
      </svg>
    </div>
  );
}
