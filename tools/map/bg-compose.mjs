/* Compose the final era backgrounds from a painted TOP-DOWN terrain:
 *   canvas = world 3200×1800 + 15 % bleed on every side (4160×2340)
 *   terrain scaled to cover it, then canal beds, survey lines, village
 *   grounds and merchant basins engraved from the real geometry.
 * Usage: node bg-compose.mjs <geo.json> <terrain.png> <out-canal.png> <out-rail.png> */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const geo = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const terrain = `data:image/png;base64,${readFileSync(process.argv[3]).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ geo, terrain }) => {
  const BLEED = 0.15, worldW = 3200, worldH = 1800;
  const W = Math.round(worldW * (1 + 2 * BLEED)), H = Math.round(worldH * (1 + 2 * BLEED));
  const OX = worldW * BLEED, OY = worldH * BLEED;
  const X = (x) => x + OX, Y = (y) => y + OY;
  const img = new Image(); img.src = terrain; await img.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  /* terrain covers the canvas */
  const s = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);

  const seed = (n) => { let x = n >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
  const rnd = seed(11);
  const path = (pts) => { ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i][0]), Y(pts[i][1])); };
  const stroke = (pts, w, style, alpha = 1, dash = null, cap = 'round') => { ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = style; if (dash) ctx.setLineDash(dash); path(pts); ctx.stroke(); ctx.restore(); };
  const wobble = (pts, amp) => pts.map(([x, y], i) => { const sw = Math.sin(i * 1.7) * amp + Math.cos(i * 0.9) * amp * 0.6; const dx = i > 0 ? pts[i][0] - pts[i - 1][0] : 1, dy = i > 0 ? pts[i][1] - pts[i - 1][1] : 0; const L = Math.hypot(dx, dy) || 1; return [x - (dy / L) * sw, y + (dx / L) * sw]; });

  /* 1. canal beds: a dug channel with earthen banks, a towpath on one side,
        still water with a lighter thread down the middle and faint ripples */
  for (const l of geo.links) {
    if (!l.canal) continue;
    const pts = wobble(l.pts, 3);
    stroke(pts, 30, 'rgba(60,50,30,0.22)');                    // trampled banks
    stroke(pts, 20, 'rgba(22,30,20,0.55)');                    // shadow of the cut
    stroke(pts, 11, 'rgba(34,62,60,0.72)');                    // still water
    stroke(pts, 5, 'rgba(78,122,118,0.42)');                   // lighter thread
    stroke(pts, 1.4, 'rgba(230,240,230,0.28)', 1, [3, 26]);    // ripples
    stroke(pts.map(([x, y]) => [x + 9, y + 9]), 2.2, 'rgba(214,196,150,0.42)', 1, [12, 10]); // towpath
  }
  /* 2. rail-only lines: cart roads today, surveyed for rails tomorrow */
  for (const l of geo.links) {
    if (l.canal) continue;
    const pts = wobble(l.pts, 2);
    stroke(pts, 7, 'rgba(70,56,38,0.28)');
    stroke(pts, 3, 'rgba(206,186,140,0.34)');
  }
  /* 3. village grounds: a cobbled patch, a warm dusty ring, a few outbuilding footprints */
  for (const t of geo.towns) {
    const r = t.farm ? 60 : 105;
    const g = ctx.createRadialGradient(X(t.x), Y(t.y), 8, X(t.x), Y(t.y), r);
    g.addColorStop(0, 'rgba(92,74,52,0.62)'); g.addColorStop(0.6, 'rgba(86,70,50,0.34)'); g.addColorStop(1, 'rgba(86,70,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), r, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < (t.farm ? 30 : 140); k++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.78;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(150,128,98,0.45)' : 'rgba(36,28,20,0.5)';
      ctx.fillRect(X(t.x) + Math.cos(a) * d, Y(t.y) + Math.sin(a) * d, 2.6, 2.6);
    }
    if (!t.farm) for (let k = 0; k < 2; k++) {
      const a = rnd() * Math.PI * 2, d = r * (0.55 + rnd() * 0.35), w = 12 + rnd() * 12, h = 8 + rnd() * 7;
      ctx.save(); ctx.translate(X(t.x) + Math.cos(a) * d, Y(t.y) + Math.sin(a) * d); ctx.rotate(rnd() * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
      ctx.fillStyle = '#7A4A3C'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = 'rgba(255,220,180,0.25)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.45);
      ctx.restore();
    }
  }
  /* 4. merchant basins: a wide stone-edged pool where the canal meets the market */
  for (const m of geo.merchants) {
    const g = ctx.createRadialGradient(X(m.x), Y(m.y), 10, X(m.x), Y(m.y), 120);
    g.addColorStop(0, 'rgba(34,62,60,0.85)'); g.addColorStop(0.55, 'rgba(40,60,56,0.45)'); g.addColorStop(1, 'rgba(40,60,56,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 120, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.strokeStyle = 'rgba(210,196,160,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 62, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  /* 5. a whisper of mist in the bleed, so the far edges read as distance */
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 1.0);
  v.addColorStop(0, 'rgba(150,170,160,0)'); v.addColorStop(1, 'rgba(150,170,160,0.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const canal = c.toDataURL('image/png');

  /* rail era: the same land under soot — colder, darker, industrial haze */
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(70,64,60,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(120,90,60,0.35)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  for (const t of geo.towns) {
    if (t.farm) continue;
    const g = ctx.createRadialGradient(X(t.x), Y(t.y), 20, X(t.x), Y(t.y), 260);
    g.addColorStop(0, 'rgba(40,34,30,0.55)'); g.addColorStop(1, 'rgba(40,34,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), 260, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 24; k++) {
      const a = rnd() * Math.PI * 2, d = 30 + rnd() * 120;
      ctx.fillStyle = `rgba(255,${120 + Math.floor(rnd() * 60)},40,${0.35 + rnd() * 0.4})`;
      ctx.fillRect(X(t.x) + Math.cos(a) * d, Y(t.y) + Math.sin(a) * d, 3, 3);
    }
  }
  ctx.restore();
  return { canal, rail: c.toDataURL('image/png'), W, H };
}, { geo, terrain });
writeFileSync(process.argv[4], Buffer.from(out.canal.split(',')[1], 'base64'));
writeFileSync(process.argv[5], Buffer.from(out.rail.split(',')[1], 'base64'));
await browser.close();
console.log('composed', out.W, 'x', out.H, '→', process.argv[4], process.argv[5]);
