import { number, ord, readonlyArray, readonlySet, record } from 'fp-ts'
import { eqStrict } from 'fp-ts/lib/Eq'
import { pipe } from 'fp-ts/lib/function'
import { Bid, ContractBid, eqShape, getHandShape, getHandSpecificShape, makeShape, Shape, SpecificShape } from './bridge'
import { Card, Hand, ordCard, Suit } from './deck'


export interface ConstraintPointRange {
  type: "PointRange"
  min: number
  max: number
}

export type SuitRangeSpecifier = "Major" | "Minor" | Suit // | "OtherMajor" | "OtherMinor"
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

interface ConstraintShape {
  type: "Shape"
  counts: Shape
}

export interface ConstraintSpecificShape {
  type: "SpecificShape",
  suits: SpecificShape
}


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

export const isSpecificShape = (hand: Hand) => (shape: SpecificShape) =>
  pipe(hand, getHandSpecificShape, suits => record.getEq(eqStrict).equals(suits, shape))

export const isSuitRange = (hand: Hand) => (range: ConstraintSuitRange) => {
  const getSuitsToCheck: readonly Suit[] =
    range.suit === "Major" ? ["S", "H"] :
    range.suit === "Minor" ? ["D", "C"] :
    [range.suit]
  return pipe(hand, getHandSpecificShape, shape =>
    pipe(getSuitsToCheck, readonlyArray.exists(s => {
      return ord.between(number.Ord)(range.min, range.max)(shape[s])
    })))
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
