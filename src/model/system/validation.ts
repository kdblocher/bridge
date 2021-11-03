import { boolean, either as E, eitherT, number, option as O, optionT, ord, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord, state as S } from 'fp-ts';
import { apply, constVoid, flow, identity, pipe } from 'fp-ts/lib/function';

import { assertUnreachable } from '../../lib';
import { Bid, isGameLevel, isSlamLevel } from '../bridge';
import { Forest, getAllLeafPaths, Path } from '../system';
import { BidContext, bidL, ConstrainedBid, Constraint, ConstraintForce, ConstraintS, forceL, forceO, ofS, ordConstrainedBid, pathL, primarySuitL, secondarySuitL, zeroContext } from './core';

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
interface SystemValidationErrorRangeInvalid {
  type: "RangeInvalid",
  constraint: Constraint
}
interface SystemValidationErrorShapeInvalid {
  type: "ShapeInvalid",
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
  | SystemValidationErrorRangeInvalid
  | SystemValidationErrorShapeInvalid
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

const bidPathSorted = (path: Path<ConstrainedBid>): SystemValidation =>
  pipe(path,
    RA.zip(RNEA.tail(path)),
    RA.traverse(E.Applicative)(([left, right]) =>
      !ord.lt(ordConstrainedBid)(left, right)
      ? E.left({ type: "BidsOutOfOrder" as const, left, right })
      : E.right(constVoid())),
    E.map(constVoid))

const forestSorted = (tree: Forest<ConstrainedBid>) =>
  // The sibling nodes do NOT need to be sorted
  pipe(tree,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(bidPathSorted),
    E.map(constVoid))

export type ValidateS<X, C, E, A> = (c: ConstraintS<X, C>) => S.State<X, E.Either<E, A>>

export const validateS : ValidateS<BidContext, Constraint, SystemValidationBidError, void> = constraint =>
  pipe(constraint, S.chain(c => {
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

      case "PointRange":
      case "SuitRange":
        return pipe(c,
          E.fromPredicate(c => c.min <= c.max,
            (): SystemValidationBidReason => ({ type: "RangeInvalid", constraint: c })),
          E.map(constVoid),
          ofS)
          
      case "SpecificShape":
        return pipe(c.suits,
          readonlyRecord.foldMap(ord.trivial)(number.MonoidSum)(identity),
          E.fromPredicate(n => n === 13,
            (): SystemValidationBidReason => ({ type: "ShapeInvalid", constraint: c })),
          E.map(constVoid),
          ofS)
          case "AnyShape":
        return pipe(c.counts,
          RA.foldMap(number.MonoidSum)(identity),
          E.fromPredicate(n => n === 13,
            (): SystemValidationBidReason => ({ type: "ShapeInvalid", constraint: c })),
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
  }),
  S.chain(e => pipe(
    S.gets<BidContext, Bid>(bidL.get),
    S.map(bid => pipe(e, E.mapLeft(r => ({ bid, ...r })))))))
   

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

const updateForceS : S.State<BidContext, void> =
  pipe(
    updateForce, ofS,
    S.ap(S.gets(bidL.get)),
    S.map(O.of),
    optionT.ap(S.Apply)(S.gets(forceL.get)),
    S.chain(O.sequence(S.Applicative)),
    S.map(constVoid))

const checkPass = (bid: Bid) => (force: O.Option<ConstraintForce>) =>
  !(bid === "Pass" && O.isSome(force))

const checkPassS : ValidateResult =
  pipe(
    ofS(checkPass),
    S.ap(S.gets(bidL.get)),
    S.ap(S.gets(forceO.getOption)),
    S.chain(boolean.fold(
      flow(() => S.gets(bidL.get), S.map(bid =>
        E.left({ type: "PassWhileForcing" as const, bid }))),
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
            S.chainFirst(() => updateForceS),
            validateS))),
        S.chainFirst(() => S.modify(pathL.modify(RA.prepend(info.bid)))),
        S.map(e => E.flatten<SystemValidationError, void>(e)))),
    S.map(RA.sequence(E.Applicative)),
    eitherT.chain(S.Monad)(() => checkFinal),
    S.evaluate(zeroContext))

const forestIsSound = (tree: Forest<ConstrainedBid>) : SystemValidation =>
  pipe(tree,
    getAllLeafPaths,
    RA.traverse(E.Applicative)(pathIsSound),
    E.map(constVoid))

export const validateTree = (forest: Forest<ConstrainedBid>) =>
  pipe([forestSorted, forestIsSound],
    RA.traverse(E.Applicative)(apply(forest)),
    E.map(constVoid))