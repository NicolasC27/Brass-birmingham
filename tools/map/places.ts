import { MERCHANTS, TOWNS, setBoard } from '@/game/data';
import { townChrome } from '@/components/game/townChrome';
import { rowLift } from '@/gl/merchantRow';
import { writeFileSync } from 'node:fs';
/* where the board shows each town and merchant (the towns nudged clear of
   one another, the southern merchants lifted), for a ground that lays
   something under them: bundle and run as geo.ts, board id as the second
   argument */
setBoard(process.argv[3]);
const out = {
  towns: TOWNS.map((t) => {
    const c = townChrome(t);
    return { id: t.id, farm: !!t.farm, slots: t.slots.length, x: c.ax, y: c.ay };
  }),
  merchants: MERCHANTS.map((m) => ({ id: m.id, x: m.x, y: m.y - rowLift(m) })),
};
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(process.argv[3] ?? 'midlands', '— towns', out.towns.length, 'merchants', out.merchants.length);
