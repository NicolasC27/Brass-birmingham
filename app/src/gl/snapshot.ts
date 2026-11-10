/* ------------------------------------------------------------------ */
/* A photograph of the board for a bug report: the table on screen     */
/* offers its own shooter while it is up (PixiBoard), and the report    */
/* asks for one when it leaves. Nothing is taken until then.            */
/* ------------------------------------------------------------------ */

type Shooter = () => Promise<string | null>;
let shooter: Shooter | null = null;

/** the board on screen offers to photograph itself; the return takes the offer back */
export function offerBoardShot(fn: Shooter): () => void {
  shooter = fn;
  return () => {
    if (shooter === fn) shooter = null;
  };
}

/** a board on screen right now, as a small JPEG data URL — or nothing */
export async function boardShot(): Promise<string | null> {
  if (!shooter) return null;
  try {
    return await shooter();
  } catch {
    return null;
  }
}
