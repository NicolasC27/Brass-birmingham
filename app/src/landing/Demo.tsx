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
/* ------------------------------------------------------------------ */

/** the rounds the taste lasts */
export const DEMO_ROUNDS = 2;

function DemoEnd() {
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
          <button type="button" className="gz-ticket !h-12" onClick={() => useGame.getState().startDemo()}>
            {t('landing.demo.again')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  const over = useGame((s) => !!s.game && (s.game.round > DEMO_ROUNDS || s.game.era !== 'canal'));
  return (
    <div className="flex min-h-[100dvh] flex-col bg-coal-900">
      <main className="flex-1">
        <Game demo />
      </main>
      {over && <DemoEnd />}
    </div>
  );
}
