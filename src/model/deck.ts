import { either, eq, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as t from 'io-ts';

export const shuffle = (nextRandom: () => number) => <T>(array: T[]): readonly T[] => {
  for (let i = 0; i < array.length; i++) {
    const r = i + (nextRandom() * (array.length - 1 - i));
    [array[i], array[r]] = [array[r], array[i]]
  }
  return array;
}

export const basicShuffle = shuffle(Math.random)

export type Suit = 'C' | 'D' | 'H' | 'S'
export const suits = ['C', 'D', 'H', 'S'] as const
export const eqSuit : eq.Eq<Suit> = eq.eqStrict
export const ordSuit : ord.Ord<Suit> = pipe(number.Ord, ord.reverse, ord.contramap(x => suits.indexOf(x)))

export const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
const RankB = t.brand(t.number, (i) : i is t.Branded<number, { readonly Rank: unique symbol }> => i >= 2 && i <= 14, 'Rank')
export const RankC = new t.Type('Rank', RankB.is, RankB.validate, r => ranks[r - 2])
export type Rank = t.TypeOf<typeof RankC>
export const eqRank : eq.Eq<Rank> = eq.eqStrict
export const ordRank : ord.Ord<Rank> = pipe(number.Ord, ord.reverse)

export interface Card {
  suit: Suit
  rank: Rank
}
export const cardToString = (c: Card) =>
  `${c.suit}${RankC.encode(c.rank)}`
export const eqCard : eq.Eq<Card> = eq.struct({
  suit: eqSuit,
  rank: eqRank
})
export const ordCard : ord.Ord<Card> = ord.getMonoid<Card>().concat(
  pipe(ordSuit, ord.contramap(c => c.suit)),
  pipe(ordRank, ord.contramap(c => c.rank))
)

export const cards: readonly Card[] = Array(52).map<Card>((_, i) => ({
  suit: suits[i / 13],
  rank: (RankC.decode(i % 13) as either.Right<Rank>).right
}))

export type Hand = ReadonlySet<Card>
export type GroupedHand = readonlyRecord.ReadonlyRecord<Suit, ReadonlyArray<Rank>>
export const getOrdGroupedHand = <T>() =>
  ord.contramap(([suit, _]: readonly [Suit, T]) => suit)(ordSuit)
export const zeroGroupedHand : GroupedHand = ({
  S: [],
  H: [],
  D: [],
  C: [],
})

export const groupHandBySuits = (hand: Hand) : GroupedHand =>
  pipe(hand,
    readonlySet.toReadonlyArray(ordCard),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(() => zeroGroupedHand, flow(
      readonlyNonEmptyArray.groupBy(c => c.suit),
      readonlyRecord.map(readonlyNonEmptyArray.map(c => c.rank)),
      readonlyRecord.union(readonlyArray.getUnionMonoid(eqRank))(zeroGroupedHand)
    )))

export type Deck = readonly Card[]

export const newDeck = () : Deck =>
  basicShuffle([...cards])