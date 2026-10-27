import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { homeSnapshot, subscribeHome } from '@/game/home';
import type { HomeTable } from '@/game/home';
import { guidedResume, startTutorial } from '@/game/quickplay';

/* ------------------------------------------------------------------ */
/* The guided game, as the site's pages offer it. The table left       */
/* unfinished is gone back to; a new one is dealt only when there is   */
/* none, or when the reader asks to start over. The office may not     */
/* answer: the button says so, and the last table's lessons are kept,  */
/* since nothing of them is touched before the new table is dealt.     */
/* ------------------------------------------------------------------ */

export interface GuidedGame {
  /** the guided table to go back to, as the register now stands */
  table: HomeTable | null;
  /** a new table is being dealt at the office */
  busy: boolean;
  /** the office did not deal it */
  failed: boolean;
  /** back to the table left unfinished — or, with none or asked `again`, a new one */
  open: (again?: boolean) => void;
}

export function useGuidedGame(): GuidedGame {
  const navigate = useNavigate();
  /* the register arrives after the page may have: read as it comes */
  const tables = useSyncExternalStore(subscribeHome, homeSnapshot, homeSnapshot);
  const code = guidedResume(tables);
  const table = code ? (tables.find((x) => x.code === code) ?? null) : null;
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const open = (again = false) => {
    if (table && !again) {
      navigate(`/game/local/${table.code}`);
      return;
    }
    if (state === 'busy') return;
    setState('busy');
    startTutorial().then(
      (dealt) => navigate(`/game/local/${dealt}`),
      () => setState('failed'),
    );
  };
  return { table, busy: state === 'busy', failed: state === 'failed', open };
}
