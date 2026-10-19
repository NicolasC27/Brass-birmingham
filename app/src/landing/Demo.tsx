import { useContext, useMemo, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import Game from '@/pages/Game';

/* ------------------------------------------------------------------ */
/* /demo — the preview's taste of the game: the real table, dealt and  */
/* played in this browser against Mr Watt and Mrs Wedgwood, nothing    */
/* written anywhere. After the second round the table is covered by a  */
/* card that sends the player back to the waiting list — the page is   */
/* usually framed inside the front page, so the way out leaves the     */
/* frame. Built for the page, lazily: the game comes only on a click.  */
/*                                                                     */
/* The table never leads anywhere else: every way the game has of      */
/* leaving (quit, resign, the results, a link to the club) is caught   */
/* before the address changes, and brings up the last card instead.     */
/* ------------------------------------------------------------------ */

/** the rounds the taste lasts */
export const DEMO_ROUNDS = 2;

function DemoEnd({ onAgain }: { onAgain: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(12,9,6,0.78)] p-6 backdrop-blur-[3px]">
      <div className="platform-root w-full max-w-[520px] border border-brass-300/60 bg-lacquer-900 p-8 text-center text-paper-100 shadow-2xl">
        <p className="eyebrow-fell">{t('landing.demo.endKicker')}</p>
        <h2 className="mt-2 font-fraunces text-[28px] italic leading-tight">{t('landing.demo.endTitle')}</h2>
        <p className="mt-3 font-serif text-[16px] leading-relaxed text-paper-300">{t('landing.demo.endText')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/#ticket" target="_top" className="gz-ticket gz-ticket-brass !h-12 !px-6">
            {t('landing.demo.ticket')}
          </a>
          <button type="button" className="gz-ticket !h-12" onClick={onAgain}>
            {t('landing.demo.again')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  const t = useT();
  const played = useGame((s) => !!s.game && (s.game.round > DEMO_ROUNDS || s.game.era !== 'canal' || s.game.phase === 'game-over'));
  /* the game asked to go somewhere: it stays, and the last card comes up */
  const [left, setLeft] = useState(false);
  const outer = useContext(UNSAFE_NavigationContext);
  const held = useMemo(() => {
    const stay = () => setLeft(true);
    return { ...outer, navigator: { ...outer.navigator, push: stay, replace: stay, go: stay } };
  }, [outer]);
  const again = () => {
    setLeft(false);
    useGame.getState().startDemo();
  };
  return (
    <div className="flex min-h-[100dvh] flex-col bg-coal-900">
      <main className="flex-1">
        <UNSAFE_NavigationContext.Provider value={held}>
          <Game demo />
        </UNSAFE_NavigationContext.Provider>
      </main>
      {/* an alpha, said on the table itself: under the order strip, over nothing that is played */}
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-[64px] z-[150] -translate-x-1/2 border border-brass-300/70 bg-[rgba(12,9,6,0.72)] px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300 shadow-lg">
        {t('landing.demo.alpha')}
      </div>
      {(played || left) && <DemoEnd onAgain={again} />}
    </div>
  );
}
