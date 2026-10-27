import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { homeSnapshot, subscribeHome } from '@/game/home';
import type { HomeTable } from '@/game/home';
import { guidedResume, startTutorial } from '@/game/quickplay';

/* ------------------------------------------------------------------ */
/* The guided game, as the site's pages offer it. The table left       */
/* unfinished is gone back to; a new one is dealt only when there is   */
/* none, or when the reader asks to start over.                        */
/* ------------------------------------------------------------------ */

export interface GuidedGame {
  /** the guided table to go back to, as the register now stands */
  table: HomeTable | null;
  /** back to the table left unfinished — or, with none or asked `again`, a new one */
  open: (again?: boolean) => void;
}

export function useGuidedGame(): GuidedGame {
  const navigate = useNavigate();
  /* the register arrives after the page may have: read as it comes */
  const tables = useSyncExternalStore(subscribeHome, homeSnapshot, homeSnapshot);
  const code = guidedResume(tables);
  const table = code ? (tables.find((x) => x.code === code) ?? null) : null;
  const open = (again = false) => {
    if (table && !again) {
      navigate(`/game/local/${table.code}`);
      return;
    }
    void startTutorial().then((dealt) => navigate(`/game/local/${dealt}`));
  };
  return { table, open };
}
