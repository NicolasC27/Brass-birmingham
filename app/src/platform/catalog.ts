import { COUNTER, FREE_ITEMS, type CounterKind } from '@/online/counter';

/* ------------------------------------------------------------------ */
/* Le Comptoir — catalogue cosmétique, dérivé de la liste partagée     */
/* avec le bureau (online/counter.ts) : mêmes ids, mêmes prix des deux */
/* côtés du fil. Aucun effet de jeu : les habits de la table seulement. */
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

export const CATEGORIES: Category[] = ['ground', 'tiles', 'cards'];

/* ------------------------------------------------------------------ */
/* Le comptoir est en veille : rien ne se vend encore. Les deux        */
/* rayons dont les images sont prêtes restent en vitrine — on les      */
/* regarde, on ne les achète pas. Ouvrir la boutique, c'est passer     */
/* COUNTER_OPEN à true.                                                */
/* ------------------------------------------------------------------ */

export const COUNTER_OPEN: boolean = true;

/** les rayons montrés tant que le comptoir est en veille */
export const PREVIEW_CATEGORIES: Category[] = ['ground', 'tiles', 'cards'];

/** les rayons visibles, boutique ouverte ou non */
export const SHOWN_CATEGORIES: Category[] = COUNTER_OPEN ? CATEGORIES : PREVIEW_CATEGORIES;

function rarityFor(price: number): Rarity {
  if (price >= 150) return 'prestige';
  if (price >= 60) return 'rare';
  return 'common';
}

export const CATALOG: ShopItem[] = COUNTER.map((i) => ({ id: i.id, category: i.kind, price: i.price, rarity: rarityFor(i.price) }));

export const ITEM_BY_ID: ReadonlyMap<string, ShopItem> = new Map(CATALOG.map((i) => [i.id, i]));

/** ce que tout le monde possède sans payer — la même liste que le bureau */
export const DEFAULT_OWNED: string[] = FREE_ITEMS;

export const DEFAULT_EQUIPPED: Record<Category, string> = {
  tiles: 'tiles-engraved',
  ground: 'ground-midlands',
  cards: 'cards-plain',
};

/** L'objet existe, et appartient bien à la catégorie annoncée. */
export function isItem(id: string, category?: Category): boolean {
  const item = ITEM_BY_ID.get(id);
  return item !== undefined && (category === undefined || item.category === category);
}
