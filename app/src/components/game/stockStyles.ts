import type { StockStyle } from '@/gl/faces';

/* stock-badge layouts, in cycle order — labels resolved via
 * i18n keys board.stockStyle.<id> (see en/board.ts / fr/board.ts) */
export const STOCK_STYLE_IDS: StockStyle[] = ['corner', 'big', 'counter', 'tag', 'top'];
