/**
 * Shared setup types, palette metadata and localStorage contract.
 * Storage key and JSON shape are fixed — the game page reads this verbatim.
 */

import { tr } from "@/i18n";

export const SETUP_STORAGE_KEY = "brassworks.setup.v1";

export type PlayerColor = "brass" | "oxblood" | "verdigris" | "steel";
export type SeatType = "human" | "bot" | "closed";
export type BotDifficulty = "foreman" | "industrialist" | "magnate";
export type EraLength = "short" | "standard";
export type MarketTemper = "calm" | "standard" | "volatile";
export type Fidelity = "core" | "approx";

export interface Seat {
  type: SeatType;
  name: string;
  color: PlayerColor;
  difficulty: BotDifficulty;
}

export interface SetupOptions {
  eraLength: EraLength;
  marketTemper: MarketTemper;
  timerMinutes: number | null;
  fidelity: Fidelity;
  /** beginner assistance for everyone at the table: playable slots lit, prices itemised, tips */
  assist?: boolean;
}

/** Exact persisted contract (brassworks.setup.v1). */
export interface StoredSetup {
  players: {
    name: string;
    color: PlayerColor;
    type: "human" | "bot";
    difficulty?: BotDifficulty;
  }[];
  options: SetupOptions;
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

/** Three tempers of clockwork; labels and tendency notes live in the i18n dict. */
export const DIFFICULTIES: {
  id: BotDifficulty;
  rim: "copper" | "brass" | "glow";
}[] = [
  { id: "foreman", rim: "copper" },
  { id: "industrialist", rim: "brass" },
  { id: "magnate", rim: "glow" },
];

export function difficultyLabel(id: BotDifficulty) {
  return tr(`setup.difficulty.${id}.label`);
}

/** Evocative Victorian names drawn for clockwork rivals. */
export const BOT_NAME_POOL = ["Ada", "Telford", "Boulton", "Watt", "Cossons"];

export const DEFAULT_OPTIONS: SetupOptions = {
  eraLength: "standard",
  marketTemper: "standard",
  timerMinutes: null,
  fidelity: "core",
  assist: false,
};

const DEFAULT_SEAT_COLORS: PlayerColor[] = ["brass", "oxblood", "verdigris", "steel"];

function pickBotName(taken: string[]): string {
  const free = BOT_NAME_POOL.find((n) => !taken.includes(n));
  return free ?? tr("setup.defaults.engine", { n: taken.length + 1 });
}

/** Build the four seat slots for a mode preset (setup.md §Panel 1). */
export function defaultSeats(mode: "solo" | "hotseat"): Seat[] {
  const seats: Seat[] = [
    { type: "human", name: tr("setup.defaults.playerOne"), color: "brass", difficulty: "industrialist" },
    { type: "closed", name: "", color: "oxblood", difficulty: "industrialist" },
    { type: "closed", name: "", color: "verdigris", difficulty: "industrialist" },
    { type: "closed", name: "", color: "steel", difficulty: "industrialist" },
  ];
  if (mode === "hotseat") {
    seats[1] = { ...seats[1], type: "human", name: tr("setup.defaults.playerTwo") };
  } else {
    seats[1] = { ...seats[1], type: "bot", name: pickBotName([]) };
    seats[2] = { ...seats[2], type: "bot", name: pickBotName([seats[1].name]) };
  }
  return seats;
}

export function openSeat(seat: Seat, type: "human" | "bot", takenNames: string[]): Seat {
  if (type === "human") {
    return { ...seat, type, name: seat.name || tr("setup.defaults.player") };
  }
  return {
    ...seat,
    type,
    name: BOT_NAME_POOL.includes(seat.name) ? seat.name : pickBotName(takenNames),
  };
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
      players: data.players as StoredSetup["players"],
      options: { ...DEFAULT_OPTIONS, ...(data.options ?? {}) },
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
    difficulty: p.difficulty ?? "industrialist",
  }));
  const used = new Set(seats.map((s) => s.color));
  while (seats.length < 4) {
    const free = DEFAULT_SEAT_COLORS.find((c) => !used.has(c)) ?? "steel";
    used.add(free);
    seats.push({ type: "closed", name: "", color: free, difficulty: "industrialist" });
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
