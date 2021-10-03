import { either, option, readonlyArray } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function'
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray'
import { RootState } from '../app/store'
import { ConstrainedBid, satisfies } from '../model/constraints'
import { Hand } from '../model/deck'
import selection, { selectHand } from './selection'
import system, { selectAllCompleteBidPaths, selectBidsByKey } from './system'

const reducers = {
  system,
  selection
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
        path: path,
        result: checkBidPath(o.opener, o.responder)(path)
      })))),
    option.toNullable)