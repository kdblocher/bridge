import { either, option, predicate, readonlyArray, readonlyNonEmptyArray, separated } from 'fp-ts';
import { tailRec } from 'fp-ts/lib/ChainRec';
import { constFalse, pipe } from 'fp-ts/lib/function';

import { deal } from './bridge';
import { satisfiesPath } from './constraints';
import { Hand, newDeck } from './deck';
import { BidPath } from './system';

export const genUntilCondition = (limit: option.Option<number>) => (condition: predicate.Predicate<readonly [Hand, Hand]>) =>
  tailRec(limit, l => {
    if (pipe(l, option.fold(constFalse, i => i === 0))) {
      return either.right(option.none)
    } else {
      const d = deal(newDeck())
      const hands = [d.N, d.S] as const
      const result = condition(hands)
      return result
        ? either.right(option.some(hands))
        : either.left(pipe(l, option.map(i => i - 1)))
    }
  })

export const genMatchingOf = (length: predicate.Predicate<number>) => (paths: readonlyNonEmptyArray.ReadonlyNonEmptyArray<BidPath>) =>
  genUntilCondition(option.some(10000))(hands =>
    pipe(paths,
      readonlyArray.partition(satisfiesPath(...hands)),
      separated.right,
      x => length(x.length)))