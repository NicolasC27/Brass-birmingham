import { WifiOff } from 'lucide-react';
import { tr } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The office is not answering.                                        */
/*                                                                     */
/* Games, papers and notes are the office's now, so a browser that     */
/* cannot reach it has nothing to show and nothing to play. It says so */
/* plainly, and says the thing that matters: nothing is lost, because  */
/* nothing was ever kept here.                                         */
/* ------------------------------------------------------------------ */

export default function Unreachable() {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-[560px] px-6 text-center">
      <WifiOff size={28} aria-hidden className="mx-auto text-rust-400" />
      <h1 className="mt-3 font-fraunces text-[24px] font-semibold text-paper-100">{tr('platform.play.offline.title')}</h1>
      <p className="mx-auto mt-2 max-w-md font-ui text-[14px] leading-relaxed text-paper-300">{tr('platform.play.offline.copy')}</p>
      <button type="button" onClick={() => window.location.reload()} className="btn-ledger mt-5">
        {tr('platform.play.offline.retry')}
      </button>
    </div>
  );
}
