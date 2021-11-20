import { either as E, foldable, number, option as O, ord, reader as R, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, readonlyTuple as RT, semigroup, state as S } from 'fp-ts';
import { apply, constVoid, flow, identity, pipe } from 'fp-ts/lib/function';
import { Kind, URIS } from 'fp-ts/lib/HKT';
import * as Logic from 'logic-solver';
import * as At from 'monocle-ts/lib/At';
import * as Lens from 'monocle-ts/lib/Lens';
import memoize from 'proxy-memoize';

import { assertUnreachable } from '../../lib';
import { permute } from '../../lib/array';
import { eqSuit, Suit, suits } from '../deck';
import { SpecificShape } from '../evaluation';
import { Path } from '../system';
import { ConstrainedBid, Constraint, ConstraintForce, RelativePartnership, relativePartnerships, RelativePlayer, relativePlayers, rotateContexts, SuitComparisonOperator } from './core';

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

const getComparator = (op: SuitComparisonOperator) => {
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
  count: Logic.Bits
  // top: Logic.Bits
}
const getZeroSuitContext = (prefix: Logic.Term): SuitContext => ({
  count: Logic.variableBits(prefix + ".count", 6),
  // top: Logic.variableBits(prefix + ".top", 3)
})
const suitContextL = Lens.id<SuitContext>()
const suitCountL = pipe(suitContextL, Lens.prop('count'))
// const suitTopL = pipe(suitContextL, Lens.prop('top'))

const mySuitCountL = (suit: Suit) =>
  pipe(playersA.at("Me"), Lens.compose(suitsA.at(suit)), Lens.compose(suitCountL))

const suitCompare = (op: SuitComparisonOperator) => (left: Suit, right: Suit) =>
  pipe(R.Do,
    R.apS('l', R.asks(mySuitCountL(left).get)),
    R.apS('r', R.asks(mySuitCountL(right).get)),
    R.map(({ l, r }) => getComparator(op)(l, r)))

const suitRangesPrimary = (suit: Suit) =>
  pipe(suits,
    RA.splitAt(suits.indexOf(suit)),
    RT.bimap(
      flow(RA.tail,
        O.fold(() => [],
          RA.map(higher => suitCompare("<")(higher, suit)))),
      RA.map(lower => suitCompare("<=")(lower, suit))),
    RA.flatten,
    R.sequenceArray,
    R.chain(ops =>
      pipe(R.asks(mySuitCountL(suit).get),
        R.map(flow(range(5, 13), RA.prepend, apply(ops),
      Logic.and)))))

interface PlayerContext {
  hcp: Logic.Bits
  suits: RR.ReadonlyRecord<Suit, SuitContext>
  primarySuit: Logic.Bits
  secondarySuit: Logic.Bits
}
const getZeroPlayerContext = (prefix: Logic.Term): PlayerContext => ({
  hcp: Logic.variableBits(prefix + ".hcp", 6),
  suits: pipe(suits, RA.map(s => [s, getZeroSuitContext(prefix + "." + s)] as const), RR.fromFoldable(semigroup.first<SuitContext>(), RA.Foldable)),
  primarySuit: Logic.variableBits(prefix + ".primary", 3), 
  secondarySuit: Logic.variableBits(prefix + ".secondary", 3),
})
const playerContextL = Lens.id<PlayerContext>()
const hcpRangeL = pipe(playerContextL, Lens.prop('hcp'))
const primarySuitL = pipe(playerContextL, Lens.prop('primarySuit'))
const secondarySuitL = pipe(playerContextL, Lens.prop('secondarySuit'))
const suitsL = pipe(playerContextL, Lens.prop('suits'))
const suitsA = At.at<PlayerContext, Suit, SuitContext>(i =>
  Lens.lens(
    flow(suitsL.get, p => p[i]),
    p => context => pipe(context, suitsL.get, RR.upsertAt(i, p), suitsL.set, apply(context))))

const suitsMatch = (playerSuits: PlayerContext["suits"]) => (pattern: SpecificShape) =>
  pipe(playerSuits,
    RR.map(s => s.count),
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
  partnerships: pipe(relativePartnerships, RA.map(p => [p, getZeroPartnershipContext(p)] as const), RR.fromFoldable(semigroup.first<PartnershipContext>(), RA.Foldable))
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

const sat = (c: Constraint): R.Reader<SATContext, Logic.Formula> => {
  switch (c.type) {
    case "Conjunction":
      return pipe(c.constraints, R.traverseArray(sat), R.map(Logic.and))
    case "Disjunction":
      return pipe(c.constraints, R.traverseArray(sat), R.map(Logic.or))
    case "Negation": 
      return pipe(c.constraint, sat, R.map(Logic.not))

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
          Logic.equalBits(s0, s))),
        R.map(andAlso),
        R.ap(suitRangesPrimary(c.suit)))
    // case "SuitSecondary":
    //   return pipe(R.Do,
    //     R.apS('p0', R.asks(pipe(playersA.at("Me"), Lens.compose(primarySuitL)).get)),
    //     R.apS('s0', R.asks(pipe(playersA.at("Me"), Lens.compose(secondarySuitL)).get)),
    //     R.map(({ p0, s0 }) => pipe(c.suit, getSuitBits, s =>
    //       Logic.and(
    //         Logic.equalBits(s0, s),
    //         Logic.not(Logic.equalBits(p0, s))))),
    //     R.map(andAlso),
    //     R.ap(suit)

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
        R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.suit)), Lens.compose(suitCountL)).get),
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
          Logic.or,
          andAlso(pipe(c.counts, countsTo13(RA.Foldable))))))

    case "SuitComparison":
      return pipe(R.Do,
        R.apS('s1', R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.left)), Lens.compose(suitCountL)).get)),
        R.apS('s2', R.asks(pipe(playersA.at("Me"), Lens.compose(suitsA.at(c.right)), Lens.compose(suitCountL)).get)),
        R.map(({ s1, s2 }) => getComparator(c.op)(s1, s2)))

    case "Constant":
      return R.of(Logic.TRUE)

    case "SuitSecondary":
    case "SuitHonors":
    case "SuitTop":
      // do later
      return R.of(Logic.TRUE)

    default:
      return assertUnreachable(c)
  }
}

const stateFromReader = <X, A>(r: R.Reader<X, A>): S.State<X, A> =>
  c => [r(c), c]

const sumTo = (total: number) => flow(Logic.sum, sum => Logic.equalBits(sum, Logic.constantBits(total)))


const baseAssumptions = (context: SATContext) =>
  Logic.and(
    pipe(context, playersL.get, RR.map(hcpRangeL.get), RR.toReadonlyArray, RA.map(RT.snd), hcps =>
      Logic.and(
        pipe(hcps, sumTo(40)),
        pipe(hcps, RA.map(hcp => Logic.lessThanOrEqual(hcp, Logic.constantBits(37)))))),
    pipe(suits, RA.map(s =>
      pipe(context,
        playersL.get,
        RR.map(flow(suitsA.at(s).get, suitCountL.get)),
        RR.toReadonlyArray,
        RA.map(RT.snd),
        sumTo(13))),
      Logic.and))

export const pathIsSound = memoize((path: Path<ConstrainedBid>) => {
  const solver = new Logic.Solver()
  const context = zeroSATContext
  solver.require(baseAssumptions(context))
  const solve = (op: Logic.Operand) => {
    solver.require(op)
    return O.fromNullable(solver.solve())
  }
  return pipe(path,
    RNEA.traverseWithIndex(S.Applicative)((i, info) => pipe(
      info.constraint,
      sat,
      R.map(flow(solve, E.fromOption(() => pipe(path, RNEA.splitAt(i), RT.fst) as Path<ConstrainedBid>))),
      R.map(E.map(s => { console.log(s.getTrueVars()); return s })),
      stateFromReader,
      S.apFirst(S.modify(rotateContexts)))),
    S.map(flow(
      RNEA.sequence(E.Applicative),
      E.map(constVoid))),
    S.evaluate(context))
}, {
  size: 100
})