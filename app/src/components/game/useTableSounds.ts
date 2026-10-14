import { useEffect, useRef } from 'react';
import { useGame } from '@/game/store';
import type { GameState, IndustryType, Verb } from '@/game/types';
import { cue, noteStrike, setMix, tableAmbience, warmSounds } from '@/gl/sfx';
import type { Cue } from '@/gl/sfx';
import { useBoardOptions } from './boardOptions';

/* ------------------------------------------------------------------ */
/* The table's sounds, cued from the game as it changes. The hook only */
/* listens: it reads the store and the board options and never writes  */
/* to either. What a change should sound like is decided by tableCues, */
/* a plain function of two snapshots, so it can be held to account.    */
/* ------------------------------------------------------------------ */

/** what the sounds need to know of the table at one instant */
export interface TableShot {
  game: GameState | null;
  /** my seat online; null at home, where every human seat is mine */
  seat: number | null;
  /** the last move turned down on the board (its time), null when none */
  shakeAt: number | null;
  /** the office turned a move of the game at home down (its place in the log) */
  refusedAt: number | null;
  verb: Verb | null;
  card: string | null;
  /** a panel over the table: the settings, the debrief */
  panel: boolean;
}

/** one thing to be heard: a sound of the palette, or word to the press
 *  that the piece it is about to strike was laid by me or by another (and,
 *  for a tile, of which trade: its sound follows the stamp) */
export type Heard = { cue: Cue; quiet?: boolean } | { strike: 'tile' | 'link'; era: 'canal' | 'rail'; mine: boolean; industry?: IndustryType };

const INDUSTRIES: readonly IndustryType[] = ['coal', 'iron', 'brewery', 'cotton', 'manufacturer', 'pottery'];
/** the industry a build entry of the log laid, when it says */
const industryOf = (v: unknown): IndustryType | undefined => (INDUSTRIES as readonly unknown[]).includes(v) ? (v as IndustryType) : undefined;

/** a batch this large is a board read back or caught up, not moves played */
const CATCH_UP = 8;

const MOVE_CUE: Partial<Record<string, Cue>> = { sell: 'sell', loan: 'loan', develop: 'develop', scout: 'scout', pass: 'card' };

/** is this seat mine: the seat online, every human's at home (hot seat) */
export const mineOf = (g: GameState, seat: number | null, i: number | undefined): boolean =>
  i !== undefined && (seat !== null ? seat === i : !!g.players[i] && !g.players[i].isBot);

/** what a change of the table sounds like, in the order it is heard */
export function tableCues(prev: TableShot, next: TableShot): Heard[] {
  const out: Heard[] = [];
  const add = (h: Heard) => {
    if ('cue' in h && out.some((o) => 'cue' in o && o.cue === h.cue)) return;
    out.push(h);
  };
  const a = prev.game;
  const b = next.game;

  /* the interface: a panel opened or put away, a verb or a card taken up */
  if (next.panel !== prev.panel) add({ cue: next.panel ? 'panel-open' : 'panel-close' });
  if (next.shakeAt !== null && next.shakeAt !== prev.shakeAt) add({ cue: 'refuse' });
  if (next.refusedAt !== null && next.refusedAt !== prev.refusedAt) add({ cue: 'refuse' });

  /* nothing is heard of a table just sat at, nor of another game */
  if (!a || !b || a.seed !== b.seed) return out;

  /* taking a card up is silent: the paper was heard on every glance at the
     hand, and the hand is looked at far more than it is played */
  if (next.verb && next.verb !== prev.verb) add({ cue: 'click' });

  /* the moves: whatever the log gained since the last look */
  if (b.ledger !== a.ledger) {
    const last = a.ledger.length ? a.ledger[a.ledger.length - 1].id : -1;
    const fresh = b.ledger.filter((e) => e.id > last && e.player !== undefined);
    if (fresh.length <= CATCH_UP) {
      for (const e of fresh) {
        const mine = mineOf(b, next.seat, e.player);
        if (e.verb === 'build') add({ strike: 'tile', era: e.era, mine, industry: industryOf(e.vars?.industry) });
        else if (e.verb === 'network') add({ strike: 'link', era: e.era, mine });
        else {
          const c = MOVE_CUE[e.verb];
          if (c) add({ cue: c, quiet: !mine });
        }
      }
    }
  }

  /* the close of the canal era: the whistle across the fields, once */
  const canalCloses = (a.phase === 'action' && b.phase === 'scoring-canal') || (a.era === 'canal' && b.era === 'rail' && a.phase !== 'scoring-canal');
  if (canalCloses) add({ cue: 'era-end' });

  /* the end: the band plays for the winner, muted for the rest */
  if (a.phase !== 'game-over' && b.phase === 'game-over') {
    const mine = b.players.some((_, i) => mineOf(b, next.seat, i));
    const won = b.winner !== undefined && mineOf(b, next.seat, b.winner);
    /* a table watched from no seat hears the winner's band */
    add({ cue: won || !mine ? 'victory' : 'defeat' });
    return out;
  }

  /* my turn comes round: the station bell */
  const turnMoves = b.current !== a.current || b.round !== a.round || b.era !== a.era || a.phase !== 'action';
  if (b.phase === 'action' && turnMoves && mineOf(b, next.seat, b.current)) add({ cue: 'turn' });
  return out;
}

/** the store and the settings, as the sounds read them */
const shotOf = (s: ReturnType<typeof useGame.getState>, panel: boolean): TableShot => ({
  game: s.game,
  seat: s.seat,
  shakeAt: s.shake?.at ?? null,
  refusedAt: s.homeTrouble?.cause === 'refused' && !s.homeTrouble.mended ? (s.homeTrouble.at ?? -1) : null,
  verb: s.verb,
  card: s.selectedCardId,
  panel: panel || s.debriefOpen,
});

/** a moment heard in the same breath as a move waits for the press to land */
const MOMENT_AFTER_MOVE_MS = 450;

/** the table's sounds: the mix from the settings, the era's ambience, and
 *  a cue for every change of the game worth hearing */
export function useTableSounds(): void {
  const opts = useBoardOptions();
  const { sound, ambience, volAmbience, volGestures, volMoments, settingsOpen } = opts;

  useEffect(() => {
    setMix({ on: sound, ambience, levels: { ambience: volAmbience, gestures: volGestures, moments: volMoments } });
  }, [sound, ambience, volAmbience, volGestures, volMoments]);

  /* the era's ambience; gone at the end of the game and when the table is left */
  const era = useGame((s) => (s.game && s.game.phase !== 'game-over' ? s.game.era : null));
  useEffect(() => {
    tableAmbience(era);
  }, [era]);
  useEffect(() => () => tableAmbience(null), []);

  const panelRef = useRef(settingsOpen);
  const lastRef = useRef<TableShot>(shotOf(useGame.getState(), settingsOpen));

  useEffect(() => {
    warmSounds();
    const timers: number[] = [];
    const hear = (next: TableShot) => {
      const prev = lastRef.current;
      lastRef.current = next;
      const heard = tableCues(prev, next);
      const moved = heard.some((h) => 'strike' in h || h.cue === 'sell' || h.cue === 'loan' || h.cue === 'develop' || h.cue === 'scout');
      for (const h of heard) {
        if ('strike' in h) noteStrike(h.strike, h.era, h.mine, h.industry);
        else if (moved && (h.cue === 'turn' || h.cue === 'era-end' || h.cue === 'victory' || h.cue === 'defeat')) {
          const c = h.cue;
          timers.push(window.setTimeout(() => cue(c), MOMENT_AFTER_MOVE_MS));
        } else cue(h.cue, { quiet: h.quiet });
      }
    };
    const off = useGame.subscribe((s) => hear(shotOf(s, panelRef.current)));
    return () => {
      off();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  /* the settings panel is a board option, not the store's: heard here */
  useEffect(() => {
    if (panelRef.current === settingsOpen) return;
    panelRef.current = settingsOpen;
    const prev = lastRef.current;
    const next = { ...prev, panel: settingsOpen || !!useGame.getState().debriefOpen };
    lastRef.current = next;
    for (const h of tableCues(prev, next)) if ('cue' in h) cue(h.cue);
  }, [settingsOpen]);
}
