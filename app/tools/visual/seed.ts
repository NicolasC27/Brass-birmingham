/* A game at home, played by machines up to the moment the reader must act,
   then written to the office so a browser can open it at that very point. */
import { applyAction, fallbackAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { chooseBotAction } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';

const PASS = process.env.VISUAL_PASS ?? '';
if (!PASS) throw new Error('set VISUAL_PASS to the dev account password');
const OFFICE = process.env.OFFICE ?? 'ws://localhost:8787';
const WHO = process.env.WHO ?? 'Chevalier';

const setup: SetupPayload = {
  players: [
    { name: 'Nicolas', color: 'brass', type: 'human' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    { name: 'Miss Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
    { name: 'Mr Watt', color: 'steel', type: 'bot', persona: 'watt' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

function play(seed: number, stopAt: (s: GameState, n: number) => boolean): { actions: GameAction[]; state: GameState } {
  let s = newGame(setup, seed);
  const actions: GameAction[] = [];
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 2000) {
    if (stopAt(s, actions.length)) break;
    if (s.phase === 'scoring-canal') {
      const a: GameAction = { kind: 'begin-rail' };
      const r = applyAction(s, s.current, a);
      if (!r.state) break;
      s = r.state; actions.push(a); continue;
    }
    const seat = s.current;
    const want = chooseBotAction(s, seat, { strength: 0.85, budget: 120 }) ?? fallbackAction(s, seat);
    let r = applyAction(s, seat, want);
    let taken = want;
    if (!r.state) { taken = fallbackAction(s, seat); r = applyAction(s, seat, taken); }
    if (!r.state) { if (process.env.DEBUG) console.log('# bloqué', actions.length, 'seat', seat, s.phase); break; }
    s = r.state; actions.push(taken);
  }
  return { actions, state: s };
}

class Wire {
  private id = 0;
  private waits = new Map<number, (m: any) => void>();
  constructor(private ws: WebSocket) {
    ws.onmessage = (m) => { const x = JSON.parse(String(m.data)); if (x.t === 'home.refused') console.log('# REFUS', JSON.stringify(x)); if (x.rid && this.waits.has(x.rid)) { this.waits.get(x.rid)!(x); this.waits.delete(x.rid); } };
  }
  static async open(): Promise<Wire> {
    const ws = new WebSocket(OFFICE);
    await new Promise((r, j) => { ws.onopen = r as () => void; ws.onerror = j as () => void; });
    return new Wire(ws);
  }
  ask(mk: (rid: number) => unknown): Promise<any> { const i = ++this.id; return new Promise((r) => { this.waits.set(i, r); this.ws.send(JSON.stringify(mk(i))); }); }
  say(m: unknown): void { this.ws.send(JSON.stringify(m)); }
}

const WANT = JSON.parse(process.env.SCENES ?? '[]') as { name: string; seed: number; until: string }[];

/* every game is played out BEFORE the line is opened: the simulation holds
   the event loop for whole seconds, and an office that gets no answer to its
   ping hangs up on us mid-deal */
const played = WANT.map((scene) => {
  const stop = (s: GameState, n: number): boolean => {
    if (scene.until === 'human-canal') return s.current === 0 && n >= 14 && s.era === 'canal' && s.phase === 'action';
    if (scene.until === 'human-rail') return s.current === 0 && s.era === 'rail' && n >= 60 && s.phase === 'action';
    if (scene.until === 'era-end') return s.phase === 'scoring-canal';
    if (scene.until === 'over') return false;
    return n >= Number(scene.until || 20);
  };
  const r = play(scene.seed, stop);
  console.log('# joué', scene.name, r.actions.length, 'coups,', r.state.phase);
  return { scene, ...r };
});

const w = await Wire.open();
let me = await w.ask((rid) => ({ t: 'signin', rid, name: WHO, password: PASS }));
if (me.t === 'refused') me = await w.ask((rid) => ({ t: 'signup', rid, name: WHO, email: `${WHO.toLowerCase()}@example.test`, password: PASS, accept: true }));
console.log('# session', me.t, me.token ? me.token.slice(0, 8) : me.error ?? '');

for (const { scene, actions, state } of played) {
  const dealt = await w.ask((rid) => ({ t: 'home.open', rid, name: scene.name, seed: scene.seed, setup }));
  if (dealt.t !== 'home.dealt') { console.log('# refusé', scene.name, dealt.error ?? dealt.t); continue; }
  const code = dealt.table.code as string;
  for (let i = 0; i < actions.length; i++) {
    /* the office drips six words a second to a socket: keep under it */
    w.say({ t: 'home.act', code, idx: i, action: actions[i] });
    await new Promise((r) => setTimeout(r, 190));
  }
  await new Promise((r) => setTimeout(r, 500));
  console.log('# action 29:', JSON.stringify(actions[29]), '| 28:', JSON.stringify(actions[28]));
  console.log(JSON.stringify({ scene: scene.name, code, moves: actions.length, era: state.era, round: state.round, current: state.current, phase: state.phase, vp: state.players.map((p) => p.vp) }));
}
await new Promise((r) => setTimeout(r, 900));
process.exit(0);
