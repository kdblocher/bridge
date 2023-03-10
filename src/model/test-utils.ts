import * as fc from 'fast-check';
import { readonlyArray, readonlySet } from 'fp-ts';

import { Card, cards, Deck, eqCard, Hand, Rank, ranks, Suit, suits } from './deck';

export const suitA: fc.Arbitrary<Suit> =
  fc.constantFrom(...suits)
export const rankA: fc.Arbitrary<Rank> = 
  fc.constantFrom(...ranks)
export const cardA: fc.Arbitrary<Card> =
  fc.tuple(suitA, rankA)
    .map(([suit,  rank ]) =>
         ({suit,  rank }))
export const cardsA: fc.Arbitrary<ReadonlyArray<Card>> =
  fc.set(cardA, { compare: eqCard.equals })

export const handA : fc.Arbitrary<Hand> =
  fc.set(cardA, { minLength: 13, maxLength: 13, compare: eqCard.equals })
    .map(readonlySet.fromReadonlyArray(eqCard))

export const spadeAce: Card = { suit: "S", rank: ranks[ranks.length - 1] }
export const clubTwo: Card = { suit: "C", rank: ranks[0] }
export const cardsWithSAandC2_A =
  cardsA.map(readonlyArray.union(eqCard)([spadeAce, clubTwo]))

export const deckA: fc.Arbitrary<Deck> =
  fc.constant(cards).chain(cards => fc.shuffledSubarray([...cards], { minLength: cards.length, maxLength: cards.length })) as unknown as fc.Arbitrary<Deck>