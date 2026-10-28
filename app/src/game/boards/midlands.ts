/* ------------------------------------------------------------------ */
/* THE MIDLANDS — the first board, the authentic Roxley geography.     */
/*                                                                     */
/* Twenty towns and two farm breweries, five edge merchants, and       */
/* thirty-nine era-tagged links, on the original 1600×1100 canvas the  */
/* registry scales to the world. Research in research/board-data.md.   */
/* ------------------------------------------------------------------ */

import type { BoardDef } from './types';

export const MIDLANDS: BoardDef = {
  id: 'midlands',
  name: 'Les Midlands',
  blurb: 'Birmingham et le Pays noir : les canaux de 1770, les rails de 1830.',
  towns: [

  // Derbyshire (teal) — location cards only at 4 players
  // v12: Belper 92 → 100 (+11px world) so its cluster clears the top edge
  { id: 'belper', name: 'Belper', x: 1074, y: 100, spaces: [['cotton', 'manufacturer'], ['coal'], ['pottery']] },
  { id: 'derby', name: 'Derby', x: 1083, y: 261, spaces: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']] },
  // Staffordshire (blue) — cards at 3–4 players
  { id: 'leek', name: 'Leek', x: 843, y: 87, spaces: [['cotton', 'manufacturer'], ['cotton', 'coal']] },
  { id: 'stoke', name: 'Stoke-on-Trent', x: 698, y: 156, spaces: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']] },
  { id: 'stone', name: 'Stone', x: 590, y: 280, spaces: [['cotton', 'brewery'], ['manufacturer', 'coal']] },
  { id: 'uttoxeter', name: 'Uttoxeter', x: 870, y: 266, spaces: [['manufacturer', 'brewery'], ['cotton', 'brewery']] },
  // West Midlands (maroon)
  { id: 'stafford', name: 'Stafford', x: 689, y: 385, spaces: [['manufacturer', 'brewery'], ['pottery']] },
  { id: 'burton', name: 'Burton-on-Trent', x: 996, y: 417, spaces: [['manufacturer', 'coal'], ['brewery']] },
  { id: 'cannock', name: 'Cannock', x: 762, y: 500, spaces: [['manufacturer', 'coal'], ['coal']] },
  { id: 'tamworth', name: 'Tamworth', x: 1023, y: 564, spaces: [['cotton', 'coal'], ['cotton', 'coal']] },
  { id: 'walsall', name: 'Walsall', x: 822, y: 614, spaces: [['iron', 'manufacturer'], ['manufacturer', 'brewery']] },
  // Black Country (brown)
  { id: 'wolverhampton', name: 'Wolverhampton', x: 657, y: 591, spaces: [['manufacturer'], ['manufacturer', 'coal']] },
  { id: 'coalbrookdale', name: 'Coalbrookdale', x: 510, y: 619, spaces: [['iron', 'brewery'], ['iron'], ['coal']] },
  { id: 'dudley', name: 'Dudley', x: 704, y: 729, spaces: [['coal'], ['iron']] },
  { id: 'kidderminster', name: 'Kidderminster', x: 629, y: 839, spaces: [['cotton', 'coal'], ['cotton']] },
  { id: 'worcester', name: 'Worcester', x: 652, y: 985, spaces: [['cotton'], ['cotton']] },
  // Birmingham region (purple)
  { id: 'birmingham', name: 'Birmingham', x: 913, y: 756, spaces: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']] },
  { id: 'coventry', name: 'Coventry', x: 1130, y: 784, spaces: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']] },
  { id: 'nuneaton', name: 'Nuneaton', x: 1119, y: 669, spaces: [['manufacturer', 'brewery'], ['cotton', 'coal']] },
  { id: 'redditch', name: 'Redditch', x: 886, y: 894, spaces: [['manufacturer', 'coal'], ['iron']] },
  // Farm breweries — single brewery socket, industry cards only
  { id: 'farm-n', name: 'Farm Brewery', x: 580, y: 477, spaces: [['brewery']], farm: true },
  // v12: farm-s (535,917) → (500,930): its wide ribbon quasi-touched both
  // Kidderminster (4px) and Worcester (4px); shifted SW into open country
  { id: 'farm-s', name: 'Farm Brewery', x: 500, y: 930, spaces: [['brewery']], farm: true },
  ],
  merchants: [
  {
    id: 'm-warrington',
    name: 'Warrington',
    x: 551,
    y: 119,
    slots: 2,
    minPlayers: 3,
    bonus: { money: 5 },
  },
  {
    id: 'm-nottingham',
    name: 'Nottingham',
    x: 1243,
    y: 197,
    slots: 2,
    minPlayers: 4,
    bonus: { vp: 3 },
  },
  {
    id: 'm-shrewsbury',
    name: 'Shrewsbury',
    x: 354,
    y: 632,
    slots: 1,
    minPlayers: 2,
    bonus: { vp: 4 },
  },
  {
    id: 'm-oxford',
    name: 'Oxford',
    x: 1152,
    y: 944,
    slots: 2,
    minPlayers: 2,
    bonus: { income: 2 },
  },
  {
    id: 'm-gloucester',
    name: 'Gloucester',
    // v12: 1040 → 1024 (−21px world) so the sign + barrels clear the bottom edge
    x: 872,
    y: 1024,
    slots: 2,
    minPlayers: 2,
    bonus: { develop: true },
  },
  ],
  links: [

  /* --- both eras (30) --- */
  { a: 'm-warrington', b: 'stoke' },
  { a: 'stoke', b: 'leek' },
  { a: 'belper', b: 'derby' },
  { a: 'derby', b: 'm-nottingham' },
  { a: 'derby', b: 'burton' },
  { a: 'stoke', b: 'stone' },
  { a: 'stone', b: 'stafford' },
  { a: 'stone', b: 'burton' },
  { a: 'stafford', b: 'cannock' },
  { a: 'cannock', b: 'farm-n' },
  { a: 'cannock', b: 'wolverhampton' },
  { a: 'cannock', b: 'walsall' },
  { a: 'burton', b: 'tamworth' },
  { a: 'tamworth', b: 'nuneaton' },
  { a: 'tamworth', b: 'birmingham' },
  { a: 'coventry', b: 'birmingham' },
  { a: 'birmingham', b: 'm-oxford', path: [[913, 756], [1060, 828], [1152, 944]] },
  { a: 'redditch', b: 'm-oxford' },
  { a: 'redditch', b: 'm-gloucester' },
  { a: 'birmingham', b: 'walsall' },
  { a: 'walsall', b: 'wolverhampton' },
  { a: 'wolverhampton', b: 'coalbrookdale' },
  { a: 'coalbrookdale', b: 'm-shrewsbury' },
  { a: 'coalbrookdale', b: 'kidderminster' },
  { a: 'wolverhampton', b: 'dudley' },
  { a: 'birmingham', b: 'dudley' },
  { a: 'dudley', b: 'kidderminster' },
  // rules: this one link also connects Kidderminster AND Worcester to farm-s
  { a: 'kidderminster', b: 'worcester', alsoConnects: 'farm-s' },
  { a: 'birmingham', b: 'worcester', path: [[913, 756], [760, 880], [652, 985]] },
  { a: 'worcester', b: 'm-gloucester' },
  /* --- rail only (8) --- */
  { a: 'leek', b: 'belper', canal: false },
  { a: 'derby', b: 'uttoxeter', canal: false },
  { a: 'uttoxeter', b: 'stone', canal: false },
  { a: 'burton', b: 'cannock', canal: false },
  { a: 'tamworth', b: 'walsall', canal: false },
  { a: 'nuneaton', b: 'coventry', canal: false },
  { a: 'nuneaton', b: 'birmingham', canal: false },
  { a: 'birmingham', b: 'redditch', canal: false },
  /* --- canal only (1) --- */
  { a: 'burton', b: 'walsall', rail: false, path: [[996, 417], [930, 500], [822, 614]] },
  ],
  locationCards: {
  stafford: [2, 2, 2],
  burton: [2, 2, 2],
  cannock: [2, 2, 2],
  tamworth: [1, 1, 1],
  walsall: [1, 1, 1],
  coalbrookdale: [3, 3, 3],
  dudley: [2, 2, 2],
  kidderminster: [2, 2, 2],
  wolverhampton: [2, 2, 2],
  worcester: [2, 2, 2],
  birmingham: [3, 3, 3],
  coventry: [3, 3, 3],
  nuneaton: [1, 1, 1],
  redditch: [1, 1, 1],
  leek: [0, 2, 2],
  stoke: [0, 3, 3],
  stone: [0, 2, 2],
  uttoxeter: [0, 1, 2],
  belper: [0, 0, 2],
  derby: [0, 0, 3],
  },
};
