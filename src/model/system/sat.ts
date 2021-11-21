import { either as E, foldable, number, option as O, ord, reader as R, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, readonlyTuple as RT, semigroup, show, state as S } from 'fp-ts';
import { apply, constVoid, flip, flow, identity, pipe } from 'fp-ts/lib/function';
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
import { ConstrainedBid, Constraint, RelativePartnership, relativePartnerships, RelativePlayer, relativePlayers, rotateContexts, SuitComparisonOperator } from './core';

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

const mapArrayToContext = <X>(getZero: (prefix: Logic.Term) => X) => <A>(s: show.Show<A>) => (init: ReadonlyArray<A>) =>
  pipe(init,
    RA.map(s.show),
    RA.map(s => [s, getZero(s)] as const),
    RR.fromFoldable(semigroup.first<X>(), RA.Foldable))

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

const suitPrimary = (primarySuit: Suit) =>
  pipe([
    pipe(R.asks(pipe(playersA.at("Me"), Lens.compose(primarySuitL)).get),
      R.map(s0 => pipe(primarySuit, getSuitBits, s =>
        Logic.equalBits(s0, s)))),
    pipe(R.asks(mySuitCountL(primarySuit).get),
      R.map(range(5, 13))),
    ...pipe(suits,
      RA.splitAt(suits.indexOf(primarySuit)),
      RT.bimap(
        flow(RA.tail,
          O.fold(() => [],
            RA.map(higher => suitCompare("<")(higher, primarySuit)))),
        RA.map(lower => suitCompare("<=")(lower, primarySuit))),
      RA.flatten)
  ],
  R.sequenceArray,
  R.map(Logic.and))

const suitSecondary = (secondarySuit: Suit) =>
  pipe(R.Do,
    R.apS('primarySuit', R.asks(pipe(playersA.at("Me"), Lens.compose(primarySuitL)).get)),
    R.apS('secondarySuit', R.asks(pipe(playersA.at("Me"), Lens.compose(secondarySuitL)).get)),
    R.apS('secondarySuitCount', R.asks(mySuitCountL(secondarySuit).get)),
    R.chain(o =>
      pipe(suits, RA.map(primarySuit =>
        pipe(R.Do,
          R.apS('primarySuitCount', R.asks(mySuitCountL(primarySuit).get)),
          R.map(p =>
            Logic.implies(
              Logic.equalBits(getSuitBits(primarySuit), o.primarySuit),
              Logic.and(
                Logic.not(Logic.equalBits(o.primarySuit, o.secondarySuit)),
                Logic.greaterThanOrEqual(p.primarySuitCount, o.secondarySuitCount)))))),
        R.sequenceArray,
        R.map(RA.concat([
          Logic.equalBits(getSuitBits(secondarySuit), o.secondarySuit),
          Logic.not(Logic.equalBits(o.primarySuit, o.secondarySuit)),
          range(4, 13)(o.secondarySuitCount)
        ])))),
    R.map(Logic.and))

interface PlayerContext {
  hcp: Logic.Bits
  suits: RR.ReadonlyRecord<Suit, SuitContext>
  primarySuit: Logic.Bits
  secondarySuit: Logic.Bits
}
const getZeroPlayerContext = (prefix: Logic.Term): PlayerContext => ({
  hcp: Logic.variableBits(prefix + ".hcp", 6),
  suits: pipe(suits, mapArrayToContext(s => getZeroSuitContext(prefix + "." + s))({ show: identity })),
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

interface GlobalSuitContext {
  hcp: Logic.Bits
}
const getZeroGlobalSuitContext = (prefix: Logic.Term): GlobalSuitContext => ({
  hcp: Logic.constantBits(10)
})

interface SATContext {
  // force: Logic.Bits
  suits: RR.ReadonlyRecord<Suit, GlobalSuitContext>
  players: RR.ReadonlyRecord<RelativePlayer, PlayerContext>
  partnerships: RR.ReadonlyRecord<RelativePartnership, PartnershipContext>
}

const zeroSATContext: SATContext = {
  // force: Logic.constantBits(0),
  suits: pipe(suits, mapArrayToContext(getZeroGlobalSuitContext)({ show: identity })),
  players: pipe(relativePlayers, mapArrayToContext(getZeroPlayerContext)({ show: identity })),
  partnerships: pipe(relativePartnerships, mapArrayToContext(getZeroPartnershipContext)({ show: identity }))
}
const contextL = Lens.id<SATContext>()
// const forceL = pipe(contextL, Lens.prop('force'))
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

    // case "ForceOneRound":
    // case "ForceGame":
    // case "ForceSlam":
    // case "Relay":
    //   return pipe(
    //     R.asks(forceL.get),
    //     R.map(f0 => pipe(c, getForcingBits, f =>
    //       Logic.lessThanOrEqual(f0, f))))
        
    case "SuitPrimary":
      return suitPrimary(c.suit)
    case "SuitSecondary":
      return suitSecondary(c.suit)

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

    case "SuitHonors":
    case "SuitTop":
      // do later
      return R.of(Logic.TRUE)

    default:
      return assertUnreachable(c)
  }
}

const values = flow(RR.toReadonlyArray, RA.map(RT.snd))

const stateFromReader = <X, A>(r: R.Reader<X, A>): S.State<X, A> =>
  c => [r(c), c]

const sumTo = (total: number) => flow(Logic.sum, sum => Logic.equalBits(sum, Logic.constantBits(total)))

const baseAssumptions = (context: SATContext) =>
  pipe([
    pipe(context, playersL.get, RR.map(hcpRangeL.get), values, hcps =>
      [ pipe(hcps, sumTo(40)),
        ...pipe(hcps, RA.map(hcp => Logic.lessThanOrEqual(hcp, Logic.constantBits(37)))) ]),
    pipe(suits, RA.map(s =>
      pipe(context,
        playersL.get,
        RR.map(flow(suitsA.at(s).get, suitCountL.get)),
        values,
        sumTo(13)))),
    pipe(context, playersL.get, RR.map(suitsL.get), values, RA.map(flow(values, RA.map(suitCountL.get), sumTo(13))))
  ],
  RA.flatten,
  Logic.and)

function* allSolutions(solver: Logic.Solver) {
  let result = solver.solve()
  while (result !== null) {
    yield result
    solver.forbid(result.getFormula())
    result = solver.solve()
  }
}

function* take<T>(generator: Generator<T>, n: number) {
  for (var i = 0; i < n; i++) {
    let v = generator.next()
    if (!v.done) {
      yield v.value
    } else {
      break
    }
  }
}

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
      stateFromReader,
      S.apFirst(S.modify(rotateContexts)))),
    S.map(flow(
      RNEA.sequence(E.Applicative),
      E.map(() => {
        pipe(Array.from(take(allSolutions(solver), 10)),
          RA.map(x => x.getTrueVars()),
          console.log)
        return constVoid()
      }))),
    S.evaluate(context))
}, {
  size: 100
})