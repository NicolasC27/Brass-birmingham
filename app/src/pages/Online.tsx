import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, KeyRound } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import { isOnline, lobby, normalizeCode } from '@/online/lobby';
import { useLine, useSession, useStranger } from '@/online/session';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The telegraph office, when there is no server: tables live in this  */
/* browser and a second tab plays the guest. With a server, this door  */
/* leads to the desk (or to the register first).                       */
/* ------------------------------------------------------------------ */

function LocalOffice() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState(lobby.me.name);
  const [tableName, setTableName] = useState('');
  const [code, setCode] = useState(normalizeCode(params.get('table') ?? ''));
  const [error, setError] = useState<string | null>(null);
  const named = name.trim().length > 0;
  const commitName = () => lobby.setName(name.trim());

  const create = async () => {
    if (!named) return;
    commitName();
    try {
      const table = await lobby.create(tableName.trim() || t('site.desk.defaultName', { name: name.trim() }), DEFAULT_OPTIONS);
      navigate(`/online/${table.code}`);
    } catch (e) {
      setError(t(`site.desk.error.${(e as Error).message}`));
    }
  };
  const join = async () => {
    if (!named || code.length < 4) return;
    commitName();
    try {
      await lobby.join(code);
      navigate(`/online/${code}`);
    } catch (e) {
      setError(t(`site.desk.error.${(e as Error).message}`));
    }
  };

  return (
    <PageShell back={{ to: '/', label: t('site.account.back') }} eyebrow={t('site.local.eyebrow')} title={t('site.local.title')} lede={t('site.local.lede')}>
      <Refusal text={error} />
      <div className="mt-2 grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel tone="paper" title={t('online.entry.book')}>
          <label htmlFor="online-name" className="block font-fell text-lg text-ink-900">
            {t('online.entry.yourName')}
          </label>
          <input
            id="online-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            maxLength={20}
            placeholder={t('online.entry.namePlaceholder')}
            autoComplete="nickname"
            className="mt-2 w-full border-0 border-b-2 border-ink-900/40 bg-transparent px-0 py-1.5 font-serif text-[22px] italic text-ink-900 placeholder:text-ink-900/30 focus:border-ink-900 focus:outline-none"
          />
          <p className="mt-3 font-sans text-[11.5px] leading-relaxed text-ink-900/60">{t('online.entry.nameHint')}</p>
        </Panel>
        <div className="grid content-start gap-6">
          <Panel title={t('site.desk.open')}>
            <p className="font-serif text-[14px] leading-relaxed text-cream-100/65">{t('site.desk.openCopy')}</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Field id="online-table" label={t('site.desk.tableName')}>
                  <input id="online-table" value={tableName} onChange={(e) => setTableName(e.target.value)} maxLength={28} placeholder={t('site.desk.tablePlaceholder')} onKeyDown={(e) => e.key === 'Enter' && create()} className={inputClass} />
                </Field>
              </div>
              <button type="button" onClick={create} disabled={!named} className="btn-strike disabled:cursor-not-allowed disabled:opacity-40">
                {t('site.desk.openCta')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </Panel>
          <Panel title={t('site.desk.join')}>
            <div className="flex flex-wrap items-center gap-3">
              <KeyRound className="h-4 w-4 text-brass-400" />
              <input
                aria-label={t('site.desk.code')}
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                maxLength={4}
                spellCheck={false}
                placeholder="····"
                className="w-[7.5rem] rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-1.5 text-center font-mono text-[20px] font-bold uppercase tracking-[0.4em] text-brass-400 placeholder:text-brass-700/50 focus:border-brass-400 focus:outline-none"
              />
              <button type="button" onClick={join} disabled={!named || code.length < 4} className="btn-ledger disabled:cursor-not-allowed disabled:opacity-40">
                {t('site.desk.joinCta')}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

export default function Online() {
  const session = useSession();
  const stranger = useStranger();
  const line = useLine();
  const [params] = useSearchParams();
  if (!isOnline) return <LocalOffice />;
  const table = normalizeCode(params.get('table') ?? '');
  const query = table ? `?table=${table}` : '';
  if (session) return <Navigate to={table ? `/account${query}` : '/desk'} replace />;
  /* a stranger, or a token the office is not there to answer: the door */
  if (stranger || line === 'offline') return <Navigate to={`/account${query}`} replace />;
  /* a token on its way: a moment, then one of the two doors */
  return null;
}
