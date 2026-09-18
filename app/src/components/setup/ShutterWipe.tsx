import { useEffect } from "react";
import LogoMark from "@/components/LogoMark";

/**
 * Iron-shutter ceremony wipe (setup.md §Start Bar): two riveted coal panels
 * slide from top and bottom to meet at the seam, where the blackrail mark
 * draws itself in. Reduced motion falls back to a single quick fade.
 */
export default function ShutterWipe({
  active,
  onDone,
}: {
  active: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(onDone, reduced ? 260 : 640);
    return () => window.clearTimeout(t);
  }, [active, onDone]);

  if (!active) return null;

  const rivets = Array.from({ length: 24 });

  return (
    <div
      aria-hidden
      className="shutter-wipe pointer-events-none fixed inset-0 z-[90]"
    >
      <style>{`
        @keyframes shutter-top { from { transform: translateY(-101%); } to { transform: translateY(0); } }
        @keyframes shutter-bottom { from { transform: translateY(101%); } to { transform: translateY(0); } }
        @keyframes shutter-seal { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes shutter-fade { from { opacity: 0; } to { opacity: 1; } }
        .shutter-panel-top { animation: shutter-top 0.5s cubic-bezier(0.7, 0, 0.2, 1) forwards; }
        .shutter-panel-bottom { animation: shutter-bottom 0.5s cubic-bezier(0.7, 0, 0.2, 1) forwards; }
        .shutter-seal { animation: shutter-seal 0.3s 0.34s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .shutter-panel-top, .shutter-panel-bottom { animation: shutter-fade 0.2s ease forwards; transform: none; }
          .shutter-seal { animation: shutter-fade 0.2s ease both; }
        }
      `}</style>

      <div className="shutter-panel-top absolute inset-x-0 top-0 h-1/2 border-b border-brass-600/60 bg-lacquer-900">
        <div className="tex-lacquer absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-6">
          {rivets.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #E7C97E, #8F6B23)",
              }}
            />
          ))}
        </div>
      </div>
      <div className="shutter-panel-bottom absolute inset-x-0 bottom-0 h-1/2 border-t border-brass-600/60 bg-lacquer-900">
        <div className="tex-lacquer absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 top-2 flex justify-center gap-6">
          {rivets.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #E7C97E, #8F6B23)",
              }}
            />
          ))}
        </div>
      </div>

      {/* The mark drawing itself into the seam */}
      <div className="shutter-seal absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <LogoMark size={88} spinning={false} />
      </div>
    </div>
  );
}
