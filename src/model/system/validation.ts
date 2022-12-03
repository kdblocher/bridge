import { either as E, ord, readonlyArray as RA, readonlyNonEmptyArray as RNEA } from 'fp-ts';
import { apply, constVoid, pipe } from 'fp-ts/lib/function';

import { Bid } from '../bridge';
import { Forest, getAllLeafPaths, Path } from '../system';
import { ConstrainedBid, ordConstrainedBid } from './core';

interface SystemValidationErrorBidsOutOfOrder {
  type: "BidsOutOfOrder"
  left: ConstrainedBid
  right: ConstrainedBid
}

// interface SystemValidationErrorPrimarySuitAlreadyDefined {
//   type: "PrimarySuitAlreadyDefined"
//   constraint: ConstraintSuitPrimary
// }
// interface SystemValidationErrorSamePrimaryAndSecondarySuit {
//   type: "SamePrimaryAndSecondarySuit"
//   constraint: ConstraintSuitSecondary
// }
// interface SystemValidationErrorTrumpSuitAlreadyDefined {
//   type: "TrumpSuitAlreadyDefined"
//   constraint: ConstraintSetTrump
// }
// interface SystemValidationErrorSuitRangeInvalid {
//   type: "SuitRangeInvalid",
//   constraint: ConstraintSuitRange
// }
// interface SystemValidationErrorPointRangeInvalid {
//   type: "PointRangeInvalid",
//   constraint: ConstraintPointRange
// }
// interface SystemValidationErrorSpecificShapeInvalid {
//   type: "SpecificShapeInvalid",
//   constraint: ConstraintSpecificShape
// }

// interface SystemValidationErrorAnyShapeInvalid {
//   type: "AnyShapeInvalid",
//   constraint: ConstraintAnyShape
// }
// interface SystemValidationErrorPassWhileForcing {
//   type: "PassWhileForcing",
//   bid: Bid
// }
// interface SystemValidationErrorNoBidDefinedButStillForcing {
//   type: "NoBidDefinedButStillForcing",
//   path: ReadonlyArray<Bid>
// }

// interface SystemValidationErrorIllegalContextModification {
//   type: "IllegalContextModification"
// }

// type SystemValidationBidReason =
//   | SystemValidationErrorNoPrimarySuitDefined
//   | SystemValidationErrorPrimarySuitAlreadyDefined
//   | SystemValidationErrorSamePrimaryAndSecondarySuit
//   | SystemValidationErrorTrumpSuitAlreadyDefined
//   | SystemValidationErrorSuitRangeInvalid
//   | SystemValidationErrorPointRangeInvalid
//   | SystemValidationErrorSpecificShapeInvalid
//   | SystemValidationErrorAnyShapeInvalid
//   | SystemValidationErrorIllegalContextModification
// type SystemValidationBidError = SystemValidationBidReason & {
//   bid: Bid
// }

export type SystemValidationError =
  
  // ( SystemValidationBidError
  (| SystemValidationErrorBidsOutOfOrder )
  // | SystemValidationErrorPassWhileForcing
  // | SystemValidationErrorNoBidDefinedButStillForcing)
  & { path: ReadonlyArray<Bid> }

type SystemValidation = E.Either<SystemValidationError, void>
// type ValidateReasonResult = S.State<BidContext, E.Either<SystemValidationBidReason, void>>
// type ValidateResult = S.State<BidContext, SystemValidation>

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

// const resetForce = S.modify(forceL.set(O.none))
// const continueForce: typeof resetForce = S.of(constVoid())
// const updateForce = (bid: Bid) => (force: ConstraintForce) => {
//   switch (force.type) {
//     case "ForceOneRound":
//     case "Relay":
//       return resetForce
//     case "ForceGame":
//       return isGameLevel(bid) ? resetForce : continueForce
//     case "ForceSlam":
//       return isSlamLevel(bid) ? resetForce : continueForce
//     default:
//       return assertUnreachable(force)
//   }
// }

// const updateForceS : S.State<BidContext, void> =
//   pipe(
//     updateForce, ofS,
//     S.ap(S.gets(bidL.get)),
//     S.map(O.of),
//     optionT.ap(S.Apply)(S.gets(forceL.get)),
//     S.chain(O.sequence(S.Applicative)),
//     S.map(constVoid))

// const rotateRelativeContexts : S.State<BidContext, void> =
//   pipe(
//     S.sequenceArray([
//       pipe(S.gets(playersL.get), S.chain(flow(rotateRecord(relativePlayers), playersL.set, S.modify))),
//       pipe(S.gets(partnershipsL.get), S.chain(flow(rotateRecord(relativePartnerships), partnershipsL.set, S.modify)))
//     ]),
//     S.map(constVoid))

// const checkPass = (bid: Bid) => (force: O.Option<ConstraintForce>) =>
//   !(bid === "Pass" && O.isSome(force))

// const checkPassS : ValidateResult =
//   pipe(
//     ofS(checkPass),
//     S.ap(S.gets(bidL.get)),
//     S.ap(S.gets(forceO.getOption)),
//     S.chain(boolean.fold(
//       flow(() => ofS({}),
//         S.apS('bid', S.gets(bidL.get)),
//         S.apS('path', S.gets(pathL.get)),
//         S.map(({ bid, path }) =>
//         E.left({ type: "PassWhileForcing" as const, bid, path }))),
//       flow(constVoid, E.right, ofS))))

// const checkFinal : ValidateResult =
//   pipe(
//     S.gets(forceO.getOption),
//     S.bindTo('force'),  
//     S.apS('path', S.gets(pathL.get)),
//     S.map(({ force, path }) => pipe(force,
//       E.fromPredicate(O.isNone, () => ({ type: "NoBidDefinedButStillForcing", path } as const)),
//       E.map(constVoid))))

// const pathIsSound = (path: Path<ConstrainedBid>) =>
//   pipe(path,
//     S.traverseArray(info =>
//       pipe(
//         S.modify(bidL.set(info.bid)),
//         S.chain(() => checkPassS),
//         S.chain(E.traverse(S.Applicative)(() =>
//           pipe(ofS(info.constraint),
//             S.apFirst(updateForceS),
//             S.chain(validateS),
//             S.map(E.mapLeft((r): SystemValidationBidError => ({ bid: info.bid, ...r })))))),
//         S.apFirst(S.modify(pathL.modify(RA.prepend(info.bid)))),
//         S.apFirst(rotateRelativeContexts),
//         S.map(flow(
//           E.map(E.mapLeft((err): SystemValidationError => ({ ...err, path: pipe(path, RA.map(b => b.bid)) }))),
//           E.flatten)))),
//     S.map(RA.sequence(E.Applicative)),
//     eitherT.chain(S.Monad)(() => checkFinal),
//     S.evaluate(zeroValidationContext))

// const forestIsSound = (tree: Forest<ConstrainedBid>) : SystemValidation =>
//   pipe(tree,
//     getAllLeafPaths,
//     RA.traverse(E.Applicative)(flow(
//       pathIsSound,
//       E.mapLeft((path): SystemValidationError => ({ type: "SAT", path })))),
//     E.map(constVoid))

export const validateForest = (forest: Forest<ConstrainedBid>) =>
  pipe([forestSorted], //forestIsSound],
    RA.traverse(E.Applicative)(apply(forest)),
    E.map(constVoid))