import { Factory, Layers, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const LUCIDE = { Factory, Layers, Search, Trophy } as const;
type LucideName = keyof typeof LUCIDE;

interface RulesIconProps {
  icon: string; // "/icon-*.svg" asset path or "lucide:Name"
  className?: string;
}

/** Renders either a custom woodcut SVG asset (ink on parchment) or a
 * lucide chrome glyph, per the design system's icon rules. */
export default function RulesIcon({ icon, className }: RulesIconProps) {
  if (icon.startsWith("lucide:")) {
    const name = icon.slice(7) as LucideName;
    const Cmp = LUCIDE[name];
    return <Cmp aria-hidden className={cn("h-5 w-5", className)} strokeWidth={1.75} />;
  }
  return <img src={icon} alt="" aria-hidden className={cn("h-5 w-5", className)} />;
}
