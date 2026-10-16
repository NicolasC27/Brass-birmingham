import { COUNTER, FREE_ITEMS, type CounterKind } from '@/online/counter';

/* ------------------------------------------------------------------ */
/* Le Comptoir — catalogue cosmétique, dérivé de la liste partagée     */
/* avec le bureau (online/counter.ts) : mêmes ids, mêmes prix des deux */
/* côtés du fil. Aucun effet de jeu : signes de prestige uniquement.   */
/* Les noms affichés vivent dans i18n (platform.comptoir.items.{id}).  */
/* ------------------------------------------------------------------ */

export type Category = CounterKind;
export type Rarity = 'common' | 'rare' | 'prestige';

export interface ShopItem {
  id: string;
  category: Category;
  price: number;
  rarity: Rarity;
}

export const CATEGORIES: Category[] = ['avatar', 'frame', 'title', 'sign', 'portrait', 'tiles'];

/* ------------------------------------------------------------------ */
/* Le comptoir est en veille : rien ne se vend encore. Les deux        */
/* rayons dont les images sont prêtes restent en vitrine — on les      */
/* regarde, on ne les achète pas. Ouvrir la boutique, c'est passer     */
/* COUNTER_OPEN à true.                                                */
/* ------------------------------------------------------------------ */

export const COUNTER_OPEN: boolean = false;

/** les rayons montrés tant que le comptoir est en veille */
export const PREVIEW_CATEGORIES: Category[] = ['portrait', 'tiles'];

/** les rayons visibles, boutique ouverte ou non */
export const SHOWN_CATEGORIES: Category[] = COUNTER_OPEN ? CATEGORIES : PREVIEW_CATEGORIES;

/* les raretés annoncées à l'ouverture du comptoir, gardées telles quelles */
const RARITY_OVERRIDE: Record<string, Rarity> = {
  'frame-gear': 'rare',
  'title-railmagnate': 'prestige',
};

function rarityFor(id: string, price: number): Rarity {
  const fixed = RARITY_OVERRIDE[id];
  if (fixed) return fixed;
  if (price >= 150) return 'prestige';
  if (price >= 60) return 'rare';
  return 'common';
}

export const CATALOG: ShopItem[] = COUNTER.map((i) => ({ id: i.id, category: i.kind, price: i.price, rarity: rarityFor(i.id, i.price) }));

export const ITEM_BY_ID: ReadonlyMap<string, ShopItem> = new Map(CATALOG.map((i) => [i.id, i]));

/** ce que tout le monde possède sans payer — la même liste que le bureau */
export const DEFAULT_OWNED: string[] = FREE_ITEMS;

export const DEFAULT_EQUIPPED: Record<Category, string> = {
  avatar: 'avatar-iron',
  frame: 'frame-none',
  title: 'title-none',
  sign: 'sign-shrewsbury',
  portrait: 'portrait-1',
  tiles: 'tiles-engraved',
};

/** L'objet existe, et appartient bien à la catégorie annoncée. */
export function isItem(id: string, category?: Category): boolean {
  const item = ITEM_BY_ID.get(id);
  return item !== undefined && (category === undefined || item.category === category);
}
