import { colorDef, type PlayerColor } from "./constants";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Shape-coded player counter (design.md §8): brass = circle, oxblood = square,
 * verdigris = diamond, steel = triangle notch. A physical token — beveled disc
 * with a top inner highlight and drop shadow.
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
  const hex = def.hex;
  const stroke = "rgba(0,0,0,0.45)";
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={t("setup.token.ariaLabel", { color: t(`setup.colors.${color}`) })}
      className={cn("shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]", className)}
    >
      {def.shape === "circle" && (
        <circle cx="16" cy="16" r="12" fill={hex} stroke={stroke} strokeWidth="1.5" />
      )}
      {def.shape === "square" && (
        <rect x="5" y="5" width="22" height="22" rx="4" fill={hex} stroke={stroke} strokeWidth="1.5" />
      )}
      {def.shape === "diamond" && (
        <rect
          x="6.5"
          y="6.5"
          width="19"
          height="19"
          rx="2"
          fill={hex}
          stroke={stroke}
          strokeWidth="1.5"
          transform="rotate(45 16 16)"
        />
      )}
      {def.shape === "triangle" && (
        <>
          <polygon points="16,4.5 28.5,26 3.5,26" fill={hex} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="16,10 23,23 9,23" fill="rgba(0,0,0,0.28)" />
        </>
      )}
      {/* engraved inner highlight */}
      {def.shape === "circle" && (
        <path d="M 8 12 A 11 11 0 0 1 24 12" fill="none" stroke="rgba(242,234,214,0.55)" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {def.shape === "square" && (
        <path d="M 8 9 H 24" fill="none" stroke="rgba(242,234,214,0.55)" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {def.shape === "diamond" && (
        <path d="M 10.5 12.5 L 16 7 L 21.5 12.5" fill="none" stroke="rgba(242,234,214,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {def.shape === "triangle" && (
        <path d="M 11.5 21 L 16 12.5 L 20.5 21" fill="none" stroke="rgba(242,234,214,0.5)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
