/* ------------------------------------------------------------------ */
/* Fitting the scales the analysis reads its leads on.                 */
/*                                                                     */
/* calibrate.ts notes, at every position of a table of machines, each  */
/* seat's lead — as the table stands, and as each judge reads it after */
/* its continuations, one figure per pass — with the rounds still to   */
/* play and, at the end, who won. This finds the width, the widening   */
/* and the rivals' shift that make the chance shown honest: "70 %"     */
/* winning seven times in ten. The judges show the mean of their       */
/* passes, so the fit weighs that same mean, not a single pass.        */
/*                                                                     */
/*   node tools/bots/fit-chance.mjs tools/bots/data/calibrate.jsonl    */
/* ------------------------------------------------------------------ */

import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'tools/bots/data/calibrate.jsonl';
const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const sigma = (x) => 1 / (1 + Math.exp(-x));

/** the chance a reading gives on a scale: the mean over the passes */
function chance(edges, left, seats, [width, widen, rivals]) {
  const spread = width * Math.sqrt(1 + widen * left);
  const shift = rivals * (seats - 2) * left;
  let sum = 0;
  for (const e of edges) sum += sigma((e - shift) / spread);
  return sum / edges.length;
}

function logLoss(sample, p) {
  let sum = 0;
  for (const r of sample) {
    const c = Math.min(1 - 1e-6, Math.max(1e-6, chance(r.edges, r.left, r.seats, p)));
    sum -= r.won ? Math.log(c) : Math.log(1 - c);
  }
  return sum / sample.length;
}

/* what each constant may be: a width of a point or two, or a widening of
   thirty, fits a sample better and reads nothing like a chance — the bounds
   keep the curve the shape the panel draws */
const BOUNDS = [
  [2, 15],
  [0, 4],
  [0, 2],
];
/** how far each constant is swept: a width moves in points, the rest in tenths */
const STEPS = [1, 0.2, 0.1];

/** coordinate descent, each constant swept in turn on a shrinking step */
function fit(sample, start) {
  let best = [...start];
  let loss = logLoss(sample, best);
  for (const shrink of [1, 0.5, 0.25, 0.1, 0.05]) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < best.length; i++) {
        for (const d of [STEPS[i] * shrink, -STEPS[i] * shrink]) {
          const trial = [...best];
          trial[i] = Math.round((trial[i] + d) * 1000) / 1000;
          if (trial[i] < BOUNDS[i][0] || trial[i] > BOUNDS[i][1]) continue;
          const l = logLoss(sample, trial);
          if (l < loss - 1e-9) {
            best = trial;
            loss = l;
            moved = true;
          }
        }
      }
    }
  }
  return { p: best, loss };
}

/** the deciles: what was promised against what happened */
function deciles(sample, p) {
  const bins = Array.from({ length: 10 }, () => ({ n: 0, said: 0, won: 0 }));
  for (const r of sample) {
    const c = chance(r.edges, r.left, r.seats, p);
    const b = bins[Math.min(9, Math.floor(c * 10))];
    b.n += 1;
    b.said += c;
    b.won += r.won;
  }
  return bins.map((b, i) => `${i * 10}-${i * 10 + 10}%: ${b.n ? `${(100 * (b.said / b.n)).toFixed(1)} said, ${(100 * (b.won / b.n)).toFixed(1)} won, ${b.n} rows` : '—'}`);
}

/* The scales in force, read out of the source rather than written in here.
   They were written in here once, and drifted: this reported a long judge
   starting from a width of seven while the code had been on 5.2 for
   months, so the "was" it printed belonged to nobody and the fit could not
   be told to beat what is actually shipped. */
function living(name) {
  const src = readFileSync('src/game/analysis.ts', 'utf8');
  const at = src.indexOf(`export const ${name}`);
  if (at < 0) throw new Error(`${name} is not in src/game/analysis.ts`);
  const line = src.slice(at, src.indexOf(';', at));
  const of = (key) => {
    const m = line.match(new RegExp(`${key}:\\s*(-?[0-9.]+)`));
    if (!m) throw new Error(`${name} has no ${key}: ${line}`);
    return Number(m[1]);
  };
  return [of('width'), of('widen'), of('rivals')];
}

const SHORT = living('SHORT_SCALE');
const LONG = living('LONG_JUDGE');
const DEEP = living('DEEP_JUDGE');

const judges = {
  'SHORT_SCALE (the table as it stands)': { pick: (r) => [r.edge], start: SHORT },
  'LONG_JUDGE (five moves on)': { pick: (r) => r.long, start: LONG },
  'LONG_JUDGE, its first pass alone': { pick: (r) => r.long?.slice(0, 1), start: LONG },
  'DEEP_JUDGE (ten moves on)': { pick: (r) => r.deep, start: DEEP },
  'DEEP_JUDGE, its first pass alone': { pick: (r) => r.deep?.slice(0, 1), start: DEEP },
};

for (const [name, { pick, start }] of Object.entries(judges)) {
  const sample = rows
    .map((r) => ({ edges: pick(r), left: r.left, seats: r.seats, won: r.won }))
    .filter((r) => Array.isArray(r.edges) && r.edges.length);
  if (!sample.length) {
    console.log(`${name}: nothing read`);
    continue;
  }
  const was = logLoss(sample, start);
  const { p, loss } = fit(sample, start);
  console.log(`\n${name} — ${sample.length} rows, ${sample[0].edges.length} pass(es)`);
  console.log(`  was   { width: ${start[0]}, widen: ${start[1]}, rivals: ${start[2]} }  log loss ${was.toFixed(4)}`);
  console.log(`  fits  { width: ${p[0]}, widen: ${p[1]}, rivals: ${p[2]} }  log loss ${loss.toFixed(4)}`);
  for (const line of deciles(sample, p)) console.log(`    ${line}`);
}
