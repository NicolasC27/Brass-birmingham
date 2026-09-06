/* Control variants. Usage: node bg-control2.mjs <geo.json> <out.png> <mode> [base.png]
 *  edges   : thin white lines on black (canny-style), tiny village dots, 15 % bleed
 *  overlay : the base painting (fitted with bleed) with canals drawn in teal on top */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const geo = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const mode = process.argv[4];
const LINES_ONLY = mode === 'lines';
const base = process.argv[5] ? `data:image/png;base64,${readFileSync(process.argv[5]).toString('base64')}` : null;
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async ({ geo, mode, base, linesOnly }) => {
  const BLEED = 0.15, worldW = 3200, worldH = 1800;
  const fullW = worldW * (1 + 2 * BLEED), fullH = worldH * (1 + 2 * BLEED);
  const W = 1536, H = Math.round((1536 * fullH) / fullW), k = W / fullW;
  const X = (x) => (x + worldW * BLEED) * k, Y = (y) => (y + worldH * BLEED) * k;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (mode === 'overlay') {
    const img = new Image(); img.src = base; await img.decode();
    ctx.fillStyle = '#243a2a'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, X(0), Y(0), worldW * k, worldH * k);
    /* soft copy of the painting into the bleed so the edges are not flat */
    ctx.globalAlpha = 0.6; ctx.filter = 'blur(6px)';
    ctx.drawImage(img, 0, 0, W, H);
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    ctx.drawImage(img, X(0), Y(0), worldW * k, worldH * k);
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const l of geo.links) {
    ctx.beginPath(); ctx.moveTo(X(l.pts[0][0]), Y(l.pts[0][1]));
    for (const p of l.pts.slice(1)) ctx.lineTo(X(p[0]), Y(p[1]));
    if (mode === 'overlay') {
      if (!l.canal) continue;
      ctx.setLineDash([]); ctx.lineWidth = 7; ctx.strokeStyle = '#2E7A78'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#8FD0C8'; ctx.stroke();
    } else {
      if (linesOnly && !l.canal) continue;
      ctx.strokeStyle = '#fff';
      if (l.canal) { ctx.setLineDash([]); ctx.lineWidth = linesOnly ? 3 : 2.2; } else { ctx.setLineDash([6, 8]); ctx.lineWidth = 1.2; }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  if (linesOnly) return c.toDataURL('image/png');
  for (const t of geo.towns) {
    ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), t.farm ? 4 : 7, 0, Math.PI * 2);
    if (mode === 'overlay') { ctx.fillStyle = 'rgba(200,60,40,0.9)'; ctx.fill(); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  for (const m of geo.merchants) {
    ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 10, 0, Math.PI * 2);
    if (mode === 'overlay') { ctx.fillStyle = 'rgba(46,122,120,0.95)'; ctx.fill(); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  return c.toDataURL('image/png');
}, { geo, mode: LINES_ONLY ? 'edges' : mode, base, linesOnly: LINES_ONLY });
writeFileSync(process.argv[3], Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('control', mode, '→', process.argv[3]);
