/* ------------------------------------------------------------------ */
/* THE VENETO — the second board.                                      */
/*                                                                     */
/* The Midlands board is a shape as much as a place: twenty towns and  */
/* two farm breweries, five edge merchants, thirty-nine links split    */
/* thirty both-era, eight rail, one canal. This board keeps every one  */
/* of those counts, and the same multiset of sockets, so the tiles,    */
/* the deck and the market that were balanced for one stand for the    */
/* other. Only the geography is new.                                   */
/*                                                                     */
/* It earns its canals: the Brenta from Padua to the lagoon, the Sile, */
/* the Bacchiglione, the Battaglia cut down to Chioggia. It earns its  */
/* rails too — Verona to Venice was Italy's trunk line, and the bridge */
/* into the lagoon opened in 1846, right in the middle of our second   */
/* era. Venice sits where Birmingham sat: everything flows to it.      */
/* ------------------------------------------------------------------ */

import type { BoardDef } from './types';

export const VENETO: BoardDef = {
  id: 'veneto',
  name: 'La Vénétie',
  blurb: 'De la lagune aux Dolomites : le Brenta, la Piave, et la ligne de Vérone à Venise.',
  towns: [
    /* the mountains, north */
    { id: 'belluno', name: 'Belluno', x: 1010, y: 95, spaces: [['manufacturer', 'brewery'], ['pottery']] },
    { id: 'vittorio', name: 'Vittorio Veneto', x: 1130, y: 200, spaces: [['manufacturer', 'coal'], ['coal']] },
    { id: 'bassano', name: 'Bassano del Grappa', x: 830, y: 215, spaces: [['cotton', 'manufacturer'], ['coal'], ['pottery']] },
    { id: 'schio', name: 'Schio', x: 610, y: 235, spaces: [['cotton', 'manufacturer'], ['cotton', 'coal']] },
    /* the foothills */
    { id: 'conegliano', name: 'Conegliano', x: 1195, y: 300, spaces: [['manufacturer', 'coal'], ['brewery']] },
    { id: 'thiene', name: 'Thiene', x: 690, y: 315, spaces: [['cotton', 'brewery'], ['manufacturer', 'coal']] },
    { id: 'castelfranco', name: 'Castelfranco', x: 960, y: 430, spaces: [['manufacturer', 'brewery'], ['cotton', 'brewery']] },
    /* the plain */
    { id: 'treviso', name: 'Trévise', x: 1105, y: 425, spaces: [['cotton', 'coal'], ['cotton', 'coal']] },
    { id: 'vicenza', name: 'Vicence', x: 720, y: 440, spaces: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']] },
    { id: 'arzignano', name: 'Arzignano', x: 590, y: 455, spaces: [['iron', 'brewery'], ['iron'], ['coal']] },
    { id: 'portogruaro', name: 'Portogruaro', x: 1330, y: 405, spaces: [['manufacturer'], ['manufacturer', 'coal']] },
    { id: 'verona', name: 'Vérone', x: 395, y: 495, spaces: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']] },
    /* the lagoon and its shore */
    { id: 'mestre', name: 'Mestre', x: 1120, y: 560, spaces: [['iron', 'manufacturer'], ['manufacturer', 'brewery']] },
    { id: 'padova', name: 'Padoue', x: 900, y: 560, spaces: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']] },
    { id: 'venezia', name: 'Venise', x: 1235, y: 620, spaces: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']] },
    /* the low country, south */
    { id: 'este', name: 'Este', x: 735, y: 645, spaces: [['cotton', 'coal'], ['cotton']] },
    { id: 'monselice', name: 'Monselice', x: 850, y: 645, spaces: [['coal'], ['iron']] },
    { id: 'legnago', name: 'Legnago', x: 540, y: 650, spaces: [['manufacturer', 'coal'], ['iron']] },
    { id: 'chioggia', name: 'Chioggia', x: 1140, y: 730, spaces: [['manufacturer', 'brewery'], ['cotton', 'coal']] },
    { id: 'rovigo', name: 'Rovigo', x: 800, y: 785, spaces: [['cotton'], ['cotton']] },
    /* the two cellars: one brewery socket, industry cards only */
    { id: 'cantina-n', name: 'Cantina', x: 430, y: 400, spaces: [['brewery']], farm: true },
    { id: 'cantina-s', name: 'Cantina', x: 790, y: 700, spaces: [['brewery']], farm: true },
  ],
  merchants: [
    { id: 'm-trento', name: 'Trente', x: 700, y: 90, slots: 2, minPlayers: 3, bonus: { money: 5 } },
    { id: 'm-trieste', name: 'Trieste', x: 1420, y: 560, slots: 2, minPlayers: 4, bonus: { vp: 3 } },
    { id: 'm-milano', name: 'Milan', x: 250, y: 520, slots: 1, minPlayers: 2, bonus: { vp: 4 } },
    { id: 'm-bologna', name: 'Bologne', x: 830, y: 960, slots: 2, minPlayers: 2, bonus: { income: 2 } },
    { id: 'm-ferrara', name: 'Ferrare', x: 560, y: 900, slots: 2, minPlayers: 2, bonus: { develop: true } },
  ],
  links: [
    /* --- both eras (30) --- */
    { a: 'm-trento', b: 'bassano' },
    { a: 'bassano', b: 'schio' },
    { a: 'bassano', b: 'thiene' },
    { a: 'bassano', b: 'castelfranco' },
    { a: 'belluno', b: 'vittorio' },
    { a: 'vittorio', b: 'conegliano' },
    { a: 'conegliano', b: 'treviso' },
    { a: 'conegliano', b: 'portogruaro' },
    { a: 'treviso', b: 'castelfranco' },
    { a: 'treviso', b: 'mestre' },
    { a: 'castelfranco', b: 'padova' },
    { a: 'castelfranco', b: 'vicenza' },
    { a: 'schio', b: 'thiene' },
    { a: 'thiene', b: 'vicenza' },
    { a: 'vicenza', b: 'arzignano' },
    { a: 'vicenza', b: 'padova' },
    { a: 'arzignano', b: 'verona' },
    { a: 'verona', b: 'legnago' },
    { a: 'verona', b: 'm-milano' },
    { a: 'verona', b: 'cantina-n' },
    { a: 'legnago', b: 'este' },
    { a: 'legnago', b: 'm-ferrara' },
    { a: 'este', b: 'monselice' },
    /* the Battaglia country: this one link also brings the southern
       cellar in, the way Kidderminster⇄Worcester does at home */
    { a: 'monselice', b: 'padova', alsoConnects: 'cantina-s' },
    { a: 'monselice', b: 'rovigo' },
    { a: 'rovigo', b: 'm-bologna' },
    /* the Brenta: the canal that made Padua a port */
    { a: 'padova', b: 'venezia', path: [[900, 560], [1040, 575], [1235, 620]] },
    { a: 'venezia', b: 'mestre' },
    { a: 'venezia', b: 'chioggia', path: [[1235, 620], [1215, 690], [1140, 730]] },
    { a: 'venezia', b: 'portogruaro', path: [[1235, 620], [1320, 520], [1330, 405]] },
    /* --- rail only (8) --- */
    { a: 'belluno', b: 'bassano', canal: false },
    { a: 'venezia', b: 'treviso', canal: false },
    { a: 'portogruaro', b: 'm-trieste', canal: false },
    { a: 'mestre', b: 'padova', canal: false },
    /* the trunk line, Milan to Venice, opened through here in 1846 */
    { a: 'verona', b: 'vicenza', canal: false },
    { a: 'legnago', b: 'monselice', canal: false },
    { a: 'este', b: 'm-ferrara', canal: false },
    { a: 'chioggia', b: 'm-bologna', canal: false },
    /* --- canal only (1): the cut from Padua down to the lagoon --- */
    { a: 'padova', b: 'chioggia', rail: false, path: [[900, 560], [940, 660], [1140, 730]] },
  ],
  /* the same counts the Midlands deals, town for town by its part in the
     game: the deck totals 40 / 54 / 64 as before */
  locationCards: {
    belluno: [2, 2, 2],
    conegliano: [2, 2, 2],
    vittorio: [2, 2, 2],
    treviso: [1, 1, 1],
    mestre: [1, 1, 1],
    arzignano: [3, 3, 3],
    monselice: [2, 2, 2],
    este: [2, 2, 2],
    portogruaro: [2, 2, 2],
    rovigo: [2, 2, 2],
    venezia: [3, 3, 3],
    padova: [3, 3, 3],
    chioggia: [1, 1, 1],
    legnago: [1, 1, 1],
    schio: [0, 2, 2],
    vicenza: [0, 3, 3],
    thiene: [0, 2, 2],
    castelfranco: [0, 1, 2],
    bassano: [0, 0, 2],
    verona: [0, 0, 3],
  },
};
