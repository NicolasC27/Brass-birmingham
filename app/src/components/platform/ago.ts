import { localeOf, type useT } from '@/i18n';

/** « il y a 4 min », then hours, then days; a date past the week */
export function ago(t: ReturnType<typeof useT>, lang: string, at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return t('platform.time.now');
  if (minutes < 60) return t('platform.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('platform.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('platform.time.daysAgo', { count: days });
  return new Date(at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short' });
}
