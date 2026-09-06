import { LINKS, MERCHANTS, TOWNS } from '@/game/data';
import { routeFor } from '@/components/game/routePaths';
import { writeFileSync } from 'node:fs';
const out = {
  links: LINKS.map((d) => ({ id: d.id, canal: d.canal, rail: d.rail, pts: routeFor(d).pts })),
  towns: TOWNS.map((t) => ({ id: t.id, x: t.x, y: t.y, farm: !!t.farm, slots: t.slots.map((s) => [s.x, s.y]) })),
  merchants: MERCHANTS.map((m) => ({ id: m.id, x: m.x, y: m.y })),
};
writeFileSync(process.argv[2], JSON.stringify(out));
console.log('links', out.links.length, 'towns', out.towns.length, 'sample pts', out.links[0].pts.length);
