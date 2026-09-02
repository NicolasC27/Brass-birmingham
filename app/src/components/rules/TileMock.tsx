import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

interface TileMockProps {
  icon: string;
  level: number;
  income: number;
  vp: number;
  className?: string;
}

/**
 * Small CSS mock of an industry tile face (design.md §6.7) — parchment face,
 * woodcut icon, level pips along the top edge, brass income chip and cream
 * VP chip along the bottom. Used in the industries tables so readers learn
 * to read tiles; flipped variant lives in TileFlipMock.
 */
export default function TileMock({ icon, level, income, vp, className }: TileMockProps) {
  const t = useT();
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-[46px] w-[66px] shrink-0 rounded-[4px] border-2 border-brass-500 bg-cream-100",
        "shadow-[0_3px_6px_rgba(36,29,20,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]",
        className,
      )}
    >
      {/* level pips */}
      <span className="absolute left-1 top-1 flex gap-[3px]">
        {Array.from({ length: level }).map((_, i) => (
          <span key={i} className="h-[5px] w-[5px] rounded-full bg-brass-700" />
        ))}
      </span>
      <img src={icon} alt="" className="absolute left-1/2 top-[46%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-ink-900" />
      {/* chips */}
      <span className="absolute -bottom-[7px] left-1 rounded-sm border border-brass-700 bg-gradient-to-b from-brass-400 to-brass-500 px-1 font-mono text-[8.5px] font-semibold leading-[13px] text-ink-900">
        +{income}
      </span>
      <span className="absolute -bottom-[7px] right-1 rounded-sm border border-ink-900/40 bg-cream-300 px-1 font-mono text-[8.5px] font-semibold leading-[13px] text-ink-900">
        {t("rules.tile.vpChip", { vp })}
      </span>
      {/* corner rivets */}
      <span className="absolute right-1 top-1 h-[4px] w-[4px] rounded-full bg-brass-700/70" />
    </div>
  );
}
