import { INCOME_MAX, INCOME_PAYOUT, LOAN_AMOUNT, LOAN_INCOME_HIT, PLAYER_COLORS, incomeLevel, loanLanding } from '@/game/data';
import { useGame, useShownGame } from '@/game/store';
import { money, useT } from '@/i18n';
import Tooltip from './Tooltip';
import { ShapeChip } from './TownInspector';

/* ------------------------------------------------------------------ */
/* Income rail — the physical game's edge track, flattened under the   */
/* score bar: levels 0..30 with payout band marks (£0/£10/£30/£70),    */
/* one pawn per player seated on their level (hover = where a loan     */
/* would drop them). The loan CONFIRM modal shows the landing pawn     */
/* itself (LoanLandingTrack, below).                                   */
/* ------------------------------------------------------------------ */

const PAD = 5; // % padding both ends
const posOf = (lvl: number) => PAD + (lvl / INCOME_MAX) * (100 - 2 * PAD);

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

export default function IncomeRail() {
  const game = useShownGame();
  const setSpotlight = useGame((s) => s.setSpotlight);
  const spotlight = useGame((s) => s.spotlight);
  const t = useT();
  if (!game) return null;

  /* group players by level so stacked pawns fan out horizontally */
  const atLevel = new Map<number, number[]>();
  game.players.forEach((p, i) => {
    const l = atLevel.get(p.income) ?? [];
    l.push(i);
    atLevel.set(p.income, l);
  });

  return (
    <div
      className="fixed inset-x-0 top-9 z-[59] flex h-10 items-center border-b border-brass-700/40 bg-coal-950/85 px-6 shadow-e2 backdrop-blur-md"
      role="group"
      aria-label={t('game.incomeRail.aria')}
    >
      <div className="relative h-full flex-1">
        {/* payout bands: faint tint per rate zone + separator at each step-up */}
        <div aria-hidden className="absolute inset-y-0" style={{ left: `${posOf(0)}%`, width: `${posOf(10) - posOf(0)}%`, background: 'rgba(201,164,92,.03)' }} />
        <div aria-hidden className="absolute inset-y-0" style={{ left: `${posOf(10)}%`, width: `${posOf(20) - posOf(10)}%`, background: 'rgba(201,164,92,.06)' }} />
        <div aria-hidden className="absolute inset-y-0" style={{ left: `${posOf(20)}%`, width: `${posOf(30) - posOf(20)}%`, background: 'rgba(201,164,92,.09)' }} />
        <span aria-hidden className="absolute inset-y-1 w-px bg-brass-700/50" style={{ left: `${posOf(10)}%` }} />
        <span aria-hidden className="absolute inset-y-1 w-px bg-brass-700/50" style={{ left: `${posOf(20)}%` }} />
        {/* the groove */}
        <div aria-hidden className="absolute inset-x-0 top-[24px] h-[3px] rounded-full bg-black/70 shadow-[0_1px_0_rgba(242,234,214,.08)]" />
        {/* level ticks + band labels */}
        {Array.from({ length: INCOME_MAX + 1 }, (_, lvl) => (
          <span key={lvl} aria-hidden className="absolute top-[21px] w-px bg-brass-700/60" style={{ left: `${posOf(lvl)}%`, height: lvl % 5 === 0 ? 7 : 4 }} />
        ))}
        {[0, 10, 20, 30].map((lvl) => (
          <span
            key={lvl}
            aria-hidden
            className="absolute top-[1px] -translate-x-1/2 font-mono text-[9px] font-semibold text-brass-500/90"
            style={{ left: `${posOf(lvl)}%` }}
          >
            {money(INCOME_PAYOUT[lvl])}
          </span>
        ))}
        {/* rate categories: how much each rung pays inside the band */}
        {[5, 15, 25].map((mid, b) => (
          <span
            key={mid}
            aria-hidden
            className="absolute top-[29px] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-brass-500/75"
            style={{ left: `${posOf(mid)}%` }}
          >
            {t(`game.incomeRail.band${b + 1}`)}
          </span>
        ))}

        {/* player pawns */}
        {game.players.map((p, i) => {
          const group = atLevel.get(p.income)!;
          const off = (group.indexOf(i) - (group.length - 1) / 2) * 10;
          const col = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
          const spot = spotlight === i;
          const pay = money(INCOME_PAYOUT[p.income]);
          const after = Math.max(0, p.income - LOAN_INCOME_HIT);
          return (
            /* the ABSOLUTE wrapper carries the position — the Tooltip span
               wrapper is static and would collapse the pawn to the rail start */
            <div key={i} className="absolute top-[8px] -translate-x-1/2" style={{ left: `calc(${posOf(p.income)}% + ${off}px)` }}>
              <Tooltip
                side="bottom"
                title={t('game.incomeRail.pawnTitle', { name: p.name, lvl: p.income, pay })}
                content={t('game.incomeRail.pawnHint', { amount: LOAN_AMOUNT, after, pay: money(INCOME_PAYOUT[after]) })}
              >
                <button
                  type="button"
                  aria-label={t('game.incomeRail.pawnAria', { name: p.name, lvl: p.income, pay })}
                  aria-pressed={spot}
                  onClick={() => setSpotlight(spot ? null : i)}
                  className="flex h-[13px] w-[13px] items-center justify-center rounded-[3px] transition-transform hover:scale-125"
                  style={{
                    background: `${col}26`,
                    boxShadow: spot ? `0 0 0 1.5px ${col}, 0 0 8px ${col}` : `0 0 0 1px ${col}88`,
                  }}
                >
                  <ShapeChip color={p.color} size={9} />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
