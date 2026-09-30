import { LINKS, MERCHANTS, TOWNS, setBoard } from '@/game/data';
import { routeFor } from '@/components/game/routePaths';
import { writeFileSync } from 'node:fs';
/* the board to dump: its id as the second argument, the Midlands by default */
setBoard(process.argv[3]);
const out = {
  links: LINKS.map((d) => ({ id: d.id, canal: d.canal, rail: d.rail, pts: routeFor(d).pts, railPts: d.rail ? routeFor(d, 'rail').pts : undefined })),
  towns: TOWNS.map((t) => ({ id: t.id, x: t.x, y: t.y, farm: !!t.farm, slots: t.slots.map((s) => [s.x, s.y]) })),
  merchants: MERCHANTS.map((m) => ({ id: m.id, x: m.x, y: m.y })),
};
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(process.argv[3] ?? 'midlands', '— links', out.links.length, 'towns', out.towns.length, 'merchants', out.merchants.length);
