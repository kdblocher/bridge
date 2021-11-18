import { boolean, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, state as S } from 'fp-ts';
import { constVoid, flow, identity, pipe } from 'fp-ts/lib/function';

import * as Gen from '../../lib/gen';
import { eqBid } from '../bridge';
import { Hand } from '../deck';
import {
    BidContext, bidL, ConstrainedBid, Constraint, constraintTrue, forceO, ofS, partnershipsL, pathL, playersL, relativePartnerships, relativePlayers, rotateRecord, satisfiesS, zeroContext
} from './core';

const specialRelayCase = (s: S.State<BidContext, Constraint>) =>
  pipe(s,
    S.bindTo('constraint'),
    S.apS('force', S.gets(forceO.getOption)),
    S.apS('bid', S.gets(bidL.get)),
    S.map(info =>
      pipe(info.force,
        O.chain(O.fromPredicate(force =>
          info.constraint.type === "Constant" && !info.constraint.value && force.type === "Relay" && eqBid.equals(force.bid, info.bid))),
        O.fold(() => info.constraint, constraintTrue))))

const rotateRelativeContexts : S.State<BidContext, void> =
  pipe(
    S.sequenceArray([
      pipe(S.gets(playersL.get), S.chain(flow(rotateRecord(relativePlayers), playersL.set, S.modify))),
      pipe(S.gets(partnershipsL.get), S.chain(flow(rotateRecord(relativePartnerships), partnershipsL.set, S.modify)))
    ]),
    S.map(constVoid))

export const satisfiesPath = (opener: Hand, responder: Hand) => (path: RNEA.ReadonlyNonEmptyArray<ConstrainedBid>) =>
  pipe(
    Gen.alternate(opener, responder),
    Gen.unfold(path.length),
    RA.zip(path),
    S.traverseArray(([hand, info]) =>
      pipe(
        ofS(info.constraint),
        S.chainFirst(() => S.modify(bidL.set(info.bid))),
        specialRelayCase,
        satisfiesS,
        S.flap(hand),
        S.apFirst(rotateRelativeContexts),
        S.apFirst(S.modify(pathL.modify(RA.prepend(info.bid)))))),
    S.map(RA.foldMap(boolean.MonoidAll)(identity)),
    S.evaluate(zeroContext))