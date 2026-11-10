/* ------------------------------------------------------------------ */
/* The four heads of the house (the founder, the spinner, the          */
/* forgemaster, the shipowner): the only likenesses a member can wear  */
/* at the tables. The office keeps the number; every seat, rail and    */
/* plate draws the head from the app's own files.                      */
/* ------------------------------------------------------------------ */

export const HEADS = [1, 2, 3, 4] as const;
export type Head = (typeof HEADS)[number];

/** the picture of a head */
export const headUrl = (n: number): string => `/portrait-${n}.webp`;

/** the likeness a member shows, from the head they wear: none without one */
export const likenessUrl = (head: number | null | undefined): string | null => (typeof head === 'number' && head >= 1 && head <= 4 ? headUrl(head) : null);
