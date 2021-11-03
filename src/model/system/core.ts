import { either as E, eq, monoid, number, option as O, optionT, ord, predicate as P, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord, readonlySet, readonlyTuple, record, state as S, string } from 'fp-ts';
import { eqStrict } from 'fp-ts/lib/Eq';
import { apply, constant, constFalse, constTrue, flow, pipe } from 'fp-ts/lib/function';
import { Lens, Optional } from 'monocle-ts';

import { assertUnreachable } from '../../lib';
import { Bid, ContractBid, eqShape, getHandShape, getHandSpecificShape, getHcp, groupHandBySuit, isContractBid, ordContractBid, Shape as AnyShape, SpecificShape } from '../bridge';
import { eqRank, eqSuit, Hand, honors, ordRankAscending, Rank, Suit, suits } from '../deck';

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
export const constraintTrue  = constant<Constraint>({ type: "Constant", value: true })
export const constraintFalse = constant<Constraint>({ type: "Constant", value: false })

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

export type ConstraintForce =
    ConstraintResponse
  | ConstraintRelayResponse

export type Constraint =
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
export const exists = <A>(ps: ReadonlyArray<P.Predicate<A>>) => pipe(ps, quantifier, apply(P.getMonoidAny<A>()))
export const forall = <A>(ps: ReadonlyArray<P.Predicate<A>>) => pipe(ps, quantifier, apply(P.getMonoidAll<A>()))
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
const ordBid: ord.Ord<Bid> =
  ord.fromCompare((a, b) =>
    isContractBid(a) && !isContractBid(b) ? -1 :
    isContractBid(b) && !isContractBid(a) ? 1 :
    isContractBid(a) && isContractBid(b) ? ordContractBid.compare(a, b) :
    0)
export const ordConstrainedBid = ord.contramap<Bid, ConstrainedBid>(b => b.bid)(ordBid)
export interface BidContext {
  bid: Bid,
  path: ReadonlyArray<Bid>
  force: O.Option<ConstraintForce>
  primarySuit: O.Option<Suit>
  secondarySuit: O.Option<Suit>,
}
export const zeroContext : BidContext = {
  bid: {} as Bid,
  path: [],
  force: O.none,
  primarySuit: O.none,
  secondarySuit: O.none
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export const contextL = Lens.fromProp<BidContext>()
export const bidL = contextL('bid')
export const pathL = contextL('path')
export const forceL = contextL('force')
export const primarySuitL = contextL('primarySuit')
export const secondarySuitL = contextL('secondarySuit')
export const contextO = Optional.fromOptionProp<BidContext>()
export const forceO = contextO('force')
export const primarySuitO = contextO('primarySuit')
export const secondarySuitO = contextO('secondarySuit')

export type ConstraintS<X, C> = S.State<X, C>
export type SatisfiesS<X, C, A> = (c: ConstraintS<X, C>) => S.State<X, P.Predicate<A>>
const quantifierS = <A>(quantifier: (c: ReadonlyArray<P.Predicate<A>>) => P.Predicate<A>) => <X, C>(satisfies: SatisfiesS<X, C, A>) =>
  flow(
    S.traverseArray(satisfies),
    S.map(quantifier))
const existsS = <X, C, A>(satisfies: SatisfiesS<X, C, A>) => quantifierS<A>(exists)(satisfies)
const forallS = <X, C, A>(satisfies: SatisfiesS<X, C, A>) => quantifierS<A>(forall)(satisfies)

export const ofS = <A>(x: A) => S.of<BidContext, A>(x)

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

export const satisfiesS : SatisfiesS<BidContext, Constraint, Hand> = s =>
  pipe(s,
    S.map(separate),
    S.chain(E.fold(
      flow(S.of, satisfiesContextual(satisfiesS)),
      flow(S.flap, f => f(ofS(satisfiesBasic))))))

const satisfiesWithContext = (x: Constraint) =>
  pipe(x, S.of, satisfiesS)
  
export const satisfies =
  flow(satisfiesWithContext, S.evaluate(zeroContext))

