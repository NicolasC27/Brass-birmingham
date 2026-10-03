/* The board's paper is the heaviest; fetched as soon as a hand moves
   toward a way onto it, so the table opens without a wait. */
let asked = false;
export function preloadGame(): void {
  if (asked) return;
  asked = true;
  void import('@/pages/Game').catch(() => {
    asked = false;
  });
}
