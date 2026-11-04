import { Link } from 'react-router';
import { useT } from '@/i18n';
import { setTrailOff, useTrailOff } from '@/components/game/guideTrail';
import { cn } from '@/lib/utils';

/* what the guided game notes for the direction, in one line, with the
   reader's no beside it — under every door that opens a guided game:
   the evening course, and the desk's strip */
export default function TrailNotice({ className }: { className?: string }) {
  const t = useT();
  const off = useTrailOff();
  return (
    <p className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-[13px] italic text-paper-300', className)}>
      <span>{t('platform.trail.line')}</span>
      <label className="inline-flex items-center gap-1.5 font-ui text-[12px] not-italic text-paper-100 coarse:min-h-[44px]">
        <input type="checkbox" checked={!off} onChange={(e) => setTrailOff(!e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brass-300))]" />
        {t('platform.trail.keep')}
      </label>
      <Link to="/legal#privacy" className="font-ui text-[10.5px] font-semibold uppercase not-italic tracking-label text-brass-500 transition-colors hover:text-paper-100">
        {t('platform.trail.more')} →
      </Link>
    </p>
  );
}
