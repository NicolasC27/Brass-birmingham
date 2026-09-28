import { cardLabel, useGame } from '@/game/store';
import type { Card } from '@/game/types';
import { PLAYER_COLORS } from '@/game/data';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useHudInsets } from './useHudInsets';

/* ------------------------------------------------------------------ */
/* The hand as it was.                                                 */
/*                                                                     */
/* Reading a move again is reading a choice, and a choice is made out  */
/* of a hand: eight cards, and the one spent. So the analysis shows    */
/* the cards the seat held at that very position, the played one       */
/* marked. A card nobody was shown then — another seat's hand at a     */
/* table online — stays face down here too.                            */
/* ------------------------------------------------------------------ */

const hidden = (c: Card): boolean => c.id.startsWith('hidden:');

export default function ReviewHand() {
  const t = useT();
  const review = useGame((s) => s.review);
  const insets = useHudInsets();
  if (!review) return null;
  const seat = review.reader ?? review.seat ?? 0;
  const player = review.state.players[seat];
  if (!player) return null;
  const hand = review.hand ?? player.hand;
  /* the card the move on show was paid with, when there was one */
  const played = review.mine ?? (review.seat === seat ? review.state.actions[review.at - 1] : undefined);
  const spent = played && 'card' in played ? played.card : undefined;
  const color = PLAYER_COLORS[player.color]?.hex ?? '#C9A45C';
  return (
    <div data-review-hand className="pointer-events-none fixed left-0 z-[63] flex justify-center" style={{ bottom: insets.bottom, right: insets.right }}>
      <div className="plaque pointer-events-auto flex max-w-[min(760px,92vw)] flex-wrap items-center gap-1.5 rounded-lg px-3 py-1.5">
        <span className="flex shrink-0 items-center gap-1.5 pr-1 font-fell text-[11px] text-cream-100/70">
          <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ backgroundColor: color }} />
          {t('game.debrief.handOf', { name: player.name })}
        </span>
        {hand.length === 0 && <span className="font-sans text-[11px] text-cream-100/45">{t('game.debrief.handEmpty')}</span>}
        {hand.map((c, i) => (
          <span
            key={`${c.id}-${i}`}
            className={cn(
              'rounded border px-1.5 py-0.5 font-sans text-[11px]',
              hidden(c)
                ? 'border-brass-700/40 bg-coal-900/60 text-cream-100/30'
                : spent && c.id === spent
                  ? 'border-brass-400 bg-brass-500/20 text-brass-300'
                  : 'border-brass-700/50 bg-coal-900/70 text-cream-100/80',
            )}
          >
            {hidden(c) ? '·' : cardLabel(c)}
          </span>
        ))}
      </div>
    </div>
  );
}
