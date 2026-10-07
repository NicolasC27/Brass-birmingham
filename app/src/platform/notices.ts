/* ------------------------------------------------------------------ */
/* Les avis au public — ce que la direction affiche en gare avant que  */
/* la chose existe. Une ligne en projet, un tracé à l'étude, une mise  */
/* en service annoncée sans date : le registre des travaux, tenu ici   */
/* et livré avec le site, le plus récent en tête.                      */
/*                                                                     */
/* Le texte vit en i18n sous platform.notices.<id> ; l'avis lu est une */
/* préférence de lecture, gardée par le navigateur comme l'arrivée.    */
/* ------------------------------------------------------------------ */

/** où en est le chantier d'un avis */
export type Stage = 'study' | 'works' | 'open';

export interface Notice {
  id: string;
  /** le jour de l'affichage, en ISO */
  at: string;
  stage: Stage;
}

/** les avis, le plus récent en tête */
export const NOTICES: Notice[] = [{ id: 'companies', at: '2026-10-07', stage: 'study' }];

const KEY = 'brassworks.notices.read.v1';

const read = (): Set<string> => {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

/** l'avis en tête d'affiche, tant que le lecteur ne l'a pas décroché */
export function standingNotice(): Notice | null {
  const seen = read();
  return NOTICES.find((n) => !seen.has(n.id)) ?? null;
}

/** décrocher un avis : il ne se réaffiche plus dans ce navigateur */
export function markRead(id: string): void {
  try {
    const seen = read();
    seen.add(id);
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    /* navigation privée : l'avis se réaffichera, sans dommage */
  }
}
