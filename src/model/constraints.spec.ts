import * as fc from 'fast-check';
import { boolean, option as O, readonlyArray as RA, readonlyRecord as RR, semigroup, these as TH, tree as T } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { decodeBid } from '../parse';
import { parseBid } from '../parse/bid';
import * as tests from './constraints.testdata';
import { getOrdGroupedHand, groupHandBySuits, rankStrings } from './deck';
import { serializedBidL } from './serialization';
import { getForestFromLeafPaths, Path } from './system';
import { Constraint, satisfies } from './system/core';
import { expandForest, SyntacticBid } from './system/expander';
import { satisfiesPath } from './system/satisfaction';
import { validateForest } from './system/validation';
import { dealA, handA } from './test-utils';

fc.configureGlobal({ numRuns: 1000 })

const expandSingleSyntacticBid = (bid: SyntacticBid) =>
  pipe(bid,
    T.of,
    RA.of,
    expandForest,
    TH.getRight,
    O.map(x => x[0].value.constraint))

const expandSingleBid = (bid: string) =>
  pipe(bid,
    O.of,
    O.chain(O.fromEitherK(decodeBid)),
    O.chain(expandSingleSyntacticBid))

const expandSingleSyntacticBidPath = (path: Path<SyntacticBid>) =>
  pipe(path,
    RA.of,
    getForestFromLeafPaths({ show: sb => serializedBidL.get(sb.bid) }),
    expandForest)

const encodeHand = flow(
  groupHandBySuits,
  RR.toReadonlyArray,
  RA.sort(getOrdGroupedHand()),
  RA.map(([suit, ranks]) => suit + pipe(pipe(ranks, RA.map(rank => rankStrings[rank - 2])).join(""), s => s === "" ? "-" : s)),
  x => x.join(" "))

describe('decode', () => {
  pipe(tests.decodeTests,
    RR.mapWithIndex((name, { value, expected }) => {
      const bid = "1C: " + value
      describe(name, () => {
        test("parses", () => {
          expect(parseBid(bid).errs).toHaveLength(0)
        })
        test("expands", () => {
          expect(expandSingleBid(bid)._tag).toEqual("Some")
        })
        test("implies", () => {
          expect(pipe(expandSingleBid(bid))).toStrictEqual<O.Option<Constraint>>(O.of(expected))
        })
      })
    }))
})

describe('constraint implications (compact)', () => {
  pipe(tests.constraintPropCompactTests,
    RR.mapWithIndex((name, [value, expected]) =>
      test(name, () => {
        const x = pipe(O.Do,
          O.bind("value", () => expandSingleBid("1C: " + value)),
          O.bind("expected", () => expandSingleBid("1C: " + expected)))
        if (O.isNone(x)) {
          fail("failed to parse")
        } else {
          fc.assert(
            fc.property(fc.context(), handA, (ctx, hand) => {
              ctx.log(encodeHand(hand))
              return boolean.BooleanAlgebra.implies(
                satisfies(x.value.value)(hand),
                satisfies(x.value.expected)(hand))
            }))
        }
    })))
})

describe('constraint implications', () => {
  pipe(tests.constraintPropositionTests,
    RR.mapWithIndex((name, { value, expected }) => {
      test(name, () => fc.assert(
        fc.property(fc.context(), handA, (ctx, hand) => {
          ctx.log(encodeHand(hand))
          boolean.BooleanAlgebra.implies(
            satisfies(value)(hand),
            satisfies(expected)(hand))
        })))
    }))
})

describe('constraint equivalencies', () => {
  pipe(tests.syntaxPropCompactTests,
    RR.mapWithIndex((name, [value, expected]) =>
    test(name, () => {
      const x = pipe(O.Do,
        O.bind("value", () => expandSingleBid("1C: " + value)),
        O.bind("expected", () => expandSingleBid("1C: " + expected)))
      if (O.isNone(x)) {
        fail("failed to parse")
      } else {
        fc.assert(
          fc.property(fc.context(), handA, (ctx, hand) => {
            ctx.log(encodeHand(hand))
            return satisfies(x.value.value)(hand) === satisfies(x.value.expected)(hand)
          }))
      }
  })))
})

describe('partnership overlaps', () => {
  pipe(tests.partnershipOverlappingTestsFalse,
    RR.mapWithIndex((name, [north, south]) =>
      test(name, () => {
        const x = pipe(O.Do,
          O.bind("north", () => expandSingleBid("1C: " + north)),
          O.bind("south", () => expandSingleBid("1D: " + south)))
        if (O.isNone(x)) {
          fail("failed to parse")
        } else {
          fc.assert(
            fc.property(fc.context(), dealA, (ctx, deal) => {
              ctx.log(encodeHand(deal.N))
              ctx.log(encodeHand(deal.S))
              return !satisfiesPath(deal.N, deal.S)([
                {bid: {level: 1, strain: "C"}, constraint: x.value.north},
                {bid: {level: 1, strain: "D"}, constraint: x.value.south},
              ]);
            }))
        }
    })))
})