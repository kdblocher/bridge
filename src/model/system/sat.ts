import {
    either as E, eq, foldable, monoid, number, optionT, ord, predicate as P, reader as R, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, readonlySet, readonlyTuple, record,
    semigroup, state as S, string
} from 'fp-ts';
import { sequenceT } from 'fp-ts/lib/Apply';
import { apply, flow, identity, pipe } from 'fp-ts/lib/function';
import { HKT, Kind, URIS, URItoKind } from 'fp-ts/lib/HKT';
import * as Logic from 'logic-solver';
import * as At from 'monocle-ts/lib/At';
import * as Lens from 'monocle-ts/lib/Lens';

import { numberTypeAnnotation } from '@babel/types';

import { assertUnreachable } from '../../lib';
import { permute } from '../../lib/array';
import { Suit, suits } from '../deck';
import { AnyShape, SpecificShape } from '../evaluation';
import { BidContext, Constraint, ConstraintForce, RelativePartnership, relativePartnerships, RelativePlayer, relativePlayers, SuitComparisonOperator } from './core';

const getForcingBits = (force: ConstraintForce): Logic.Bits => {
  switch (force.type) {
    // 0 for unspecified
    case "ForceOneRound": return Logic.constantBits(1)
    case "ForceGame": return Logic.constantBits(2)
    case "ForceSlam": return Logic.constantBits(3)
    case "Relay": return Logic.constantBits(4)
  }
}

const getSuitBits = (suit: Suit): Logic.Bits =>
  pipe(suits.indexOf(suit) + 1, Logic.constantBits) // 0-4, 0 = none

const range = (min: number, max: number) => (bits: Logic.Bits) =>
  Logic.and(
    Logic.greaterThanOrEqual(bits, Logic.constantBits(min)),
    Logic.lessThanOrEqual(bits, Logic.constantBits(max)))

const countsTo13 = <F extends URIS>(f: foldable.Foldable1<F>) => (fa: Kind<F, number>) =>
  pipe(
    f.foldMap(number.MonoidSum)(fa, identity),
    b => b === 13 ? Logic.TRUE : Logic.FALSE)

const andAlso = (also: Logic.Formula) => (...formulas: readonly Logic.Formula[]) => 
  Logic.and(also, ...formulas)

const getComparer = (op: SuitComparisonOperator) => {
  switch (op) {
    case "<" : return Logic.lessThan
    case "<=": return Logic.lessThanOrEqual
    case "=" : return Logic.equalBits
    case ">=": return Logic.greaterThanOrEqual
    case ">" : return Logic.greaterThan
    default  : return assertUnreachable(op)
  }
}

interface SuitContext {
  range: Logic.Bits
  top: Logic.Bits
}
const getZeroSuitContext = (prefix: Logic.Term): SuitContext => ({
  range: Logic.variableBits(prefix + ".range", 5),
  top: Logic.variableBits(prefix + ".top", 3)
})
const suitContextL = Lens.id<SuitContext>()
const suitRangeL = pipe(suitContextL, Lens.prop('range'))
const suitTopL = pipe(suitContextL, Lens.prop('top'))

interface PlayerContext {
  hcpRange: Logic.Bits
  primarySuit: Logic.Bits
  secondarySuit: Logic.Bits
  suits: RR.ReadonlyRecord<Suit, SuitContext>
}
const getZeroPlayerContext = (prefix: Logic.Term): PlayerContext => ({
  hcpRange: Logic.variableBits(prefix + ".hcp", 6),
  primarySuit: Logic.variableBits(prefix + ".primary", 3), 
  secondarySuit: Logic.variableBits(prefix + ".secondary", 3),
  suits: pipe(suits, RA.mapWithIndex((i, s) => [s, getZeroSuitContext(i)] as const), RR.fromFoldable(semigroup.first<SuitContext>(), RA.Foldable)),
})
const playerContextL = Lens.id<PlayerContext>()
const hcpRangeL = pipe(playerContextL, Lens.prop('hcpRange'))
const primarySuitL = pipe(playerContextL, Lens.prop('primarySuit'))
const secondarySuitL = pipe(playerContextL, Lens.prop('secondarySuit'))
const suitsL = pipe(playerContextL, Lens.prop('suits'))
const suitsA = At.at<PlayerContext, Suit, SuitContext>(i =>
  Lens.lens(
    flow(suitsL.get, p => p[i]),
    p => context => pipe(context, suitsL.get, RR.upsertAt(i, p), suitsL.set, apply(context))))

const suitsMatch = (playerSuits: PlayerContext["suits"]) => (pattern: SpecificShape) =>
  pipe(playerSuits,
    RR.toReadonlyArray,
    RA.map(([i, s0]) => pipe(pattern[i], Logic.constantBits, s1 => Logic.equalBits(s0, s1))),
    Logic.and)

interface PartnershipContext {
  trumpSuit: Logic.Bits
}
const getZeroPartnershipContext = (prefix: Logic.Term): PartnershipContext => ({
  trumpSuit: Logic.variableBits(prefix + ".trump", 3),
})
const partnershipContextL = Lens.id<PartnershipContext>()
const trumpSuitL = pipe(partnershipContextL, Lens.prop('trumpSuit'))

interface SATContext {
  force: Logic.Bits
  players: RR.ReadonlyRecord<RelativePlayer, PlayerContext>
  partnerships: RR.ReadonlyRecord<RelativePartnership, PartnershipContext>
}
const zeroSATContext: SATContext = {
  force: Logic.constantBits(0),
  players: pipe(relativePlayers, RA.mapWithIndex((i, p) => [p, getZeroPlayerContext(i)] as const), RR.fromFoldable(semigroup.first<PlayerContext>(), RA.Foldable)),
  partnerships: pipe(relativePartnerships, RA.mapWithIndex((i, p) => [p, getZeroPartnershipContext(i)] as const), RR.fromFoldable(semigroup.first<PartnershipContext>(), RA.Foldable))
}
const contextL = Lens.id<SATContext>()
const forceL = pipe(contextL, Lens.prop('force'))
const playersL = pipe(contextL, Lens.prop('players'))
const partnershipsL = pipe(contextL, Lens.prop('partnerships'))
const playersA = At.at<SATContext, RelativePlayer, PlayerContext>(i =>
  Lens.lens(
    flow(playersL.get, p => p[i]),
    p => context => pipe(context, playersL.get, RR.upsertAt(i, p), playersL.set, apply(context))))
const partnershipsA = At.at<SATContext, RelativePartnership, PartnershipContext>(i =>
  Lens.lens(
    flow(partnershipsL.get, p => p[i]),
    p => context => pipe(context, partnershipsL.get, RR.upsertAt(i, p), partnershipsL.set, apply(context))))

const toSAT = (c: Constraint): R.Reader<SATContext, Logic.Formula> => {
  switch (c.type) {
    case "Conjunction":
      return pipe(c.constraints, R.traverseArray(toSAT), R.map(Logic.and))
    case "Disjunction":
      return pipe(c.constraints, R.traverseArray(toSAT), R.map(Logic.or))
    case "Negation": 
      return pipe(c.constraint, toSAT, R.map(Logic.not))

    case "ForceOneRound":
    case "ForceGame":
    case "ForceSlam":
    case "Relay":
      return pipe(
        R.asks(forceL.get),
        R.map(f0 => pipe(c, getForcingBits, f =>
          Logic.lessThanOrEqual(f0, f))))
        
    case "SuitPrimary":
      return pipe(
        R.asks(pipe(playersA.at("Me"), Lens.compose(primarySuitL)).get),
        R.map(s0 => pipe(c.suit, getSuitBits, s =>
          Logic.equalBits(s0, s))))
    case "SuitSecondary":
      return pipe(R.Do,
        R.apS('p0', R.asks(pipe(playersA.at("Me"), Lens.compose(primarySuitL)).get)),
        R.apS('s0', R.asks(pipe(playersA.at("Me"), Lens.compose(secondarySuitL)).get)),
        R.map(({ p0, s0 }) => pipe(c.suit, getSuitBits, s =>
          Logic.and(
            Logic.equalBits(s0, s),
            Logic.not(Logic.equalBits(p0, s))))))

    case "SetTrump":
      return pipe(
        R.asks(pipe(partnershipsA.at("We"), Lens.compose(trumpSuitL)).get),
        R.map(s0 => pipe(c.suit, getSuitBits, s =>
          Logic.equalBits(s0, s))))

    case "PointRange":
      return pipe(
        R.asks(pipe(playersA.at("Me"), Lens.compose(hcpRangeL)).get),
        R.map(range(c.min, c.max)))
    case "SuitRange":
      return pipe(
        R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.suit)), Lens.compose(suitRangeL)).get),
        R.map(range(c.min, c.max)))

    case "SpecificShape":
      return pipe(
        R.asks(pipe(playersA.at("Me"), Lens.compose(suitsL)).get),
        R.map(flow(
          suitsMatch,
          apply(c.suits),
          andAlso(pipe(c.suits, countsTo13(RR.getFoldable(ord.trivial)))))))

    case "AnyShape":
      return pipe(
        R.asks(pipe(playersA.at("Me"), Lens.compose(suitsL)).get),
        R.map(flow(
          suitsMatch,
          RA.of,
          RA.ap(pipe(
            Array.from(permute(c.counts)),
            RA.map(flow(
              shape => RA.zip(suits, shape),
              RR.fromFoldable(semigroup.first<number>(), RA.Foldable),
              (suits: RR.ReadonlyRecord<Suit, number>) => suits)))),
          andAlso(pipe(c.counts, countsTo13(RA.Foldable))))))

    case "SuitComparison":
      return pipe(R.Do,
        R.apS('s1', R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.left)), Lens.compose(suitRangeL)).get)),
        R.apS('s2', R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.right)), Lens.compose(suitRangeL)).get)),
        R.map(({ s1, s2 }) => getComparer(c.op)(s1, s2)))

    case "Constant":
      return R.of(Logic.TRUE)

    case "SuitHonors":
    case "SuitTop":
      // do later
      return R.of(Logic.TRUE)

        
    default:
      return assertUnreachable(c)
  }
}

