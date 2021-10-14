import * as fc from 'fast-check';
import { readonlyArray } from 'fp-ts';
import { flow } from 'fp-ts/lib/function';
import { Card, cards, Deck, eqCard, ordCardDescending, Rank, ranks, Suit, suits } from './deck';

const suitA: fc.Arbitrary<Suit> =
  fc.constantFrom(...suits)
const rankA: fc.Arbitrary<Rank> = 
  fc.constantFrom(...ranks)
const cardA: fc.Arbitrary<Card> =
  fc.tuple(suitA, rankA)
    .map(([suit,  rank ]) =>
         ({suit,  rank }))
const cardsA: fc.Arbitrary<ReadonlyArray<Card>> =
  fc.array(cardA)

const spadeAce: Card = { suit: "S", rank: ranks[0] }
const clubTwo: Card = { suit: "C", rank: ranks[ranks.length - 1] }
const cardsWithSAandC2_A =
  cardsA.map(readonlyArray.union(eqCard)([spadeAce, clubTwo]))

const deckA: fc.Arbitrary<Deck> =
  fc.constant(cards)

test('orders cards descending', () => fc.assert(
  fc.property(
    cardsWithSAandC2_A,
    flow(
      readonlyArray.sort(ordCardDescending),
      cs =>
        eqCard.equals(cs[0], spadeAce) &&
        eqCard.equals(cs[cs.length - 1], clubTwo)))))
