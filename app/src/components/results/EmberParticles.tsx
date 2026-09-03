import { memo, useMemo } from "react";

/**
 * Brass-gear ember particles (reconciled from endgame.md's R3F embers per
 * design.md §9: CSS-only, no Three.js). A sparse drift of warm sparks and
 * tiny gear silhouettes rising over the felt. Hidden under reduced motion.
 */
function EmberParticles({ density = 16 }: { density?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: density }, (_, i) => {
        const gear = i % 4 === 0;
        return {
          left: (i * 61.8) % 100,
          size: gear ? 14 + (i % 3) * 6 : 2.5 + (i % 3) * 1.6,
          duration: 9 + ((i * 7) % 9),
          delay: -((i * 3.7) % 12),
          drift: ((i * 53) % 40) - 20,
          gear,
        };
      }),
    [density],
  );

  return (
    <div aria-hidden className="ember-field pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes ember-rise {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          12% { opacity: var(--ember-opacity, 0.5); }
          85% { opacity: var(--ember-opacity, 0.5); }
          100% { transform: translate3d(var(--ember-drift, 0px), -108vh, 0) rotate(160deg); opacity: 0; }
        }
        .ember {
          position: absolute;
          bottom: -6vh;
          border-radius: 999px;
          background: radial-gradient(circle at 40% 35%, #DDBE7E, #C9A45C 55%, rgba(138,107,51,0));
          animation: ember-rise linear infinite;
          will-change: transform, opacity;
        }
        .ember-gear {
          background: none;
          border-radius: 0;
        }
        .ember-gear svg { display: block; opacity: 0.35; }
        @media (prefers-reduced-motion: reduce) {
          .ember { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          className={p.gear ? "ember ember-gear" : "ember"}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--ember-drift" as string]: `${p.drift}px`,
            ["--ember-opacity" as string]: p.gear ? 0.4 : 0.55,
          }}
        >
          {p.gear && (
            <img src="/logo-mark.svg" alt="" width={p.size} height={p.size} />
          )}
        </span>
      ))}
    </div>
  );
}

export default memo(EmberParticles);
