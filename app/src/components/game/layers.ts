/* ------------------------------------------------------------------ */
/* The table's layers: every panel that opens over the board — the     */
/* ledger, the exchange, the mat, the settings, the notebook, a card,   */
/* a sheet to sign — takes a ticket here, and the tickets are kept as a */
/* stack, like the forms on a stationmaster's spike.                    */
/*                                                                      */
/* Three rules, and no panel keeps its own:                             */
/*  - Escape asks the last ticket's panel to close, and that one only;  */
/*    the board's own Escape (dropping the move in hand) waits for an   */
/*    empty spike. A panel that will not be dismissed (a sheet that     */
/*    must be answered) simply keeps its ticket.                        */
/*  - A panel that lives along an edge reserves that edge: opening a    */
/*    second one there sends the first away rather than laying one      */
/*    over the other. Sheets in the middle simply stack.                */
/*  - A sheet that holds the table (`modal`) keeps the keyboard inside  */
/*    it while it is on top.                                            */
/*                                                                      */
/* This module is plain bookkeeping, with no DOM and no React, so the   */
/* rules can be read and tested on their own; `useLayer` wires it to    */
/* the page.                                                            */
/* ------------------------------------------------------------------ */

/** where a panel lives: an edge it reserves, or the middle of the table */
export type LayerZone = 'left' | 'right' | 'centre';

export interface LayerTicket {
  readonly id: number;
  readonly zone: LayerZone;
  /** holds the table: the keyboard stays inside while it is on top */
  readonly modal: boolean;
  /** asks the panel to close — the panel then takes its ticket back */
  close: () => void;
}

const spike: LayerTicket[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
let version = 0;

function changed(): void {
  version++;
  for (const fn of [...listeners]) fn();
}

/** a panel opens: its ticket goes on top. On an edge, whatever held that
 *  edge is asked to close — two panels never share a place for longer
 *  than it takes the first one to go. */
export function openLayer(zone: LayerZone, close: () => void, modal = false): number {
  const id = nextId++;
  if (zone !== 'centre') {
    for (const held of spike.filter((x) => x.zone === zone)) held.close();
  }
  spike.push({ id, zone, modal, close });
  changed();
  return id;
}

/** a panel has closed, by whatever way: its ticket comes off the spike */
export function removeLayer(id: number): void {
  const at = spike.findIndex((x) => x.id === id);
  if (at < 0) return;
  spike.splice(at, 1);
  changed();
}

/** the panel's close, kept current without moving its ticket */
export function retarget(id: number, close: () => void): void {
  const held = spike.find((x) => x.id === id);
  if (held) held.close = close;
}

export function topLayer(): LayerTicket | undefined {
  return spike[spike.length - 1];
}

export function isTop(id: number): boolean {
  return topLayer()?.id === id;
}

export function layerCount(): number {
  return spike.length;
}

/** what holds an edge right now */
export function zoneHeld(zone: LayerZone): boolean {
  return spike.some((x) => x.zone === zone);
}

/** Escape: the last ticket's panel is asked to close, and nothing else;
 *  its ticket comes off when the panel has gone. Says whether there was
 *  one — when there was not, the key belongs to the board. */
export function escapeTop(): boolean {
  const top = topLayer();
  if (!top) return false;
  top.close();
  return true;
}

export function subscribeLayers(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** a number that moves whenever the spike does (for useSyncExternalStore) */
export function layersVersion(): number {
  return version;
}

/** the spike emptied — only for tests */
export function clearLayers(): void {
  spike.length = 0;
  changed();
}
