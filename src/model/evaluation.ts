import { eq, number, option, ord, readonlyArray, readonlyRecord, readonlySet, readonlyTuple, semigroup } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { groupHandBySuits, Hand, ordCardDescending, Rank, Suit } from './deck';

export const getRankHcp = (rank: Rank) =>
  Math.max(0, rank - 10)

export const getHcp =
  flow(
    readonlySet.toReadonlyArray(ordCardDescending),
    readonlyArray.foldMap(number.MonoidSum)(c => getRankHcp(c.rank)))

export type AnyShape = readonly [number, number, number, number]
export const zeroShape: AnyShape = [0, 0, 0, 0]
export const sortShape = (s: AnyShape) => pipe(s, readonlyArray.sort(ord.reverse(number.Ord))) as AnyShape
export const makeShape = (...counts: AnyShape) =>
  pipe(counts, sortShape)
export const eqShape : eq.Eq<AnyShape> =
  eq.contramap(sortShape)(readonlyArray.getEq(number.Eq))

export type SpecificShape = Record<Suit, number>
export const makeSpecificShape = (s: number, h: number, d: number, c: number) : SpecificShape => ({
  S: s,
  H: h,
  D: d,
  C: c
})
export const zeroSpecificShape = makeSpecificShape(0, 0, 0, 0)

export const getHandSpecificShape = (hand: Hand) : SpecificShape =>
  pipe(hand,
    groupHandBySuits,
    readonlyRecord.map(x => x.length),
    readonlyRecord.union(semigroup.first<number>())(zeroSpecificShape),
    (suits: readonlyRecord.ReadonlyRecord<Suit, number>) => suits)

export const getHandShape = (hand: Hand) : AnyShape =>
  pipe(hand,
    getHandSpecificShape,
    readonlyRecord.toReadonlyArray,
    readonlyArray.map(readonlyTuple.snd),
    suitCounts => readonlyArray.mapWithIndex((idx, _) =>
      pipe(suitCounts, readonlyArray.lookup(idx), option.getOrElse(() => 0)))(zeroShape)) as AnyShape