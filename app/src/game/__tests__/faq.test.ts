import { describe, expect, it } from 'vitest';
import { faqFor, faqMatch, passagesOf, rulesMatch } from '../faq';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';

/* what the guide knows of the rules: every answer is written, none is
   generated, and a question must reach the one that answers it */

describe('the rules the guide knows', () => {
  it('names a topic and carries words for every entry', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const e of faqFor(lang)) {
        expect(`${lang}:${e.id}:words`).toBe(e.words.length > 0 ? `${lang}:${e.id}:words` : `${lang}:${e.id} has no words`);
        expect(`${lang}:${e.id}:answer`).toBe(e.answer.length > 40 ? `${lang}:${e.id}:answer` : `${lang}:${e.id} answers too briefly`);
        expect(`${lang}:${e.id}:topic`).toBe(e.topic.length > 0 ? `${lang}:${e.id}:topic` : `${lang}:${e.id} has no topic`);
      }
    }
  });

  it('answers the questions it was written for', () => {
    const asks: [string, string][] = [
      ['Est-ce que mon fer se vend automatiquement quand je la pose ?', 'ironSells'],
      ['ma mine vend elle son charbon toute seule ?', 'coalSells'],
      ['quand est-ce que ma forge se retourne', 'flipMine'],
      ['comment je retourne ma filature', 'flipWorks'],
      ['il faut une liaison pour le fer ?', 'ironWhere'],
      ['pourquoi le prix du charbon monte', 'marketPrice'],
      ['où je trouve de la bière', 'beer'],
      ['combien coûte un canal', 'linkCost'],
      ['un emprunt se rembourse ?', 'loan'],
      ['je peux développer une poterie à ampoule ?', 'develop'],
      ['qui joue en premier', 'order'],
      ['une tuile par lieu ou plusieurs ?', 'oneTilePerPlace'],
      ['la surconstruction marche comment', 'overbuildTile'],
    ];
    for (const [q, id] of asks) expect(`${q} → ${faqMatch(q, faqFor('fr'))?.id ?? 'none'}`).toBe(`${q} → ${id}`);
  });

  it('says nothing rather than the wrong thing', () => {
    for (const q of ['bonjour', 'qui a gagné la coupe du monde', 'aaaa', '']) expect(faqMatch(q, faqFor('fr'))).toBeNull();
  });

  it('matches in English too', () => {
    expect(faqMatch('does my forge sell iron by itself?', faqFor('en'))?.id).toBe('ironSells');
    expect(faqMatch('where does beer come from', faqFor('en'))?.id).toBe('beer');
  });
});

describe('the rules codex, searched', () => {
  const frPassages = passagesOf((fr as { rules?: unknown }).rules);
  const enPassages = passagesOf((en as { rules?: unknown }).rules);

  it('flattens into passages that carry a heading and a body', () => {
    expect(frPassages.length).toBeGreaterThan(30);
    expect(enPassages.length).toBeGreaterThan(30);
    for (const p of frPassages) expect(p.body.length).toBeGreaterThanOrEqual(80);
  });

  it('finds most passages by what they are headed with', () => {
    /* a heading is the shortest honest question about its own passage, and
       a search on words alone answers most of them — not all, which is why
       the written entries are tried first */
    const headed = frPassages.filter((p) => p.title.split(' ').length >= 3).slice(0, 12);
    const found = headed.filter((p) => rulesMatch(p.title, frPassages)?.title === p.title);
    expect(found.length / headed.length).toBeGreaterThanOrEqual(0.6);
  });

  it('leaves the common phrasings to the written answers', () => {
    /* bag-of-words cannot tell "entre les deux ères" from "entre deux
       villes": the written entry answers first, and does */
    expect(faqMatch('que se passe-t-il entre les deux ères ?', faqFor('fr'))?.id).toBe('eraEnd');
  });

  it('holds its tongue when nothing is close', () => {
    expect(rulesMatch('zzz', frPassages)).toBeNull();
  });
});

describe('the answers written from the rules dossier', () => {
  it('cover every area of the game', () => {
    /* the four areas the entries were written from */
    const ids = faqFor('fr').map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(100);
    for (const must of ['boardTowns', 'merchantPlaces', 'cottonCost', 'potteryCost', 'deckSize', 'coalOrder', 'progressBands', 'gameEndTie', 'initiationBonus'])
      expect(`${must}: ${ids.includes(must)}`).toBe(`${must}: true`);
  });

  it('holds the same ids in both tongues', () => {
    expect(faqFor('en').map((e) => e.id)).toEqual(faqFor('fr').map((e) => e.id));
  });

  it('keeps the entries mostly out of each other’s way', () => {
    /* a phrase belonging to one entry may be answered by another when both
       answers are true — two entries on the income track, say. What must not
       happen is a corpus where that is the rule rather than the exception */
    const entries = faqFor('fr');
    const phrases = entries.flatMap((e) => e.words.map((w) => ({ e, w })));
    const stolen = phrases.filter(({ e, w }) => {
      const hit = faqMatch(w, entries);
      return hit && hit.id !== e.id;
    });
    expect(stolen.length / phrases.length).toBeLessThan(0.15);
  });

  it('answers a hundred plain questions without falling through', () => {
    const entries = faqFor('fr');
    /* every entry must be reachable by at least one of its own phrases */
    const mute = entries.filter((e) => !e.words.some((w) => faqMatch(w, entries)?.id === e.id));
    expect(mute.map((e) => e.id)).toEqual([]);
  });
});
