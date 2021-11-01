import {
    boolean, either as E, eq, hkt, identity as id, number, option as O, optionT, ord, predicate as P, readonlyArray as RA, readonlyMap, readonlyNonEmptyArray as RNEA, readonlyRecord, readonlySet,
    readonlyTuple, record, state as S, string
} from 'fp-ts';
import { eqStrict } from 'fp-ts/lib/Eq';
import { constant, constFalse, constTrue, constVoid, flow, identity, pipe } from 'fp-ts/lib/function';
import { fromTraversable, Lens, lens, Optional } from 'monocle-ts';

import { assertUnreachable, debug } from '../lib';
import {
    Bid, ContractBid, eqBid, eqShape, getHandShape, getHandSpecificShape, getHcp, groupHandBySuit, isContractBid, isGameLevel, isSlamLevel, makeShape, ordContractBid, Shape as AnyShape, SpecificShape
} from './bridge';
import { eqRank, eqSuit, Hand, honors, ordRankAscending, Rank, Suit, suits } from './deck';
import { BidInfo, BidPath, BidTree, getAllLeafPaths } from './system';

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

export interface ConstraintSuitHonors {
  type: "SuitHonors",
  suit: Suit,
  honors: ReadonlyArray<Rank>
}

export interface ConstraintSuitTop {
  type: "SuitTop",
  suit: Suit,
  count: number,
  minRank: Rank
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

export interface ConstraintOtherwise {
  type: "Otherwise"
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

export interface ConstraintLabelDef {
  type: "LabelDef"
  name: string
  constraint: Constraint
}

export interface ConstraintLabelRef {
  type: "LabelRef"
  name: string
}

export type Constraint =
  | ConstraintConst
  | ConstraintConjunction
  | ConstraintDisjunction
  | ConstraintNegation
  | ConstraintOtherwise
  | ConstraintOtherBid
  | ConstraintPointRange
  | ConstraintSuitRange
  | ConstraintSuitComparison
  | ConstraintSuitRank
  | ConstraintSuitHonors
  | ConstraintSuitTop
  | ConstraintDistribution
  | ConstraintAnyShape
  | ConstraintSpecificShape
  | ConstraintForce
  | ConstraintLabelDef
  | ConstraintLabelRef

const contextualConstraintTypes = [
  "Conjunction",
  "Disjunction",
  "Negation",
  "Otherwise",
  "OtherBid",
  "ForceOneRound",
  "ForceGame",
  "ForceSlam",
  "Relay",
  "SuitPrimary",
  "SuitSecondary",
  "LabelDef",
  "LabelRef"
] as const

type ContextualConstraintType = typeof contextualConstraintTypes[number]
type BasicConstraint = Exclude<Constraint, { type: ContextualConstraintType }>
type ContextualConstraint = Extract<Constraint, { type: ContextualConstraintType }>

const isContextualConstraint = (c: Constraint) : c is ContextualConstraint =>
  RA.elem(string.Eq as eq.Eq<Constraint["type"]>)(c.type)(contextualConstraintTypes)

const separate = (c: Constraint) : E.Either<ContextualConstraint, BasicConstraint> =>
  isContextualConstraint(c) ? E.left(c) : E.right(c as BasicConstraint)

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
const peersT = pipe(peersL,
  lens.composeTraversal(fromTraversable(RA.Traversable)<ConstrainedBid>()))
const labelsL = contextL('labels')
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

const labelDef = <A>(recur: (c: S.State<X, C>) => S.State<X, A>) => (c: ConstraintLabelDef) =>
  pipe(
    S.gets(flow(
      labelsL.get,
      readonlyMap.lookup(string.Eq)(c.name))),
    S.chain(O.fold(
      () => ofS(c.constraint),
      S.chain(c0 => ofS({ type: "Conjunction", constraints: [c0, c.constraint] } as const)))),
    S.chain(constraint => pipe(
      S.modify(labelsL.modify(readonlyMap.upsertAt(string.Eq)(c.name, ofS(constraint)))),
      S.chain(() => recur(ofS(constraint))))))

const labelRef = <A>(recur: (c: S.State<X, C>) => S.State<X, A>) => (c: ConstraintLabelRef) : S.State<X, O.Option<A>>  =>
  pipe(
    S.gets(flow(
      labelsL.get, 
      readonlyMap.lookup(string.Eq)(c.name))),
    optionT.alt(S.Monad)(() => pipe(
      S.get<BidContext>(),
      S.map(context => pipe(
        S.gets(peersL.get),
        debug,
        S.chain(RA.traverse(S.Applicative)(s => pipe(s.constraint, ofS, recur))),
        S.chain(() => S.gets(flow(
          labelsL.get,
          readonlyMap.lookup(string.Eq)(c.name)))),
        S.evaluate(context))))),
    S.chain(O.sequence(S.Applicative)),
    S.chain(O.traverse(S.Applicative)(x => recur(ofS(x)))))

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
    case "SuitTop":
      return suitTop(c)
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

const ofS = <T>(x: T) => S.of<BidContext, T>(x)

const satisfiesContextual : SatisfiesT2<S.URI, ContextualConstraint> = recur =>
  S.chain(c => {
    switch (c.type) {
      case "Conjunction":
        return pipe(c.constraints, RNEA.map(ofS), forallT(recur))
      case "Disjunction":
        return pipe(c.constraints, RNEA.map(ofS), existsT(recur))
      case "Negation": 
        return pipe(c.constraint, ofS, recur, S.map(P.not))
        
      case "Otherwise":
        return pipe(
          S.gets((context: BidContext) =>
            pipe(context,
              peersL.get,
              // stops cycles, since bids can only check upwards
              RA.takeLeftWhile(b => !eqBid.equals(b.bid, context.bid)))),
          S.chain(flow(
            RA.map(cb => pipe(
              S.modify(bidL.set(cb.bid)),
              S.map(() => cb.constraint))),
            forallT(flow(recur, S.map(P.not))))))

      case "OtherBid":
        return pipe(
          S.gets(flow(
            peersL.get,
            RA.findFirst(b => eqBid.equals(b.bid, c.bid)))),
          S.chain(O.fold(
            () => ofS(constraintFalse),
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

      case "LabelDef":
        return pipe(c, labelDef(recur))
      case "LabelRef":
        return pipe(c, labelRef(recur),
          S.map(O.getOrElse(() => constraintFalse)))
        
      default:
        return assertUnreachable(c)
    }
  })

const satisfiesS : ReturnType<SatisfiesT2<S.URI, Constraint>> = s =>
  pipe(s,
    S.map(separate),
    S.chain(E.fold(
      flow(S.of, satisfiesContextual(satisfiesS)),
      right => pipe(S.of<X, typeof satisfiesBasic>(satisfiesBasic), S.ap(S.of(right))))))

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

const specialRelayCase = (bid: Bid) => (s: S.State<BidContext, Constraint>) =>
  pipe(s,
    S.bindTo('constraint'),
    S.bind('relay', ({ constraint }) =>
      S.gets(flow(
        forceL.get,
        O.fold(constFalse, force =>
          constraint.type === "Constant" && !constraint.value && force.type === "Relay" && eqBid.equals(force.bid, bid))))),
    S.map(s => s.relay ? constConstraintTrue() : s.constraint))

const preTraversal = (info: BidInfo) =>
  pipe(
    S.modify(peersL.set(info.siblings)),
    S.chain(() => S.modify(bidL.set(info.bid))),
    S.map(() => info.constraint))

const postTraversal = <A>(info: BidInfo) =>
    S.chain((s: A) => pipe(
      S.modify(pathL.modify(RA.prepend(info.bid))),
      S.map(() => s)))
  
export const satisfiesPath = (opener: Hand, responder: Hand) => (path: BidPath) =>
  pipe(
    Gen.alternate(opener, responder),
    Gen.unfold(path.length),
    RA.zip(path),
    S.traverseArray(([hand, info]) =>
      pipe(
        preTraversal(info),
        flow(
          specialRelayCase(info.bid),
          satisfiesS),
        S.ap(S.of(hand)),
        postTraversal(info))),
    S.map(RA.foldMap(boolean.MonoidAll)(identity)),
    S.evaluate(zeroContext))

// Only use for one-off checks, as it doesn't descend the entire bid tree
export const satisfiesPathWithoutSiblingCheck = (opener: Hand, responder: Hand) =>
  flow(RNEA.map((x: ConstrainedBid) => ({ ...x, siblings: [] })), satisfiesPath(opener, responder))

const ordBid: ord.Ord<Bid> =
  ord.fromCompare((a, b) =>
    isContractBid(a) && !isContractBid(b) ? -1 :
    isContractBid(b) && !isContractBid(a) ? 1 :
    isContractBid(a) && isContractBid(b) ? ordContractBid.compare(a, b) :
    0)

const ordConstrainedBid = ord.contramap<Bid, ConstrainedBid>(b => b.bid)(ordBid)

interface SystemValidationErrorBidsOutOfOrder {
  type: "BidsOutOfOrder"
  left: ConstrainedBid
  right: ConstrainedBid
}
interface SystemValidationErrorOtherBidNotFound {
  type: "OtherBidNotFound"
  constraint: Constraint
}
interface SystemValidationErrorNoPrimaryBidDefined {
  type: "NoPrimaryBidDefined"
  constraint: Constraint
}
interface SystemValidationErrorLabelNotFound {
  type: "LabelNotFound"
  constraint: Constraint
}
interface SystemValidationErrorPassWhileForcing {
  type: "PassWhileForcing",
  bid: Bid
}
interface SystemValidationErrorNoBidDefinedButStillForcing {
  type: "NoBidDefinedButStillForcing",
  path: ReadonlyArray<Bid>
}

type SystemValidationBidReason =
  | SystemValidationErrorOtherBidNotFound
  | SystemValidationErrorNoPrimaryBidDefined
  | SystemValidationErrorLabelNotFound
type SystemValidationBidError = SystemValidationBidReason & {
  bid: Bid
}

type SystemValidationError =
  | SystemValidationBidError
  | SystemValidationErrorBidsOutOfOrder
  | SystemValidationErrorPassWhileForcing
  | SystemValidationErrorNoBidDefinedButStillForcing

type SystemValidation = E.Either<SystemValidationError, void>
type ValidateResult = S.State<BidContext, SystemValidation>

const bidPathSorted = (path: BidPath): SystemValidation =>
  pipe(path,
    RA.zip(RNEA.tail(path)),
    RA.traverse(E.Applicative)(([left, right]) =>
      !ord.lt(ordConstrainedBid)(left, right)
      ? E.left({ type: "BidsOutOfOrder" as const, left, right })
      : E.right(constVoid())),
    E.map(constVoid))

const bidTreeSorted = (path: BidTree) =>
  pipe(path,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(bidPathSorted),
    E.map(constVoid))

export const validateS = (s: S.State<BidContext, Constraint>): S.State<BidContext, E.Either<SystemValidationBidError, void>> =>
  pipe(s, S.chain(c => {
    if (isContextualConstraint(c)) {
      switch (c.type) {
        case "Conjunction":
        case "Disjunction":
          return pipe(c.constraints,
            RNEA.map(ofS),
            S.traverseArray(validateS),
            S.map(flow(
              RA.sequence(E.Applicative),
              E.map(constVoid))))
        case "Negation": 
          return pipe(c.constraint, ofS, validateS)
        
        case "Otherwise":
          return S.of(E.right(constVoid()))
        case "OtherBid":
          return pipe(
            S.gets(flow(
              peersL.get,
              RA.map(cb => cb.bid),
              debug,
              E.fromPredicate(RA.elem(eqBid)(c.bid), (): SystemValidationBidReason => ({ type: "OtherBidNotFound", constraint: c })),
              E.map(constVoid))))
        
        case "ForceOneRound":
        case "ForceGame":
        case "ForceSlam":
        case "Relay":
          return pipe(
            S.modify(forceL.set(O.some(c))),
            S.map(() => E.right(constVoid())))

        case "SuitPrimary":
          return pipe(
            S.modify(primarySuitL.set(O.some(c.suit))),
            S.map(() => E.right(constVoid())))
        case "SuitSecondary":
          return pipe(
            S.modify(secondarySuitL.set(O.some(c.suit))),
            S.chain(() => S.gets(context => context.primarySuit)),
            S.map(flow(
              E.fromOption((): SystemValidationBidReason => ({ type: "NoPrimaryBidDefined", constraint: c })),
              E.map(constVoid))))
              
        case "LabelDef":
          return pipe(c, labelDef(validateS))
        case "LabelRef":
          return pipe(c, labelRef(validateS),
            S.map(O.getOrElseW(() => E.left<SystemValidationBidReason>({ type: "LabelNotFound", constraint: c }))))
            
        default:
          return assertUnreachable(c)
      }
    } else {
      return S.of(E.right(constVoid()))
    }
  }),
  S.chain(e => pipe(
    S.gets(bidL.get),
    S.map(bid => pipe(e, E.mapLeft(r => ({ bid: bid, ...r })))))))
   

const resetForce = S.modify(forceL.set(O.none))
const continueForce: typeof resetForce = S.of(constVoid())
const updateForce = (bid: Bid) => (force: ConstraintForce) => {
  switch (force.type) {
    case "ForceOneRound":
    case "Relay":
      return resetForce
    case "ForceGame":
      return isGameLevel(bid) ? resetForce : continueForce
    case "ForceSlam":
      return isSlamLevel(bid) ? resetForce : continueForce
    default:
      return assertUnreachable(force)
  }
}

const updateForceS : <A>(s: S.State<BidContext, A>) => S.State<BidContext, A> =
  flow(
    S.bindTo('result'),
    S.apS('bid', S.gets(bidL.get)),
    S.apS('force', S.gets(forceO.getOption)),
    S.chain(({ bid, force, result }) =>
      pipe(force,
        O.traverse(S.Applicative)(updateForce(bid)),
        S.map(() => result))))

const checkPass = (bid: Bid) => (force: O.Option<ConstraintForce>) =>
  !(bid === "Pass" && O.isSome(force))

const checkPassS : (s: S.State<BidContext, Constraint>) => ValidateResult =
  flow(
    S.apS('bid', S.gets(bidL.get)),
    S.apS('force', S.gets(forceL.get)),
    S.map(({ bid, force }) =>
      pipe(force,
        E.fromPredicate(checkPass(bid), () => ({ type: "PassWhileForcing" as const, bid })),
        E.map(constVoid))))

const checkFinal : ValidateResult =
  pipe(
    S.gets(forceO.getOption),
    S.bindTo('force'),  
    S.apS('path', S.gets(pathL.get)),
    S.map(({ force, path }) => pipe(force,
      E.fromPredicate(O.isNone, () => ({ type: "NoBidDefinedButStillForcing", path } as const)),
      E.map(constVoid))))

const pathIsSound = (path: BidPath) =>
  pipe(path,
    S.traverseArray(info =>
      pipe(
        preTraversal(info),
        S.bindTo('constraint'),
        S.bind('forceCheck', ({ constraint }) => checkPassS(S.of(constraint))),
        S.chain(({ constraint, forceCheck }) =>
          pipe(forceCheck,
            E.traverse(S.Applicative)(() =>
              pipe(S.of<BidContext, Constraint>(constraint),
                updateForceS,
                validateS,
                postTraversal(info))),
            S.map(e => E.flatten<SystemValidationError, void>(e)))))),
    S.bindTo('result'),
    S.apS('finalCheck', checkFinal),
    S.map(({ result, finalCheck }) =>
      pipe(result,
        RA.prepend(finalCheck),
        RA.sequence(E.Applicative),
        E.map(constVoid))),
    S.evaluate(zeroContext))

const treeIsSound = (tree: BidTree) : SystemValidation =>
  pipe(tree,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(pathIsSound),
    E.map(constVoid))

export const validateTree = (tree: BidTree) =>
  pipe(tree,
    bidTreeSorted,
    E.chain(() => treeIsSound(tree)))