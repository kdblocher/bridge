import { Shape as AnyShape, Bid, ContractBid, SpecificShape, eqShape, getHandShape, getHandSpecificShape, makeShape } from './bridge'
import { Card, Hand, Suit, eqSuit, ordCard, suits } from './deck'
import { predicate as P, number, option, ord, readonlyArray, readonlySet, readonlyTuple, record } from 'fp-ts'
import { constFalse, constant, flow, identity, pipe } from 'fp-ts/lib/function'

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

const assertUnreachable = (x: never) => {
  throw new Error (`shouldn't get here with ${JSON.stringify(x)}`)
}

const getComparator = (op: SuitComparisonOperator) => {
  switch (op) {
    case "<" : return ord.lt(number.Ord)
    case "<=": return ord.leq(number.Ord)
    case "=" : return number.Eq.equals
    case ">=": return ord.geq(number.Ord)
    case ">" : return ord.gt(number.Ord)
    default  : return assertUnreachable(op)
  }
}

export const suitCompare = (op: SuitComparisonOperator) => (left: Suit, right: Suit) =>
  flow(getHandSpecificShape,
    shape => getComparator(op)(shape[left], shape[right]))

export const suitPrimary = (suit: Suit) =>
  pipe(suits,
    readonlyArray.splitAt(suits.indexOf(suit)),
    readonlyTuple.bimap(
      flow(readonlyArray.tail,
        option.fold(() => [],
          readonlyArray.map(higher => suitCompare("<")(higher, suit)))),
      readonlyArray.map(lower => suitCompare("<=")(lower, suit))),
    readonlyArray.flatten,
    readonlyArray.prepend(isSuitRange({ type: "SuitRange", suit, min: 5, max: 13 })),
    forall(identity))

export const suitSecondary = (secondarySuit: Suit) => (primarySuit: Suit) =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('otherSuit', suits),
    readonlyArray.apS('suit', [secondarySuit, primarySuit]),
    readonlyArray.filter(({ suit, otherSuit }) => !eqSuit.equals(suit, otherSuit)),
    readonlyArray.map(({ suit, otherSuit }) => suitCompare(">")(suit, otherSuit)),
    readonlyArray.concat([
      isSuitRange({ type: "SuitRange", suit: secondarySuit, min: 4, max: 13 }),
      suitCompare(">=")(primarySuit, secondarySuit)
    ]),
    forall(identity))

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
  switch (c.type) {
    case "Constant":
      return constant(c.value)
    case "Conjunction":
      return pipe(c.constraints, forall(satisfies))
    case "Disjunction":
      return pipe(c.constraints, exists(satisfies))
    case "Negation": 
      return pipe(c.constraint, satisfies, P.not)
    case "PointRange":
      return isPointRange(c)
    case "SuitRange":
      return isSuitRange(c)
    case "SuitComparison":
      return suitCompare(c.op)(c.left, c.right)
    case "SuitPrimary":
      return suitPrimary(c.suit)
    case "Balanced":
      return isBalanced
    case "SemiBalanced":
      return P.or(isBalanced)(isSemiBalanced)
    case "Unbalanced":
      return P.not(P.or(isBalanced)(isSemiBalanced))
    case "AnyShape":
      return isShape(c.counts)
    case "SpecificShape":
      return isSpecificShape(c.suits)

    case "ForceOneRound":
    case "ForceGame":
    case "ForceSlam":
    case "Relay":
    case "SuitSecondary":
      return constFalse
      
    default:
      return assertUnreachable(c)
  }
}
