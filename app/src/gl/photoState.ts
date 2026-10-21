import { useSyncExternalStore } from 'react';
import { isPhotoLook } from './photoPrint';
import type { PhotoLook } from './photoPrint';

/* ------------------------------------------------------------------ */
/* The photo mode's store: whether the table is being photographed,    */
/* in what look, and with the names and figures or without. The       */
/* toolbar writes it; the board (photo.ts, in the WebGL chunk) dresses */
/* itself from it. The look and the labels are remembered on this      */
/* device; the mode itself never outlives the page.                    */
/* ------------------------------------------------------------------ */

export interface PhotoState {
  on: boolean;
  look: PhotoLook;
  /** the towns' names and the figures on the cards */
  labels: boolean;
}

const KEY = 'brassworks.photo.v1';

let state: PhotoState = (() => {
  const base: PhotoState = { on: false, look: 'sepia', labels: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const kept = JSON.parse(raw) as Partial<Record<keyof PhotoState, unknown>>;
      return { ...base, look: isPhotoLook(kept.look) ? kept.look : base.look, labels: kept.labels !== false };
    }
  } catch {
    /* private mode / malformed */
  }
  return base;
})();

const listeners = new Set<() => void>();

export const getPhoto = (): PhotoState => state;

export function subscribePhoto(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setPhoto(patch: Partial<PhotoState>): void {
  const next = { ...state, ...patch };
  if (next.on === state.on && next.look === state.look && next.labels === state.labels) return;
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify({ look: state.look, labels: state.labels }));
  } catch {
    /* non-fatal */
  }
  for (const fn of [...listeners]) fn();
}

export function usePhoto(): PhotoState {
  return useSyncExternalStore(subscribePhoto, getPhoto, getPhoto);
}
