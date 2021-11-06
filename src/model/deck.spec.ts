import * as fc from 'fast-check';
import { applicative, apply, eq, number, ord, readonlyArray, readonlyRecord, readonlySet } from 'fp-ts';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { MersenneTwister19937, nativeMath } from 'random-js';

import { eqDeal } from './bridge';
import { Card, cards, Deck, engine, eqCard, eqRank, groupHandBySuits, Hand, newDeck, ordCardDescending, Rank, ranks, Suit, suits } from './deck';

export const suitA: fc.Arbitrary<Suit> =
  fc.constantFrom(...suits)
export const rankA: fc.Arbitrary<Rank> = 
  fc.constantFrom(...ranks)
export const cardA: fc.Arbitrary<Card> =
  fc.tuple(suitA, rankA)
    .map(([suit,  rank ]) =>
         ({suit,  rank }))
export const cardsA: fc.Arbitrary<ReadonlyArray<Card>> =
  fc.array(cardA)

export const handA : fc.Arbitrary<Hand> =
  fc.array(cardA, { minLength: 13, maxLength: 13 })
    .map(readonlySet.fromReadonlyArray(eqCard))

const spadeAce: Card = { suit: "S", rank: ranks[ranks.length - 1] }
const clubTwo: Card = { suit: "C", rank: ranks[0] }
const cardsWithSAandC2_A =
  cardsA.map(readonlyArray.union(eqCard)([spadeAce, clubTwo]))

export const deckA: fc.Arbitrary<Deck> =
  fc.constant(cards).chain(cards => fc.shuffledSubarray([...cards], { minLength: cards.length, maxLength: cards.length })) as unknown as fc.Arbitrary<Deck>

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