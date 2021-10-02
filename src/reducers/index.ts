import { either, option, readonlyArray } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function'
import { RootState } from '../app/store'
import { ConstrainedBid, satisfies } from '../model/constraints'
import { Hand } from '../model/deck'
import selection from './selection'
import system, { selectBids } from './system'

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

const walkNodesWithHands = (opener: Hand, responder: Hand) => (bids: ReadonlyArray<ConstrainedBid>) =>
  pipe(
    alternate(opener, responder),
    unfold(bids.length),
    readonlyArray.zip(bids),
    readonlyArray.every(([hand, bid]) => satisfies(hand)(bid.constraint)))

export const selectHandsSatisfySelectedPath = (state: RootState) =>
  pipe(option.Do,
    option.apS('blockKey', state.selection.selectedBlockKey),
    option.apS('opener', option.fromNullable(state.selection.opener)),
    option.apS('responder', option.fromNullable(state.selection.responder)),
    option.chain(o => pipe(either.Do,
      either.apS('opener', o.opener),
      either.apS('responder', o.responder),
      either.apS('bids', selectBids(state.system, o.blockKey)),
      either.map(e => walkNodesWithHands(e.opener, e.responder)(e.bids)),
      option.fromEither)),
    option.toNullable)

  // pipe(state.selection.selectedBlockKey,
  //   option.map(blockKey => selectBids(state.system, blockKey)),
  //   option.chain(option.fromEither),
  //   option.map(walkNodesWithHands(state.selection.opener))