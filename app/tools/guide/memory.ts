/* a browser's storage, in memory: the guide keeps its progress there, and
   node has none. Imported first, before any module reads it */
const kept = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => kept.get(k) ?? null,
  setItem: (k: string, v: string) => void kept.set(k, String(v)),
  removeItem: (k: string) => void kept.delete(k),
  clear: () => kept.clear(),
  key: (i: number) => [...kept.keys()][i] ?? null,
  get length() {
    return kept.size;
  },
};
