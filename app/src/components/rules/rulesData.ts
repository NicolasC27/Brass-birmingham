/**
 * rulesData.ts — single source of truth for the Rules Codex content.
 *
 * PROTOTYPE TUNING NOTICE: industry level values below are original,
 * Brass: Birmingham–style approximations authored for this fan-made
 * preview. They are internally consistent (cost/income/VP scale with
 * level) but are NOT reproductions of the printed tile statistics.
 * The game board reads from this same file so codex and play agree.
 *
 * User-visible strings live in src/i18n (rules.*); the getters below read
 * tr() at call time so text resolves in the current language on every render.
 */

import { tr } from "@/i18n";
import { INDUSTRIES } from "@/game/data";
import type { IndustryType } from "@/game/types";

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
}

export const getChapters = (): Chapter[] => [
  { id: "quickstart", numeral: "I.", title: tr("rules.chapters.quickstart") },
  { id: "eras", numeral: "II.", title: tr("rules.chapters.eras") },
  { id: "actions", numeral: "III.", title: tr("rules.chapters.actions") },
  { id: "industries", numeral: "IV.", title: tr("rules.chapters.industries") },
  { id: "network", numeral: "V.", title: tr("rules.chapters.network") },
  { id: "supply", numeral: "VI.", title: tr("rules.chapters.supply") },
  { id: "market", numeral: "VII.", title: tr("rules.chapters.market") },
  { id: "selling", numeral: "VIII.", title: tr("rules.chapters.selling") },
  { id: "money", numeral: "IX.", title: tr("rules.chapters.money") },
  { id: "scoring", numeral: "X.", title: tr("rules.chapters.scoring") },
  { id: "glossary", numeral: "XI.", title: tr("rules.chapters.glossary") },
  { id: "approximations", numeral: "XII.", title: tr("rules.chapters.approximations") },
];

/* ------------------------------------------------------------------ */
/* §I — Quickstart                                                     */
/* ------------------------------------------------------------------ */

export interface QuickStep {
  icon: string; // "/icon-*.svg" asset path or "lucide:Name"
  title: string;
  body: string;
}

export const getQuickSteps = (): QuickStep[] => [
  {
    icon: "lucide:Trophy",
    title: tr("rules.quick.goal.title"),
    body: tr("rules.quick.goal.body"),
  },
  {
    icon: "lucide:Layers",
    title: tr("rules.quick.turn.title"),
    body: tr("rules.quick.turn.body"),
  },
  {
    icon: "lucide:Factory",
    title: tr("rules.quick.build.title"),
    body: tr("rules.quick.build.body"),
  },
  {
    icon: "/icon-canal.svg",
    title: tr("rules.quick.connect.title"),
    body: tr("rules.quick.connect.body"),
  },
  {
    icon: "/icon-merchant.svg",
    title: tr("rules.quick.sell.title"),
    body: tr("rules.quick.sell.body"),
  },
  {
    icon: "/icon-coal.svg",
    title: tr("rules.quick.supply.title"),
    body: tr("rules.quick.supply.body"),
  },
];

/* ------------------------------------------------------------------ */
/* §III — The six actions                                              */
/* ------------------------------------------------------------------ */

export interface ActionDef {
  id: string;
  name: string;
  icon: string;
  cost: string; // chip summary, e.g. "£ tile cost + resources"
  steps: string[];
  edges: string[];
  diagram: "build" | "network" | "develop" | "sell" | "loan" | "scout";
}

export const getActions = (): ActionDef[] => [
  {
    id: "build",
    name: tr("rules.actions.build.name"),
    icon: "lucide:Factory",
    cost: tr("rules.actions.build.cost"),
    steps: [
      tr("rules.actions.build.steps.s1"),
      tr("rules.actions.build.steps.s2"),
      tr("rules.actions.build.steps.s3"),
    ],
    edges: [
      tr("rules.actions.build.edges.e1"),
      tr("rules.actions.build.edges.e2"),
      tr("rules.actions.build.edges.e3"),
    ],
    diagram: "build",
  },
  {
    id: "network",
    name: tr("rules.actions.network.name"),
    icon: "/icon-canal.svg",
    cost: tr("rules.actions.network.cost"),
    steps: [
      tr("rules.actions.network.steps.s1"),
      tr("rules.actions.network.steps.s2"),
      tr("rules.actions.network.steps.s3"),
    ],
    edges: [
      tr("rules.actions.network.edges.e1"),
      tr("rules.actions.network.edges.e2"),
      tr("rules.actions.network.edges.e3"),
    ],
    diagram: "network",
  },
  {
    id: "develop",
    name: tr("rules.actions.develop.name"),
    icon: "/icon-develop.svg",
    cost: tr("rules.actions.develop.cost"),
    steps: [
      tr("rules.actions.develop.steps.s1"),
      tr("rules.actions.develop.steps.s2"),
      tr("rules.actions.develop.steps.s3"),
    ],
    edges: [
      tr("rules.actions.develop.edges.e1"),
      tr("rules.actions.develop.edges.e2"),
    ],
    diagram: "develop",
  },
  {
    id: "sell",
    name: tr("rules.actions.sell.name"),
    icon: "/icon-merchant.svg",
    cost: tr("rules.actions.sell.cost"),
    steps: [
      tr("rules.actions.sell.steps.s1"),
      tr("rules.actions.sell.steps.s2"),
      tr("rules.actions.sell.steps.s3"),
    ],
    edges: [
      tr("rules.actions.sell.edges.e1"),
      tr("rules.actions.sell.edges.e2"),
      tr("rules.actions.sell.edges.e3"),
    ],
    diagram: "sell",
  },
  {
    id: "loan",
    name: tr("rules.actions.loan.name"),
    icon: "/icon-loan.svg",
    cost: tr("rules.actions.loan.cost"),
    steps: [tr("rules.actions.loan.steps.s1")],
    edges: [
      tr("rules.actions.loan.edges.e1"),
      tr("rules.actions.loan.edges.e2"),
      tr("rules.actions.loan.edges.e3"),
    ],
    diagram: "loan",
  },
  {
    id: "scout",
    name: tr("rules.actions.scout.name"),
    icon: "lucide:Search",
    cost: tr("rules.actions.scout.cost"),
    steps: [
      tr("rules.actions.scout.steps.s1"),
      tr("rules.actions.scout.steps.s2"),
    ],
    edges: [
      tr("rules.actions.scout.edges.e1"),
      tr("rules.actions.scout.edges.e2"),
    ],
    diagram: "scout",
  },
];

/* ------------------------------------------------------------------ */
/* §IV — Industries (prototype tuning — see notice at top of file)     */
/* ------------------------------------------------------------------ */

export interface IndustryLevel {
  level: number;
  cost: number; // £ to build
  coal: number;
  iron: number;
  beer: number; // beer required to sell/flip (0 = flips when emptied)
  income: number; // income steps gained on flip
  vp: number; // VP at era scoring when flipped
  note: string;
}

export interface Industry {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  levels: IndustryLevel[];
}

const INDUSTRY_META: { id: string; key: string; type: IndustryType; icon: string }[] = [
  { id: "coal-mine", key: "coalMine", type: "coal", icon: "/icon-coal.svg" },
  { id: "iron-works", key: "ironWorks", type: "iron", icon: "/icon-iron.svg" },
  { id: "cotton-mill", key: "cottonMill", type: "cotton", icon: "/icon-cotton.svg" },
  { id: "manufacturer", key: "manufacturer", type: "manufacturer", icon: "/icon-manufacture.svg" },
  { id: "pottery", key: "pottery", type: "pottery", icon: "/icon-pottery.svg" },
  { id: "brewery", key: "brewery", type: "brewery", icon: "/icon-brewery.svg" },
];

/** the printed player-mat tiles, straight from the engine's data table */
export const getIndustries = (): Industry[] =>
  INDUSTRY_META.map((m) => ({
    id: m.id,
    name: tr(`rules.industries.${m.key}.name`),
    icon: m.icon,
    blurb: tr(`rules.industries.${m.key}.blurb`),
    levels: INDUSTRIES[m.type].map((lv) => ({
      level: lv.level,
      cost: lv.cost,
      coal: lv.coal,
      iron: lv.iron,
      beer: lv.beerToSell,
      income: lv.incomeDelta,
      vp: lv.vp,
      note: tr(`rules.industries.${m.key}.notes.n${lv.level}`),
    })),
  }));

/* ------------------------------------------------------------------ */
/* §XI — Glossary                                                      */
/* ------------------------------------------------------------------ */

export interface GlossaryTerm {
  term: string;
  def: string;
}

export const getGlossary = (): GlossaryTerm[] => [
  { term: tr("rules.glossary.network.term"), def: tr("rules.glossary.network.def") },
  { term: tr("rules.glossary.connected.term"), def: tr("rules.glossary.connected.def") },
  { term: tr("rules.glossary.flippedTile.term"), def: tr("rules.glossary.flippedTile.def") },
  { term: tr("rules.glossary.merchantPort.term"), def: tr("rules.glossary.merchantPort.def") },
  { term: tr("rules.glossary.demandPip.term"), def: tr("rules.glossary.demandPip.def") },
  { term: tr("rules.glossary.beer.term"), def: tr("rules.glossary.beer.def") },
  { term: tr("rules.glossary.wildCard.term"), def: tr("rules.glossary.wildCard.def") },
  { term: tr("rules.glossary.era.term"), def: tr("rules.glossary.era.def") },
  { term: tr("rules.glossary.incomeTrack.term"), def: tr("rules.glossary.incomeTrack.def") },
  { term: tr("rules.glossary.overbuild.term"), def: tr("rules.glossary.overbuild.def") },
  { term: tr("rules.glossary.linkVp.term"), def: tr("rules.glossary.linkVp.def") },
  { term: tr("rules.glossary.market.term"), def: tr("rules.glossary.market.def") },
  { term: tr("rules.glossary.distantSale.term"), def: tr("rules.glossary.distantSale.def") },
  { term: tr("rules.glossary.clockworkClub.term"), def: tr("rules.glossary.clockworkClub.def") },
];

/* ------------------------------------------------------------------ */
/* §XII — Approximations ledger                                        */
/* ------------------------------------------------------------------ */

export type Fidelity = "faithful" | "approximate" | "planned";

export interface Approximation {
  area: string;
  status: Fidelity;
  note: string;
}

export const getApproximations = (): Approximation[] => [
  {
    area: tr("rules.approximations.supplyCore.area"),
    status: "faithful",
    note: tr("rules.approximations.supplyCore.note"),
  },
  {
    area: tr("rules.approximations.industryValues.area"),
    status: "approximate",
    note: tr("rules.approximations.industryValues.note"),
  },
  {
    area: tr("rules.approximations.map.area"),
    status: "approximate",
    note: tr("rules.approximations.map.note"),
  },
  {
    area: tr("rules.approximations.deck.area"),
    status: "approximate",
    note: tr("rules.approximations.deck.note"),
  },
  {
    area: tr("rules.approximations.bots.area"),
    status: "approximate",
    note: tr("rules.approximations.bots.note"),
  },
  {
    area: tr("rules.approximations.multiplayer.area"),
    status: "planned",
    note: tr("rules.approximations.multiplayer.note"),
  },
];
