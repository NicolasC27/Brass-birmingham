import { useT } from "@/i18n";

/**
 * §VIII showpiece — a life-size mock of the flip moment. Hover (or keyboard
 * focus) to turn the tile 180° onto its ember face, exactly as sold works
 * appear on the board. CSS-only; reduced motion collapses it to a quick fade
 * via the global media rule.
 */
export default function TileFlipMock() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rules-flip h-[104px] w-[148px] cursor-pointer rounded-md"
        tabIndex={0}
        role="img"
        aria-label={t("rules.selling.flip.aria")}
      >
        <div className="rules-flip-inner relative h-full w-full">
          {/* face — parchment, ink engraving, brass income chip */}
          <div className="rules-flip-face absolute inset-0 rounded-md border-2 border-brass-500 bg-cream-100 shadow-e3">
            <span className="absolute left-1.5 top-1.5 flex gap-1">
              {[0, 1].map((i) => (
                <span key={i} className="h-[7px] w-[7px] rounded-full bg-brass-700" />
              ))}
            </span>
            <img src="/icon-cotton.svg" alt="" className="absolute left-1/2 top-[44%] h-12 w-12 -translate-x-1/2 -translate-y-1/2" />
            <span className="absolute bottom-1.5 left-1.5 rounded-sm border border-brass-700 bg-gradient-to-b from-brass-400 to-brass-500 px-1.5 py-px font-mono text-[11px] font-semibold text-ink-900">
              +5
            </span>
            <span className="absolute bottom-1.5 right-1.5 rounded-sm border border-ink-900/40 bg-cream-300 px-1.5 py-px font-mono text-[11px] font-semibold text-ink-900">
              {t("rules.tile.vpChip", { vp: 5 })}
            </span>
            <span className="absolute inset-x-0 bottom-6 text-center font-fell text-[11px] uppercase tracking-[0.1em] text-ink-900/60">
              {t("rules.selling.flip.tileName")}
            </span>
          </div>
          {/* back — the sold ember face */}
          <div className="rules-flip-face rules-flip-back absolute inset-0 rounded-md border-2 border-copper-500 bg-coal-800 shadow-e3">
            <div className="rules-ember-rim absolute inset-1 rounded border border-copper-500/70" />
            <span className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block font-display text-3xl font-black text-copper-500">5</span>
              <span className="block font-fell text-[10px] uppercase tracking-[0.22em] text-cream-100/70">
                {t("rules.selling.flip.vp")}
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-2 text-center font-fell text-[10px] uppercase tracking-[0.14em] text-cream-100/50">
              {t("rules.selling.flip.sold")}
            </span>
          </div>
        </div>
      </div>
      <p className="font-ui text-[11px] text-iron-400">
        {t("rules.selling.flip.caption")}
      </p>
    </div>
  );
}
