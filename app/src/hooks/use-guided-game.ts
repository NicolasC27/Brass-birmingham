import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { homeKnown, homeSnapshot, subscribeHome } from '@/game/home';
import type { HomeTable } from '@/game/home';
import { guidedBound, guidedResume, openGuided } from '@/game/quickplay';

/* ------------------------------------------------------------------ */
/* The guided game, as the site's pages offer it. The table left      */
/* unfinished is gone back to — the register read first, should the   */
/* site have opened before the office gave it; a new one is dealt     */
/* only when there is none, or when the reader asks to start over.    */
/* The office may not answer: the button says so, and the last        */
/* table's lessons are kept, since nothing of them is touched before  */
/* the new table is dealt.                                            */
/* ------------------------------------------------------------------ */

export interface GuidedGame {
  /** the guided table to go back to, as the register now stands */
  table: HomeTable | null;
  /** a guided table is left unfinished: the one above, or one bound
   *  while the register has not been read — most likely still there */
  unfinished: boolean;
  /** a table is being looked up or dealt at the office */
  busy: boolean;
  /** the office did not answer */
  failed: boolean;
  /** back to the table left unfinished — or, with none or asked `again`, a new one */
  open: (again?: boolean) => void;
}

export function useGuidedGame(): GuidedGame {
  const navigate = useNavigate();
  /* the register arrives after the page may have: read as it comes */
  const tables = useSyncExternalStore(subscribeHome, homeSnapshot, homeSnapshot);
  const known = useSyncExternalStore(subscribeHome, homeKnown, homeKnown);
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
    openGuided(again).then(
      (dealt) => navigate(`/game/local/${dealt}`),
      () => setState('failed'),
    );
  };
  return { table, unfinished: !!table || (!known && guidedBound() !== null), busy: state === 'busy', failed: state === 'failed', open };
}
