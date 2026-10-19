import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '@/i18n';
import { PREVIEW, toOffice } from './office';
import { DISCORD_URL, DiscordTicket } from './Discord';

/* ------------------------------------------------------------------ */
/* The two pages a letter to the waiting list leads to: the seat       */
/* confirmed, and the way out. The first answers as soon as it opens;  */
/* the second waits for a click, so a mail service that opens every    */
/* link to look at it strikes nobody from the list.                    */
/* ------------------------------------------------------------------ */

type Outcome = 'working' | 'ok' | 'bad' | 'down';

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="gz-measure max-w-[640px] pb-24 pt-10">
      <p className="eyebrow-fell">{t('landing.confirm.eyebrow')}</p>
      <h1 className="display-page mt-2">{title}</h1>
      <div className="mt-4 grid gap-5">{children}</div>
      <Link to={PREVIEW} className="micro-label mt-8 inline-flex min-h-6 items-center py-1 text-iron-400 transition-colors hover:text-brass-300">
        ← {t('landing.back')}
      </Link>
    </div>
  );
}

const Said = ({ text }: { text: string }) => <p className="font-serif text-[15px] italic leading-relaxed text-paper-300">{text}</p>;

export function Confirm() {
  const t = useT();
  const { token = '' } = useParams();
  const [outcome, setOutcome] = useState<Outcome>('working');
  /* one answer per link, even when the page is drawn twice */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void toOffice('/waitlist/confirm', { token }).then((s) => setOutcome(s === 200 ? 'ok' : s === 404 ? 'bad' : 'down'));
  }, [token]);
  if (outcome === 'working') return <Sheet title={t('landing.confirm.working')}>{null}</Sheet>;
  if (outcome === 'ok')
    return (
      <Sheet title={t('landing.confirm.title')}>
        <Said text={t('landing.confirm.text')} />
        {DISCORD_URL && (
          <>
            <Said text={t('landing.discord.seat')} />
            <DiscordTicket label={t('landing.discord.join')} className="gz-ticket-brass" />
          </>
        )}
      </Sheet>
    );
  return (
    <Sheet title={t(outcome === 'bad' ? 'landing.confirm.badTitle' : 'landing.confirm.working')}>
      <Said text={t(outcome === 'bad' ? 'landing.confirm.bad' : 'landing.errors.down')} />
    </Sheet>
  );
}

export function Leave() {
  const t = useT();
  const { token = '' } = useParams();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const leave = async () => {
    setOutcome('working');
    const s = await toOffice('/waitlist/leave', { token });
    setOutcome(s === 200 ? 'ok' : s === 404 ? 'bad' : 'down');
  };
  return (
    <Sheet title={t('landing.leave.title')}>
      {outcome === 'ok' ? (
        <Said text={t('landing.leave.done')} />
      ) : outcome === 'bad' ? (
        <Said text={t('landing.leave.bad')} />
      ) : (
        <>
          <Said text={t(outcome === 'down' ? 'landing.errors.down' : 'landing.leave.text')} />
          <button type="button" disabled={outcome === 'working'} onClick={() => void leave()} className="gz-ticket w-fit">
            {t('landing.leave.button')}
          </button>
        </>
      )}
    </Sheet>
  );
}
