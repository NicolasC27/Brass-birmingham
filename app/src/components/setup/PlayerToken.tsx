import { useId } from "react";
import { colorDef, type PlayerColor } from "./constants";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** a hex colour lightened (k > 1) or darkened (k < 1) */
function mix(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Shape-coded player counter (design.md §8): brass = circle, oxblood = square,
 * verdigris = diamond, steel = triangle notch. A physical token — enamel over
 * metal, lit from the upper left like everything on the table: a light
 * catching the top, the colour itself in the middle, a dark rim below.
 */
export default function PlayerToken({
  color,
  size = 28,
  className,
}: {
  color: PlayerColor;
  size?: number;
  className?: string;
}) {
  const def = colorDef(color);
  const t = useT();
  const id = useId();
  const hex = def.hex;
  const fill = `url(#${id}-g)`;
  const stroke = mix(hex, 0.45);
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={t("setup.token.ariaLabel", { color: t(`setup.colors.${color}`) })}
      className={cn("shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]", className)}
    >
      <defs>
        <radialGradient id={`${id}-g`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={mix(hex, 1.45)} />
          <stop offset="0.45" stopColor={hex} />
          <stop offset="1" stopColor={mix(hex, 0.55)} />
        </radialGradient>
      </defs>
      {def.shape === "circle" && <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="1.5" />}
      {def.shape === "square" && <rect x="5" y="5" width="22" height="22" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />}
      {def.shape === "diamond" && (
        <rect x="6.5" y="6.5" width="19" height="19" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" transform="rotate(45 16 16)" />
      )}
      {def.shape === "triangle" && (
        <>
          <polygon points="16,4.5 28.5,26 3.5,26" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="16,10 23,23 9,23" fill="rgba(0,0,0,0.28)" />
        </>
      )}
      {/* the light on the upper edge */}
      {def.shape === "circle" && <path d="M 8 12 A 11 11 0 0 1 24 12" fill="none" stroke="rgba(255,250,236,0.6)" strokeWidth="1.6" strokeLinecap="round" />}
      {def.shape === "square" && <path d="M 8 9 H 24" fill="none" stroke="rgba(255,250,236,0.6)" strokeWidth="1.6" strokeLinecap="round" />}
      {def.shape === "diamond" && (
        <path d="M 10.5 12.5 L 16 7 L 21.5 12.5" fill="none" stroke="rgba(255,250,236,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {def.shape === "triangle" && (
        <path d="M 11.5 21 L 16 12.5 L 20.5 21" fill="none" stroke="rgba(255,250,236,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
