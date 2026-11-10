import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/* The four heads of the house (the founder, the spinner, the          */
/* forgemaster, the shipowner), one of which a member may wear at the  */
/* tables in place of a picture of their own. A head is a picture like */
/* any other to the office: picked, it is cut to the same 160 px of    */
/* WebP and kept as the member's likeness, so every seat, rail and     */
/* plate that shows a likeness shows it without knowing it is a head.  */
/* ------------------------------------------------------------------ */

export const HEADS = [1, 2, 3, 4] as const;
export type Head = (typeof HEADS)[number];

/** the picture served for a head */
export const headUrl = (n: Head): string => `/portrait-${n}.webp`;

const SIDE = 160;
const baked = new Map<Head, Promise<string>>();

/** the head as the office keeps a likeness: the same square, the same
 *  encoding as a picture of one's own (Profile.tsx), baked once a session */
export function bakeHead(n: Head): Promise<string> {
  let p = baked.get(n);
  if (!p) {
    p = new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = SIDE;
        c.height = SIDE;
        const g = c.getContext('2d');
        if (!g) return reject(new Error('canvas'));
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIDE, SIDE);
        const webp = c.toDataURL('image/webp', 0.82);
        resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('head'));
      img.src = headUrl(n);
    });
    baked.set(n, p);
  }
  return p;
}

/** the four heads baked, by head — so the one worn can be told from a
 *  likeness that happens to be one of them */
export function useBakedHeads(): Partial<Record<Head, string>> {
  const [heads, setHeads] = useState<Partial<Record<Head, string>>>({});
  useEffect(() => {
    let live = true;
    void Promise.all(HEADS.map((n) => bakeHead(n).then((d) => [n, d] as const).catch(() => null))).then((all) => {
      if (live) setHeads(Object.fromEntries(all.filter((x): x is readonly [Head, string] => x !== null)));
    });
    return () => {
      live = false;
    };
  }, []);
  return heads;
}
