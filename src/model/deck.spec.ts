import * as fc from 'fast-check';
import { readonlyArray, readonlySet } from 'fp-ts';
import { flow } from 'fp-ts/lib/function';
import { Card, cards, Deck, eqCard, Hand, ordCardDescending, Rank, ranks, Suit, suits } from './deck';


const suitA: fc.Arbitrary<Suit> =
  fc.constantFrom(...suits)
const rankA: fc.Arbitrary<Rank> = 
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
