import { useT } from '@/i18n';
import PageShell from '@/components/site/PageShell';

/* /glossaire — the station's words, each with what it means in the game */

const TERMS = ["departs", "quai", "billet", "lettre", "chef", "buffet", "palmares", "registre", "compagnie", "avis", "depeches", "ephemeride", "brevet", "feuilleton", "courrier", "edition", "portrait"];

export default function Glossaire() {
  const t = useT();
  return (
    <PageShell eyebrow={t('platform.glossary.eyebrow')} title={t('platform.glossary.title')} lede={t('platform.glossary.lede')}>
      <div className="gz-rule-double" aria-hidden />
      <dl className="grid gap-x-10 min-[900px]:grid-cols-2">
        {TERMS.map((id) => (
          <div key={id} className="border-b border-[var(--gz-ink-faint)] py-4">
            <dt className="font-fraunces text-[18px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
              {t(`platform.glossary.terms.${id}.name`)}
            </dt>
            <dd className="mt-1 font-serif text-[14px] italic leading-relaxed text-paper-300">{t(`platform.glossary.terms.${id}.def`)}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
