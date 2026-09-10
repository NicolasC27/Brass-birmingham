import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Copy, KeyRound } from 'lucide-react';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import { lobby, normalizeCode } from '@/online/lobby';
import type { LobbyError } from '@/online/lobby';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Online — the telegraph office. Sign the visitors' book, then either */
/* open a table (you get a brass code to pass around) or answer an     */
/* invitation by typing its four glyphs. Both roads lead to the room.  */
/* ------------------------------------------------------------------ */

/** the four-glyph code as brass slots — filled or waiting */
function CodeSlots({ value, large }: { value: string; large?: boolean }) {
  return (
    <span className={cn('inline-flex gap-1.5', large && 'gap-2')} aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'flex items-center justify-center rounded-[5px] border font-mono font-bold text-brass-400',
            large ? 'h-14 w-12 text-[26px]' : 'h-9 w-8 text-[16px]',
            value[i] ? 'border-brass-400/80 bg-coal-950 shadow-[inset_0_2px_6px_rgba(0,0,0,.6),0_0_0_1px_rgba(201,164,92,.25)]' : 'border-dashed border-brass-700/50 bg-coal-950/40 text-brass-700/60',
          )}
        >
          {value[i] ?? '·'}
        </span>
      ))}
    </span>
  );
}

export default function Online() {
  const t = useT();
  const navigate = useNavigate();
  const [name, setName] = useState(lobby.me.name);
  const [tableName, setTableName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<LobbyError | null>(null);
  const named = name.trim().length > 0;
  const commitName = () => lobby.setName(name.trim());

  const create = () => {
    if (!named) return;
    commitName();
    const table = lobby.create(tableName.trim() || t('online.entry.create.defaultName', { name: name.trim() }), DEFAULT_OPTIONS);
    navigate(`/online/${table.code}`);
  };
  const join = () => {
    if (!named || code.length < 4) return;
    commitName();
    try {
      lobby.join(code);
      navigate(`/online/${code}`);
    } catch (e) {
      setError((e as Error).message as LobbyError);
    }
  };

  const label = 'font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-400/80';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(16,13,11,0.75) 100%)' }} />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.05]" />
      <div className="relative mx-auto max-w-[1180px] px-6 py-10 lg:py-14">
        <header className="mb-8">
          <Link to="/" className="mb-4 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('online.entry.back')}
          </Link>
          <p className="eyebrow">{t('online.entry.eyebrow')}</p>
          <h1 className="mt-2 font-display text-[44px] font-black leading-none tracking-[-0.01em] text-cream-100">{t('online.entry.title')}</h1>
          <p className="mt-3 max-w-2xl font-sans text-[14px] leading-relaxed text-cream-100/65">{t('online.entry.subtitle')}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* the visitors' book: who you are at the table */}
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="paper relative self-start p-6">
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.35]" />
            <div className="relative">
              <p className="font-fell text-[11px] uppercase tracking-[0.2em] text-ink-900/60">{t('online.entry.book')}</p>
              <label htmlFor="online-name" className="mt-4 block font-fell text-lg text-ink-900">
                {t('online.entry.yourName')}
              </label>
              <input
                id="online-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                maxLength={18}
                placeholder={t('online.entry.namePlaceholder')}
                autoComplete="nickname"
                className="mt-2 w-full border-0 border-b-2 border-ink-900/40 bg-transparent px-0 py-1.5 font-serif text-[22px] italic text-ink-900 placeholder:text-ink-900/30 focus:border-ink-900 focus:outline-none"
              />
              <p className="mt-3 font-sans text-[11.5px] leading-relaxed text-ink-900/60">{t('online.entry.nameHint')}</p>
            </div>
          </motion.section>

          <div className="grid gap-6">
            {/* open a table */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06, ease: 'easeOut' }} className="plate relative p-6">
              <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]" />
              <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">{t('online.entry.create.title')}</h2>
                  <div className="divider-brass mt-3 !mx-0" />
                  <p className="mt-3 font-sans text-[12.5px] leading-relaxed text-cream-100/60">{t('online.entry.create.copy')}</p>
                  <label className={cn(label, 'mt-4 block')} htmlFor="online-table">
                    {t('online.entry.create.tableName')}
                  </label>
                  <input
                    id="online-table"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    maxLength={28}
                    placeholder={t('online.entry.create.tablePlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && create()}
                    className="mt-1.5 w-full max-w-sm rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-2 font-sans text-[14px] text-cream-100 placeholder:text-cream-100/30 focus:border-brass-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-cream-100/40">{t('online.entry.create.codePreview')}</span>
                  <CodeSlots value="" large />
                  <button type="button" onClick={create} disabled={!named} className="btn-strike !h-12 !px-6 disabled:cursor-not-allowed disabled:opacity-40">
                    {t('online.entry.create.cta')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.section>

            {/* answer an invitation */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }} className="plate relative p-6">
              <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]" />
              <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="flex items-center gap-2 font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
                    <KeyRound className="h-4 w-4 text-brass-400" />
                    {t('online.entry.join.title')}
                  </h2>
                  <div className="divider-brass mt-3 !mx-0" />
                  <p className="mt-3 font-sans text-[12.5px] leading-relaxed text-cream-100/60">{t('online.entry.join.copy')}</p>
                  <label className={cn(label, 'mt-4 block')} htmlFor="online-code">
                    {t('online.entry.join.code')}
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      id="online-code"
                      value={code}
                      onChange={(e) => {
                        setCode(normalizeCode(e.target.value));
                        setError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && join()}
                      maxLength={4}
                      spellCheck={false}
                      autoCapitalize="characters"
                      placeholder="····"
                      className="w-[9rem] rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-2 text-center font-mono text-[22px] font-bold uppercase tracking-[0.4em] text-brass-400 placeholder:text-brass-700/50 focus:border-brass-400 focus:outline-none"
                    />
                    <CodeSlots value={code} />
                  </div>
                  {error && (
                    <p role="alert" className="mt-2 font-sans text-[12px] text-rust-500 brightness-150">
                      {t(`online.entry.join.error.${error}`)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={join} disabled={!named || code.length < 4} className="btn-ledger !h-12 !px-6 self-end disabled:cursor-not-allowed disabled:opacity-40 md:self-center">
                  {t('online.entry.join.cta')}
                </button>
              </div>
            </motion.section>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 font-sans text-[11px] text-cream-100/40">
          <Copy className="h-3 w-3" /> {t('online.entry.localNote')}
        </p>
      </div>
    </div>
  );
}
