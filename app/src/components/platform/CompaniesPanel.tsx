import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { foundCompany, joinCompany, leaveCompany, useCompanies, useDesk } from '@/online/session';
import Button from './Button';
import GlossMark from './GlossMark';
import Modal from './Modal';

/* ------------------------------------------------------------------ */
/* The companies: the honours rank them by their members' wins this   */
/* season; beside the table, my own company — or the means to found    */
/* one under a name of the era, or to join one of those listed. The    */
/* two columns part at 900px, as the honours above them do, and both  */
/* open on the same double rule with their heads under it.            */
/* ------------------------------------------------------------------ */

export default function CompaniesPanel() {
  const t = useT();
  const board = useCompanies();
  const desk = useDesk();
  const mine = desk?.company ?? board?.mine ?? null;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* joining binds the member to one company: it is asked twice */
  const [joining, setJoining] = useState<{ id: string; name: string } | null>(null);

  const run = async (op: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await op();
      setName('');
    } catch (e) {
      const code = e instanceof Error ? e.message : 'refused';
      setError(t(`platform.companies.errors.${['in-company', 'name-taken', 'name-short', 'not-found'].includes(code) ? code : 'refused'}`));
    } finally {
      setBusy(false);
    }
  };

  const rows = board?.rows ?? [];
  /* the ticket cannot be handed in yet: it is put out, not faded */
  const notEnough = busy || name.trim().length < 3;
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut', delay: 0.12 }} className="mt-12" aria-label={t('platform.companies.title')}>
      <h2 className="gz-head h2-section">{t('platform.companies.title')}</h2>
      <p className="mt-3 text-center font-serif text-[14px] italic text-paper-300">{t('platform.companies.lede')}</p>

      <div className="mt-8 grid gap-8 min-[900px]:grid-cols-12">
        <div className="min-[900px]:col-span-8">
          <div className="gz-rule-double" aria-hidden />
          {rows.length === 0 ? (
            <p className="px-2 py-8 text-center font-serif text-[14px] italic text-paper-300">{board ? t('platform.companies.none') : t('platform.ranking.loading')}</p>
          ) : (
            <table className="gz-timetable">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>{t('platform.companies.name')}</th>
                  <th className="w-[84px] !text-right">{t('platform.companies.colMembers')}</th>
                  <th className="w-[84px] !text-right">{t('platform.companies.colWins')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={cn(mine?.id === row.id && 'bg-brass-500/[.06]')}>
                    <td className="data-text text-iron-400 tnums">{i + 1}.</td>
                    <td>
                      <span className={cn('font-fraunces text-[15px] font-medium', mine?.id === row.id ? 'text-brass-300' : 'text-paper-100')}>
                        {row.name}
                      </span>
                    </td>
                    {/* the column heads name the unit, so the cells print the figures alone */}
                    <td className="data-text whitespace-nowrap text-right text-paper-300 tnums">{row.members}</td>
                    <td className="data-text whitespace-nowrap text-right text-paper-300 tnums">{t('platform.companies.winsCell', { n: row.wins, games: row.games })}</td>
                    <td className="w-px pr-2 text-right">
                      {!mine && (
                        <button type="button" disabled={busy} onClick={() => setJoining({ id: row.id, name: row.name })} className={cn('gz-ticket gz-ticket-sm', busy && 'is-off')}>
                          {t('platform.companies.join')} →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="gz-col-rule-900 min-[900px]:col-span-4">
          <div className="gz-rule-double" aria-hidden />
          {/* the column's head, set as the table's are: under the double rule */}
          <p className="micro-label flex items-center border-b border-[var(--gz-ink-soft)] px-2 py-1.5 text-paper-100">
            {t('platform.companies.mine')}
            <GlossMark id="compagnie" />
          </p>
          {mine ? (
            <div className="mt-4">
              <p className="font-fraunces text-[22px] font-medium leading-tight text-paper-100">
                {mine.name}
              </p>
              <p className="data-text mt-1 text-iron-400 tnums">{t('platform.companies.members', { n: mine.members })}</p>
              <Button variant="danger-ghost" className="mt-4 !h-8" disabled={busy} onClick={() => void run(leaveCompany)}>
                {t('platform.companies.leave')}
              </Button>
            </div>
          ) : (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => foundCompany(name));
              }}
            >
              <p className="font-serif text-[13.5px] italic leading-relaxed text-paper-300">{t('platform.companies.foundHint')}</p>
              <label htmlFor="company-name" className="micro-label mt-4 block text-brass-300">
                {t('platform.companies.name')}
              </label>
              <input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={t('platform.companies.placeholder')}
                /* the name is typed in the house's title face; the example
                   under it is only a hint, set in the small sans */
                className="mt-1.5 w-full border-b border-[var(--gz-ink-soft)] bg-transparent py-2 font-fraunces text-[18px] text-paper-100 placeholder:font-ui placeholder:text-[13px] placeholder:text-iron-400 focus:border-brass-300"
              />
              <button type="submit" disabled={notEnough} className={cn('gz-ticket gz-ticket-brass mt-4', notEnough && 'is-off')}>
                {t('platform.companies.found')} →
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-3 font-serif text-[13px] italic text-rust-400">
              {error}
            </p>
          )}
        </aside>
      </div>

      <Modal open={joining !== null} onClose={() => !busy && setJoining(null)} title={joining ? t('platform.companies.joinTitle', { name: joining.name }) : undefined}>
        {joining && (
          <>
            <p className="font-serif text-[14px] italic leading-relaxed text-paper-300">{t('platform.companies.joinCopy')}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="ticket-brass"
                disabled={busy}
                onClick={() => {
                  const id = joining.id;
                  setJoining(null);
                  void run(() => joinCompany(id));
                }}
              >
                {t('platform.companies.join')} →
              </Button>
              <Button variant="ticket" disabled={busy} onClick={() => setJoining(null)}>
                {t('platform.companies.cancel')}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </motion.section>
  );
}
