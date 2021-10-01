import { Bid, ContractBid } from './bridge'
import { Card, Hand, Suit, ordCard } from './deck'
import { eq, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet, readonlyTuple, record } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function'

import { eqStrict } from 'fp-ts/lib/Eq'
import { first } from 'fp-ts/lib/Semigroup'

module Tuple {
  type MapTuple<T, U> = {
    [K in keyof T]: U
  }
  export const map = <A, B, Arr extends A[]>(f: (a: A, i: number) => B, ...a: Arr) : MapTuple<Arr, B> =>
    [...a.map(f)] as MapTuple<Arr, B>
}

export interface ConstraintPointRange {
  type: "PointRange"
  min: number
  max: number
}

export type SuitRangeSpecifier = "Major" | "OtherMajor" | "Minor" | "OtherMinor" | Suit

export interface ConstraintSuitRange {
  type: "SuitRange"
  suit: SuitRangeSpecifier
  min: number
  max: number
}

export interface ConstraintConjunction {
  type: "Conjunction"
  constraints: ReadonlyArray<Constraint>
}

export interface ConstraintDisjunction {
  type: "Disjunction"
  constraints: ReadonlyArray<Constraint>
}

type Shape = readonly [number, number, number, number]
interface ConstraintShape {
  type: "Shape"
  counts: Shape
}
const zeroShape: Shape = [0, 0, 0, 0]
const sortShape = (s: Shape) => pipe(s, readonlyArray.sort(ord.reverse(number.Ord))) as Shape
const makeShape = (...counts: Shape) =>
  pipe(counts, sortShape)
const eqShape : eq.Eq<Shape> =
  eq.contramap(sortShape)(readonlyArray.getEq(number.Eq))

type SpecificShape = Record<Suit, number>
export interface ConstraintSpecificShape {
  type: "SpecificShape",
  suits: SpecificShape
}

const makeSpecificShape = (s: number, h: number, d: number, c: number) : SpecificShape => ({
  S: s,
  H: h,
  D: d,
  C: c
})
export const zeroSpecificShape = makeSpecificShape(0, 0, 0, 0)

export interface ConstraintDistribution {
  type: "Balanced" | "SemiBalanced" | "Unbalanced"
}

export interface ConstraintResponse {
  type: "ForceOneRound" | "ForceGame" | "ForceSlam"
}

export interface ConstraintRelayResponse {
  type: "Relay",
  bid: ContractBid
}

export type Constraint =
  | ConstraintConjunction
  | ConstraintDisjunction
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintDistribution
  | ConstraintShape
  | ConstraintSpecificShape
  | ConstraintResponse
  | ConstraintRelayResponse

export interface ConstrainedBid {
  bid: Bid
  constraint: Constraint
}

export const getCardHcp = (card: Card) =>
  ord.max(number.Ord)(0, card.rank - 10)

export const getHcp = (hand: Hand) =>
  pipe(hand,
    readonlySet.toReadonlyArray(ordCard),
    readonlyArray.foldMap(number.MonoidSum)(getCardHcp))

export const getHandSpecificShape = (hand: Hand) : SpecificShape =>
  pipe(hand,
    readonlySet.toReadonlyArray(ordCard),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(() => zeroSpecificShape, flow(
      readonlyNonEmptyArray.groupBy(c => c.suit),
      readonlyRecord.map(x => x.length),
      readonlyRecord.union(first<number>())(zeroSpecificShape),
      (suits: readonlyRecord.ReadonlyRecord<Suit, number>) => suits)))

export const getHandShape = (hand: Hand) : Shape =>
  pipe(hand,
    getHandSpecificShape,
    readonlyRecord.toReadonlyArray,
    readonlyArray.map(readonlyTuple.snd),
    suitCounts => {
      const result = Tuple.map((_, idx) => pipe(suitCounts, readonlyArray.lookup(idx), option.getOrElse(() => 0)), ...zeroShape)
      return result
    })

export const isSpecificShape = (hand: Hand) => (shape: SpecificShape) =>
  pipe(hand, getHandSpecificShape, suits => record.getEq(eqStrict).equals(suits, shape))

export const isSuitRange = (hand: Hand) => (range: ConstraintSuitRange) => {
  const getSuitsToCheck: readonly Suit[] =
    range.suit === "Major" || range.suit === "OtherMajor" ? ["S", "H"] :
    range.suit === "Minor" || range.suit === "OtherMinor" ? ["D", "C"] :
    [range.suit]
  return pipe(hand, getHandSpecificShape, shape =>
    pipe(getSuitsToCheck, readonlyArray.exists(s => ord.between(number.Ord)(range.min, range.max)(shape[s]))))
}

export const isShape = (hand: Hand) => (shape: Shape) =>
  eqShape.equals(shape, getHandShape(hand))

export const isBalanced = (hand: Hand) =>
  pipe([
    makeShape(4, 3, 3, 3),
    makeShape(5, 3, 3, 2),
    makeShape(4, 4, 3, 2),
    makeShape(5, 5, 3, 2),
  ], readonlyArray.exists(isShape(hand)))

export const isSemiBalanced = (hand: Hand) =>
  pipe([
    makeShape(5, 4, 2, 2),
    makeShape(6, 3, 2, 2)
  ], readonlyArray.exists(isShape(hand)))

export const satisfies = (hand: Hand) => (c: Constraint) : boolean => {
  if (c.type === "Conjunction") {
    return pipe(c.constraints, readonlyArray.every(satisfies(hand)))
  } else if (c.type === "Disjunction") {
    return pipe(c.constraints, readonlyArray.exists(satisfies(hand)))
  } else if (c.type === "PointRange") {
    return pipe(hand, getHcp, ord.between(number.Ord)(c.min, c.max))
  } else if (c.type === "SuitRange") {
    return isSuitRange(hand)(c)
  } else if (c.type === "Balanced") {
    return isBalanced(hand)
  } else if (c.type === "SemiBalanced") {
    return isBalanced(hand) || isSemiBalanced(hand)
  } else if (c.type === "Unbalanced") {
    return !(isBalanced(hand) || isSemiBalanced(hand))
  } else if (c.type === "Shape") {
    return isShape(hand)(c.counts)
  } else if (c.type === "SpecificShape") {
    return isSpecificShape(hand)(c.suits)
  } else {
    // todo
    return false
  }
}
