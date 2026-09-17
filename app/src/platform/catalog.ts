/* ------------------------------------------------------------------ */
/* Le Comptoir — catalogue cosmétique (comptoir.md §Catalogue).        */
/* Aucun effet de jeu : signes de prestige uniquement. Les noms        */
/* affichés vivent dans i18n (platform.comptoir.items.{id}).           */
/* ------------------------------------------------------------------ */

export type Category = 'avatar' | 'frame' | 'title';
export type Rarity = 'common' | 'rare' | 'prestige';

export interface ShopItem {
  id: string;
  category: Category;
  price: number;
  rarity: Rarity;
}

export const CATALOG: ShopItem[] = [
  /* Avatars gravés — variantes du meeple avatar-default.svg */
  { id: 'avatar-iron', category: 'avatar', price: 0, rarity: 'common' },
  { id: 'avatar-brass', category: 'avatar', price: 40, rarity: 'common' },
  { id: 'avatar-copper', category: 'avatar', price: 40, rarity: 'common' },
  { id: 'avatar-enamel', category: 'avatar', price: 90, rarity: 'rare' },
  { id: 'avatar-gold', category: 'avatar', price: 160, rarity: 'prestige' },
  /* Cadres de carte de membre — anneaux SVG en code */
  { id: 'frame-none', category: 'frame', price: 0, rarity: 'common' },
  { id: 'frame-fillet', category: 'frame', price: 50, rarity: 'common' },
  { id: 'frame-rivets', category: 'frame', price: 90, rarity: 'rare' },
  { id: 'frame-gear', category: 'frame', price: 150, rarity: 'rare' },
  { id: 'frame-laurel', category: 'frame', price: 220, rarity: 'prestige' },
  /* Titres honorifiques — micro-label sous le pseudo */
  { id: 'title-none', category: 'title', price: 0, rarity: 'common' },
  { id: 'title-founder', category: 'title', price: 30, rarity: 'common' },
  { id: 'title-accountant', category: 'title', price: 60, rarity: 'rare' },
  { id: 'title-forgemaster', category: 'title', price: 90, rarity: 'rare' },
  { id: 'title-canalbaron', category: 'title', price: 90, rarity: 'rare' },
  { id: 'title-railmagnate', category: 'title', price: 130, rarity: 'prestige' },
  { id: 'title-legend', category: 'title', price: 260, rarity: 'prestige' },
];

export const ITEM_BY_ID: ReadonlyMap<string, ShopItem> = new Map(CATALOG.map((i) => [i.id, i]));

export const DEFAULT_OWNED: string[] = ['avatar-iron', 'frame-none', 'title-none'];

export const DEFAULT_EQUIPPED: Record<Category, string> = {
  avatar: 'avatar-iron',
  frame: 'frame-none',
  title: 'title-none',
};

/** L'objet existe, et appartient bien à la catégorie annoncée. */
export function isItem(id: string, category?: Category): boolean {
  const item = ITEM_BY_ID.get(id);
  return item !== undefined && (category === undefined || item.category === category);
}
