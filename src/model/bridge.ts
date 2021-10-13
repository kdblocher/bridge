import { Deck, Hand, Suit, eqCard, ordCard, suits } from "./deck"
import { readonlyNonEmptyArray as RNEA, readonlySet as RS, readonlyTuple as RT, apply, eq, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet, readonlyTuple, semigroup, string } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"

export const directions = ['N', 'E', 'S', 'W'] as const
export type Direction = typeof directions[number]
export const ordDirection : ord.Ord<Direction> = pipe(number.Ord, ord.contramap(d => directions.indexOf(d)))

export type Deal = readonlyRecord.ReadonlyRecord<Direction, Hand>
export type Player = {
  direction: Direction
  hand: Hand
}

export const deal = (deck: Deck) : Deal =>
  pipe(directions,
    RNEA.zip(RNEA.chunksOf(13)(deck)),
    readonlyNonEmptyArray.groupBy(RT.fst),
    readonlyRecord.map(flow(RNEA.head, RT.snd, RS.fromReadonlyArray(eqCard))),
    (x: readonlyRecord.ReadonlyRecord<Direction, Hand>) => x)

export const vulnerabilities = ["Neither", "NorthSouth", "EastWest", "Both"] as const
export type Vulnerability = typeof vulnerabilities[number]


export const strains = [...suits, 'N'] as const
export type Strain = typeof strains[number]
export const eqStrain : eq.Eq<Strain> = eq.eqStrict
export const minors: ReadonlyArray<Strain> = ['C', 'D']
export const majors: ReadonlyArray<Strain> = ['H', 'S']

export interface Board {
  number: number
  dealer: Direction
  deal: Deal
  vulnerability: Vulnerability
}

const boneChart = (boardNumber: number) : Vulnerability => {
  switch ((boardNumber % 16) + 1) {
    case 1: case 8: case 11: case 14: return "Neither"
    case 2: case 5: case 12: case 15: return "NorthSouth"
    case 3: case 6: case 9:  case 16: return "EastWest"
    case 4: case 7: case 10: case 13: return "Both"
    default: throw Error("Not possible")
  }
}

export const makeBoard = (number: number) => (deal: Deal) : Board => ({
  number,
  dealer: directions[(number - 1) % directions.length],
  deal,
  vulnerability: boneChart(number)
})

export type NonContractBid = "Pass" | "Double" | "Redouble"
export const eqNonContractBid : eq.Eq<NonContractBid> = string.Eq
export interface ContractBid {
  level: number
  strain: Strain
}
export const eqContractBid : eq.Eq<ContractBid> = eq.struct({
  level: number.Eq,
  strain: string.Eq
})
export const contractBids : ReadonlyArray<ContractBid> =
  apply.sequenceS(readonlyArray.Apply)(({
    level: readonlyArray.makeBy(7, level => level + 1),
    strain: strains
  }))

export type Bid = NonContractBid | ContractBid
export const isNonContractBid = (b: Bid) : b is NonContractBid => typeof b === "string"

export const eqBid : eq.Eq<Bid> = eq.fromEquals((x, y) =>
  (isNonContractBid(x) && isNonContractBid(y) && eqNonContractBid.equals(x, y)) ||
  (!isNonContractBid(x) && !isNonContractBid(y) && eqContractBid.equals(x, y)))

export type ContractModifier = "Undoubled" | "Doubled" | "Redoubled"
export interface Contract extends ContractBid {
  modifier: ContractModifier
}
export const eqContract : eq.Eq<Contract> = eq.struct({
  level: number.Eq,
  strain: string.Eq,
  modifier: string.Eq
})





export type Auction = RNEA.ReadonlyNonEmptyArray<Bid>
export type NonPassAuction = Auction & [...Auction, "Pass", "Pass", "Pass"]
export type PassAuction = Auction & ["Pass", "Pass", "Pass", "Pass"]
export type CompletedAuction = NonPassAuction | PassAuction

export interface BoardWithAuction extends Board {
  auction: Auction 
}
export interface BoardWithCompletedAuction extends BoardWithAuction {
  auction: CompletedAuction
}

export type Shape = readonly [number, number, number, number]
export const zeroShape: Shape = [0, 0, 0, 0]
export const sortShape = (s: Shape) => pipe(s, readonlyArray.sort(ord.reverse(number.Ord))) as Shape
export const makeShape = (...counts: Shape) =>
  pipe(counts, sortShape)
export const eqShape : eq.Eq<Shape> =
  eq.contramap(sortShape)(readonlyArray.getEq(number.Eq))

export type SpecificShape = Record<Suit, number>
export const makeSpecificShape = (s: number, h: number, d: number, c: number) : SpecificShape => ({
  S: s,
  H: h,
  D: d,
  C: c
})
export const zeroSpecificShape = makeSpecificShape(0, 0, 0, 0)

export const getHandSpecificShape = (hand: Hand) : SpecificShape =>
  pipe(hand,
    readonlySet.toReadonlyArray(ordCard),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(() => zeroSpecificShape, flow(
      readonlyNonEmptyArray.groupBy(c => c.suit),
      readonlyRecord.map(x => x.length),
      readonlyRecord.union(semigroup.first<number>())(zeroSpecificShape),
      (suits: readonlyRecord.ReadonlyRecord<Suit, number>) => suits)))

export const getHandShape = (hand: Hand) : Shape =>
  pipe(hand,
    getHandSpecificShape,
    readonlyRecord.toReadonlyArray,
    readonlyArray.map(readonlyTuple.snd),
    suitCounts => readonlyArray.mapWithIndex((idx, _) =>
      pipe(suitCounts, readonlyArray.lookup(idx), option.getOrElse(() => 0)))(zeroShape)) as Shape