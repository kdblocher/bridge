import * as fc from 'fast-check';
import { number, ord, readonlyArray, readonlyRecord, readonlySet } from 'fp-ts';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { MersenneTwister19937 } from 'random-js';

import { engine, eqCard, groupHandBySuits, newDeck, ordCardDescending } from './deck';
import { cardsWithSAandC2_A, clubTwo, handA, spadeAce } from './test-utils';

test('orders cards descending', () => fc.assert(
  fc.property(
    cardsWithSAandC2_A,
    flow(
      readonlyArray.sort(ordCardDescending),
      cs =>
        eqCard.equals(cs[0], spadeAce) &&
        eqCard.equals(cs[cs.length - 1], clubTwo)))))

test('grouping hands preserves count', () => fc.assert(
  fc.property(handA, hand =>
    pipe(hand,
      groupHandBySuits,
      readonlyRecord.foldMap(ord.trivial)(number.MonoidSum)(ranks => ranks.length),
      length => length === pipe(hand, readonlySet.toReadonlyArray(ord.trivial), x => x.length)))))

test('grouping and ungrouping returns same hand', () => fc.assert(
  fc.property(handA, hand =>
    pipe(hand,
      groupHandBySuits,
      readonlyRecord.foldMapWithIndex(ord.trivial)(readonlySet.getUnionMonoid(eqCard))((suit, ranks) =>
        pipe(ranks, readonlyArray.map(rank => ({ suit, rank })), readonlySet.fromReadonlyArray(eqCard))),
      hand2 => readonlySet.getEq(eqCard).equals(hand, hand2)))))

test('new deck every time', () =>
  fc.assert(
    fc.property(fc.constant(10000), fc.integer(), (count, seed) => {
      engine.engine = MersenneTwister19937.seed(seed)
      return pipe(readonlyArray.replicate(count, newDeck),
        readonlyArray.ap(readonlyArray.of(constVoid)),
        readonlySet.fromReadonlyArray(readonlyArray.getEq(eqCard)),
        readonlySet.toReadonlyArray(ord.trivial),
        x => x.length === count)
    }), { numRuns: 1 }))