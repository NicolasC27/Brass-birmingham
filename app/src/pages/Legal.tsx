import { useEffect } from 'react';
import { useLocation } from 'react-router';
import PageShell, { Panel } from '@/components/site/PageShell';
import { localeOf, useLang, useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The legal notice and the privacy policy — who runs the house, what  */
/* it keeps of a member and for how long, and the member's rights.     */
/* The house's own particulars come from the build's environment       */
/* (VITE_LEGAL_OPERATOR, VITE_LEGAL_CONTACT, VITE_LEGAL_HOST), so they  */
/* live in .env.local and not in the repository.                       */
/* ------------------------------------------------------------------ */

/** the date this policy was last changed — bump it with the text */
export const POLICY_DATE = '2026-09-13';

const env = (key: string): string => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();

/** the strings under a key, as many as the dictionary has */
function list(t: (k: string) => string, key: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 24; i++) {
    const s = t(`${key}.${i}`);
    if (s.endsWith(`.${i}`)) break;
    out.push(s);
  }
  return out;
}

/** a paragraph whose web addresses are links */
function Prose({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s,;]+|www\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s,;]*)?)/gi);
  return (
    <p className="font-ui text-[14px] leading-relaxed text-paper-300">
      {parts.map((p, i) =>
        /^(https?:\/\/|www\.)/i.test(p) ? (
          <a key={i} href={p.startsWith('http') ? p : `https://${p}`} target="_blank" rel="noopener noreferrer" className="text-brass-300 underline decoration-brass-500/40 underline-offset-2 hover:text-brass-200">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}

export default function Legal() {
  const t = useT();
  const lang = useLang();
  const { hash } = useLocation();
  const todo = t('platform.legal.todo');
  const vars = {
    operator: env('VITE_LEGAL_OPERATOR') || todo,
    contact: env('VITE_LEGAL_CONTACT') || todo,
    host: env('VITE_LEGAL_HOST') || todo,
  };
  const tv = (k: string) => t(k, vars);
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const sections: { h: string; p: string[] }[] = [];
  for (let i = 0; i < 16; i++) {
    const h = t(`platform.legal.privacy.sections.${i}.h`);
    if (h.endsWith(`.${i}.h`)) break;
    sections.push({ h, p: list(tv, `platform.legal.privacy.sections.${i}.p`) });
  }
  const date = new Date(POLICY_DATE).toLocaleDateString(localeOf(lang), { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <PageShell back={{ to: '/', label: t('platform.account.back') }} eyebrow={t('platform.legal.eyebrow')} title={t('platform.legal.title')} lede={t('platform.legal.lede')} width="narrow">
      <div className="grid gap-6">
        <section id="notice">
          <Panel title={t('platform.legal.notice.title')}>
            <div className="grid gap-3">
              {list(tv, 'platform.legal.notice.items').map((p, i) => (
                <Prose key={i} text={p} />
              ))}
            </div>
          </Panel>
        </section>
        <section id="privacy">
          <Panel title={t('platform.legal.privacy.title')}>
            <div className="grid gap-6">
              {sections.map((s) => (
                <div key={s.h}>
                  <h3 className="title-card mb-2">{s.h}</h3>
                  <div className="grid gap-2">
                    {s.p.map((p, i) => (
                      <Prose key={i} text={p} />
                    ))}
                  </div>
                </div>
              ))}
              <p className="micro-label text-iron-400">{t('platform.legal.privacy.updated', { date })}</p>
            </div>
          </Panel>
        </section>
      </div>
    </PageShell>
  );
}
