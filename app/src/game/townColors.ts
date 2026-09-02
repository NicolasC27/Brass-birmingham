/* ------------------------------------------------------------------ */
/* Town colour code — in physical Brass each location has its own      */
/* coloured banner, which is how players match location cards to towns */
/* at a glance. These values are sampled from the physical board:      */
/* blue cluster in the north, reds across the centre, amber/orange in  */
/* the west, purples/maroons south-east, cream for farm breweries.     */
/* ------------------------------------------------------------------ */

const BY_ID: Record<string, string> = {
  leek: '#32497A', // bleu nuit
  stoke: '#32497A', // bleu roi
  stone: '#32497A', // bleu acier
  uttoxeter: '#32497A', // bleu profond
  belper: '#3F7A6B', // sarcelle
  derby: '#2F5E50', // vert bouteille
  stafford: '#9E3B30', // rouge franc
  burton: '#7C2E2A', // rouge sombre
  cannock: '#7C2E2A', // rouge brique
  tamworth: '#7C2E2A', // marron rouge
  walsall: '#7C2E2A', // rouge foncé
  wolverhampton: '#BF9540', // brun orangé
  coalbrookdale: '#BF9540', // ambre
  dudley: '#BF9540', // orange
  kidderminster: '#BF9540', // doré
  worcester: '#BF9540', // or
  birmingham: '#6E4668', // marron aubergine
  coventry: '#6E4668', // pourpre
  nuneaton: '#6E4668', // violet
  redditch: '#6E4668', // mauve
  'farm-n': '#B8A678', // crème (brasserie indépendante)
  'farm-s': '#B8A678',
};

/** muted banner colour identifying a town (physical board colour) */
export function townColor(townId: string): string {
  return BY_ID[townId] ?? '#8A6B33';
}
