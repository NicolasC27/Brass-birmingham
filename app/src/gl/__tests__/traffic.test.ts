import { describe, expect, it } from 'vitest';
import { LINKS } from '@/game/data';
import { routeFor } from '@/components/game/routePaths';
import { BARGE_RAMP_S, BARGE_SPEED, TRAIN_RAMP_S, TRAIN_SPEED, castOffAt, nextCastOff, passageAt, planPassage, quayAlpha, underWay } from '../ambiance';
import type { Passage, Timetable } from '../ambiance';

/* the run a vehicle makes on a link: 80 % of the route, off the towns */
const runOf = (era: 'canal' | 'rail'): number[] =>
  LINKS.filter((d) => (era === 'canal' ? d.canal : d.rail)).map((d) => {
    const p = routeFor(d, era).pts;
    let total = 0;
    for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return 0.8 * total;
  });

/** the fastest the vehicle goes, sampled at 240 frames a second */
const topSpeed = (p: Passage): number => {
  let top = 0;
  for (let s = 0; s < p.dur; s += 1 / 240) top = Math.max(top, (passageAt(p, s + 1 / 240) - passageAt(p, s)) * 240);
  return top;
};

describe('a barge on a new canal goes at a horse’s pace', () => {
  const runs = runOf('canal');

  it('cruises at its speed in world units a second, whatever the canal’s length', () => {
    for (const dist of [Math.min(...runs), 300, Math.max(...runs)]) {
      const p = planPassage(dist, BARGE_SPEED, BARGE_RAMP_S);
      const mid = p.dur / 2;
      expect(passageAt(p, mid + 0.5) - passageAt(p, mid - 0.5)).toBeCloseTo(BARGE_SPEED, 6);
      expect(topSpeed(p)).toBeLessThanOrEqual(BARGE_SPEED + 1e-6);
    }
  });

  it('takes its time: no crossing under fifteen seconds, the longest about a minute', () => {
    const durs = runs.map((d) => planPassage(d, BARGE_SPEED, BARGE_RAMP_S).dur);
    expect(Math.min(...durs)).toBeGreaterThan(15);
    expect(Math.max(...durs)).toBeLessThan(65);
  });

  it('casts off and moors gently, from rest to rest', () => {
    const p = planPassage(300, BARGE_SPEED, BARGE_RAMP_S);
    expect(passageAt(p, 0)).toBe(0);
    expect(passageAt(p, p.dur)).toBe(300);
    /* first and last half-second: barely a few units */
    expect(passageAt(p, 0.5)).toBeLessThan(0.5);
    expect(300 - passageAt(p, p.dur - 0.5)).toBeLessThan(0.5);
    /* the way builds without a jump: speed rises steadily over the ramp */
    let last = 0;
    for (let s = 0.25; s <= BARGE_RAMP_S; s += 0.25) {
      const v = (passageAt(p, s + 0.01) - passageAt(p, s)) / 0.01;
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v - last).toBeLessThan(BARGE_SPEED * 0.2);
      last = v;
    }
  });

  it('never jumps, sampled at any frame rate', () => {
    const p = planPassage(Math.max(...runs), BARGE_SPEED, BARGE_RAMP_S);
    for (const fps of [24, 60, 144]) {
      let prev = 0;
      for (let s = 0; s <= p.dur; s += 1 / fps) {
        const d = passageAt(p, s);
        expect(d - prev).toBeLessThanOrEqual(BARGE_SPEED / fps + 1e-6);
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
    }
  });

  it('a short cut is sailed slower, never faster', () => {
    const p = planPassage(30, BARGE_SPEED, BARGE_RAMP_S);
    expect(p.cruise).toBeLessThan(BARGE_SPEED);
    expect(topSpeed(p)).toBeLessThanOrEqual(BARGE_SPEED);
    expect(p.dur).toBeGreaterThanOrEqual(2 * BARGE_RAMP_S - 1e-9);
  });
});

describe('a train is quicker than a barge, without rushing', () => {
  const runs = runOf('rail');

  it('cruises at its own speed, three barges’ worth', () => {
    const p = planPassage(400, TRAIN_SPEED, TRAIN_RAMP_S);
    expect(passageAt(p, p.dur / 2 + 0.5) - passageAt(p, p.dur / 2 - 0.5)).toBeCloseTo(TRAIN_SPEED, 6);
    expect(TRAIN_SPEED).toBeGreaterThan(BARGE_SPEED);
    expect(TRAIN_SPEED).toBeLessThanOrEqual(3 * BARGE_SPEED);
  });

  it('no line is run in under seven seconds', () => {
    const durs = runs.map((d) => planPassage(d, TRAIN_SPEED, TRAIN_RAMP_S).dur);
    expect(Math.min(...durs)).toBeGreaterThan(7);
    expect(Math.max(...durs)).toBeLessThan(25);
  });
});

describe('a link just laid sends its vehicle off from the quay', () => {
  const pass = planPassage(250, BARGE_SPEED, BARGE_RAMP_S);
  const rest = 4;
  const t0 = 137.42; // the table's clock when the canal is laid

  it('the maiden voyage starts at the quay, at rest and unseen, the moment the link is laid', () => {
    const tt: Timetable = { pass, rest, ph: castOffAt(t0, { pass, rest }), from: t0, until: Infinity };
    expect(underWay(tt, t0 - 0.01)).toBeNull();
    expect(underWay(tt, t0)).toBeCloseTo(0, 9);
    expect(quayAlpha(pass, underWay(tt, t0)!)).toBeCloseTo(0, 6);
    /* two seconds later it has barely left the quay */
    expect(passageAt(pass, underWay(tt, t0 + 2)!)).toBeLessThan(BARGE_SPEED);
  });

  it('shows itself only where it moves slowly: nothing pops in or out mid-canal', () => {
    const tt: Timetable = { pass, rest, ph: castOffAt(t0, { pass, rest }), from: t0, until: Infinity };
    let prev: number | null = null;
    for (let t = t0; t < t0 + 3 * (pass.dur + rest); t += 1 / 60) {
      const s = underWay(tt, t);
      if ((s === null) !== (prev === null)) {
        /* appearing or vanishing: the frame shown is at a quay, all but transparent */
        const shown = s ?? prev!;
        expect(quayAlpha(pass, shown)).toBeLessThan(0.02);
        const run = passageAt(pass, shown);
        expect(Math.min(run, pass.dist - run)).toBeLessThan(0.01);
      }
      prev = s;
    }
  });

  it('with traffic off, the maiden voyage makes one crossing and is gone', () => {
    const tt: Timetable = { pass, rest, ph: castOffAt(t0, { pass, rest }), from: t0, until: t0 + pass.dur };
    expect(underWay(tt, t0 + pass.dur / 2)).not.toBeNull();
    expect(underWay(tt, t0 + pass.dur)).toBeNull();
    expect(underWay(tt, t0 + pass.dur + rest + 1)).toBeNull();
  });

  it('a link that comes with a crowd waits for its own cast-off, never popping up mid-canal', () => {
    for (const ph of [0, 3.3, pass.dur / 2, pass.dur - 0.2, pass.dur + rest / 2]) {
      const from = nextCastOff(t0, { pass, rest, ph });
      const tt: Timetable = { pass, rest, ph, from, until: Infinity };
      expect(from).toBeGreaterThanOrEqual(t0);
      expect(from - t0).toBeLessThan(pass.dur + rest);
      /* unseen until then, and first seen at the quay, at rest */
      expect(underWay(tt, from - 0.01)).toBeNull();
      expect(underWay(tt, from)).toBeCloseTo(0, 6);
    }
  });
});
