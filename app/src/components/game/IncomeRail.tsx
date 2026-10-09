import { INCOME_MAX, INCOME_PAYOUT, PLAYER_COLORS, incomeLevel, loanLanding } from '@/game/data';
import { money, useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The loan's landing, as the confirmation sheet shows it: a few spaces */
/* of the income track either side of where the pawn stands and where  */
/* the loan would set it down. The track along the table's edge lives  */
/* in EdgeTracks.                                                      */
/* ------------------------------------------------------------------ */

/** mini track inside the loan-confirm modal — ZOOMED on the spaces that
 *  matter (a few either side of the current and landing spaces): every
 *  space is a cell, cells sharing a payout form a level band with its £
 *  above, solid pawn now, dashed pawn where the loan lands. */
export function LoanLandingTrack({ income, color }: { income: number; color: string }) {
  const t = useT();
  const landing = loanLanding(income);
  const after = landing ?? income;
  const col = PLAYER_COLORS[color]?.hex ?? '#C9A45C';
  const lo = Math.max(0, Math.min(after, income) - 3);
  const hi = Math.min(INCOME_MAX, Math.max(after, income) + 3);
  const spaces = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const n = spaces.length;
  const bands: { from: number; to: number; pay: number }[] = [];
  for (const sp of spaces) {
    const pay = INCOME_PAYOUT[sp];
    const last = bands[bands.length - 1];
    if (last && last.pay === pay) last.to = sp;
    else bands.push({ from: sp, to: sp, pay });
  }
  const centre = (sp: number) => ((sp - lo + 0.5) / n) * 100;
  return (
    <div className="mt-4 rounded-md border border-brass-700/50 bg-coal-950/70 p-3">
      {/* level bands: one £ label centred over its spaces */}
      <div className="flex h-4">
        {bands.map((b) => (
          <div
            key={b.from}
            className={`truncate text-center font-mono text-[10px] font-bold leading-4 ${b.pay < 0 ? 'text-rust-500 brightness-150' : 'text-brass-400'}`}
            style={{ flex: b.to - b.from + 1 }}
          >
            {money(b.pay)}
          </div>
        ))}
      </div>
      {/* the spaces themselves */}
      <div className="relative mt-1 flex h-9 overflow-visible rounded-sm border border-brass-700/60 bg-black/50">
        {spaces.map((sp) => {
          const boundary = sp > lo && INCOME_PAYOUT[sp] !== INCOME_PAYOUT[sp - 1];
          return (
            <div
              key={sp}
              className={`flex flex-1 items-end justify-center pb-[2px] ${boundary ? 'border-l border-brass-500/80' : sp > lo ? 'border-l border-brass-700/25' : ''} ${INCOME_PAYOUT[sp] < 0 ? 'bg-rust-500/10' : ''}`}
            >
              <span className="font-mono text-[9px] leading-none text-cream-100/45">{sp}</span>
            </div>
          );
        })}
        {/* descent arrow from the current space to the landing space */}
        {landing !== null && landing !== income && (
          <svg aria-hidden className="pointer-events-none absolute top-[9px] h-[10px] overflow-visible" style={{ left: `${centre(after)}%`, width: `${centre(income) - centre(after)}%` }}>
            <line x1="9" y1="5" x2="100%" y2="5" stroke={col} strokeWidth="1.6" strokeDasharray="3 3" opacity="0.85" />
            <path d="M1,5 L9,1 L9,9 Z" fill={col} />
          </svg>
        )}
        {/* landing pawn (dashed) + current pawn (solid) */}
        {landing !== null && (
          <span
            aria-hidden
            className="absolute top-[5px] flex h-[17px] w-[17px] -translate-x-1/2 items-center justify-center rounded-[3px] border-2 border-dashed"
            style={{ left: `${centre(after)}%`, borderColor: col, background: `${col}2e` }}
          >
            <span className="font-mono text-[9px] font-black" style={{ color: col }}>{incomeLevel(after)}</span>
          </span>
        )}
        <span
          aria-hidden
          className="absolute top-[5px] flex h-[17px] w-[17px] -translate-x-1/2 items-center justify-center rounded-[3px]"
          style={{ left: `${centre(income)}%`, background: col, boxShadow: `0 0 6px ${col}` }}
        >
          <span className="font-mono text-[9px] font-black text-ink-900">{incomeLevel(income)}</span>
        </span>
      </div>
      <p className="mt-2 text-center font-sans text-[11px] text-cream-100/80">
        {landing === null
          ? t('game.incomeRail.loanBlocked')
          : t('game.incomeRail.loanLine', { from: incomeLevel(income), to: incomeLevel(after), payFrom: money(INCOME_PAYOUT[income]), payTo: money(INCOME_PAYOUT[after]) })}
      </p>
    </div>
  );
}
