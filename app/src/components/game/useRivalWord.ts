import { useEffect, useRef } from 'react';
import { personaName } from '@/game/data';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { loadRivals, noteSpoken, rivalWordFor, spokenVars } from '@/platform/rivals';
import { portraitFor } from './portraits';
import type { Incoming } from './noticeQueue';

/* ------------------------------------------------------------------ */
/* A rival's word as a game at home opens: the character at the table  */
/* with the most history against the reader says one line of it — the  */
/* town taken from it, the streak, the loans — as the first notice of  */
/* the book, filed like any other. Said once a game: a table read      */
/* again is not greeted twice. Never in the guided game, which has its */
/* own voice. Whatever the game, the rivalries are asked for as it     */
/* opens, so the letter that ends it can close on their count.         */
/* ------------------------------------------------------------------ */

export function useRivalWord(post: (items: Incoming[]) => void): void {
  const t = useT();
  const local = useGame((s) => s.local);
  const tutorial = useGame((s) => s.tutorial);
  const opening = useGame((s) => !!s.game && s.game.phase !== 'game-over' && s.game.era === 'canal' && s.game.round === 1);
  const said = useRef<string | null>(null);

  useEffect(() => {
    if (!local) return;
    let live = true;
    void loadRivals().then((rivals) => {
      if (!live || !rivals || !opening || tutorial || said.current === local) return;
      said.current = local;
      const g = useGame.getState().game;
      if (!g || useGame.getState().local !== local) return;
      const spoken = rivalWordFor(g, local, rivals);
      if (!spoken) return;
      const { word, seat } = spoken;
      noteSpoken(local, word);
      post([
        {
          id: `r${local}`,
          kind: 'rival',
          rank: 2,
          owner: seat,
          portrait: portraitFor(g.players[seat], seat),
          title: t('rivals.title', { name: personaName(word.persona) }),
          detail: t(`rivals.${word.persona}.${word.key}`, spokenVars(word.vars, t)),
          round: g.round,
          era: g.era,
        },
      ]);
    });
    return () => {
      live = false;
    };
  }, [local, opening, tutorial, post, t]);
}
