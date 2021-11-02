import { boolean, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, state as S } from 'fp-ts';
import { constFalse, flow, identity, pipe } from 'fp-ts/lib/function';

import { Bid, eqBid } from '../bridge';
import { Hand } from '../deck';
import { BidContext, bidL, ConstrainedBid, Constraint, ConstraintS, constraintTrue, forceL, pathL, satisfiesS, zeroContext } from './core';

module Gen {
  export function* alternate<A>(opener: A, responder: A) {
    while (true) { yield opener; yield responder }
  }

  export const unfold = (length: number) => <A>(g: Generator<A>) : readonly A[] => {
    const val = g.next()
    return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
  }
}

const specialRelayCase = (bid: Bid) => (s: ConstraintS<BidContext, Constraint>) =>
  pipe(s,
    S.bindTo('constraint'),
    S.bind('relay', ({ constraint }) =>
      S.gets(flow(
        forceL.get,
        O.fold(constFalse, force =>
          constraint.type === "Constant" && !constraint.value && force.type === "Relay" && eqBid.equals(force.bid, bid))))),
    S.map(s => s.relay ? constraintTrue() : s.constraint))

const preTraversal = (info: ConstrainedBid) =>
  pipe(
    // S.modify(peersL.set(info.siblings)),
    // S.chain(() => S.modify(bidL.set(info.bid))),
    S.modify(bidL.set(info.bid)),
    S.map(() => info.constraint))

const postTraversal = <A>(info: ConstrainedBid) =>
    S.chain((s: A) => pipe(
      S.modify(pathL.modify(RA.prepend(info.bid))),
      S.map(() => s)))
  
export const satisfiesPath = (opener: Hand, responder: Hand) => (path: RNEA.ReadonlyNonEmptyArray<ConstrainedBid>) =>
  pipe(
    Gen.alternate(opener, responder),
    Gen.unfold(path.length),
    RA.zip(path),
    S.traverseArray(([hand, cb]) =>
      pipe(
        preTraversal(cb),
        specialRelayCase(cb.bid),
        satisfiesS,
        S.flap(hand),
        postTraversal(cb))),
    S.map(RA.foldMap(boolean.MonoidAll)(identity)),
    S.evaluate(zeroContext))