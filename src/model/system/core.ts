import {
    boolean, either as E, eitherT, eq, hkt, identity as id, monoid, number, option as O, optionT, ord, predicate as P, readonlyArray as RA, readonlyMap, readonlyNonEmptyArray as RNEA, readonlyRecord,
    readonlySet, readonlyTuple, record, state as S, string
} from 'fp-ts';
import { eqStrict } from 'fp-ts/lib/Eq';
import { apply, constant, constFalse, constTrue, constVoid, flow, identity, pipe } from 'fp-ts/lib/function';
import { fromTraversable, Lens, lens, Optional } from 'monocle-ts';

import { assertUnreachable, debug } from '../../lib';
import {
    Bid, ContractBid, eqBid, eqShape, getHandShape, getHandSpecificShape, getHcp, groupHandBySuit, isContractBid, isGameLevel, isSlamLevel, makeShape, ordContractBid, Shape as AnyShape, SpecificShape
} from '../bridge';
import { eqRank, eqSuit, Hand, honors, ordRankAscending, Rank, Suit, suits } from '../deck';
import { BidInfo, BidPath, BidTree, getAllLeafPaths } from '../system';

interface ConstraintPointRange {
  type: "PointRange"
  min: number
  max: number
}

interface ConstraintSuitRange {
  type: "SuitRange"
  suit: Suit
  min: number
  max: number
}

type SuitComparisonOperator = "<" | "<=" | "=" | ">=" | ">"
interface ConstraintSuitComparison {
  type: "SuitComparison",
  left: Suit,
  right: Suit,
  op: SuitComparisonOperator
}

interface ConstraintSuitHonors {
  type: "SuitHonors",
  suit: Suit,
  honors: ReadonlyArray<Rank>
}

interface ConstraintSuitTop {
  type: "SuitTop",
  suit: Suit,
  count: number,
  minRank: Rank
}

interface ConstraintSuitPrimary {
  type: "SuitPrimary",
  suit: Suit
}
interface ConstraintSuitSecondary {
  type: "SuitSecondary",
  suit: Suit
}
type ConstraintSuitRank = ConstraintSuitPrimary | ConstraintSuitSecondary

interface ConstraintConstant {
  type: "Constant",
  value: boolean
}
const constraintTrue  = constant<Constraint>({ type: "Constant", value: true })
const constraintFalse = constant<Constraint>({ type: "Constant", value: false })

interface ConstraintConjunction {
  type: "Conjunction"
  constraints: RNEA.ReadonlyNonEmptyArray<Constraint>
}
interface ConstraintDisjunction {
  type: "Disjunction"
  constraints: RNEA.ReadonlyNonEmptyArray<Constraint>
}
interface ConstraintNegation {
  type: "Negation"
  constraint: Constraint
}

interface ConstraintAnyShape {
  type: "AnyShape"
  counts: AnyShape
}

interface ConstraintSpecificShape {
  type: "SpecificShape",
  suits: SpecificShape
}

interface ConstraintResponse {
  type: "ForceOneRound" | "ForceGame" | "ForceSlam"
}

interface ConstraintRelayResponse {
  type: "Relay",
  bid: ContractBid
}

type ConstraintForce =
    ConstraintResponse
  | ConstraintRelayResponse

type Constraint =
  | ConstraintConstant
  | ConstraintConjunction
  | ConstraintDisjunction
  | ConstraintNegation
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintSuitComparison
  | ConstraintSuitRank
  | ConstraintSuitHonors
  | ConstraintSuitTop
  | ConstraintAnyShape
  | ConstraintSpecificShape
  | ConstraintForce

  /* eslint-disable @typescript-eslint/no-unused-vars */
const predFalse : P.Predicate<Hand> = constFalse
const predTrue : P.Predicate<Hand> = constTrue
const quantifier = <A>(ps: ReadonlyArray<P.Predicate<A>>) => (m: monoid.Monoid<P.Predicate<A>>) => 
  RA.foldMap(m)((x: P.Predicate<A>) => x)(ps)
const exists = <A>(ps: ReadonlyArray<P.Predicate<A>>) => pipe(ps, quantifier, apply(P.getMonoidAny<A>()))
const forall = <A>(ps: ReadonlyArray<P.Predicate<A>>) => pipe(ps, quantifier, apply(P.getMonoidAll<A>()))
// const forall = <A>() => pipe(P.getMonoidAll<A>(), RA.foldMap, apply(identity))
/* eslint-enable @typescript-eslint/no-unused-vars */

interface Range {
  min: number
  max: number
}

const rangeCheck = (range: Range) =>
  ord.between(number.Ord)(range.min, range.max)

const isPointRange =
  flow(rangeCheck, P.contramap(getHcp))

const isSpecificShape = (shape: SpecificShape) =>
  flow(getHandSpecificShape, suits => record.getEq(eqStrict).equals(suits, shape))

const isSuitRange = (range: Range) => (suit: Suit) =>
  flow(getHandSpecificShape, shape =>
    pipe(range, rangeCheck, apply(shape[suit])))

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

const suitCompare = (op: SuitComparisonOperator) => (left: Suit, right: Suit) =>
  flow(getHandSpecificShape,
    shape => getComparator(op)(shape[left], shape[right]))

const suitPrimary = (suit: Suit) =>
  pipe(suits,
    RA.splitAt(suits.indexOf(suit)),
    readonlyTuple.bimap(
      flow(RA.tail,
        O.fold(() => [],
          RA.map(higher => suitCompare("<")(higher, suit)))),
      RA.map(lower => suitCompare("<=")(lower, suit))),
    RA.flatten,
    RA.prepend(isSuitRange({ min: 5, max: 13 })(suit)),
    forall)

const suitSecondary = (secondarySuit: Suit) => (primarySuit: Suit) =>
  pipe(RA.Do,
    RA.apS('suit', [secondarySuit, primarySuit]),
    RA.apS('otherSuit', pipe(suits, RA.difference(eqSuit)([secondarySuit, primarySuit]))),
    RA.filter(({ suit, otherSuit }) => !eqSuit.equals(suit, otherSuit)),
    RA.map(({ suit, otherSuit }) => suitCompare(">")(suit, otherSuit)),
    RA.concat([
      isSuitRange({ min: 5, max: 13 })(secondarySuit),
      suitCompare(">=")(primarySuit, secondarySuit)
    ]),
    forall)

const toRankSet = readonlySet.fromReadonlyArray(eqRank)

const suitHonors = (suitHonors: ConstraintSuitHonors) =>
  flow(
    groupHandBySuit,
    readonlyRecord.lookup(suitHonors.suit),
    O.fold(constFalse, cards => {
      const cardSet = pipe(cards,
        RA.map(c => c.rank),
        toRankSet,
        readonlySet.intersection(eqRank)(toRankSet(honors)))
      const honorSet = pipe(suitHonors.honors, toRankSet)
      return pipe(honorSet, readonlySet.isSubset(eqRank)(cardSet))
    }))

const suitTop = (suitTop: ConstraintSuitTop) =>
  flow(groupHandBySuit,
    readonlyRecord.lookup(suitTop.suit),
    O.fold(constFalse, flow(
      RA.map(c => c.rank),
      RA.filter(r => ordRankAscending.compare(r, suitTop.minRank) >= 0),
      cards => cards.length >= suitTop.count)))

const isShape = (shape: AnyShape) =>
  flow(getHandShape, handShape =>
    eqShape.equals(shape, handShape))


const contextualConstraintTypes = [
  "Conjunction",
  "Disjunction",
  "Negation",
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

const separate = (c: Constraint) : E.Either<ContextualConstraint, BasicConstraint> =>
  isContextualConstraint(c) ? E.left(c) : E.right(c as BasicConstraint)

const satisfiesBasic = (c: BasicConstraint): P.Predicate<Hand> => {
  switch (c.type) {
    case "Constant":
      return constant(c.value)
    case "PointRange":
      return isPointRange(c)
    case "SuitRange":
      return isSuitRange(c)(c.suit)
    case "SuitComparison":
      return suitCompare(c.op)(c.left, c.right)
    case "SuitHonors":
      return suitHonors(c)
    case "SuitTop":
      return suitTop(c)
    case "AnyShape":
      return isShape(c.counts)
    case "SpecificShape":
      return isSpecificShape(c.suits)
    default:
      return assertUnreachable(c)
  }
}

export interface ConstrainedBid {
  bid: Bid
  constraint: Constraint
}

export interface BidContext {
  bid: Bid,
  path: ReadonlyArray<Bid>
  force: O.Option<ConstraintForce>
  primarySuit: O.Option<Suit>
  secondarySuit: O.Option<Suit>,
  peers: ReadonlyArray<ConstrainedBid>,
  labels: ReadonlyMap<string, S.State<BidContext, Constraint>>
}
export const zeroContext : BidContext = {
  bid: {} as Bid,
  path: [],
  force: O.none,
  primarySuit: O.none,
  secondarySuit: O.none,
  peers: [],
  labels: readonlyMap.empty
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const contextL = Lens.fromProp<BidContext>()
const bidL = contextL('bid')
const pathL = contextL('path')
const forceL = contextL('force')
const primarySuitL = contextL('primarySuit')
const secondarySuitL = contextL('secondarySuit')
const peersL = contextL('peers')
const labelsL = contextL('labels')
const contextO = Optional.fromOptionProp<BidContext>()
const forceO = contextO('force')
const primarySuitO = contextO('primarySuit')
const secondarySuitO = contextO('secondarySuit')

type ConstraintS<X, C> = S.State<X, C>
type SatisfiesS<X, C, A> = (c: ConstraintS<X, C>) => S.State<X, P.Predicate<A>>
const quantifierS = <A>(quantifier: (c: ReadonlyArray<P.Predicate<A>>) => P.Predicate<A>) => <X, C>(satisfies: SatisfiesS<X, C, A>) =>
  flow(
    S.traverseArray(satisfies),
    S.map(quantifier))
const existsS = <X, C, A>(satisfies: SatisfiesS<X, C, A>) => quantifierS<A>(exists)(satisfies)
const forallS = <X, C, A>(satisfies: SatisfiesS<X, C, A>) => quantifierS<A>(forall)(satisfies)

const ofS = <A>(x: A) => S.of<BidContext, A>(x)

const satisfiesContextual = (recur: SatisfiesS<BidContext, Constraint, Hand>) : SatisfiesS<BidContext, ContextualConstraint, Hand> =>
  S.chain(c => {
    switch (c.type) {
      case "Conjunction":
        return pipe(c.constraints, RNEA.map(ofS), forallS(recur))
      case "Disjunction":
        return pipe(c.constraints, RNEA.map(ofS), existsS(recur))
      case "Negation": 
        return pipe(c.constraint, ofS, recur, S.map(P.not))
        
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
          S.map(O.getOrElseW(() => predFalse)))
        
      default:
        return assertUnreachable(c)
    }
  })

const satisfiesS : SatisfiesS<BidContext, Constraint, Hand> = s =>
  pipe(s,
    S.map(separate),
    S.chain(E.fold(
      flow(S.of, satisfiesContextual(satisfiesS)),
      flow(S.flap, f => f(ofS(satisfiesBasic))))))

const satisfiesWithContext = (x: Constraint) =>
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

// const specialRelayCase = (bid: Bid) => (s: S.State<BidContext, Constraint>) =>
//   pipe(s,
//     S.bindTo('constraint'),
//     S.bind('relay', ({ constraint }) =>
//       S.gets(flow(
//         forceL.get,
//         O.fold(constFalse, force =>
//           constraint.type === "Constant" && !constraint.value && force.type === "Relay" && eqBid.equals(force.bid, bid))))),
//     S.map(s => s.relay ? constraintTrue() : s.constraint))

// const preTraversal = (info: BidInfo) =>
//   pipe(
//     S.modify(peersL.set(info.siblings)),
//     S.chain(() => S.modify(bidL.set(info.bid))),
//     S.map(() => info.constraint))

// const postTraversal = <A>(info: BidInfo) =>
//     S.chain((s: A) => pipe(
//       S.modify(pathL.modify(RA.prepend(info.bid))),
//       S.map(() => s)))
  
// export const satisfiesPath = (opener: Hand, responder: Hand) => (path: BidPath) =>
//   pipe(
//     Gen.alternate(opener, responder),
//     Gen.unfold(path.length),
//     RA.zip(path),
//     S.traverseArray(([hand, info]) =>
//       pipe(
//         preTraversal(info),
//         flow(
//           specialRelayCase(info.bid),
//           satisfiesS),
//         S.ap(S.of(hand)),
//         postTraversal(info))),
//     S.map(RA.foldMap(boolean.MonoidAll)(identity)),
//     S.evaluate(zeroContext))