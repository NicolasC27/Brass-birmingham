import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import PageShell from '@/components/site/PageShell';

/* /glossaire — the station's words, each with what it means in the game.
   Every entry is an anchor the « ? » of a page can land on, the words that
   name a page of the station lead to it, and the list is set in the order
   of its significant word, as a reader looks a word up. */

const TERMS: { id: string; to?: string }[] = [
  { id: 'departs', to: '/online' },
  { id: 'quai', to: '/online' },
  { id: 'billet' },
  { id: 'lettre', to: '/setup' },
  { id: 'chef', to: '/desk' },
  { id: 'buffet', to: '/comptoir' },
  { id: 'palmares', to: '/classement' },
  { id: 'registre', to: '/account' },
  { id: 'compagnie', to: '/classement' },
  { id: 'avis', to: '/defis' },
  { id: 'depeches' },
  { id: 'ephemeride', to: '/almanach' },
  { id: 'brevet' },
  { id: 'feuilleton' },
  { id: 'courrier' },
  { id: 'edition' },
  { id: 'portrait' },
];

/** the article that opens a term, in any of the four tongues, is passed over when sorting */
const ARTICLE = /^(?:l[’']|(?:le|la|les|un|une|the|an?|el|los|las|una?|der|die|das|ein|eine)\s+)/i;

export default function Glossaire() {
  const t = useT();
  const lang = useLang();
  const { hash } = useLocation();
  const target = hash.slice(1);
  /* the page is drawn after the browser looked for the anchor: the « ? » of
     another page lands on its word once the list is there */
  useEffect(() => {
    if (!target) return;
    document.getElementById(target)?.scrollIntoView({ block: 'start' });
  }, [target]);
  const collator = new Intl.Collator(lang, { sensitivity: 'base' });
  const terms = TERMS.map((term) => ({ ...term, name: t(`platform.glossary.terms.${term.id}.name`) })).sort((a, b) =>
    collator.compare(a.name.replace(ARTICLE, ''), b.name.replace(ARTICLE, '')),
  );
  return (
    <PageShell back={{ to: '/', label: t('platform.glossary.back') }} eyebrow={t('platform.glossary.eyebrow')} title={t('platform.glossary.title')} lede={t('platform.glossary.lede')}>
      {/* set in two columns read downwards, as a dictionary is; each entry is
          ruled above and the list closes on a full rule, so the odd last one
          no longer leaves a half line hanging */}
      <dl className="gap-x-10 border-b border-[var(--gz-ink-faint)] min-[900px]:columns-2">
        {terms.map(({ id, to, name }) => (
          <div key={id} id={id} className={cn('scroll-mt-24 break-inside-avoid border-t border-[var(--gz-ink-faint)] py-4', id === target && '-mx-3 bg-enamel-800 px-3')}>
            <dt className="font-fraunces text-[18px] font-medium text-paper-100">
              {to ? (
                <Link to={to} className="group inline-flex items-baseline gap-2 transition-colors hover:text-brass-500">
                  {name}
                  <span aria-hidden className="font-ui text-[14px] text-brass-500">→</span>
                </Link>
              ) : (
                name
              )}
            </dt>
            <dd className="mt-1 font-serif text-[14px] italic leading-relaxed text-paper-300">{t(`platform.glossary.terms.${id}.def`)}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
