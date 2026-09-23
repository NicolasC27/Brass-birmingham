/* ------------------------------------------------------------------ */
/* The weights of the machines' reading of the board.                  */
/*                                                                     */
/* Every number the evaluation in search.ts leans on lives here, so    */
/* that the machines can train: tools/bots/train.ts plays them against */
/* themselves, keeps whatever reads the board better, and writes the   */
/* winner back into TRAINED. Edit DEFAULTS by hand; TRAINED belongs to */
/* the trainer.                                                        */
/* ------------------------------------------------------------------ */

export interface Weights {
  /** what a pound is worth in points at the end, and per fraction of game left */
  cashFloor: number;
  cashSlope: number;
  /** what one action can plausibly lay out, and what a pound beyond
   *  everything one's remaining actions could spend is worth, as a share
   *  of a spendable one: money one never gets to spend is dead weight */
  cashPerAction: number;
  idleCash: number;
  /** the income a flip moves the marker to, per payday left */
  incomeOnFlip: number;
  /** the chance a goods tile flips: a buyer connected (with beer around, without), one link away, none */
  goodsServed: number;
  goodsNoBeer: number;
  goodsNearly: number;
  goodsFar: number;
  /** a brewery's chance: base, per own goods tile, per rival goods tile on its network, and the second brewery's share */
  breweryBase: number;
  breweryOwnGoods: number;
  breweryNear: number;
  brewerySecond: number;
  /** a works' chance: base and what draining adds; a mine's: base, draining, a merchant on its network */
  ironBase: number;
  ironDrain: number;
  coalBase: number;
  coalDrain: number;
  coalMerchant: number;
  /** flips grow unlikely as the game runs out: chance × min(1, floor + fraction left) */
  chanceFloor: number;
  /** an unflipped tile's link icons */
  linkIcons: number;
  /** the threat of a negative income, per level below zero */
  negIncome: number;
  /** a card in hand once the deck is out */
  handAtEnd: number;
  /** room to move: per town of one's network, and the want of a market */
  towns: number;
  noMarket: number;
  /** the next tile of each industry on the mat */
  stack: number;
  /** how much the strongest rival's worth counts against one's own */
  rival: number;
  /** the classic opening: what each of two loans in the first three canal rounds is worth on its own */
  earlyLoan: number;
  /** a mat developed in the Canal Era: per industry whose next tile is level 2 or above, which will survive the sweep and score twice */
  developed: number;
  /** what a slot is worth for being scarce: per own tile, times the share of
   *  that industry's slots already taken across the board. Strong players say
   *  the question at every action is whether it helps the others more than
   *  oneself; taking the contested thing first is that question's answer, and
   *  it is an opportunity cost rather than an aggression */
  /** how much a build this card names, that only the purse forbids today,
   *  counts towards keeping the card. At zero a card is ranked by what it
   *  can pay for this instant, which throws away the expensive builds */
  /** what a line of play still standing is worth: its outstanding tiles'
   *  points less the actions still between the seat and their sale, charged
   *  at `chainAction` a piece. Nothing is promised and nothing is forbidden;
   *  a line the board or the hand has closed reads zero at once */
  chainPay: number;
  /** what an action is charged against a line. The machines make 4.0 points
   *  an action today and would need 5.3 to match a strong human */
  chainAction: number;
  cardLater: number;
  scarceSlot: number;
  /** what it costs to have spent a level-1 goods mill or brewery on the board.
   *  The tile is gone from the mat either way, and the strong players' advice
   *  is to develop those away rather than build them: half our builds are
   *  level 1 and our mats end the game barely started (cotton at 1.3 of 4) */
  lowTile: number;
  /** the turn-order weapon: per seat one would move ahead of next round by having spent less */
  tempo: number;
  /** a canal laid for less than four icons: the guides call it an inefficient action */
  weakLink: number;
  /** entering the rails ready: in the last two canal rounds, cash for two double rails and beer of one's own */
  railReady: number;
}

export const DEFAULTS: Weights = {
  cashFloor: 0.05,
  cashSlope: 0.4,
  cashPerAction: 12,
  idleCash: 0.05,
  incomeOnFlip: 0.8,
  goodsServed: 0.7,
  goodsNoBeer: 0.4,
  goodsNearly: 0.35,
  goodsFar: 0.1,
  breweryBase: 0.15,
  breweryOwnGoods: 0.2,
  breweryNear: 0.1,
  brewerySecond: 0.6,
  ironBase: 0.55,
  ironDrain: 0.45,
  coalBase: 0.3,
  coalDrain: 0.6,
  coalMerchant: 0.1,
  chanceFloor: 0.3,
  linkIcons: 0.3,
  negIncome: 1.5,
  handAtEnd: 2,
  towns: 0.6,
  noMarket: 4,
  stack: 0.08,
  rival: 0,
  earlyLoan: 8,
  developed: 2,
  chainPay: 0,
  chainAction: 5,
  cardLater: 1,
  scarceSlot: 0,
  lowTile: 3,
  tempo: 1,
  weakLink: 0,
  railReady: 3,
};

/* written by tools/bots/train.ts — the reading that won the last training */
export const TRAINED: Weights = { ...DEFAULTS };
