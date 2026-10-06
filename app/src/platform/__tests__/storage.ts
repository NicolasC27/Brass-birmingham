import { clearPapers } from '../papers';

/* a register for the tests: the browser's localStorage kept in a map, and
   the shelf of papers emptied — a browser that has played nothing */
export function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  clearPapers();
  return store;
}
