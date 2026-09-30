/**
 * Shared setup types, palette metadata and localStorage contract.
 * Storage key and JSON shape are fixed — the game page reads this verbatim.
 */

import { tr } from "@/i18n";
import { PERSONAS as CHARACTERS, freePersona, personaFor, personaName } from "@/game/data";
import type { BotPersona } from "@/game/types";

export type { BotPersona };

export const SETUP_STORAGE_KEY = "brassworks.setup.v1";

export type PlayerColor = "brass" | "oxblood" | "verdigris" | "steel";
export type SeatType = "human" | "bot" | "closed";
export type EraLength = "short" | "standard";
export type MarketTemper = "calm" | "standard" | "volatile";
export type Fidelity = "core" | "approx";

export interface Seat {
  type: SeatType;
  name: string;
  color: PlayerColor;
  persona: BotPersona;
}

export interface SetupOptions {
  eraLength: EraLength;
  marketTemper: MarketTemper;
  timerMinutes: number | null;
  fidelity: Fidelity;
  /** beginner assistance for everyone at the table: playable slots lit, prices itemised, tips */
  assist?: boolean;
  /** the board: absent means the Midlands */
  map?: string;
}

/** Exact persisted contract (brassworks.setup.v1). */
export interface StoredSetup {
  players: {
    name: string;
    color: PlayerColor;
    type: "human" | "bot";
    persona?: BotPersona;
    /** the one difficulty a bot used to have: read, never written */
    difficulty?: string;
    /** this seat's candle: null for none, minutes otherwise; absent = the table's */
    minutes?: number | null;
  }[];
  options: SetupOptions;
  /** the table's name, drawn from the club register on the setup page */
  name?: string;
}

/** Player colors paired with shapes (design.md §8 accessibility pairing). */
export const PLAYER_COLORS: {
  id: PlayerColor;
  label: string;
  hex: string;
  shape: "circle" | "square" | "diamond" | "triangle";
}[] = [
  { id: "brass", label: "Brass", hex: "#C9A45C", shape: "circle" },
  { id: "oxblood", label: "Oxblood", hex: "#9E3B30", shape: "square" },
  { id: "verdigris", label: "Verdigris", hex: "#3F7A55", shape: "diamond" },
  { id: "steel", label: "Steel Blue", hex: "#4E6E8E", shape: "triangle" },
];

export function colorDef(color: PlayerColor) {
  return PLAYER_COLORS.find((c) => c.id === color) ?? PLAYER_COLORS[0];
}

/** The four characters a machine can be; their trades and tendencies live in the i18n dict. */
export const PERSONAS: { id: BotPersona; name: string; color: PlayerColor; initials: string }[] = CHARACTERS.map((p) => ({ ...p, color: p.color as PlayerColor }));

export { personaName };

/** is this the name a character sits down under? (then it follows the character) */
export const isPersonaName = (name: string): boolean => CHARACTERS.some((p) => p.name === name.trim());

export const DEFAULT_OPTIONS: SetupOptions = {
  eraLength: "standard",
  marketTemper: "standard",
  timerMinutes: null,
  fidelity: "core",
  assist: false,
};

const DEFAULT_SEAT_COLORS: PlayerColor[] = ["brass", "oxblood", "verdigris", "steel"];

/** a machine for a chair: the character its colour suggests when free, else the next one */
function seatBot(seat: Seat, seats: Seat[]): Seat {
  const taken = seats.filter((s) => s !== seat && s.type === "bot").map((s) => s.persona);
  const suggested = personaFor({ color: seat.color });
  const persona = taken.includes(suggested) ? freePersona(taken) : suggested;
  return { ...seat, type: "bot", persona, name: personaName(persona) };
}

/** Build the four seat slots for a mode preset (setup.md §Panel 1). */
export function defaultSeats(mode: "solo" | "hotseat"): Seat[] {
  const seats: Seat[] = [
    { type: "human", name: tr("setup.defaults.playerOne"), color: "brass", persona: "boulton" },
    { type: "closed", name: "", color: "oxblood", persona: "wedgwood" },
    { type: "closed", name: "", color: "verdigris", persona: "arkwright" },
    { type: "closed", name: "", color: "steel", persona: "watt" },
  ];
  if (mode === "hotseat") {
    seats[1] = { ...seats[1], type: "human", name: tr("setup.defaults.playerTwo") };
  } else {
    seats[1] = seatBot(seats[1], seats);
    seats[2] = seatBot(seats[2], seats);
  }
  return seats;
}

export function openSeat(seat: Seat, type: "human" | "bot", seats: Seat[]): Seat {
  if (type === "human") {
    return { ...seat, type, name: seat.name || tr("setup.defaults.player") };
  }
  return seatBot(seat, seats);
}

/** a bot takes on a character: its name follows unless the player named it */
export function recastSeat(seat: Seat, persona: BotPersona): Seat {
  const named = seat.name.trim() && !isPersonaName(seat.name);
  return { ...seat, persona, name: named ? seat.name : personaName(persona) };
}

/** Read a previously stored setup; returns null when absent or malformed. */
export function loadStoredSetup(): StoredSetup | null {
  try {
    const raw = localStorage.getItem(SETUP_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredSetup>;
    if (!Array.isArray(data.players) || data.players.length < 2) return null;
    const valid = data.players.every(
      (p) =>
        p &&
        typeof p.name === "string" &&
        typeof p.color === "string" &&
        (p.type === "human" || p.type === "bot"),
    );
    if (!valid) return null;
    return {
      /* a setup from before the characters names none: the colour picks one */
      players: (data.players as StoredSetup["players"]).map((p) => (p.type === "bot" ? { ...p, persona: personaFor(p) } : p)),
      options: { ...DEFAULT_OPTIONS, ...(data.options ?? {}) },
      ...(typeof data.name === "string" && data.name ? { name: data.name } : {}),
    };
  } catch {
    return null;
  }
}

/** Rehydrate seats from a stored setup (used for prefill and Revanche). */
export function seatsFromStored(stored: StoredSetup): Seat[] {
  const seats: Seat[] = stored.players.slice(0, 4).map((p) => ({
    type: p.type,
    name: p.name,
    color: (PLAYER_COLORS.some((c) => c.id === p.color) ? p.color : "brass") as PlayerColor,
    persona: personaFor(p),
  }));
  const used = new Set(seats.map((s) => s.color));
  while (seats.length < 4) {
    const free = DEFAULT_SEAT_COLORS.find((c) => !used.has(c)) ?? "steel";
    used.add(free);
    seats.push({ type: "closed", name: "", color: free, persona: personaFor({ color: free }) });
  }
  // Guarantee seat 1 is human (design contract).
  if (seats[0].type !== "human") {
    const humanIdx = seats.findIndex((s) => s.type === "human");
    if (humanIdx > 0) {
      const [h] = seats.splice(humanIdx, 1);
      seats.unshift(h);
    } else {
      seats[0] = { ...seats[0], type: "human", name: seats[0].name || tr("setup.defaults.playerOne") };
    }
  }
  return seats;
}

const ROMAN = ["", "II", "III", "IV"];

/** Duplicate names are suffixed automatically ("Boulton II"). */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const base = n.trim() || tr("setup.defaults.nameless");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} ${ROMAN[count] ?? count + 1}`;
  });
}
