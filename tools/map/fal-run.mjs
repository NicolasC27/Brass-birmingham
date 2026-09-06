/* fal.ai queue runner. Usage: node fal-run.mjs <model-id> <body.json> <out-image> [imageKey]
 * The key is read from ../.env.local (FAL_KEY=...), never printed. */
import { readFileSync, writeFileSync } from 'node:fs';
const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/FAL_KEY=(\S+)/)?.[1];
if (!KEY) throw new Error('FAL_KEY missing in .env.local');
const [model, bodyFile, out, imageKey = 'images'] = process.argv.slice(2);
const body = JSON.parse(readFileSync(bodyFile, 'utf8'));
/* file:// values become base64 data URIs */
for (const [k, v] of Object.entries(body)) {
  if (Array.isArray(v)) body[k] = v.map((x) => (typeof x === 'string' && x.startsWith('file://') ? `data:image/png;base64,${readFileSync(x.slice(7)).toString('base64')}` : x));
  if (typeof v === 'string' && v.startsWith('file://')) {
    const p = v.slice(7);
    const mime = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
    body[k] = `data:${mime};base64,${readFileSync(p).toString('base64')}`;
  }
}
const H = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' };
const sub = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
if (!sub.ok) throw new Error(`submit ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
const { request_id, status_url, response_url } = await sub.json();
const base = `https://queue.fal.run/${model}/requests/${request_id}`;
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 2500));
  const st = await (await fetch(`${status_url ?? base + '/status'}`, { headers: H })).json();
  if (st.status === 'COMPLETED') break;
  if (st.error) throw new Error(`fal error: ${JSON.stringify(st).slice(0, 300)}`);
  if (Date.now() - t0 > 240000) throw new Error('timeout');
}
const res = await (await fetch(response_url ?? base, { headers: H })).json();
const img = Array.isArray(res[imageKey]) ? res[imageKey][0] : res[imageKey];
if (!img?.url) throw new Error(`no image in response: ${JSON.stringify(res).slice(0, 300)}`);
const buf = Buffer.from(await (await fetch(img.url)).arrayBuffer());
writeFileSync(out, buf);
console.log(`${model} → ${out} ${img.width}x${img.height} seed=${res.seed} in ${Math.round((Date.now() - t0) / 1000)}s`);
