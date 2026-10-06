import { paper, writePaper } from '@/platform/papers';

/* ------------------------------------------------------------------ */
/* The form — how the house rates the player at home.                  */
/*                                                                     */
/* Local games have no cote. What they have is a run of results        */
/* against the machines, folded into one number between 0 and 1 that   */
/* the machines play at: a win moves it up, a loss down, and the first  */
/* games start it gently. It is one of the office's papers.            */
/* ------------------------------------------------------------------ */

export interface Form {
  /** the strength the machines play at, 0 to 1 */
  level: number;
  games: number;
}

export const FRESH_FORM: Form = { level: 0.5, games: 0 };
const FLOOR = 0.3;
const WIN = 0.08;
const LOSS = 0.05;

export function readForm(): Form {
  const f = paper<Partial<Form> | null>('form', null);
  if (!f || typeof f.level !== 'number' || !Number.isFinite(f.level)) return FRESH_FORM;
  return { level: Math.max(FLOOR, Math.min(1, f.level)), games: typeof f.games === 'number' ? f.games : 0 };
}

/** a game against the machines played out: the form moves */
export function recordForm(won: boolean): Form {
  const was = readForm();
  const next: Form = { level: Math.max(FLOOR, Math.min(1, was.level + (won ? WIN : -LOSS))), games: was.games + 1 };
  writePaper('form', next);
  return next;
}
