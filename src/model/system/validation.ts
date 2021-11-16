import { boolean, either as E, eitherT, number, option as O, optionT, ord, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, state as S } from 'fp-ts';
import { apply, constVoid, flow, identity, pipe } from 'fp-ts/lib/function';
import { At, Lens, Optional } from 'monocle-ts';

import { assertUnreachable } from '../../lib';
import { Bid, isGameLevel, isSlamLevel } from '../bridge';
import { Forest, getAllLeafPaths, Path } from '../system';
import {
    BidContext, ConstrainedBid, Constraint, ConstraintAnyShape, ConstraintForce, ConstraintPointRange, ConstraintSpecificShape, ConstraintSuitPrimary, ConstraintSuitRange, ConstraintSuitSecondary, ordConstrainedBid, PlayerContext, primarySuitL, relativePartnerships, RelativePlayer, relativePlayers,
    rotateRecord, secondarySuitL, zeroContext as zeroBidContext
} from './core';

interface SystemValidationErrorBidsOutOfOrder {
  type: "BidsOutOfOrder"
  left: ConstrainedBid
  right: ConstrainedBid
}
interface SystemValidationErrorNoPrimarySuitDefined {
  type: "NoPrimarySuitDefined"
  constraint: ConstraintSuitSecondary
}
interface SystemValidationErrorPrimarySuitAlreadyDefined {
  type: "PrimarySuitAlreadyDefined"
  constraint: ConstraintSuitPrimary
}
interface SystemValidationErrorSamePrimaryAndSecondarySuit {
  type: "SamePrimaryAndSecondarySuit"
  constraint: ConstraintSuitSecondary
}
interface SystemValidationErrorSuitRangeInvalid {
  type: "SuitRangeInvalid",
  constraint: ConstraintSuitRange
}
interface SystemValidationErrorPointRangeInvalid {
  type: "PointRangeInvalid",
  constraint: ConstraintPointRange
}
interface SystemValidationErrorSpecificShapeInvalid {
  type: "SpecificShapeInvalid",
  constraint: ConstraintSpecificShape
}

interface SystemValidationErrorAnyShapeInvalid {
  type: "AnyShapeInvalid",
  constraint: ConstraintAnyShape
}
interface SystemValidationErrorPassWhileForcing {
  type: "PassWhileForcing",
  bid: Bid
}
interface SystemValidationErrorNoBidDefinedButStillForcing {
  type: "NoBidDefinedButStillForcing",
  path: ReadonlyArray<Bid>
}

interface SystemValidationErrorIllegalContextModification {
  type: "IllegalContextModification"
}

type SystemValidationBidReason =
  | SystemValidationErrorNoPrimarySuitDefined
  | SystemValidationErrorPrimarySuitAlreadyDefined
  | SystemValidationErrorSamePrimaryAndSecondarySuit
  | SystemValidationErrorSuitRangeInvalid
  | SystemValidationErrorPointRangeInvalid
  | SystemValidationErrorSpecificShapeInvalid
  | SystemValidationErrorAnyShapeInvalid
  | SystemValidationErrorIllegalContextModification
type SystemValidationBidError = SystemValidationBidReason & {
  bid: Bid
}

export type SystemValidationError =
  ( SystemValidationBidError
  | SystemValidationErrorBidsOutOfOrder
  | SystemValidationErrorPassWhileForcing
  | SystemValidationErrorNoBidDefinedButStillForcing)
  & { path: ReadonlyArray<Bid> }

type EffectContext =
  | "Open"
  | "Disjunction"
  | "Negation"
interface ValidateContext extends BidContext {
  effectContext: EffectContext
}
export const zeroValidationContext: ValidateContext = ({
  ...zeroBidContext,
  effectContext: "Open"
})
const ofS = <A>(x: A) => S.of<ValidateContext, A>(x)
const contextL = Lens.fromProp<ValidateContext>()
const effectContextL = contextL('effectContext')
const bidL = contextL('bid')
const pathL = contextL('path')
const forceL = contextL('force')
export const playersL = contextL('players')
export const partnershipsL = contextL('partnerships')
const contextO = Optional.fromOptionProp<ValidateContext>()
const forceO = contextO('force')
export const playerContextA = new At<ValidateContext, RelativePlayer, PlayerContext>(player =>
  new Lens(
    flow(playersL.get, p => p[player]),
    p => context => pipe(context, playersL.get, RR.upsertAt(player, p), playersL.set, apply(context))))

type SystemValidation = E.Either<SystemValidationError, void>
type ValidateReasonResult = S.State<ValidateContext, E.Either<SystemValidationBidReason, void>>
type ValidateResult = S.State<ValidateContext, SystemValidation>

const effectModifyS = (setter: (context: ValidateContext) => ValidateContext): ValidateReasonResult =>
  pipe(S.gets(effectContextL.get),
    S.chain(x => x === "Open"
      ? pipe(S.modify(setter), S.map(() => E.right(constVoid())))
      : S.of(E.left({ type: "IllegalContextModification" }))))

const bidPathSorted = (path: Path<ConstrainedBid>): SystemValidation =>
  pipe(path,
    RA.zip(RNEA.tail(path)),
    RA.traverse(E.Applicative)(([left, right]) =>
      !ord.lt(ordConstrainedBid)(left, right)
      ? E.left({ type: "BidsOutOfOrder" as const, left, right, path: pipe(path, RA.map(cb => cb.bid)) })
      : E.right(constVoid())),
    E.map(constVoid))

const forestSorted = (tree: Forest<ConstrainedBid>) =>
  // The sibling nodes do NOT need to be sorted
  pipe(tree,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(bidPathSorted),
    E.map(constVoid))

const validateConnectiveConstraints = (cs: ReadonlyArray<Constraint>) => (traverseContext: EffectContext) =>
  pipe(
    S.gets(effectContextL.get),
    S.chain(outerContext => pipe(
      S.modify(effectContextL.set(traverseContext)),
      S.map(() => cs),
      S.chain(S.traverseArray(validateS)),
      S.map(flow(
        RA.sequence(E.Applicative),
        E.map(constVoid))),
      S.apFirst(S.modify(effectContextL.set(outerContext))))))

export const validateS = (c: Constraint): ValidateReasonResult => {
  switch (c.type) {
    case "Conjunction":
      return pipe(
        S.gets(effectContextL.get),
        S.chain(validateConnectiveConstraints(c.constraints)))
    case "Disjunction":
      return validateConnectiveConstraints(c.constraints)(c.type)
    case "Negation": 
      return validateConnectiveConstraints(RA.of(c.constraint))(c.type)

    case "ForceOneRound":
    case "ForceGame":
    case "ForceSlam":
    case "Relay":
      return effectModifyS(forceL.set(O.some(c)))

    case "SuitPrimary":
      return pipe(
        S.gets(playerContextA.at("Me").composeLens(primarySuitL).get),
        S.chain(O.fold(
          () => effectModifyS(playerContextA.at("Me").composeLens(primarySuitL).set(O.some(c.suit))),
          () => ofS(E.left({ type: "PrimarySuitAlreadyDefined", constraint: c })))))
    case "SuitSecondary":
      return pipe(
        effectModifyS(playerContextA.at("Me").composeLens(secondarySuitL).set(O.some(c.suit))),
        eitherT.chain(S.Monad)(() => pipe(
          S.gets(playerContextA.at("Me").composeLens(primarySuitL).get),
          S.map(flow(
            E.fromOption((): SystemValidationBidReason => ({ type: "NoPrimarySuitDefined", constraint: c })),
            E.chainFirst(E.fromPredicate(suit => c.suit !== suit, (): SystemValidationBidReason => ({ type: "SamePrimaryAndSecondarySuit", constraint: c }))),
            E.map(constVoid))))))

    case "PointRange":
      return pipe(c,
        E.fromPredicate(c => c.min <= c.max,
          (): SystemValidationBidReason => ({ type: "PointRangeInvalid", constraint: c })),
        E.map(constVoid),
        ofS)
    case "SuitRange":
      return pipe(c,
        E.fromPredicate(c => c.min <= c.max,
          (): SystemValidationBidReason => ({ type: "SuitRangeInvalid", constraint: c })),
        E.map(constVoid),
        ofS)
        
    case "SpecificShape":
      return pipe(c.suits,
        RR.foldMap(ord.trivial)(number.MonoidSum)(identity),
        E.fromPredicate(n => n === 13,
          (): SystemValidationBidReason => ({ type: "SpecificShapeInvalid", constraint: c })),
        E.map(constVoid),
        ofS)
        case "AnyShape":
      return pipe(c.counts,
        RA.foldMap(number.MonoidSum)(identity),
        E.fromPredicate(n => n === 13,
          (): SystemValidationBidReason => ({ type: "AnyShapeInvalid", constraint: c })),
        E.map(constVoid),
        ofS)

    case "Constant":
    case "SuitComparison":
    case "SuitHonors":
    case "SuitTop":
      return ofS(E.right(constVoid()))
        
    default:
      return assertUnreachable(c)
  }
}  

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

const updateForceS : S.State<ValidateContext, void> =
  pipe(
    updateForce, ofS,
    S.ap(S.gets(bidL.get)),
    S.map(O.of),
    optionT.ap(S.Apply)(S.gets(forceL.get)),
    S.chain(O.sequence(S.Applicative)),
    S.map(constVoid))

const rotateRelativeContexts : S.State<ValidateContext, void> =
  pipe(
    S.sequenceArray([
      pipe(S.gets(playersL.get), S.chain(flow(rotateRecord(relativePlayers), playersL.set, S.modify))),
      pipe(S.gets(partnershipsL.get), S.chain(flow(rotateRecord(relativePartnerships), partnershipsL.set, S.modify)))
    ]),
    S.map(constVoid))

const checkPass = (bid: Bid) => (force: O.Option<ConstraintForce>) =>
  !(bid === "Pass" && O.isSome(force))

const checkPassS : ValidateResult =
  pipe(
    ofS(checkPass),
    S.ap(S.gets(bidL.get)),
    S.ap(S.gets(forceO.getOption)),
    S.chain(boolean.fold(
      flow(() => ofS({}),
        S.apS('bid', S.gets(bidL.get)),
        S.apS('path', S.gets(pathL.get)),
        S.map(({ bid, path }) =>
        E.left({ type: "PassWhileForcing" as const, bid, path }))),
      flow(constVoid, E.right, ofS))))

const checkFinal : ValidateResult =
  pipe(
    S.gets(forceO.getOption),
    S.bindTo('force'),  
    S.apS('path', S.gets(pathL.get)),
    S.map(({ force, path }) => pipe(force,
      E.fromPredicate(O.isNone, () => ({ type: "NoBidDefinedButStillForcing", path } as const)),
      E.map(constVoid))))

const pathIsSound = (path: Path<ConstrainedBid>) =>
  pipe(path,
    S.traverseArray(info =>
      pipe(
        S.modify(bidL.set(info.bid)),
        S.chain(() => checkPassS),
        S.chain(E.traverse(S.Applicative)(() =>
          pipe(ofS(info.constraint),
            S.apFirst(updateForceS),
            S.chain(validateS),
            S.map(E.mapLeft((r): SystemValidationBidError => ({ bid: info.bid, ...r })))))),
        S.apFirst(S.modify(pathL.modify(RA.prepend(info.bid)))),
        S.apFirst(rotateRelativeContexts),
        S.map(flow(
          E.map(E.mapLeft((err): SystemValidationError => ({ ...err, path: pipe(path, RA.map(b => b.bid)) }))),
          E.flatten)))),
    S.map(RA.sequence(E.Applicative)),
    eitherT.chain(S.Monad)(() => checkFinal),
    S.evaluate(zeroValidationContext))

const forestIsSound = (tree: Forest<ConstrainedBid>) : SystemValidation =>
  pipe(tree,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(pathIsSound),
    E.map(constVoid))

export const validateTree = (forest: Forest<ConstrainedBid>) =>
  pipe([forestSorted, forestIsSound],
    RA.traverse(E.Applicative)(apply(forest)),
    E.map(constVoid))