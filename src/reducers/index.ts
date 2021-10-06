import { ConstrainedBid, satisfies } from '../model/constraints'
import { either, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function'
import generator, { selectAllDeals } from './generator'
import selection, { selectHand } from './selection'
import system, { selectAllCompleteBidPaths, selectBidsByKey } from './system'

import { ContractBid } from '../model/bridge'
import { Hand } from '../model/deck'
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray'
import { RootState } from '../app/store'

const reducers = {
  system,
  selection,
  generator
}
export default reducers

function* alternate(opener: Hand, responder: Hand) {
  while (true) { yield opener; yield responder }
}

const unfold = (length: number) => <T>(g: Generator<T>) : readonly T[] => {
  const val = g.next()
  return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
}

const checkBidPath = (opener: Hand, responder: Hand) => (bids: ReadonlyArray<ConstrainedBid>) =>
  pipe(
    alternate(opener, responder),
    unfold(bids.length),
    readonlyArray.zip(bids),
    readonlyArray.every(([hand, bid]) => satisfies(hand)(bid.constraint)))

export const selectHandsSatisfySelectedPath = (state: RootState) =>
  pipe(option.Do,
    option.apS('blockKey', state.selection.selectedBlockKey),
    option.apS('opener', selectHand(state.selection, 'opener')),
    option.apS('responder', selectHand(state.selection, 'responder')),
    option.chain(o => pipe(either.Do,
      either.apS('bids', selectBidsByKey(state.system, o.blockKey)),
      either.map(e => checkBidPath(o.opener, o.responder)(e.bids)),
      option.fromEither)),
    option.toNullable)

interface BidResult {
  path: ReadonlyNonEmptyArray<ConstrainedBid>
  result: boolean
}
export const selectPathsSatisfyHands = (state: RootState) =>
  pipe(option.Do,
    option.apS('opener', selectHand(state.selection, 'opener')),
    option.apS('responder', selectHand(state.selection, 'responder')),
    option.map(o => pipe(
      selectAllCompleteBidPaths(state.system),
      readonlyArray.map<ReadonlyNonEmptyArray<ConstrainedBid>, BidResult>(path => ({
        path,
        result: checkBidPath(o.opener, o.responder)(path)
      })))),
    option.toNullable)

interface BidCountResult {
  path: ReadonlyNonEmptyArray<ConstrainedBid>
  count: number
}
const ordStats = pipe(
  number.Ord,
  ord.reverse,
  ord.contramap<number, BidCountResult>(r => r.count))

export const selectSatisfyStats = (state: RootState) : ReadonlyArray<BidCountResult> | null =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('deal', selectAllDeals(state.generator)),
    readonlyArray.apS('path', selectAllCompleteBidPaths(state.system)),
    readonlyArray.map(ra => ({
      path: ra.path,
      result: checkBidPath(ra.deal[0], ra.deal[1])(ra.path)
    })),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.map(
      flow(
        readonlyNonEmptyArray.groupBy(x =>
          pipe(x.path,
            readonlyArray.map(p => p.bid as ContractBid),
            readonlyArray.foldMap(string.Monoid)(b => `${b.level}${b.strain}`))),
        readonlyRecord.map(r => ({
          path: r[0].path,
          count: pipe(r, readonlyArray.filter(a => a.result)).length
        })),
        readonlyRecord.toReadonlyArray,
        readonlyArray.map(readonlyTuple.snd),
        readonlyArray.sort(ordStats))),
    option.toNullable)