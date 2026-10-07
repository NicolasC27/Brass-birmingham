import { useLang, useT, localeOf } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useTables } from '@/online/session';
import type { Dispatch } from '@/online/table';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The telegraph: the latest headlines wired from the tables in play,  */
/* as the Gazette wrote them at the close of a round — the table, the  */
/* line, the hour. Nothing is made up; the office keeps ten.           */
/* ------------------------------------------------------------------ */

const SHOWN = 6;

function hour(at: number, lang: string): string {
  return new Date(at).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });
}

export default function Telegraph() {
  const t = useT();
  const lang = useLang();
  /* the office keeps one register at a time: every reader on this page
     asks for the same page, or the last asking blanks the others */
  const page = useTables({ limit: 12 });
  const dispatches: Dispatch[] = page?.dispatches ?? [];
  const say = (d: Dispatch) => t(`game.gazette.${d.key}`, { ...d.vars, goods: d.vars.goods ? t(`game.log.industry.${d.vars.goods}`) : '' });
  return (
    <section aria-label={t('platform.home.telegraph.title')}>
      <h2 className="micro-label flex items-center gap-2 text-paper-100">
        <span className={dispatches.length ? 'animate-presence-dot h-1.5 w-1.5 rounded-full bg-signal-400' : 'h-1.5 w-1.5 rounded-full bg-iron-600'} aria-hidden />
        {t('platform.home.telegraph.title')}
        <GlossMark id="depeches" />
      </h2>
      <div className="mt-1 border-t border-[var(--gz-ink-soft)]" aria-live="polite">
        {dispatches.length === 0 ? (
          <p className="px-1 py-5 text-center font-serif text-[13px] text-paper-300">{t('platform.home.telegraph.none')}</p>
        ) : (
          dispatches.slice(0, SHOWN).map((d, i) => (
            <p key={`${d.code}:${d.at}:${i}`} className="flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] px-1 py-2 last:border-b-0">
              <span className="data-text shrink-0 text-[10.5px] text-iron-400 tnums">{hour(d.at, lang)}</span>
              <span className="min-w-0 flex-1 font-serif text-[13px] leading-snug text-paper-100">
                <span className="text-iron-400">« {tableTitle(d.table, lang)} » — </span>
                {say(d)}
              </span>
            </p>
          ))
        )}
      </div>
    </section>
  );
}
