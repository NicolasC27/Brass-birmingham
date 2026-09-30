/* ------------------------------------------------------------------ */
/* Carrying a record across a change to the reading.                   */
/*                                                                     */
/* A row of the record is as wide as the features are many, so adding  */
/* one leaves every row ever written unreadable — and a record is      */
/* weeks of machines playing. Thrown away, the features can never be   */
/* improved without the next network starting from nothing.            */
/*                                                                     */
/* A feature appended to the end of the reading changes nothing about  */
/* the ones before it, so an old row becomes a new one by having the   */
/* newcomers written into it as nought. That is what the position      */
/* looked like to a reading that could not see them, which is exactly  */
/* what a network widened the same way makes of it.                    */
/*                                                                     */
/*   FROM=166 sh tools/bots/widen.sh                                   */
/*                                                                     */
/* A row is copied word by word rather than number by number: the      */
/* move record keeps a bitmask of the names on offer in among its      */
/* numbers, and some of those bit patterns are not numbers at all.     */
/* Copied as floats they would be quietly rewritten; copied as words   */
/* they arrive as they left.                                           */
/*                                                                     */
/* The old file is left where it lies. Nothing here is destructive.    */
/* ------------------------------------------------------------------ */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FEATURES } from '@/game/net';

/** the values that follow the features on every row. Six for the record
 *  of positions, which keeps the targets; the record of moves keeps the
 *  move played, a mask of the names on offer and the readings of the best
 *  of them, and names its own count. */
const TRAILING = Number(process.env.TRAILING ?? 6);
const FROM = Number(process.env.FROM ?? 0);
const DIR = resolve(process.env.DIR ?? 'tools/bots/data');
const PREFIX = process.env.PREFIX ?? 'positions';
const STAMP = `${PREFIX}-${FEATURES}f-`;

if (!FROM || FROM >= FEATURES) {
  console.error(`FROM must name the feature count the record was written for, below the ${FEATURES} this reading wants`);
  process.exit(1);
}

const wasRow = FROM + TRAILING;
const nowRow = FEATURES + TRAILING;
const pad = FEATURES - FROM;
let carried = 0;

for (const name of readdirSync(DIR)) {
  if (!name.startsWith(`${PREFIX}-`) || !name.endsWith('.f32') || name.startsWith(STAMP)) continue;
  const path = resolve(DIR, name);
  const bytes = readFileSync(path);
  const all = new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  if (all.length % wasRow !== 0) {
    console.warn(`${name}: ${all.length} numbers is not a whole count of ${wasRow}-wide rows — left alone`);
    continue;
  }
  const rows = all.length / wasRow;
  const out = new Uint32Array(rows * nowRow);
  for (let r = 0; r < rows; r++) {
    /* the features, then the newcomers as nought, then the targets */
    out.set(all.subarray(r * wasRow, r * wasRow + FROM), r * nowRow);
    out.set(all.subarray(r * wasRow + FROM, (r + 1) * wasRow), r * nowRow + FROM + pad);
  }
  /* the tag the old name carried, so two records never collide */
  const tag = name.slice(`${PREFIX}-`.length, -'.f32'.length);
  const to = resolve(DIR, `${STAMP}${tag}.f32`);
  writeFileSync(to, Buffer.from(out.buffer, 0, out.byteLength));
  const was = statSync(path).size;
  console.log(`${name}: ${rows} rows carried from ${FROM} features to ${FEATURES} (${(was / 1e6).toFixed(0)} MB to ${(out.byteLength / 1e6).toFixed(0)} MB)`);
  carried += rows;
}
console.log(carried ? `${carried} rows now readable by this reading; the originals are untouched` : 'nothing to carry');
