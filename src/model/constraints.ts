import { Shape as AnyShape, Bid, ContractBid, SpecificShape, eqShape, getHandShape, getHandSpecificShape, makeShape } from './bridge'
import { Card, Hand, Suit, ordCard } from './deck'
import { constFalse, pipe } from 'fp-ts/lib/function'
import { number, ord, readonlyArray, readonlySet, record } from 'fp-ts'

import { eqStrict } from 'fp-ts/lib/Eq'

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

export type SuitComparisonOperator = "<" | "<=" | "=" | ">=" | ">"
export interface ConstraintSuitComparison {
  type: "SuitComparison",
  left: Suit,
  right: Suit,
  op: SuitComparisonOperator
}

export interface ConstraintConjunction {
  type: "Conjunction"
  constraints: ReadonlyArray<Constraint>
}

export interface ConstraintDisjunction {
  type: "Disjunction"
  constraints: ReadonlyArray<Constraint>
}

export interface ConstraintNegation {
  type: "Negation"
  constraint: Constraint
}

interface ConstraintAnyShape {
  type: "AnyShape"
  counts: AnyShape
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
  | ConstraintNegation
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintSuitComparison
  | ConstraintDistribution
  | ConstraintAnyShape
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

const getComparator = (op: SuitComparisonOperator) => {
  if (op === "<") {
    return ord.lt(number.Ord)
  } else if (op === "<=") {
    return ord.leq(number.Ord)
  } else if (op === "=") {
    return number.Eq.equals
  } else if (op === ">=") {
    return ord.geq(number.Ord)
  } else if (op === ">") {
    return ord.gt(number.Ord)
  } else return constFalse
}

export const suitCompare = (hand: Hand) => (op: SuitComparisonOperator) => (left: Suit, right: Suit) => {
  const shape = getHandSpecificShape(hand)
  return getComparator(op)(shape[left], shape[right])
}

export const isShape = (hand: Hand) => (shape: AnyShape) =>
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
  } else if (c.type === "Negation") { 
    return !satisfies(hand)(c.constraint)
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
  } else if (c.type === "AnyShape") {
    return isShape(hand)(c.counts)
  } else if (c.type === "SpecificShape") {
    return isSpecificShape(hand)(c.suits)
  } else if (c.type === "SuitComparison") {
    return suitCompare(hand)(c.op)(c.left, c.right)
  }
  // these aren't supported yet, they need contextual info
  //if (c.type === "ForceOneRound" || c.type === "ForceGame" || c.type === "ForceSlam" || c.type === "Relay") {
  return false
}
