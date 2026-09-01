import { cn } from "@/lib/utils";

const GEAR_PATH =
  "M 64.00 18.00 L 71.31 8.48 L 78.49 9.91 L 81.60 21.50 L 87.00 24.16 L 98.09 19.57 L 103.60 24.40 L 100.49 36.00 L 103.84 41.00 L 115.74 42.57 L 118.09 49.51 L 109.61 58.00 L 110.00 64.00 L 119.52 71.31 L 118.09 78.49 L 106.50 81.60 L 103.84 87.00 L 108.43 98.09 L 103.60 103.60 L 92.00 100.49 L 87.00 103.84 L 85.43 115.74 L 78.49 118.09 L 70.00 109.61 L 64.00 110.00 L 56.69 119.52 L 49.51 118.09 L 46.40 106.50 L 41.00 103.84 L 29.91 108.43 L 24.40 103.60 L 27.51 92.00 L 24.16 87.00 L 12.26 85.43 L 9.91 78.49 L 18.39 70.00 L 18.00 64.00 L 8.48 56.69 L 9.91 49.51 L 21.50 46.40 L 24.16 41.00 L 19.57 29.91 L 24.40 24.40 L 36.00 27.51 L 41.00 24.16 L 42.57 12.26 L 49.51 9.91 L 58.00 18.39 Z";

/**
 * Inline twin of /logo-mark.svg — gear whose inner ring is a canal lock gate,
 * with a rising smoke plume forming a subtle "B".
 * Inline so the gear ring can spin on its own (24s CSS rotation).
 */
export default function LogoMark({
  size = 64,
  spinning = true,
  className,
}: {
  size?: number;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Brassworks emblem"
      className={className}
    >
      <g
        className={cn(spinning && "animate-spin-slow")}
        style={{ transformOrigin: "64px 64px" }}
        stroke="#C9A45C"
        strokeWidth={3}
        strokeLinejoin="round"
      >
        <path d={GEAR_PATH} fill="#C9A45C" fillOpacity={0.14} />
        <circle cx="64" cy="64" r="46" />
        <circle cx="64" cy="64" r="38" strokeWidth={2} />
      </g>
      <g stroke="#C9A45C" strokeWidth={2.4} strokeLinecap="round">
        <path d="M 40 92 L 64 66 L 88 92" />
        <path d="M 44 92 L 64 70 L 84 92" strokeWidth={1.2} opacity={0.65} />
        <path d="M 40 92 L 40 74 M 88 92 L 88 74" />
        <path d="M 52 79.5 L 52 88 M 76 79.5 L 76 88" strokeWidth={1.2} opacity={0.65} />
        <path d="M 36 92 H 92" />
      </g>
      <g stroke="#C9A45C" strokeWidth={2} strokeLinecap="round" fill="none">
        <path d="M 64 62 C 60 54 54 52 55 45 C 56 39 62 40 63 35 C 64 29 58 28 60 21" />
        <path d="M 64 62 C 68 55 73 52 72 45" opacity={0.6} />
        <path d="M 60 21 C 66 18 71 21 69.5 26 C 68.3 30 62 29 62 33 C 62 36.5 69 35.5 69.5 40 C 70 44.5 64 45.5 62 43" opacity={0.9} />
      </g>
    </svg>
  );
}
