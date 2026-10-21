import { afterEach, describe, expect, it } from 'vitest';
import { ABSENCE_MS, PS_KEYS, RIVAL_KEYS, chooseRival, foldGame, pickPs, pickWord, situations } from '../rivalry';
import type { RivalLast, Rivalry } from '../rivalry';
import type { BotPersona } from '../types';
import { PERSONA_IDS } from '../data';
import { LANGS, setLang, tr } from '@/i18n';
import { fr } from '@/i18n/fr';
import { spokenVars } from '@/platform/rivals';

/* ------------------------------------------------------------------ */
/* Which line a character says: the most particular thing it           */
/* remembers, never the same line twice running to one player, the     */
/* dice choosing only between lines as particular as each other.       */
/* ------------------------------------------------------------------ */

const NOW = Date.UTC(2026, 8, 20);

const rival = (o: Partial<Omit<Rivalry, 'last'>> & { last?: Partial<RivalLast> } = {}): Rivalry => ({
  persona: 'watt',
  games: 2,
  won: 1,
  lost: 1,
  streak: 1,
  ...o,
  last: { code: 'L', at: NOW - 60_000, map: 'midlands', won: true, vp: 150, theirs: 130, ...o.last },
});

/** dice that always land on the same face */
const dice = (face: number) => () => face;

describe('a rival’s word', () => {
  it('greets a player it has never met', () => {
    expect(pickWord('watt', null, { now: NOW, map: 'midlands', name: 'Ada' })).toEqual({ persona: 'watt', key: 'first', vars: { name: 'Ada' } });
  });

  it('says the most particular thing it remembers', () => {
    const say = (r: Rivalry) => pickWord('watt', r, { now: NOW, map: 'midlands', name: 'Ada', random: dice(0) }).key;
    expect(say(rival({ last: { at: NOW - ABSENCE_MS - 1 } }))).toBe('absence');
    expect(say(rival({ streak: 3 }))).toBe('streakYours');
    expect(say(rival({ streak: -4, last: { won: false } }))).toBe('streakMine');
    expect(say(rival({ last: { comeback: true, vp: 150, theirs: 120 } }))).toBe('comeback');
    expect(say(rival({ last: { vp: 131, theirs: 130 } }))).toBe('close');
    expect(say(rival({ last: { town: { id: 'birmingham', name: 'Birmingham' } } }))).toBe('town');
    expect(say(rival({ last: { won: true } }))).toBe('revenge');
    expect(say(rival({ last: { won: false } }))).toBe('gloat');
  });

  it('calls a town back only on the board it stands on', () => {
    const r = rival({ last: { town: { id: 'birmingham', name: 'Birmingham' } } });
    expect(situations(r, NOW, 'midlands')).toContainEqual(['town']);
    expect(situations(r, NOW, 'veneto').flat()).not.toContain('town');
  });

  it('boasts of its own best build only after a win of its own', () => {
    expect(situations(rival({ last: { won: false, own: 'iron' } }), NOW, 'midlands').flat()).toContain('own');
    expect(situations(rival({ last: { won: true, own: 'iron' } }), NOW, 'midlands').flat()).not.toContain('own');
  });

  it('lets the dice choose between lines as particular as each other', () => {
    const r = rival({ last: { town: { id: 'walsall', name: 'Walsall' }, loans: 4, industry: 'cotton' } });
    const at = (face: number) => pickWord('watt', r, { now: NOW, map: 'midlands', name: 'Ada', random: dice(face) }).key;
    expect(at(0)).toBe('town');
    expect(at(0.5)).toBe('loans');
    expect(at(0.99)).toBe('industry');
    /* a die that lands on its edge still names a line */
    expect(at(1)).toBe('industry');
  });

  it('never says the same line twice running to one player', () => {
    const streak = rival({ streak: 3 });
    expect(pickWord('watt', streak, { now: NOW, map: 'midlands', name: 'Ada', said: 'streakYours', random: dice(0) }).key).toBe('revenge');
    const plain = rival();
    expect(pickWord('watt', plain, { now: NOW, map: 'midlands', name: 'Ada', said: 'revenge', random: dice(0) }).key).toBe('tally');
    expect(pickWord('watt', plain, { now: NOW, map: 'midlands', name: 'Ada', said: 'tally', random: dice(0) }).key).toBe('revenge');
    const town = rival({ last: { town: { id: 'walsall', name: 'Walsall' }, loans: 3 } });
    expect(pickWord('watt', town, { now: NOW, map: 'midlands', name: 'Ada', said: 'town', random: dice(0) }).key).toBe('loans');
  });

  it('is the same word for the same dice', () => {
    const r = rival({ last: { town: { id: 'walsall', name: 'Walsall' }, loans: 4, industry: 'cotton' } });
    const a = pickWord('watt', r, { now: NOW, map: 'midlands', name: 'Ada', random: dice(0.4) });
    const b = pickWord('watt', r, { now: NOW, map: 'midlands', name: 'Ada', random: dice(0.4) });
    expect(a).toEqual(b);
  });
});

describe('the rival who speaks', () => {
  const met = (persona: BotPersona, games: number, at: number): Rivalry => rival({ persona, games, last: { at } });

  it('is the character at the table with the most history', () => {
    const rivals = [met('watt', 2, 5), met('wedgwood', 5, 1), met('boulton', 9, 9)];
    expect(chooseRival(['watt', 'wedgwood'], rivals)?.persona).toBe('wedgwood');
  });

  it('is the latest met when two have as much', () => {
    expect(chooseRival(['watt', 'wedgwood'], [met('watt', 3, 5), met('wedgwood', 3, 9)])?.persona).toBe('wedgwood');
  });

  it('is the first at the table when none has met the player', () => {
    expect(chooseRival(['arkwright', 'watt'], [met('boulton', 4, 1)])).toEqual({ persona: 'arkwright', rivalry: null });
    expect(chooseRival([], [])).toBeNull();
  });
});

describe('the record, one game on', () => {
  it('counts the game in and carries the run on', () => {
    const r = foldGame(rival({ games: 4, won: 3, lost: 1, streak: 2 }), 'watt', { code: 'N', at: NOW, map: 'midlands', won: true, vp: 140, theirs: 120 });
    expect(r).toMatchObject({ games: 5, won: 4, lost: 1, streak: 3, last: { code: 'N', won: true } });
    expect(foldGame(r, 'watt', { code: 'M', at: NOW, map: 'midlands', won: false, vp: 100, theirs: 120 })).toMatchObject({ games: 6, lost: 2, streak: -1 });
  });

  it('never counts the same game twice', () => {
    const r = rival({ games: 4, last: { code: 'N' } });
    expect(foldGame(r, 'watt', { code: 'N', at: NOW, map: 'midlands', won: true, vp: 1, theirs: 0 })).toBe(r);
  });

  it('starts from nothing', () => {
    expect(foldGame(null, 'arkwright', { code: 'N', at: NOW, map: 'midlands', won: false, vp: 90, theirs: 120 })).toMatchObject({ persona: 'arkwright', games: 1, won: 0, lost: 1, streak: -1 });
  });

  it('closes a letter on a first game, a run, or the count', () => {
    expect(pickPs(rival({ games: 1 })).key).toBe('first');
    expect(pickPs(rival({ games: 5, streak: 3 })).key).toBe('streakYours');
    expect(pickPs(rival({ games: 5, streak: -3 })).key).toBe('streakMine');
    expect(pickPs(rival({ games: 5, won: 2, lost: 3, streak: 1 }))).toEqual({ key: 'tally', vars: { games: 5, won: 2, lost: 3, n: 1 } });
  });
});

describe('the characters’ lines', () => {
  afterEach(() => setLang('fr'));

  const full = rival({ games: 5, won: 3, lost: 2, streak: 3, last: { town: { id: 'birmingham', name: 'Birmingham' }, loans: 4, industry: 'cotton', own: 'iron' } });

  it('are written for every character, in every tongue, with nothing left to fill', () => {
    const loose: string[] = [];
    for (const lang of LANGS) {
      setLang(lang);
      const t = (key: string, vars?: Record<string, string | number>) => tr(key, vars);
      for (const persona of PERSONA_IDS) {
        for (const key of RIVAL_KEYS) {
          const word = pickWord(persona, full, { now: NOW, map: 'midlands', name: 'Ada' });
          const text = t(`rivals.${persona}.${key}`, spokenVars({ ...word.vars }, t));
          if (text.startsWith('rivals.') || /[{}[\]]/.test(text)) loose.push(`${lang}:${persona}.${key} → ${text}`);
        }
        for (const key of PS_KEYS) {
          const text = t(`rivals.${persona}.ps.${key}`, { ...pickPs(full).vars, me: 'Ada' });
          if (text.startsWith('rivals.') || /[{}[\]]/.test(text)) loose.push(`${lang}:${persona}.ps.${key} → ${text}`);
        }
      }
    }
    expect(loose).toEqual([]);
  });

  it('name the town, the industries and the count in the reader’s tongue', () => {
    setLang('fr');
    const t = (key: string, vars?: Record<string, string | number>) => tr(key, vars);
    const vars = spokenVars(pickWord('watt', full, { now: NOW, map: 'midlands', name: 'Ada' }).vars, t);
    expect(t('rivals.watt.town', vars)).toContain('Birmingham');
    expect(t('rivals.watt.industry', vars)).toContain('vos filatures');
    expect(t('rivals.watt.own', vars)).toContain('mes forges');
    expect(t('rivals.record', { games: 5, won: 3 })).toBe('Contre vous\u00a0: 5 parties, 3 victoires pour vous.');
    expect(t('rivals.record', { games: 1, won: 1 })).toBe('Contre vous\u00a0: 1 partie, 1 victoire pour vous.');
    setLang('en');
    expect(t('rivals.record', { games: 5, won: 3 })).toBe('Against you: 5 games, 3 won by you.');
  });

  it('set French with its own spaces and apostrophes', () => {
    setLang('fr');
    const off: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        if (/\p{L}'\p{L}/u.test(node)) off.push(`${path}: straight apostrophe`);
        if (/[^\u00a0\d}]:(?!\/\/)|\d:(?!\d)/u.test(node.replace(/\{[^}]*\}/g, 'x'))) off.push(`${path}: “:” without its unbreakable space`);
        if (/[^\u202f!?][;!?]/u.test(node)) off.push(`${path}: “; ! ?” without the thin space`);
        return;
      }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    };
    walk(fr.rivals, 'rivals');
    expect(off).toEqual([]);
  });
});
