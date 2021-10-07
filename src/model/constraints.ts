import { Shape as AnyShape, Bid, ContractBid, SpecificShape, eqShape, getHandShape, getHandSpecificShape, makeShape } from './bridge'
import { Card, Hand, Suit, ordCard, suits } from './deck'
import { predicate as P, number, option, ord, readonlyArray, readonlySet, readonlyTuple, record } from 'fp-ts'
import { constFalse, flow, identity, pipe } from 'fp-ts/lib/function'

import { constant } from 'fp-ts/lib/function'
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

export interface ConstraintSuitPrimary {
  type: "SuitPrimary",
  suit: Suit
}
export interface ConstraintSuitSecondary {
  type: "SuitSecondary",
  suit: Suit
}
export type CosntraintSuitRank = ConstraintSuitPrimary | ConstraintSuitSecondary

export interface ConstraintConst {
  type: "Constant",
  value: boolean
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
  | ConstraintConst
  | ConstraintConjunction
  | ConstraintDisjunction
  | ConstraintNegation
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintSuitComparison
  | CosntraintSuitRank
  | ConstraintDistribution
  | ConstraintAnyShape
  | ConstraintSpecificShape
  | ConstraintResponse
  | ConstraintRelayResponse

export interface ConstrainedBid {
  bid: Bid
  constraint: Constraint
}

const exists = pipe(P.getMonoidAny<Hand>(), readonlyArray.foldMap)
const forall = pipe(P.getMonoidAll<Hand>(), readonlyArray.foldMap)

export const getCardHcp = (card: Card) =>
  Math.max(0, card.rank - 10)

export const getHcp =
  flow(
    readonlySet.toReadonlyArray(ordCard),
    readonlyArray.foldMap(number.MonoidSum)(getCardHcp))

const rangeCheck = (range: { min: number, max: number }) => ord.between(number.Ord)(range.min, range.max)

export const isPointRange =
  flow(rangeCheck, P.contramap(getHcp))

export const isSpecificShape = (shape: SpecificShape) =>
  flow(getHandSpecificShape, suits => record.getEq(eqStrict).equals(suits, shape))

export const isSuitRange = (range: ConstraintSuitRange) => {
  const getSuitsToCheck: readonly Suit[] =
    range.suit === "Major" ? ["S", "H"] :
    range.suit === "Minor" ? ["D", "C"] :
    [range.suit]
  return flow(getHandSpecificShape, shape =>
    pipe(getSuitsToCheck, readonlyArray.exists(s => ord.between(number.Ord)(range.min, range.max)(shape[s]))))
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

export const suitCompare = (op: SuitComparisonOperator) => (left: Suit, right: Suit) =>
  flow(getHandSpecificShape,
    shape => { return getComparator(op)(shape[left], shape[right]) })

export const suitPrimary = (suit: Suit) =>
  pipe(suits,
    readonlyArray.splitAt(suits.indexOf(suit)),
    readonlyTuple.bimap(
      flow(readonlyArray.tail,
        option.fold(() => [],
          readonlyArray.map(higher => { return suitCompare("<")(higher, suit) }))),
      readonlyArray.map(lower => { return suitCompare("<=")(lower, suit) })),
    readonlyArray.flatten,
    readonlyArray.foldMap(P.getMonoidAll<Hand>())(identity))

export const isShape = (shape: AnyShape) => (hand: Hand) =>
  eqShape.equals(shape, getHandShape(hand))

export const isBalanced =
  pipe([
    makeShape(4, 3, 3, 3),
    makeShape(5, 3, 3, 2),
    makeShape(4, 4, 3, 2),
    makeShape(5, 5, 3, 2),
  ], exists(isShape))

export const isSemiBalanced =
  pipe([
    makeShape(5, 4, 2, 2),
    makeShape(6, 3, 2, 2)
  ], exists(isShape))

export const satisfies = (c: Constraint) : P.Predicate<Hand> => {
  if (c.type === "Constant") {
    return constant(c.value)
  } else if (c.type === "Conjunction") {
    return pipe(c.constraints, forall(satisfies))
  } else if (c.type === "Disjunction") {
    return pipe(c.constraints, exists(satisfies))
  } else if (c.type === "Negation") { 
    return pipe(c.constraint, satisfies, P.not)
  } else if (c.type === "PointRange") {
    return isPointRange(c)
  } else if (c.type === "SuitRange") {
    return isSuitRange(c)
  } else if (c.type === "SuitComparison") {
    return suitCompare(c.op)(c.left, c.right)
  } else if (c.type === "SuitPrimary") {
    return suitPrimary(c.suit)
  } else if (c.type === "Balanced") {
    return isBalanced
  } else if (c.type === "SemiBalanced") {
    return P.or(isBalanced)(isSemiBalanced)
  } else if (c.type === "Unbalanced") {
    return P.not(P.or(isBalanced)(isSemiBalanced))
  } else if (c.type === "AnyShape") {
    return isShape(c.counts)
  } else if (c.type === "SpecificShape") {
    return isSpecificShape(c.suits)
  } 
  // these aren't supported yet, they need contextual info
  //if (c.type === "ForceOneRound" || c.type === "ForceGame" || c.type === "ForceSlam" || c.type === "Relay") {
  return constFalse
}
