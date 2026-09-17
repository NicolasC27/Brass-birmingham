import type { PlayerColor } from '@/components/setup/constants';

/* ------------------------------------------------------------------ */
/* DONNÉES DE DÉMONSTRATION — en attendant les endpoints serveur.      */
/*                                                                     */
/* Tout ce fichier est un mock de présentation : il habille la page    */
/* d'accueil (tableau des tables, files, activité) tant que les        */
/* contrats src/online/* n'exposent ni tables publiques, ni files,     */
/* ni fil d'activité. Les pages consomment ces listes ; quand le       */
/* serveur fournira les données, seul ce module sera remplacé.         */
/* Aucune de ces valeurs ne prétend venir d'un backend réel.           */
/* ------------------------------------------------------------------ */

export type TableMode = 'normal' | 'ranked';
export type TableState = 'open' | 'live' | 'full';

export interface DemoSeat {
  name: string;
  color: PlayerColor;
  kind: 'human' | 'bot';
  ready: boolean;
  host?: boolean;
  you?: boolean;
}

export interface DemoTable {
  id: string;
  code: string;
  name: string;
  mode: TableMode;
  visibility: 'public' | 'private';
  region: string;
  latencyMs: number;
  /** null = siège libre */
  seats: (DemoSeat | null)[];
  state: TableState;
  /** tour courant, si en cours */
  round?: number;
}

export const demoTables: DemoTable[] = [
  {
    id: 't1',
    code: 'FNDR',
    name: 'Fonderie du Nord',
    mode: 'normal',
    visibility: 'public',
    region: 'EU',
    latencyMs: 24,
    state: 'live',
    round: 12,
    seats: [
      { name: 'Sofia', color: 'brass', kind: 'human', ready: true, host: true },
      { name: 'Marc', color: 'oxblood', kind: 'human', ready: true },
      { name: 'Léa', color: 'verdigris', kind: 'human', ready: true },
      { name: 'T. Bernard', color: 'steel', kind: 'human', ready: true },
    ],
  },
  {
    id: 't2',
    code: 'CNCH',
    name: 'Canal & Charbon',
    mode: 'normal',
    visibility: 'public',
    region: 'EU',
    latencyMs: 31,
    state: 'open',
    seats: [
      { name: 'Léa', color: 'brass', kind: 'human', ready: true, host: true },
      { name: 'Priya', color: 'oxblood', kind: 'human', ready: false },
      null,
      null,
    ],
  },
  {
    id: 't3',
    code: 'HTFR',
    name: 'Hauts-Fourneaux',
    mode: 'ranked',
    visibility: 'public',
    region: 'EU',
    latencyMs: 27,
    state: 'full',
    round: 8,
    seats: [
      { name: 'Marc', color: 'brass', kind: 'human', ready: true, host: true },
      { name: 'Sofia', color: 'oxblood', kind: 'human', ready: true },
      { name: 'Étienne', color: 'verdigris', kind: 'human', ready: true },
      { name: 'Ada', color: 'steel', kind: 'human', ready: true },
    ],
  },
  {
    id: 't4',
    code: 'TXTL',
    name: 'Filatures de Birmingham',
    mode: 'normal',
    visibility: 'public',
    region: 'EU',
    latencyMs: 35,
    state: 'open',
    seats: [{ name: 'Noor', color: 'brass', kind: 'human', ready: false, host: true }, null, null, null],
  },
  {
    id: 't5',
    code: 'RAIL',
    name: 'Voie Express',
    mode: 'ranked',
    visibility: 'private',
    region: 'EU',
    latencyMs: 22,
    state: 'live',
    round: 21,
    seats: [
      { name: 'Sofia', color: 'brass', kind: 'human', ready: true, host: true },
      { name: 'T. Bernard', color: 'oxblood', kind: 'human', ready: true },
      { name: 'Horloge Fine', color: 'verdigris', kind: 'bot', ready: true },
      { name: 'Contremaître', color: 'steel', kind: 'bot', ready: true },
    ],
  },
];

export interface DemoQueueEntry {
  id: string;
  /** pseudo masqué : « Joueur #412 » */
  masked: string;
  mode: TableMode;
  /** secondes d'attente déjà écoulées au chargement */
  waitedSec: number;
}

export const demoQueue: DemoQueueEntry[] = [
  { id: 'q1', masked: 'Joueur #412', mode: 'normal', waitedSec: 38 },
  { id: 'q2', masked: 'Joueur #287', mode: 'ranked', waitedSec: 104 },
  { id: 'q3', masked: 'Joueur #533', mode: 'normal', waitedSec: 12 },
  { id: 'q4', masked: 'Joueur #096', mode: 'ranked', waitedSec: 171 },
  { id: 'q5', masked: 'Joueur #340', mode: 'normal', waitedSec: 63 },
];

export type FeedKind = 'tableOpened' | 'joinedQueue' | 'gameWon' | 'newRank' | 'tableFull';

export interface DemoFeedItem {
  id: string;
  kind: FeedKind;
  vars: Record<string, string | number>;
  minutesAgo: number;
}

export const demoFeed: DemoFeedItem[] = [
  { id: 'f1', kind: 'tableOpened', vars: { table: 'Canal & Charbon', name: 'Léa' }, minutesAgo: 2 },
  { id: 'f2', kind: 'joinedQueue', vars: { name: 'Marc', mode: 'ranked' }, minutesAgo: 4 },
  { id: 'f3', kind: 'gameWon', vars: { name: 'Sofia', round: 21 }, minutesAgo: 9 },
  { id: 'f4', kind: 'newRank', vars: { name: 'T. Bernard', rank: 'Acier I' }, minutesAgo: 14 },
  { id: 'f5', kind: 'tableFull', vars: { table: 'Hauts-Fourneaux' }, minutesAgo: 18 },
];

export interface DemoTickerItem {
  id: string;
  time: string;
  table: string;
  winner: string;
  vp: number;
}

export const demoTicker: DemoTickerItem[] = [
  { id: 'r1', time: '21:42', table: 'Fonderie du Nord', winner: 'Sofia', vp: 148 },
  { id: 'r2', time: '21:15', table: 'Voie Express', winner: 'Marc', vp: 132 },
  { id: 'r3', time: '20:58', table: 'Hauts-Fourneaux', winner: 'Ada', vp: 121 },
  { id: 'r4', time: '20:31', table: 'Canal & Charbon', winner: 'Léa', vp: 117 },
  { id: 'r5', time: '19:54', table: 'Filatures de Birmingham', winner: 'Noor', vp: 109 },
  { id: 'r6', time: '19:12', table: 'Fonderie du Nord', winner: 'T. Bernard', vp: 104 },
];

/** mon état de démonstration : rang, cote, progression de division */
export const demoRating = {
  tier: 'fer' as const,
  division: 'II',
  lp: 48,
  /** progression vers la division suivante, 0–100 */
  progress: 62,
  placementDone: null as number | null,
};
