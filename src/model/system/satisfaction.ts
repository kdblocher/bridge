import { boolean, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, state as S } from 'fp-ts';
import { identity, pipe } from 'fp-ts/lib/function';

import { eqBid } from '../bridge';
import { Hand } from '../deck';
import { BidContext, bidL, ConstrainedBid, Constraint, constraintTrue, forceO, ofS, pathL, satisfiesS, zeroContext } from './core';

module Gen {
  export function* alternate<A>(opener: A, responder: A) {
    while (true) { yield opener; yield responder }
  }

  export const unfold = (length: number) => <A>(g: Generator<A>) : readonly A[] => {
    const val = g.next()
    return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
  }
}

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
        S.chainFirst(() => S.modify(pathL.modify(RA.prepend(info.bid)))))),
    S.map(RA.foldMap(boolean.MonoidAll)(identity)),
    S.evaluate(zeroContext))