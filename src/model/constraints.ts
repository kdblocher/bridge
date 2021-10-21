import { boolean, either, eq, hkt, identity as id, number, option as O, optionT, ord, predicate as P, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord, readonlySet, readonlyTuple, record, state as S, string } from 'fp-ts';
import { eqStrict } from 'fp-ts/lib/Eq';
import { constant, constFalse, constTrue, flow, identity, pipe } from 'fp-ts/lib/function';
import { fromTraversable, Lens, lens, Optional, traversal } from 'monocle-ts';
import { assertUnreachable } from '../lib';
import { Bid, ContractBid, eqBid, eqShape, getHandShape, getHandSpecificShape, getHcp, groupHandBySuit, makeShape, Shape as AnyShape, SpecificShape } from './bridge';
import { eqRank, eqSuit, Hand, honors, Rank, Suit, suits } from './deck';
import { BidInfo } from './system';


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

export type SuitHonorsQualifier = "+" | "-" | "="
export interface ConstraintSuitHonors {
  type: "SuitHonors",
  suit: Suit,
  honors: ReadonlyArray<Rank>,
  qualifier: SuitHonorsQualifier
}

export interface ConstraintSuitPrimary {
  type: "SuitPrimary",
  suit: Suit
}
export interface ConstraintSuitSecondary {
  type: "SuitSecondary",
  suit: Suit
}
export type ConstraintSuitRank = ConstraintSuitPrimary | ConstraintSuitSecondary

export interface ConstraintConst {
  type: "Constant",
  value: boolean
}
export const constConstraintTrue  = constant<Constraint>({ type: "Constant", value: true })
export const constConstraintFalse = constant<Constraint>({ type: "Constant", value: false })

export interface ConstraintConjunction {
  type: "Conjunction"
  constraints: RNEA.ReadonlyNonEmptyArray<Constraint>
}
export interface ConstraintDisjunction {
  type: "Disjunction"
  constraints: RNEA.ReadonlyNonEmptyArray<Constraint>
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

export interface ConstraintOtherBid {
  type: "OtherBid",
  bid: ContractBid
}

export type ConstraintForce =
    ConstraintResponse
  | ConstraintRelayResponse

export type Constraint =
  | ConstraintConst
  | ConstraintConjunction
  | ConstraintDisjunction
  | ConstraintNegation
  | ConstraintOtherBid
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintSuitComparison
  | ConstraintSuitRank
  | ConstraintSuitHonors
  | ConstraintDistribution
  | ConstraintAnyShape
  | ConstraintSpecificShape
  | ConstraintForce

const contextualConstraintTypes = [
  "Conjunction",
  "Disjunction",
  "Negation",
  "OtherBid",
  "ForceOneRound",
  "ForceGame",
  "ForceSlam",
  "Relay",
  "SuitPrimary",
  "SuitSecondary",
] as const

type ContextualConstraintType = typeof contextualConstraintTypes[number]
type BasicConstraint = Exclude<Constraint, { type: ContextualConstraintType }>
type ContextualConstraint = Extract<Constraint, { type: ContextualConstraintType }>

const isContextualConstraint = (c: Constraint) : c is ContextualConstraint =>
  RA.elem(string.Eq as eq.Eq<Constraint["type"]>)(c.type)(contextualConstraintTypes)

const separate = (c: Constraint) : either.Either<ContextualConstraint, BasicConstraint> =>
  isContextualConstraint(c) ? either.left(c) : either.right(c as BasicConstraint)

export interface ConstrainedBid {
  bid: Bid
  constraint: Constraint
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const anyP = P.getMonoidAny<Hand>()
const allP = P.getMonoidAll<Hand>()
const constraintFalse : P.Predicate<Hand> = constFalse
const constraintTrue : P.Predicate<Hand> = constTrue
const exists = pipe(anyP, RA.foldMap)
const forall = pipe(allP, RA.foldMap)
/* eslint-enable @typescript-eslint/no-unused-vars */

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
    pipe(getSuitsToCheck, RA.exists(s => ord.between(number.Ord)(range.min, range.max)(shape[s]))))
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
    RA.splitAt(suits.indexOf(suit)),
    readonlyTuple.bimap(
      flow(RA.tail,
        O.fold(() => [],
          RA.map(higher => suitCompare("<")(higher, suit)))),
      RA.map(lower => suitCompare("<=")(lower, suit))),
    RA.flatten,
    RA.prepend(isSuitRange({ type: "SuitRange", suit, min: 5, max: 13 })),
    forall(identity))

export const suitSecondary = (secondarySuit: Suit) => (primarySuit: Suit) =>
  pipe(RA.Do,
    RA.apS('suit', [secondarySuit, primarySuit]),
    RA.apS('otherSuit', pipe(suits, RA.difference(eqSuit)([secondarySuit, primarySuit]))),
    RA.filter(({ suit, otherSuit }) => !eqSuit.equals(suit, otherSuit)),
    RA.map(({ suit, otherSuit }) => suitCompare(">")(suit, otherSuit)),
    RA.concat([
      isSuitRange({ type: "SuitRange", suit: secondarySuit, min: 4, max: 13 }),
      suitCompare(">=")(primarySuit, secondarySuit)
    ]),
    forall(identity))

const suitHonors = (suitHonors: ConstraintSuitHonors) =>
  flow(
    groupHandBySuit,
    readonlyRecord.lookup(suitHonors.suit),
    O.fold(constFalse, cards => {
      const setFromArray = readonlySet.fromReadonlyArray(eqRank)
      const cardSet = pipe(cards,
        RA.map(c => c.rank),
        setFromArray,
        readonlySet.intersection(eqRank)(setFromArray(honors)))
      const honorSet = pipe(suitHonors.honors, setFromArray)
      switch (suitHonors.qualifier) {
        case "=": return readonlySet.getEq(eqRank).equals(cardSet, honorSet)
        case "-": return pipe(cardSet, readonlySet.isSubset(eqRank)(honorSet))
        case "+": return pipe(honorSet, readonlySet.isSubset(eqRank)(cardSet))
        default: return assertUnreachable(suitHonors.qualifier)
      }
    }))

export const isShape = (shape: AnyShape) =>
  flow(getHandShape, handShape =>
    eqShape.equals(shape, handShape))

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

export interface BidContext {
  bid: Bid,
  path: ReadonlyArray<Bid>
  force: O.Option<ConstraintForce>
  primarySuit: O.Option<Suit>
  secondarySuit: O.Option<Suit>,
  peers: ReadonlyArray<ConstrainedBid>,
}
export const zeroContext : BidContext = {
  bid: {} as Bid,
  path: [],
  force: O.none,
  primarySuit: O.none,
  secondarySuit: O.none,
  peers: [],
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const contextL = Lens.fromProp<BidContext>()
const bidL = contextL('bid')
const pathL = contextL('path')
const forceL = contextL('force')
const primarySuitL = contextL('primarySuit')
const secondarySuitL = contextL('secondarySuit')
const peersL = contextL('peers')
const peersT = pipe(peersL,
  lens.composeTraversal(fromTraversable(RA.Traversable)<ConstrainedBid>()))
const contextO = Optional.fromOptionProp<BidContext>()
const forceO = contextO('force')
const primarySuitO = contextO('primarySuit')
const secondarySuitO = contextO('secondarySuit')
/* eslint-enable @typescript-eslint/no-unused-vars */

type X = BidContext
type C = Constraint
type A = P.Predicate<Hand>

const quantifierT = (quantifier: (c: ReadonlyArray<A>) => A) => (satisfies: (c: S.State<X, C>) => S.State<X, A>) =>
  flow(
    S.traverseArray(satisfies),
    S.map(quantifier))
const existsT = quantifierT(exists(identity))
const forallT = quantifierT(forall(identity))

type SatisfiesShape<R, C, A> = (recur: (c: R) => A) => (constraint: C) => A
type SatisfiesT1<F extends hkt.URIS , C extends Constraint> = SatisfiesShape<hkt.Kind  <F,    Constraint>, hkt.Kind <F,    C>, hkt.Kind <F,    A>>
type SatisfiesT2<F extends hkt.URIS2, C extends Constraint> = SatisfiesShape<hkt.Kind2 <F, X, Constraint>, hkt.Kind2<F, X, C>, hkt.Kind2<F, X, A>>

const satisfiesBasic : ReturnType<SatisfiesT1<id.URI, BasicConstraint>> = c => {
  switch (c.type) {
    case "Constant":
      return constant(c.value)
    case "PointRange":
      return isPointRange(c)
    case "SuitRange":
      return isSuitRange(c)
    case "SuitComparison":
      return suitCompare(c.op)(c.left, c.right)
    case "SuitHonors":
      return suitHonors(c)
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
    default:
      return assertUnreachable(c)
  }
}

const satisfiesContextual : SatisfiesT2<S.URI, ContextualConstraint> = recur =>
  S.chain(c => {
    switch (c.type) {
      case "Conjunction":
        return pipe(c.constraints, RNEA.map(c => S.of(c)), forallT(recur))
      case "Disjunction":
        return pipe(c.constraints, RNEA.map(c => S.of(c)), existsT(recur))
      case "Negation": 
        return pipe(c.constraint, S.of, recur, S.map(P.not))
      case "OtherBid":
        return pipe(
          S.gets((context: BidContext) =>
            pipe(
              peersT,
              traversal.filter((b: ConstrainedBid) => eqBid.equals(b.bid, c.bid)),
              traversal.getAll(context),
              RA.head)),
          S.chain(O.fold(
            () => S.of(constraintFalse),
            otherBid => pipe(
              S.gets(bidL.get),
              S.chain(bid =>
                eqBid.equals(bid, otherBid.bid) // stops cycles
                ? S.of(constFalse)
                : recur(S.of(otherBid.constraint)))))))
      case "ForceOneRound":
      case "ForceGame":
      case "ForceSlam":
      case "Relay":
        return pipe(
          S.modify<BidContext>(forceL.set(O.some(c))),
          S.map(() => constTrue))
      case "SuitPrimary":
        return pipe(
          S.modify<BidContext>(primarySuitL.set(O.some(c.suit))),
          S.map(() => suitPrimary(c.suit)))
      case "SuitSecondary":
        return pipe(
          S.modify<BidContext>(secondarySuitL.set(O.some(c.suit))),
          S.chain(() => S.gets(context => context.primarySuit)),
          optionT.map(S.Functor)(suitSecondary(c.suit)),
          S.map(O.getOrElseW(() => constraintFalse)))
      default:
        return assertUnreachable(c)
    }
  })

const satisfiesS : ReturnType<SatisfiesT2<S.URI, Constraint>> = s =>
  pipe(s,
    S.map(separate),
    S.chain(either.fold(
      flow(S.of, satisfiesContextual(satisfiesS)),
      right => pipe(S.of<X, typeof satisfiesBasic>(satisfiesBasic), S.ap(S.of(right))))))

export const satisfiesWithContext = (x: Constraint) =>
  pipe(x, S.of, satisfiesS)
  
export const satisfies =
  flow(satisfiesWithContext, S.evaluate(zeroContext))

module Gen {
  export function* alternate(opener: Hand, responder: Hand) {
    while (true) { yield opener; yield responder }
  }

  export const unfold = (length: number) => <T>(g: Generator<T>) : readonly T[] => {
    const val = g.next()
    return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
  }
}

const specialRelayCase = (bid: Bid) => (s: S.State<BidContext, Constraint>) =>
  pipe(s,
    S.bindTo('constraint'),
    S.bind('relay', ({ constraint }) =>
      S.gets(flow(
        forceL.get,
        O.fold(constFalse, force =>
          constraint.type === "Constant" && !constraint.value && force.type === "Relay" && eqBid.equals(force.bid, bid))))),
    S.map(s => s.relay ? constConstraintTrue() : s.constraint))

export const satisfiesPath = (opener: Hand, responder: Hand) => (bids: ReadonlyArray<BidInfo>) => {
  return pipe(
    Gen.alternate(opener, responder),
    Gen.unfold(bids.length),
    RA.zip(bids),
    S.traverseArray(([hand, { bid, siblings, constraint }]) =>
      pipe(
        S.modify(peersL.set(siblings)),
        S.chain(() => S.modify(bidL.set(bid))),
        S.chain(() => S.of(constraint)),
        flow(specialRelayCase(bid), satisfiesS),
        // satisfiesS,
        S.ap(S.of(hand)),
        S.chain(s => pipe(
          S.modify(pathL.modify(RA.prepend(bid))),
          S.map(() => s))))),
    S.map(RA.foldMap(boolean.MonoidAll)(identity)),
    S.evaluate(zeroContext)) 
  }

// Only use for one-off checks, as it doesn't descend the entire bid tree
export const satisfiesPathWithoutSiblingCheck = (opener: Hand, responder: Hand) =>
  flow(RA.map((x: ConstrainedBid) => ({ ...x, siblings: [] })), satisfiesPath(opener, responder))
