/* Visual guard — a fixed timetable of scenes, photographed and laid over
   the last approved proof. A plate that moved beyond the threshold, a new
   line of text under its contrast floor, a new sideways overflow, a
   utility whose computed value is void, or a colour token that is no
   longer an "r g b" triplet: the run fails and says where.

   npm run visual            compare against tools/visual/refs
   npm run visual:update     rewrite the references after a wanted change
   env: VISUAL_ONLY=name,... VISUAL_THRESHOLD=0.002 (share of pixels)
        VISUAL_TOKEN or tools/visual/.session (session for the game scenes)
        VISUAL_GAMES='{"canal":"A6AS",…}' (after a re-seed)
        VISUAL_CDP=9336 VISUAL_BASE=http://localhost:3000 VISUAL_OFFICE=8787 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const REFS = join(HERE, 'refs');
const OUT = join(HERE, 'out');
const UPDATE = process.argv.includes('--update');
const BASE = process.env.VISUAL_BASE ?? 'http://localhost:3000';
const CDP_PORT = process.env.VISUAL_CDP ?? '9336';
const OFFICE_PORT = Number(process.env.VISUAL_OFFICE ?? 8787);
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD ?? 0.002);
const ONLY = (process.env.VISUAL_ONLY ?? '').split(',').filter(Boolean);
const FROZEN = Date.parse('2026-06-15T10:30:00+02:00');
const MAX_H = 4000;

/* ---------- the timetable ---------- */
const PAGES = ['/', '/online', '/desk', '/profile', '/rules', '/classement', '/comptoir', '/setup'];
const SCENES = [];
for (const url of PAGES) for (const theme of ['light', 'dark']) for (const w of [1440, 1024]) {
  SCENES.push({ name: `site${url === '/' ? '-home' : url.replace(/\//g, '-')}-${theme}-${w}`, url, theme, w, h: 900, full: true, boot: 3500 });
}
// Game codes live in the dev register (app/brassworks.db); after a re-seed,
// pass the new ones as VISUAL_GAMES='{"canal":"XXXX",...}'.
const CODES = JSON.parse(process.env.VISUAL_GAMES ?? '{}');
const game = (name, code, steps = []) => ({ name: `table-${name}`, url: `/game/local/${CODES[name] ?? code}`, theme: 'dark', w: 1440, h: 900, boot: 12000, gl: true, steps });
SCENES.push(
  game('canal', 'A6AS'),
  game('rail', 'WDR8'),
  game('end-of-canal', 'C8F3'),
  game('finished', 'ZHBV'),
  game('card-build', 'A6AS', [
    // First card of the hand dock (its buttons carry aria-pressed), then the
    // dock's Build action, whatever the language.
    { js: `(() => { const c = document.querySelector('footer[data-lens="hand"] button[aria-pressed]'); if (!c) return false; c.click(); return true; })()` },
    { wait: 600 },
    { js: `(() => { const b = [...document.querySelectorAll('footer[data-lens="hand"] button')].find(b => b.offsetParent && /^(construire|build|construir|bauen)/i.test((b.innerText || b.getAttribute('aria-label') || '').trim())); if (!b) return false; b.click(); return true; })()` },
    { wait: 1200 },
  ]),
);

/* ---------- the platform check ---------- */
const reach = (port) => new Promise((res) => { const s = connect(port, '127.0.0.1'); s.once('connect', () => { s.end(); res(true); }); s.once('error', () => res(false)); });
async function preflight() {
  const miss = [];
  try { await fetch(BASE); } catch { miss.push(`vite is not answering on ${BASE} -> (cd app && npx vite --port 3000 --strictPort)`); }
  if (!(await reach(OFFICE_PORT))) miss.push(`the office is not answering on :${OFFICE_PORT} -> (cd app && DEV_LETTERS=1 npm run server)`);
  let version = null;
  try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); } catch {
    miss.push(`headless Chrome is not answering on :${CDP_PORT} -> google-chrome-stable --headless=new --remote-debugging-port=${CDP_PORT} --user-data-dir=/tmp/visual-chrome --no-first-run --hide-scrollbars --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`);
  }
  if (miss.length) { console.error('visual: the line is not open.\n  ' + miss.join('\n  ')); process.exit(2); }
  return version;
}

/* ---------- a thin CDP client ---------- */
async function openBrowser(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { const p = pend.get(x.id); pend.delete(x.id); x.error ? p.j(new Error(`${p.m}: ${x.error.message}`)) : p.r(x.result); } };
  const send = (m, params = {}, sessionId) => new Promise((r, j) => {
    const i = ++id; pend.set(i, { r, j, m });
    ws.send(JSON.stringify({ id: i, method: m, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); j(new Error('timeout ' + m)); } }, 60000);
  });
  return { send, close: () => ws.close() };
}

const session = process.env.VISUAL_TOKEN ?? (existsSync(join(HERE, '.session')) ? readFileSync(join(HERE, '.session'), 'utf8').trim() : '');
const probeSrc = readFileSync(join(HERE, 'probe.js'), 'utf8');
// Every colour token Tailwind reads as `rgb(var(--x, …) / <alpha-value>)`.
const TRIPLETS = [...new Set([...readFileSync(join(APP, 'tailwind.config.js'), 'utf8').matchAll(/rgb\(var\((--[\w-]+)/g)].map((m) => m[1]))];

const boot = (s) => `(() => {
  try {
    localStorage.setItem('brassworks.theme.v1', ${JSON.stringify(s.theme)});
    localStorage.setItem('brassworks.lang', 'fr');
    ${session ? `localStorage.setItem('brassworks.session.v1', ${JSON.stringify(session)});` : ''}
  } catch (e) {}
  // The station clock is stopped at one fixed morning; it still ticks forward from there.
  const Real = Date, t0 = Real.now(), base = ${FROZEN};
  class Frozen extends Real { constructor(...a) { a.length ? super(...a) : super(base + (Real.now() - t0)); } static now() { return base + (Real.now() - t0); } }
  globalThis.Date = Frozen;
  const still = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'; document.documentElement.appendChild(st); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', still) : still();
})()`;

// Browser-side audit beyond probe.js: triplet tokens and void utility values.
const AUDIT = `(() => {
  const ctx = [['root', document.documentElement]];
  let pr = document.querySelector('.platform-root'), made = false;
  if (!pr) { pr = document.createElement('div'); pr.className = 'platform-root'; document.body.appendChild(pr); made = true; }
  ctx.push(['platform-root', pr]);
  const tokens = [];
  for (const [where, el] of ctx) {
    const cs = getComputedStyle(el);
    for (const t of ${JSON.stringify(TRIPLETS)}) {
      const v = cs.getPropertyValue(t).trim();
      if (v && !CSS.supports('color', 'rgb(' + v + ' / 1)')) tokens.push(where + ' ' + t + ': ' + v);
    }
  }
  const resolve = (val, cs, depth = 0) => depth > 8 ? val : val.replace(/var\\((--[\\w-]+)\\s*(?:,\\s*((?:[^()]|\\([^()]*\\))*))?\\)/g, (_, n, fb) => {
    const v = cs.getPropertyValue(n).trim();
    return v ? v : fb !== undefined ? resolve(fb.trim(), cs, depth + 1) : 'unset-token';
  });
  const utilities = new Set();
  const walk = (rules) => { for (const r of rules) {
    if (r.cssRules && !r.style) { walk(r.cssRules); continue; }
    if (!r.style || !r.selectorText || !/^\\.[\\w\\\\:\\[\\]\\/.-]+$/.test(r.selectorText.split(/[ >:]/)[0])) continue;
    for (const prop of r.style) {
      const raw = r.style.getPropertyValue(prop);
      if (!raw.includes('var(') || prop.startsWith('--')) continue;
      for (const [where, el] of ctx) {
        const v = resolve(raw, getComputedStyle(el));
        if (v.includes('unset-token')) continue;
        if (/(color|background|border|fill|stroke|outline|shadow|decoration)/.test(prop) && !CSS.supports(prop, v)) utilities.add(r.selectorText + ' { ' + prop + ' } in ' + where);
      }
    }
  } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
  if (made) pr.remove();
  const masks = [...document.querySelectorAll('time, [role="timer"], [data-clock]')].map((e) => { const b = e.getBoundingClientRect(); return [b.x + scrollX, b.y + scrollY, b.width, b.height]; }).filter((b) => b[2] > 0 && b[3] > 0);
  return JSON.stringify({ tokens, utilities: [...utilities].slice(0, 400), masks });
})()`;

/* ---------- one scene ---------- */
async function shoot(b, s) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => b.send(m, p, sessionId);
  const notes = [];
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: s.theme }] });
    await send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Paris' }).catch(() => {});
    await send('Page.addScriptToEvaluateOnNewDocument', { source: boot(s) });
    await send('Page.navigate', { url: BASE + s.url });
    await sleep(s.boot);
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
    for (const st of s.steps ?? []) {
      if (st.wait) await sleep(st.wait);
      if (st.js && !(await ev(st.js))) notes.push('step missed: ' + st.js.slice(0, 70));
    }
    await ev('document.fonts && document.fonts.ready.then(() => 1)');
    // Wait for the plate to settle: two viewport proofs in a row that agree.
    let prev = null;
    for (let i = 0; i < (s.gl ? 12 : 5); i++) {
      const cur = PNG.sync.read(Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      if (prev && prev.width === cur.width && prev.height === cur.height && pixelmatch(prev.data, cur.data, null, cur.width, cur.height, { threshold: 0.1 }) / (cur.width * cur.height) < 0.0005) break;
      prev = cur; await sleep(s.gl ? 2000 : 700);
    }
    const probe = JSON.parse(await ev(probeSrc));
    const audit = JSON.parse(await ev(AUDIT));
    const height = s.full ? Math.min(MAX_H, Math.max(s.h, await ev('document.documentElement.scrollHeight'))) : s.h;
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: s.full, clip: { x: 0, y: 0, width: s.w, height, scale: 1 } });
    return { png: Buffer.from(shot.data, 'base64'), probe, audit, notes };
  } finally {
    await b.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

/* ---------- comparison ---------- */
// A contrast failure is keyed by its colour pair: the words may change, the ink must not.
const keyOf = (c) => `${c.fg} on ${c.bg} (${c.need})`;
function compare(s, cur, ref) {
  const fails = [];
  let a = PNG.sync.read(cur.png), r = PNG.sync.read(readFileSync(join(REFS, `${s.name}.png`)));
  const w = Math.max(a.width, r.width), h = Math.max(a.height, r.height);
  const pad = (img) => { if (img.width === w && img.height === h) return img; const p = new PNG({ width: w, height: h }); p.data.fill(0); PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0); return p; };
  a = pad(a); r = pad(r);
  for (const [x, y, mw, mh] of [...cur.audit.masks, ...(ref.audit?.masks ?? [])]) {
    for (let yy = Math.max(0, y | 0); yy < Math.min(h, y + mh); yy++) for (let xx = Math.max(0, x | 0); xx < Math.min(w, x + mw); xx++) {
      const i = (yy * w + xx) * 4; for (const img of [a, r]) { img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    }
  }
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(r.data, a.data, diff.data, w, h, { threshold: 0.1, includeAA: false });
  writeFileSync(join(OUT, `${s.name}.diff.png`), PNG.sync.write(diff));
  const share = n / (w * h);
  const limit = s.gl ? THRESHOLD * 5 : THRESHOLD;
  if (share > limit) fails.push(`pixels: ${(share * 100).toFixed(2)} % differ (limit ${(limit * 100).toFixed(2)} %)`);
  const had = new Set((ref.probe?.contrast ?? []).map(keyOf));
  for (const c of cur.probe.contrast ?? []) if (!had.has(keyOf(c)) && c.grounded !== false) fails.push(`contrast ${c.ratio} < ${c.need}: "${c.txt}" (${c.fg} on ${c.bg}) ${c.sel}`);
  if (cur.probe.hOverflow && !ref.probe?.hOverflow) fails.push(`horizontal overflow: ${cur.probe.hOverflow.doc}px in ${cur.probe.hOverflow.vw}px`);
  const hadU = new Set(ref.audit?.utilities ?? []);
  for (const u of cur.audit.utilities) if (!hadU.has(u)) fails.push('void utility: ' + u);
  return { share, fails };
}

/* ---------- the run ---------- */
const version = await preflight();
mkdirSync(REFS, { recursive: true }); mkdirSync(OUT, { recursive: true });
if (!session) console.warn('visual: no session (VISUAL_TOKEN or tools/visual/.session); the table scenes will show the door, not the game.');
const b = await openBrowser(version.webSocketDebuggerUrl);
const rows = [];
let failed = 0;
for (const s of SCENES.filter((x) => !ONLY.length || ONLY.some((o) => x.name.includes(o)))) {
  let row;
  try {
    const cur = await shoot(b, s);
    writeFileSync(join(OUT, `${s.name}.png`), cur.png);
    const fails = cur.audit.tokens.map((t) => 'token is not a triplet: ' + t);
    const refJson = join(REFS, `${s.name}.json`);
    let share = 0;
    if (UPDATE || !existsSync(refJson)) {
      writeFileSync(join(REFS, `${s.name}.png`), cur.png);
      writeFileSync(refJson, JSON.stringify({ probe: { contrast: cur.probe.contrast, hOverflow: cur.probe.hOverflow }, audit: cur.audit }, null, 1));
      if (!UPDATE) cur.notes.push('no reference yet: this proof becomes it');
    } else {
      const c = compare(s, cur, JSON.parse(readFileSync(refJson, 'utf8')));
      share = c.share; fails.push(...c.fails);
    }
    row = { s, share, fails, notes: cur.notes };
  } catch (e) {
    row = { s, share: 0, fails: ['scene broke: ' + e.message], notes: [] };
  }
  rows.push(row);
  if (row.fails.length) failed++;
  console.log(`${row.fails.length ? 'FAIL' : ' ok '} ${s.name}${row.share ? ` ${(row.share * 100).toFixed(2)}%` : ''}`);
  for (const f of row.fails.slice(0, 6)) console.log('       ' + f);
  if (row.fails.length > 6) console.log(`       … ${row.fails.length - 6} more in the report`);
  for (const n of row.notes) console.log('       note: ' + n);
}
b.close();

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const html = `<!doctype html><meta charset="utf-8"><title>Visual guard</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#f6f3ec;color:#1d1a16}h2{margin:32px 0 6px;font-size:16px}
.bad h2{color:#a4231a}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}figcaption{font-size:12px;color:#5b5348}
img{width:100%;border:1px solid #d8d0c2;background:#fff}ul{margin:4px 0;padding-left:18px;color:#a4231a;font-size:13px}</style>
<h1>Visual guard — ${failed ? `${failed} scene(s) failed` : 'all clear'}</h1>
<p>${rows.length} scenes, threshold ${(THRESHOLD * 100).toFixed(2)} % (table ×5). ${UPDATE ? 'References rewritten.' : ''}</p>
${rows.map(({ s, share, fails, notes }) => `<section class="${fails.length ? 'bad' : ''}"><h2>${esc(s.name)} · ${(share * 100).toFixed(2)} %</h2>
${fails.length ? `<ul>${fails.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}${notes.map((n) => `<p>${esc(n)}</p>`).join('')}
<div class="row"><figure><img loading="lazy" src="../refs/${s.name}.png"><figcaption>before (reference)</figcaption></figure>
<figure><img loading="lazy" src="${s.name}.png"><figcaption>after</figcaption></figure>
<figure><img loading="lazy" src="${s.name}.diff.png"><figcaption>difference</figcaption></figure></div></section>`).join('\n')}`;
writeFileSync(join(OUT, 'report.html'), html);
console.log(`\nvisual: ${rows.length - failed}/${rows.length} clear · report ${join(OUT, 'report.html')}`);
process.exit(failed ? 1 : 0);
