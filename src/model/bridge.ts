import { Deck, Hand, Suit, eqCard, suits } from "./deck"
import { readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlySet as RS, readonlyTuple as RT, apply, readonlyArray } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"

export type Direction = 'N' | 'E' | 'S' | 'W'
export const directions = ['N', 'E', 'S', 'W'] as const

export type Deal = ReadonlyMap<Direction, Hand>
export type Player = {
  direction: Direction
  hand: Hand
}

export const deal = (deck: Deck) : Deal =>
  pipe(deck,
    RA.chunksOf(13),
    RA.zip(directions),
    RA.map(flow(
      RT.mapFst(RS.fromReadonlyArray(eqCard)),
      RT.swap)),
    x => new Map(x))

export type Vulnerability = "Neither" | "NorthSouth" | "EastWest" | "Both"
export const vulnerabilities: ReadonlyArray<Vulnerability> = ["Neither", "NorthSouth", "EastWest", "Both"]

export type Strain = Suit | 'N'
export const strains : ReadonlyArray<Strain> = [...suits, 'N']

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

export interface Contract {
  level: number
  strain: Strain
}
export const contracts : ReadonlyArray<Contract> =
  apply.sequenceS(readonlyArray.Apply)(({
    level: readonlyArray.makeBy(7, level => level + 1),
    strain: strains
  }))

export type NonContractBid = "Pass" | "Double" | "Redouble"
export type ContractBid = Contract
export type Bid = NonContractBid | ContractBid

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