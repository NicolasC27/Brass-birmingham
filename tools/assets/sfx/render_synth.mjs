// The sounds synthesised in app/src/gl/sfx.ts, rendered offline for
// judge_sfx.py: the dev server's page in a headless Chrome, an
// OfflineAudioContext standing in for the page's context, each function
// called as the sound board of /admin calls it. Writes <out>/synth-*.f32
// (48 kHz stereo float, as the page hears them).
//
//   google-chrome-stable --headless=new --remote-debugging-port=9337 --user-data-dir=<a scratch dir> about:blank &
//   node tools/assets/sfx/render_synth.mjs <out dir>          (the dev server on :3000)
import { writeFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('usage: render_synth.mjs <out dir>');
mkdirSync(out, { recursive: true });
const port = Number(process.env.CDP_PORT ?? 9337);
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));
let id = 0;
const waits = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waits.has(m.id)) {
    waits.get(m.id)(m);
    waits.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((ok, ko) => {
    const i = ++id;
    waits.set(i, (m) => (m.error ? ko(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:3000/admin?arrived=1' });
for (let k = 0; k < 150 && (await evaluate('document.readyState').catch(() => '')) !== 'complete'; k++) await wait(200);
await wait(2000);
/* a real gesture: sfx.ts makes no sound before the reader has touched the page */
for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: 5, y: 5, button: 'left', clickCount: 1 });

const SYNTH = {
  'synth-counter-bell': 'm.counterBell()',
  'synth-ping-tap': 'm.pingTap()',
  'synth-mug-clink': 'm.mugClink()',
  'synth-station-bell': 'm.stationBell()',
  'synth-steam-whistle': 'm.steamWhistle()',
  'synth-press-tile': "m.stampThud('tile')",
  'synth-press-link': "m.stampThud('link')",
  'synth-house-bell': "m.houseBell('birmingham')",
};
for (const [name, call] of Object.entries(SYNTH)) {
  const b64 = await evaluate(`(async () => {
    const m = await import('/src/gl/sfx.ts');
    m.closeAudio();
    m.setMix({ on: true, ambience: false, music: false, voices: false, levels: { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 } });
    const off = new OfflineAudioContext(2, 48000 * 4, 48000);
    /* the offline context told running, so sfx.ts plays into it */
    const proxy = new Proxy(off, { get(t, k) {
      if (k === 'state') return 'running';
      if (k === 'resume' || k === 'close') return () => Promise.resolve();
      const v = Reflect.get(t, k, t);
      return typeof v === 'function' ? v.bind(t) : v;
    } });
    window.AudioContext = function () { return proxy; };
    ${call};
    await new Promise((r) => setTimeout(r, 100));
    const buf = await off.startRendering();
    const n = buf.length, l = buf.getChannelData(0), r = buf.getChannelData(1);
    const f = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) { f[2 * i] = l[i]; f[2 * i + 1] = r[i]; }
    const bytes = new Uint8Array(f.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  })()`);
  writeFileSync(`${out}/${name}.f32`, Buffer.from(b64, 'base64'));
  console.log(name);
}
ws.close();
