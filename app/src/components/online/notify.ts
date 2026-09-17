import type { ToastData } from '@/components/platform/Toast';

/* Notification remontée à la page : un seul Toast rendu par /online. */
export type Notify = (toast: Omit<ToastData, 'id'>) => void;

/** message d'erreur lobby → libellé i18n, avec repli honnête */
export function lobbyErrorText(t: (key: string) => string, e: unknown, fallback: string): string {
  const key = `site.desk.error.${(e as Error).message}`;
  const text = t(key);
  return text === key ? fallback : text;
}
