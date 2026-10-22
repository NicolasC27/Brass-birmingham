import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { START_MONEY } from '@/game/data';
import { newGame } from '@/game/engine';
import { passagesOf } from '@/game/faq';
import type { GameState, SetupPayload } from '@/game/types';
import { dictOf, trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { answerQuestion, answerTo, blockedBy, intentOf } from '../tableAnswers';

/* the table's answers, on the guided table itself: you against Wedgwood,
   the canal era only, the deal of seed 3 — asked in French and English */

function guided(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

const tIn = (lang: Lang) => (k: string, v?: Record<string, string | number>) => trIn(lang, k, v);
const fr = tIn('fr');
const en = tIn('en');
const passages = (lang: Lang) => passagesOf((dictOf(lang) as { rules?: unknown }).rules);

describe('a question about the table', () => {
  it('is told from the rules\' own questions by its words', () => {
    expect(intentOf('combien j ai d argent', fr, 'fr')?.id).toBe('money');
    expect(intentOf('je peux vendre ?', fr, 'fr')?.id).toBe('sell');
    expect(intentOf('il reste combien de manches', fr, 'fr')?.id).toBe('rounds');
    expect(intentOf('how much money do i have', en, 'en')?.id).toBe('money');
    /* "what is beer" asks the rules, not the table */
    expect(intentOf('c est quoi la biere', fr, 'fr')).toBeNull();
  });

  it('is answered with the table\'s own figures', () => {
    const g = guided();
    expect(answerTo('money', g, 0, fr)).toContain(String(START_MONEY));
    expect(answerTo('rounds', g, 0, en)).toContain('Round 1 of 10');
    /* nothing to sell on a bare board: the block says why */
    expect(answerTo('sell', g, 0, fr)).toBe(blockedBy('sell', g, 0, fr)!.text);
  });

  it('goes to the table while a game is on, and to the rules otherwise', () => {
    const g = guided();
    const asked = answerQuestion('combien j ai d argent', { g, me: 0 }, fr, 'fr', passages('fr'));
    expect(asked).toMatchObject({ intent: 'money', near: [] });
    expect(asked.answer).toContain(String(START_MONEY));
    /* no table: the same words find the rules' answer on money */
    const away = answerQuestion('combien j ai d argent', null, fr, 'fr', passages('fr'));
    expect(away.intent).toBeNull();
    expect(away.answer.length).toBeGreaterThan(0);
    expect(away.answer).not.toBe(asked.answer);
    /* a rules question at the table is the rules' */
    expect(answerQuestion('comment marche le fer', { g, me: 0 }, fr, 'fr', passages('fr')).intent).toBeNull();
  });
});

describe('a deed the table does not allow', () => {
  it('names money only when money is what stops it', () => {
    const g = guided();
    /* the first mine is within reach of the purse */
    expect(blockedBy('coal', g, 0, fr)).toBeNull();
    const broke = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    expect(blockedBy('coal', broke, 0, fr)).toMatchObject({ money: true });
    /* the last round has no payday to wait for */
    const last = { ...broke, round: 10 };
    expect(blockedBy('coal', last, 0, fr)!.text).toContain(fr('game.guide.blocked.loanAdviceLast', { amount: 30, hit: 3 }));
  });
});
