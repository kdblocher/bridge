import {
  apply,
  eq,
  number,
  ord,
  readonlyArray as RA,
  readonlyNonEmptyArray as RNEA,
  readonlyRecord,
  readonlySet as RS,
  readonlyTuple as RT,
  refinement,
  string,
} from "fp-ts";
import { flow, pipe } from "fp-ts/lib/function";

import { ordAscending } from "../lib";
import { Deck, eqCard, Hand, suits } from "./deck";

export const directions = ["N", "E", "S", "W"] as const;
export type Direction = (typeof directions)[number];
export const eqDirection: eq.Eq<Direction> = string.Eq;
export const ordDirection = ordAscending(directions);

export const partnerships = ["NorthSouth", "EastWest"] as const;
export type Partnership = (typeof partnerships)[number];
export const eqPartnership: eq.Eq<Partnership> = string.Eq;
export const ordPartnership = ordAscending(partnerships);

export const getPartnershipByDirection = (d: Direction): Partnership =>
  d === "N" || d === "S" ? "NorthSouth" : "EastWest";

export type Deal = readonlyRecord.ReadonlyRecord<Direction, Hand>;
export type Player = {
  direction: Direction;
  hand: Hand;
};
export const eqHand: eq.Eq<Hand> = RS.getEq(eqCard);

export const deal = (deck: Deck): Deal =>
  pipe(
    directions,
    RNEA.zip(RNEA.chunksOf(13)(deck)),
    RNEA.groupBy(RT.fst),
    readonlyRecord.map(flow(RNEA.head, RT.snd, RS.fromReadonlyArray(eqCard))),
    (x: readonlyRecord.ReadonlyRecord<Direction, Hand>) => x
  );
export const eqDeal: eq.Eq<Deal> = readonlyRecord.getEq<Direction, Hand>(
  eqHand
);

export const vulnerabilities = [
  "Neither",
  "NorthSouth",
  "EastWest",
  "Both",
] as const;
export type Vulnerability = (typeof vulnerabilities)[number];

export const getIsVulnerable = (dir: Direction, vul: Vulnerability) =>
  !(vul === "Neither") &&
  (vul === "Both" || getPartnershipByDirection(dir) === vul);

export const strains = [...suits, "N"] as const;
export type Strain = (typeof strains)[number];
export const eqStrain: eq.Eq<Strain> = eq.eqStrict;
export const ordStrain: ord.Ord<Strain> = ordAscending(strains);

export const minors: ReadonlyArray<Strain> = ["C", "D"];
export const majors: ReadonlyArray<Strain> = ["H", "S"];

export interface Board {
  dealer: Direction;
  deal: Deal;
}
export const eqBoard: eq.Eq<Board> = eq.struct({
  dealer: eqDirection,
  deal: eqDeal,
});

export interface BoardWithDetail extends Board {
  number: number;
  vulnerability: Vulnerability;
}

const boneChart = (boardNumber: number): Vulnerability => {
  switch ((boardNumber % 16) + 1) {
    case 1:
    case 8:
    case 11:
    case 14:
      return "Neither";
    case 2:
    case 5:
    case 12:
    case 15:
      return "NorthSouth";
    case 3:
    case 6:
    case 9:
    case 16:
      return "EastWest";
    case 4:
    case 7:
    case 10:
    case 13:
      return "Both";
    default:
      throw Error("Not possible");
  }
};

export const makeBoard =
  (number: number) =>
  (deal: Deal): BoardWithDetail => ({
    number,
    dealer: directions[(number - 1) % directions.length],
    deal,
    vulnerability: boneChart(number),
  });

export const nonContractBids = ["Pass", "Double", "Redouble"] as const;
export type NonContractBid = (typeof nonContractBids)[number];
export const eqNonContractBid: eq.Eq<NonContractBid> = string.Eq;
export const isNonContractBid = (b: unknown): b is NonContractBid =>
  typeof b === "string" && pipe(nonContractBids, RA.elem<string>(string.Eq)(b));

export interface ContractBid {
  level: number;
  strain: Strain;
}
export const eqContractBid: eq.Eq<ContractBid> = eq.struct({
  level: number.Eq,
  strain: string.Eq,
});
export const ordContractBid: ord.Ord<ContractBid> = ord
  .getMonoid<ContractBid>()
  .concat(
    pipe(
      number.Ord,
      ord.contramap((c) => c.level)
    ),
    pipe(
      ordStrain,
      ord.contramap((c) => c.strain)
    )
  );
export const levels = RNEA.makeBy((level) => level + 1)(7);
export const contractBids: ReadonlyArray<ContractBid> = pipe(
  apply.sequenceS(RA.Apply)({
    level: levels,
    strain: strains,
  }),
  RA.sort(ordContractBid)
);

export type Bid = NonContractBid | ContractBid;
export const isContractBid = (b: Bid): b is ContractBid => !isNonContractBid(b);

export const eqBid: eq.Eq<Bid> = eq.fromEquals(
  (x, y) =>
    (isNonContractBid(x) &&
      isNonContractBid(y) &&
      eqNonContractBid.equals(x, y)) ||
    (!isNonContractBid(x) && !isNonContractBid(y) && eqContractBid.equals(x, y))
);

export const isGameLevel = (bid: Bid) =>
  isContractBid(bid) && ord.geq(ordContractBid)(bid, { level: 3, strain: "N" });
export const isSlamLevel = (bid: Bid) =>
  isContractBid(bid) && ord.gt(ordContractBid)(bid, { level: 5, strain: "N" });

export const contractModifiers = ["Undoubled", "Doubled", "Redoubled"] as const;
export type ContractModifier = (typeof contractModifiers)[number];
export interface Contract extends ContractBid {
  modifier: ContractModifier;
}
export const eqContract: eq.Eq<Contract> = eq.struct({
  level: number.Eq,
  strain: string.Eq,
  modifier: string.Eq,
});
export const fromBid = (bid: ContractBid): Contract => ({
  ...bid,
  modifier: "Undoubled",
});

export type Auction = RNEA.ReadonlyNonEmptyArray<Bid>;
const consecutivePasses = ["Pass", "Pass", "Pass"] as const;
export type NonPassAuction = Auction &
  [...Auction, ...typeof consecutivePasses];
const passout = ["Pass", "Pass", "Pass", "Pass"] as const;
export type PassAuction = typeof passout;
export type CompletedAuction = NonPassAuction | PassAuction;
export const eqAuction: eq.Eq<Auction> = RNEA.getEq(eqBid);
export const isCompletedAuction: refinement.Refinement<
  Auction,
  CompletedAuction
> = (a): a is CompletedAuction =>
  a.length >= 4 &&
  (eqAuction.equals(a, passout) ||
    eqAuction.equals(
      a.slice(a.length - 3) as unknown as Auction,
      consecutivePasses
    ));

export interface BoardWithAuction extends Board {
  auction: Auction;
}
export interface BoardWithCompletedAuction extends BoardWithAuction {
  auction: CompletedAuction;
}
