/* ------------------------------------------------------------------ */
/* The folded income track, read at a glance: every rung a seat stands */
/* on carries a flag — the seats' tokens, fanned, and what the rung    */
/* pays: after them along the bottom, on a plate under them down the   */
/* left edge. Seats on one rung share their flag (they earn the same); */
/* two flags never overprint each other: neighbours are pushed apart   */
/* along the line, a cluster centred on its rungs, the whole kept      */
/* inside the lane. Plain functions of positions in pixels, so the     */
/* layout can be held to account without a browser.                    */
/* ------------------------------------------------------------------ */

export type FlagAxis = 'x' | 'y';

/** the token on the folded track, and the step between tokens fanned on one rung */
export const FLAG_CHIP = 13;
export const FLAG_FAN = 8;
/** the pay's figure: along the bottom it follows the tokens on the line,
 *  down the left edge it hangs under them, on the line, inside the lane */
export const FLAG_FONT: Record<FlagAxis, number> = { x: 11, y: 10 };
/** between the tokens and the figure, and between two flags */
export const FLAG_SPACE = 3;
export const FLAG_GAP = 4;
/** down the left edge the figure's plate: a 12 px line and its edge, as
 *  wide as the lane but a margin either side, so the plates make a column */
export const FLAG_PLATE_H = 14;
export const FLAG_PLATE_MARGIN = 3;

/** a figure's width in the track's monospace (IBM Plex Mono: 0.6 em a
 *  glyph), its backing's padding included */
export const figureWidth = (text: string, px: number): number => Math.ceil(text.length * 0.6 * px) + 4;
/** what a figure asks of its plate down the left edge, its edge included */
export const plateWidth = (text: string): number => figureWidth(text, FLAG_FONT.y) + 2;

/** the tokens fanned on one rung: their run along the line */
export const fanLength = (n: number): number => FLAG_CHIP + FLAG_FAN * Math.max(0, n - 1);

export interface FlagSpec {
  /** the rung's place along the lane, px from the lane's start */
  at: number;
  /** from the flag's start to the rung (the middle of its tokens) */
  lead: number;
  /** the flag's run along the lane */
  len: number;
}

/** a rung's flag: `n` tokens, then the figure after them along the bottom,
 *  or under them down the left edge (the lane runs from the top there, so
 *  after them again), the rung at the middle of the tokens */
export function flagSpec(axis: FlagAxis, at: number, n: number, figure: string): FlagSpec {
  const fan = fanLength(n);
  const figureLen = axis === 'y' ? FLAG_PLATE_H : figureWidth(figure, FLAG_FONT.x);
  return { at, lead: fan / 2, len: fan + FLAG_SPACE + figureLen };
}

/**
 * Where each flag's rung mark lands (px along the lane, the input's order):
 * on its rung when it has room, else pushed apart from its neighbours by
 * `gap` at least — a cluster of flags as near its rungs as it can be (the
 * least squares of the pushes), never out of [lo, hi] when the lane holds it.
 */
export function spreadFlags(flags: readonly FlagSpec[], gap: number, lo: number, hi: number): number[] {
  type Block = { idx: number[]; off: number[]; len: number; sum: number; start: number };
  const clamp = (start: number, len: number) => Math.max(lo, Math.min(start, hi - len));
  const order = flags.map((_, i) => i).sort((a, b) => flags[a].at - flags[b].at || a - b);
  const blocks: Block[] = [];
  for (const i of order) {
    const f = flags[i];
    const want = f.at - f.lead;
    let b: Block = { idx: [i], off: [0], len: f.len, sum: want, start: clamp(want, f.len) };
    for (let p = blocks[blocks.length - 1]; p && p.start + p.len + gap > b.start; p = blocks[blocks.length - 1]) {
      blocks.pop();
      const shift = p.len + gap;
      const idx = [...p.idx, ...b.idx];
      const len = shift + b.len;
      /* each member asks the block to start at its own wish less its
         place in the block: the block starts at the mean of the asks */
      const sum = p.sum + b.sum - shift * b.idx.length;
      b = { idx, off: [...p.off, ...b.off.map((o) => o + shift)], len, sum, start: clamp(sum / idx.length, len) };
    }
    blocks.push(b);
  }
  const out = new Array<number>(flags.length);
  for (const b of blocks) b.idx.forEach((i, k) => (out[i] = b.start + b.off[k] + flags[i].lead));
  return out;
}

/** whether a mark `half` px either side of `pos` (px along the lane)
 *  falls within the run of one of the flags laid at `at` */
export function underFlags(flags: readonly FlagSpec[], at: readonly number[], pos: number, half: number): boolean {
  return flags.some((f, k) => pos + half > at[k] - f.lead && pos - half < at[k] - f.lead + f.len);
}

/** the seats on each rung, rungs in the order first met */
export function rungs(incomes: readonly number[]): { space: number; seats: number[] }[] {
  const map = new Map<number, number[]>();
  incomes.forEach((s, i) => map.set(s, [...(map.get(s) ?? []), i]));
  return [...map].map(([space, seats]) => ({ space, seats }));
}

/** the seat or seats furthest along the track; nobody while all stand level */
export function incomeLeaders(incomes: readonly number[]): number[] {
  if (incomes.length < 2) return [];
  const top = Math.max(...incomes);
  const lead = incomes.flatMap((s, i) => (s === top ? [i] : []));
  return lead.length === incomes.length ? [] : lead;
}
