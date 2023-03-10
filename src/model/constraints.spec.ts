import * as fc from 'fast-check';
import { boolean, option as O, readonlyArray as RA, readonlyRecord as RR, semigroup, these as TH, tree as T } from 'fp-ts';
import { constFalse, flow, pipe } from 'fp-ts/lib/function';

import { decodeBid } from '../parse';
import { parseBid } from '../parse/bid';
import * as tests from './constraints.testdata';
import { getOrdGroupedHand, groupHandBySuits, rankStrings } from './deck';
import { handA } from './deck.spec';
import { serializedBidL } from './serialization';
import { getForestFromLeafPaths, Path } from './system';
import { Constraint, satisfies } from './system/core';
import { expandForest, SyntacticBid } from './system/expander';
import { validateForest } from './system/validation';

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

describe('constraint propositions', () => {
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

describe('syntax propositions', () => {
  pipe(tests.syntaxPropositionTests,
    RR.mapWithIndex((name, { value, expected }) => {
      const sb: SyntacticBid = { bid: { level: 1, strain: "C" }, syntax: value }
      describe(name, () => {
        test("expands", () => {
          expect(expandSingleSyntacticBid(sb)._tag).toEqual("Some")
        })
        test("implies", () => fc.assert(
          fc.property(fc.context(), handA, (ctx, hand) => {
            ctx.log(encodeHand(hand))
            return pipe(sb,
              expandSingleSyntacticBid,
              O.fold(
                constFalse,
                c => boolean.BooleanAlgebra.implies(
                  satisfies(c)(hand),
                  satisfies(expected)(hand))))
        })))
      })
    }))
})

describe('expansion path validation', () => {
  pipe(tests.expansionPathValidTests,
    RR.mapWithIndex((name, { value, expected }) => {
      describe(name, () => {
        test("expands", () => {
          expect(pipe(value,
            expandSingleSyntacticBidPath,
            x => TH.getChain(semigroup.first<unknown>()).chain(x, validateForest),
            TH.isRight)).toEqual(expected)
        })
      })
    }))
})