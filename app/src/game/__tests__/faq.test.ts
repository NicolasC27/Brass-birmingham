import { describe, expect, it } from 'vitest';
import { faqFor, faqMatch, passagesOf, rulesMatch } from '../faq';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';

/* what the guide knows of the rules: every answer is written, none is
   generated, and a question must reach the one that answers it */

describe('the rules the guide knows', () => {
  it('names a topic and carries words for every entry', () => {
    for (const lang of ['fr', 'en', 'es', 'de'] as const) {
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

  it('matches in Spanish and German, in their own words', () => {
    const asks: ['es' | 'de', string, string][] = [
      ['es', '¿mi fundición vende el hierro automáticamente?', 'ironSells'],
      ['es', '¿dónde encuentro hierro?', 'ironWhere'],
      ['es', '¿cuánto cuesta un canal?', 'linkCost'],
      ['es', '¿el préstamo se devuelve?', 'loan'],
      ['es', '¿una loseta por lugar o varias?', 'oneTilePerPlace'],
      ['es', '¿cómo funciona sobreconstruir?', 'overbuildTile'],
      ['de', 'verkauft meine eisenhütte das eisen automatisch?', 'ironSells'],
      ['de', 'woher bekomme ich eisen?', 'ironWhere'],
      ['de', 'was kostet ein kanal?', 'linkCost'],
      ['de', 'muss man den kredit zurückzahlen?', 'loan'],
      ['de', 'ein plättchen pro ort oder mehrere?', 'oneTilePerPlace'],
      ['de', 'wie funktioniert überbauen?', 'overbuildTile'],
    ];
    for (const [lang, q, id] of asks) expect(`${q} → ${faqMatch(q, faqFor(lang))?.id ?? 'none'}`).toBe(`${q} → ${id}`);
    const idle: ['es' | 'de', string][] = [['es', 'hola'], ['es', 'quién ganó el mundial'], ['de', 'hallo'], ['de', 'wer wurde weltmeister']];
    for (const [lang, q] of idle) expect(faqMatch(q, faqFor(lang))).toBeNull();
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

  it('holds the same ids in all four tongues', () => {
    for (const lang of ['en', 'es', 'de'] as const) expect(faqFor(lang).map((e) => e.id)).toEqual(faqFor('fr').map((e) => e.id));
  });

  it('carries the French figures into every tongue', () => {
    /* the translations were checked figure by figure: a number or a
       level written as a numeral in one tongue is written in the others
       too, save the counts of players that German and English spell out */
    const numerals = (s: string) => (s.match(/\d+/g) ?? []).sort().join(' ');
    const levels = (s: string) => (s.match(/\b(?:I{1,3}|IV|VI{0,3})\b/g) ?? []).sort().join(' ');
    const fr = faqFor('fr');
    for (const lang of ['es', 'de'] as const) {
      faqFor(lang).forEach((e, i) => {
        expect(`${lang}:${e.id}:${levels(e.answer)}`).toBe(`${lang}:${e.id}:${levels(fr[i].answer)}`);
        /* every figure it gives is one the French gives */
        const mine = numerals(e.answer).split(' ').filter(Boolean);
        const theirs = new Set(numerals(fr[i].answer).split(' '));
        expect(`${lang}:${e.id}:${mine.filter((n) => !theirs.has(n)).join(',')}`).toBe(`${lang}:${e.id}:`);
      });
    }
  });

  it('keeps the entries mostly out of each other’s way', () => {
    /* a phrase belonging to one entry may be answered by another when both
       answers are true — two entries on the income track, say. What must not
       happen is a corpus where that is the rule rather than the exception */
    for (const lang of ['fr', 'es', 'de'] as const) {
      const entries = faqFor(lang);
      const phrases = entries.flatMap((e) => e.words.map((w) => ({ e, w })));
      const stolen = phrases.filter(({ e, w }) => {
        const hit = faqMatch(w, entries);
        return hit && hit.id !== e.id;
      });
      expect(stolen.length / phrases.length).toBeLessThan(0.15);
    }
  });

  it('answers a hundred plain questions without falling through', () => {
    for (const lang of ['fr', 'es', 'de'] as const) {
      const entries = faqFor(lang);
      /* every entry must be reachable by at least one of its own phrases */
      const mute = entries.filter((e) => !e.words.some((w) => faqMatch(w, entries)?.id === e.id));
      expect(`${lang}: ${mute.map((e) => e.id).join(', ')}`).toBe(`${lang}: `);
    }
  });
});
