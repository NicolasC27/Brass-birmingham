/* ------------------------------------------------------------------ */
/* The inks of the pages after the table. They are printed on the     */
/* register's paper, so a seat is drawn in the register's own tempering */
/* of its colour (--player-*), not in the board's plate: the board's    */
/* brass measured 1.72 on the day's paper and left the first seat's     */
/* line all but gone. Everything else is told from the register too.   */
/* ------------------------------------------------------------------ */

const SEATS = new Set(["brass", "oxblood", "verdigris", "steel"]);

/** a seat's colour, as the register prints it */
export const seatInk = (color: string | undefined): string =>
  `rgb(var(--player-${color && SEATS.has(color) ? color : "brass"}))`;

/** the register's inks, for the charts drawn by hand in SVG */
export const INK = {
  /** the body's ink: figures and labels, at an opacity */
  text: "rgb(var(--paper-100))",
  /** the ground the marks are punched out of */
  ground: "rgb(var(--lacquer-900))",
  /** the era rule and the zero line */
  brass: "rgb(var(--brass-400))",
  /** the canal, told in green */
  canal: "rgb(var(--bottle-ink))",
  /** the rail, told in copper */
  rail: "rgb(var(--rust-400))",
} as const;
